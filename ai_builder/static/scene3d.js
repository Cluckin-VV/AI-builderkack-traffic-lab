import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const { createAtmosphere, createCity, createBusStopDistrict, batchStaticCity, loadVehicleAssets } = await import(
  new URL("./urban-world.js" + new URL(import.meta.url).search, import.meta.url).href
);
const { TrafficController, MAX_VEHICLES } = await import(new URL("./traffic-controller.mjs" + new URL(import.meta.url).search, import.meta.url).href);
const { WeatherView } = await import(new URL("./weather-view.js" + new URL(import.meta.url).search, import.meta.url).href);
const { qualityProfile, CAMERA_PROFILES } = await import(new URL("./atmosphere-profile.mjs" + new URL(import.meta.url).search, import.meta.url).href);
const layoutResponse = await fetch("/assets/scene-layouts.json" + new URL(import.meta.url).search);
if (!layoutResponse.ok) throw new Error(`Scene layout manifest: HTTP ${layoutResponse.status}`);
const layoutDefinitions = await layoutResponse.json();
// A steeper oblique keeps the near-corner roofs from hiding the actual junction.
const DEFAULT_CAMERA = CAMERA_PROFILES.bird;
const BRAKING_REASONS = new Set([
  "red_light", "yellow_light", "approaching_red_light", "approaching_yellow_light",
  "following", "station_dwell", "manual_stop", "braking_for_stop",
]);

function mesh(geometry, material, cast = false, receive = false) {
  const value = new THREE.Mesh(geometry, material);
  value.castShadow = cast;
  value.receiveShadow = receive;
  return value;
}

function box(width, height, depth, color, options = {}) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.74,
    metalness: options.metalness ?? 0.04,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
  });
  return mesh(new THREE.BoxGeometry(width, height, depth), material, options.cast ?? true, options.receive ?? true);
}

function createSignalBadge(movement) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(1.65, 0.34),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
  );
  panel.position.set(0, 8.35, 0.48);
  panel.userData.movement = movement;
  return { canvas, context, texture, panel };
}

function updateSignalBadge(signal, value) {
  const { context, texture, canvas, panel } = signal.badge;
  const status = value === "绿灯" ? "GO" : value === "黄灯" ? "CAUTION" : "STOP";
  const accent = value === "绿灯" ? "#5ee3b2" : value === "黄灯" ? "#ffd166" : "#ff766e";
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(7, 17, 15, .94)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = accent;
  context.lineWidth = 5;
  context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  context.fillStyle = "#f2f6ee";
  context.font = "700 31px ui-monospace, SFMono-Regular, Consolas, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  const movementLabel = { left: "LEFT ↰", straight: "THRU ↑", right: "RIGHT ↱" }[panel.userData.movement];
  context.fillText(`${movementLabel}  ${status}`, canvas.width / 2, canvas.height / 2 + 1);
  texture.needsUpdate = true;
}

export class TransitWorld {
  constructor(container, onFailure) {
    this.container = container;
    this.onFailure = onFailure;
    this.vehicles = [];
    this.traffic = new TrafficController();
    this.visualPaused = false;
    this.quality='balanced';
    this.frameSamples=[];
    this.lastRenderReport=performance.now();
      this.lastTime = performance.now();
      this.spherical = { ...DEFAULT_CAMERA };
      this.target = new THREE.Vector3(0, 2.5, 0);
    this.pointer = null;
    this.signalGroups = { EW: [], NS: [] };
    this.signalHeads = [];
    this.lastTrafficEvent = 0;
    this.activeLayout = 'crossroads';
    this.layoutDefinitions = layoutDefinitions;
    this.cameraMode = 'bird';
    this.districts = new Map();

    try {
      this.setupRenderer();
      this.setupScene();
      this.container.dataset.busAsset = "loading";
      this.assetReady = loadVehicleAssets().then(templates => {
        this.vehicleTemplates = templates;
        this.applyVehicleQuality();
        for (const vehicle of this.vehicles) this.attachVehicleTemplate(vehicle);
        this.container.dataset.busAsset = "ready";
      }).catch(error => {
        this.container.dataset.busAsset = "failed";
        console.error("Bus asset failed", error);
      });
      this.setupControls();
      document.addEventListener('visibilitychange', () => {
        // Background throttling is not foreground rendering performance.
        this.lastTime = performance.now();
        this.lastRenderReport = this.lastTime;
        this.frameSamples = [];
      });
      for(const eventName of ['focus','blur']) window.addEventListener(eventName, () => {
        this.lastTime=performance.now();
        this.lastRenderReport=this.lastTime;
        this.frameSamples=[];
      });
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
      this.resize();
      this.animate();
    } catch (error) {
      onFailure(error);
    }
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualityProfile(this.quality).pixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    this.container.append(this.renderer.domElement);
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    this.updateCamera();
    createAtmosphere(this);
    const district = new THREE.Group(); this.scene.add(district);
    const layouts = this.layoutDefinitions ?? {};
    createCity(this, district, layouts.crossroads ?? {});
    batchStaticCity(district);
    this.districts.set('crossroads', {group:district, groundMaterial:this.groundMaterial, roadMaterial:this.roadMaterial, wetRoads:this.wetRoads,snowSurfaces:this.snowSurfaces, architecturalLights:this.architecturalLights});
    this.weatherView = new WeatherView(this);
    this.createSignals();
  }

  createSignals() {
    const junction = this.layoutDefinitions?.crossroads?.junction;
    if (!junction?.approaches) return;
    for (const approach of ["W", "E", "S", "N"]) this.createSignal(approach, junction.approaches[approach], junction);
  }

  createSignal(approach, definition, junction) {
    const group = new THREE.Group();
    const [x, z] = definition.pole_position;
    const yaw = definition.signal_yaw;
    const [fx, fz] = definition.forward;
    const [rx, rz] = definition.right;
    const poleAlong = x * fx + z * fz;
    const poleLateral = x * rx + z * rz;
    group.position.set(x, 0, z);
    group.rotation.y = yaw;

    const pole = box(0.36, 8.2, 0.36, 0x243734, { metalness: 0.54, roughness: 0.42 });
    pole.position.y = 4.1;
    group.add(pole);

    const offsets = junction.lane_offsets;
    const laneOffsets = [offsets.left, offsets.straight, offsets.right];
    const reach = poleLateral - Math.min(...laneOffsets);
    const arm = box(reach + 1.0, 0.24, 0.24, 0x243734, { metalness: 0.54, roughness: 0.42 });
    arm.position.set((reach + 1.0) / 2, 7.85, 0);
    group.add(arm);

    const base = box(1.2, 0.28, 1.2, 0x253a34, { metalness: 0.18 });
    base.position.y = 0.15;
    group.add(base);
    this.scene.add(group);

    const axis = definition.axis;
    for (const [movement, lane] of [["left", "left"], ["straight", "straight"], ["right", "right"]]) {
      const targetLateral = offsets[lane];
      const targetAlong = junction.stop_line_s + 1.5;
      const localX = poleLateral - targetLateral;
      const localZ = poleAlong - targetAlong;
      const head = new THREE.Group();
      head.position.set(localX, 0, localZ);
      group.add(head);
      const housing = box(0.96, 2.75, 0.68, 0x101918, { metalness: 0.25, roughness: 0.55 });
      housing.position.y = 6.38;
      head.add(housing);
      const badge = createSignalBadge(movement);
      head.add(badge.panel);
      const lamps = {};
      const lampGeometry = new THREE.SphereGeometry(0.245, 18, 12);
      const lampConfig = [["红灯", 0xff3438, 7.22], ["黄灯", 0xffbd32, 6.38], ["绿灯", 0x27e879, 5.54]];
      for (const [name, color, y] of lampConfig) {
        const material = new THREE.MeshStandardMaterial({
          color: 0x101714, emissive: color, emissiveIntensity: 0.018, roughness: 0.30, toneMapped: false,
        });
        const lamp = mesh(lampGeometry, material);
        lamp.position.set(0, y, 0.37);
        lamps[name] = lamp;
        head.add(lamp);
        const visor = box(0.59, 0.09, 0.35, 0x080e0d, { roughness: 0.55 });
        visor.position.set(0, y + 0.27, 0.33);
        head.add(visor);
      }
      const record = { group, head, lamps, badge, axis, approach, movement, groupKey: `${axis}_${movement === "left" ? "LEFT" : "THROUGH"}` };
      this.signalGroups[axis].push(record);
      this.signalHeads.push(record);
      this.setSignalHead(record, "红灯");
    }
  }

  createVehicle(descriptor) {
    const group = new THREE.Group();
    if (this.vehicleTemplates?.[descriptor.type]) group.add(this.vehicleTemplates[descriptor.type].clone(true));
    else {
      const dimensions = descriptor.type === 'bus' ? [9.5,3.06,3.264] : descriptor.type === 'suv' ? [4.95,2.30,1.818] : [4.65,2.18,1.47];
      const placeholder = box(dimensions[0], dimensions[2], dimensions[1], descriptor.type === 'bus' ? 0xd7ddd8 : descriptor.type === 'suv' ? 0x315c42 : 0x245f92);
      placeholder.position.y = dimensions[2] / 2;
      group.add(placeholder);
    }
    group.scale.setScalar(0.01);
    group.userData.targetScale = 1;
    this.scene.add(group);
    const vehicle={id:descriptor.id,type:descriptor.type,group,wheelGroups:[],wheelPivots:new Map(),brakeLights:[],lastS:null,
      model:null,bodyDynamics:{wheelSpin:0,steeringAngle:0,pitch:0,roll:0,previousSpeed:0,previousYaw:null}};
    if(this.vehicleTemplates?.[descriptor.type])this.attachVehicleTemplate(vehicle);
    return vehicle;
  }

  attachVehicleTemplate(vehicle) {
    for(const child of [...vehicle.group.children]) {
      vehicle.group.remove(child);child.geometry?.dispose();
      if(Array.isArray(child.material))child.material.forEach(material=>material.dispose());else child.material?.dispose();
    }
    const model=this.vehicleTemplates[vehicle.type].clone(true);
    vehicle.wheelGroups=[];vehicle.wheelPivots=new Map();vehicle.brakeLights=[];vehicle.model=model;
    model.traverse(child=>{
      if(child.userData.vehicleWheelId){child.userData.wheelRadius=model.userData.wheelRadius;vehicle.wheelGroups.push(child);vehicle.wheelPivots.set(child.userData.vehicleWheelId,child);}
      if(child.userData.component==='brake_lamp'){
        child.material=child.material.clone();child.material.emissiveIntensity=.12;vehicle.brakeLights.push(child);
      }
    });
    vehicle.groundOffset=model.userData.groundOffset;
    vehicle.group.add(model);
  }

  setVehicles(descriptors) {
    const requested = descriptors.slice(0, MAX_VEHICLES);
    const wanted = new Map(requested.map(item => [item.id,item]));
    for (const vehicle of [...this.vehicles]) if (!wanted.has(vehicle.id)) {
      this.scene.remove(vehicle.group); this.vehicles.splice(this.vehicles.indexOf(vehicle),1);
    }
    const existing = new Set(this.vehicles.map(vehicle => vehicle.id));
    for (const descriptor of requested) if (!existing.has(descriptor.id)) this.vehicles.push(this.createVehicle(descriptor));
    this.vehicles.sort((a,b) => requested.findIndex(item=>item.id===a.id)-requested.findIndex(item=>item.id===b.id));
    this.applyTrafficSnapshot(this.traffic.snapshot());
  }

  setSignalHead(signal, value) {
    const colors = { "红灯": 0xff4c46, "黄灯": 0xffc44a, "绿灯": 0x43e19f };
    const active = colors[value] ? value : "红灯";
    for (const [name, lamp] of Object.entries(signal.lamps)) {
      const enabled = name === active;
      lamp.material.color.set(enabled ? colors[name] : 0x101714);
      lamp.material.emissiveIntensity = enabled ? 1.2 : 0.012;
    }
    updateSignalBadge(signal, active);
  }

  syncState(sceneState) {
    this.setLayout(sceneState.scene_layout ?? 'crossroads', sceneState.layout_data);
    this.traffic.configure(sceneState);
    const descriptors = Array.isArray(sceneState.vehicles) ? sceneState.vehicles : Array.from({length:sceneState.bus_count ?? sceneState.buses ?? 0},(_,id)=>({id:`legacy-bus-${id}`,type:'bus'}));
    this.setVehicles(descriptors);
    this.weatherView.set(sceneState.weather ?? "clear");
    this.applyTrafficSnapshot(this.traffic.snapshot());
  }

  setLayout(layout, definition) {
    if(layout === this.activeLayout) return;
    if(!this.districts.has(layout)) {
      const group=new THREE.Group(); this.scene.add(group);
      createBusStopDistrict(this, group, definition);
      batchStaticCity(group);
      this.districts.set(layout,{group,groundMaterial:this.groundMaterial,roadMaterial:this.roadMaterial,wetRoads:this.wetRoads,snowSurfaces:this.snowSurfaces,architecturalLights:this.architecturalLights});
    }
    for(const [name, district] of this.districts) district.group.visible=name===layout;
    const active=this.districts.get(layout);
    Object.assign(this,{groundMaterial:active.groundMaterial,roadMaterial:active.roadMaterial,wetRoads:active.wetRoads,snowSurfaces:active.snowSurfaces,architecturalLights:active.architecturalLights});
    for(const signal of this.signalGroups.NS) signal.group.visible=layout==='crossroads';
    this.activeLayout=layout;
    this.layoutCamera=definition?.camera ?? DEFAULT_CAMERA;
    this.container.dataset.sceneLayout=layout;
    this.resetCamera();
  }

  applyTrafficSnapshot(snapshot, deltaSeconds=0) {
    for (const signal of this.signalHeads) {
      const stage = snapshot.signalGroups?.[signal.groupKey] ?? "red";
      this.setSignalHead(signal, stage === "green" ? "绿灯" : stage === "yellow" ? "黄灯" : "红灯");
    }
    this.vehicles.forEach((rendered, index) => {
      const vehicle = snapshot.vehicles[index];
      if (!vehicle) return;
      const displacement=rendered.lastS===null?0:vehicle.s-rendered.lastS;
      rendered.lastS=vehicle.s;
      const dynamics=rendered.bodyDynamics;
      const dt=Math.max(deltaSeconds,1/60);
      const speedDelta=vehicle.currentSpeed-dynamics.previousSpeed;
      const previousYaw=dynamics.previousYaw===null?vehicle.yaw:dynamics.previousYaw;
      const yawDelta=Math.atan2(Math.sin(vehicle.yaw-previousYaw),Math.cos(vehicle.yaw-previousYaw));
      const wheelSpin=Math.abs(displacement)<5?displacement/(rendered.wheelGroups[0]?.userData.wheelRadius||.4):0;
      dynamics.wheelSpin+=wheelSpin;
      if(wheelSpin)for(const wheel of rendered.wheelGroups)wheel.rotation.z+=wheelSpin;
      const braking=speedDelta<-.08||BRAKING_REASONS.has(vehicle.reason);
      for(const lamp of rendered.brakeLights)lamp.material.emissiveIntensity=braking?2.1:.12;
      const steeringTarget=THREE.MathUtils.clamp((yawDelta/dt)*.55,-.42,.42);
      const smoothing=1-Math.exp(-dt*10);
      dynamics.steeringAngle=THREE.MathUtils.lerp(dynamics.steeringAngle,steeringTarget,smoothing);
      for(const [wheelId,pivot] of rendered.wheelPivots) {
        pivot.rotation.y=wheelId.startsWith("front_")?dynamics.steeringAngle:0;
      }
      if(rendered.model&&rendered.type!=="bus") {
        // A restrained visual cue: braking pitches the nose down and a turn
        // loads the outside suspension. This is not a tire/collision solver.
        const pitchTarget=THREE.MathUtils.clamp(-speedDelta/dt*.006,-.045,.045);
        const rollTarget=THREE.MathUtils.clamp(-yawDelta/dt*.018,-.06,.06);
        dynamics.pitch=THREE.MathUtils.lerp(dynamics.pitch,pitchTarget,smoothing);
        dynamics.roll=THREE.MathUtils.lerp(dynamics.roll,rollTarget,smoothing);
        rendered.model.rotation.z=dynamics.pitch;
        rendered.model.rotation.x=dynamics.roll;
      }
      rendered.group.position.set(vehicle.x, rendered.groundOffset ?? vehicle.ground_offset ?? .18, vehicle.z);
      rendered.group.rotation.y = vehicle.yaw;
      dynamics.previousSpeed=vehicle.currentSpeed;
      dynamics.previousYaw=vehicle.yaw;
      const currentScale = rendered.group.scale.x;
      const nextScale = THREE.MathUtils.lerp(currentScale, rendered.group.userData.targetScale, 0.12);
      rendered.group.scale.setScalar(nextScale);
    });
    const now = performance.now();
    if (now - this.lastTrafficEvent > 200) {
      this.lastTrafficEvent = now;
      this.container.dispatchEvent(new CustomEvent("traffic-frame", { detail: snapshot }));
    }
  }

  positionBuses(deltaSeconds) {
    const elapsed = this.visualPaused ? 0 : deltaSeconds;
    const snapshot = this.traffic.advance(elapsed);
    this.applyTrafficSnapshot(snapshot, elapsed);
    if (!this.visualPaused) this.weatherView.update(deltaSeconds);
  }

  setupControls() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", (event) => {
      this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!this.pointer || this.pointer.id !== event.pointerId) return;
      const dx = event.clientX - this.pointer.x;
      const dy = event.clientY - this.pointer.y;
      this.pointer.x = event.clientX;
      this.pointer.y = event.clientY;
      this.spherical.theta -= dx * 0.006;
      this.spherical.phi = THREE.MathUtils.clamp(this.spherical.phi + dy * 0.005, 0.4, 1.42);
      this.updateCamera();
    });
    const release = (event) => {
      if (this.pointer?.id === event.pointerId) {
        this.pointer = null;
        canvas.style.cursor = "grab";
      }
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      this.spherical.radius = THREE.MathUtils.clamp(this.spherical.radius + event.deltaY * 0.035, 18, this.activeLayout==='bus_stop'?110:72);
      this.updateCamera();
    }, { passive: false });
    canvas.style.cursor = "grab";

    this.container.addEventListener("keydown", (event) => {
      const step = 0.08;
      if (event.key === "ArrowLeft") this.spherical.theta += step;
      else if (event.key === "ArrowRight") this.spherical.theta -= step;
      else if (event.key === "ArrowUp") this.spherical.phi = Math.max(0.4, this.spherical.phi - step);
      else if (event.key === "ArrowDown") this.spherical.phi = Math.min(1.42, this.spherical.phi + step);
      else return;
      event.preventDefault();
      this.updateCamera();
    });
  }

  updateCamera() {
    const { radius, theta, phi } = this.spherical;
    this.camera.position.set(
      this.target.x + radius * Math.sin(phi) * Math.cos(theta),
      this.target.y + radius * Math.cos(phi),
      this.target.z + radius * Math.sin(phi) * Math.sin(theta),
    );
    this.camera.lookAt(this.target);
  }

  resetCamera() {
    const profile = CAMERA_PROFILES[this.cameraMode] ?? DEFAULT_CAMERA;
    this.spherical = { ...(this.cameraMode === 'bird' ? this.layoutCamera ?? profile : profile) };
    this.target.set(...profile.target);
    this.updateCamera();
    this.container.dataset.cameraMode = this.cameraMode;
  }

  setCameraMode(mode) {
    if (!Object.hasOwn(CAMERA_PROFILES, mode)) return;
    this.cameraMode = mode;
    this.resetCamera();
  }

  setPaused(value) {
    this.visualPaused = Boolean(value);
  }

  setQuality(name) {
    this.quality=['low','balanced','high'].includes(name)?name:'balanced';
    const profile=qualityProfile(this.quality);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,profile.pixelRatio));
    this.sun.shadow.mapSize.set(profile.shadowSize,profile.shadowSize);
    this.sun.shadow.map?.dispose();this.sun.shadow.map=null;
    this.container.dataset.quality=this.quality;
    this.applyVehicleQuality();
    this.resize();
  }

  applyVehicleQuality() {
    const transmission=qualityProfile(this.quality).glassTransmission;
    const changed=new Set();
    for(const template of Object.values(this.vehicleTemplates??{})) template.traverse(child=>{
      if(child.userData.component!=='glass' || !child.material || changed.has(child.material))return;
      changed.add(child.material);
      if(child.material.transmission!==transmission) {
        child.material.transmission=transmission;
        child.material.needsUpdate=true;
      }
    });
  }

  setLightStyle(style) {this.weatherView.setLightStyle(style);}

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  animate() {
    this.frame = requestAnimationFrame(() => this.animate());
    const now = performance.now();
    const frameMs=now-this.lastTime;
    // Keep visible shader-compilation hitches in the measurement, not just fast frames.
    const measuring = !document.hidden && document.hasFocus();
    if(frameMs>0 && measuring) this.frameSamples.push(frameMs);
    const delta = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.positionBuses(delta);
    this.renderer.render(this.scene, this.camera);
    if(!measuring && now-this.lastRenderReport>=1000) {
      this.container.dispatchEvent(new CustomEvent('render-frame',{detail:{measuring:false}}));
      this.lastRenderReport=now;
      this.frameSamples=[];
    }
    if(now-this.lastRenderReport>=1000&&this.frameSamples.length) {
      const samples=this.frameSamples.sort((a,b)=>a-b);
      const average=samples.reduce((a,b)=>a+b,0)/samples.length;
      const detail={measuring:true,fps:Math.round(1000/average),p95Ms:Math.round(samples[Math.floor(samples.length*.95)]*10)/10,
        slowFrames:this.frameSamples.filter(ms=>ms>250).length,
        drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,
        geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,quality:this.quality,
        weather:this.weatherView.weather,transition:this.container.dataset.atmosphereTransition,
        snowSurfaces:{total:this.snowSurfaces.length,attached:this.snowSurfaces.filter(s=>s.parent).length,visible:this.snowSurfaces.filter(s=>s.visible).length}};
      this.container.dataset.renderStats=JSON.stringify(detail);
      this.container.dispatchEvent(new CustomEvent('render-frame',{detail}));
      this.frameSamples=[];this.lastRenderReport=now;
    }
  }
}
