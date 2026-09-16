import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const { createAtmosphere, createCity, batchStaticCity, loadBusAsset } = await import(
  new URL("./urban-world.js" + new URL(import.meta.url).search, import.meta.url).href
);
const { TrafficController, MAX_BUSES } = await import(new URL("./traffic-controller.mjs" + new URL(import.meta.url).search, import.meta.url).href);
const { WeatherView } = await import(new URL("./weather-view.js" + new URL(import.meta.url).search, import.meta.url).href);
const DEFAULT_CAMERA = { radius: 43, theta: 1.1, phi: 1.35 };

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

export class TransitWorld {
  constructor(container, onFailure) {
    this.container = container;
    this.onFailure = onFailure;
    this.buses = [];
    this.traffic = new TrafficController();
    this.visualPaused = false;
    this.lastTime = performance.now();
    this.spherical = { ...DEFAULT_CAMERA };
    this.target = new THREE.Vector3(0, 2.5, 0);
    this.pointer = null;
    this.signalGroups = { EW: [], NS: [] };
    this.lastTrafficEvent = 0;

    try {
      this.setupRenderer();
      this.setupScene();
      this.container.dataset.busAsset = "loading";
      this.assetReady = loadBusAsset().then(template => {
        this.busTemplate = template;
        for (const bus of this.buses) {
          for (const child of [...bus.children]) {
            bus.remove(child);
            child.geometry?.dispose();
            child.material?.dispose();
          }
          bus.add(template.clone(true));
        }
        this.container.dataset.busAsset = "ready";
      }).catch(error => {
        this.container.dataset.busAsset = "failed";
        console.error("Bus asset failed", error);
      });
      this.setupControls();
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
    createCity(this);
    batchStaticCity(this.scene);
    this.weatherView = new WeatherView(this);
    this.createSignals();
  }

  createSignals() {
    this.createSignal(15.5, -9.8, 0, "EW");
    this.createSignal(-15.5, 9.8, Math.PI, "EW");
    this.createSignal(-9.8, -15.5, -Math.PI / 2, "NS");
    this.createSignal(9.8, 15.5, Math.PI / 2, "NS");
  }

  createSignal(x, z, yaw, axis) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = yaw;

    const pole = box(0.34, 7.8, 0.34, 0x243734, { metalness: 0.54, roughness: 0.42 });
    pole.position.y = 3.9;
    group.add(pole);

    const arm = box(5.7, 0.3, 0.3, 0x243734, { metalness: 0.54, roughness: 0.42 });
    arm.position.set(-2.7, 7.2, 0);
    group.add(arm);

    const housing = box(1.25, 3.25, 0.9, 0x101918, { metalness: 0.25, roughness: 0.55 });
    housing.position.set(-5.1, 5.9, 0);
    group.add(housing);

    const lamps = {};
    const lampGeometry = new THREE.SphereGeometry(0.36, 18, 12);
    const lampConfig = [
      ["红灯", 0xff4c46, 6.82],
      ["黄灯", 0xffc44a, 5.92],
      ["绿灯", 0x43e19f, 5.02],
    ];
    for (const [name, color, y] of lampConfig) {
      const material = new THREE.MeshStandardMaterial({
        color: 0x1b2926,
        emissive: color,
        emissiveIntensity: 0.02,
        roughness: 0.35,
      });
      const lamp = mesh(lampGeometry, material);
      lamp.position.set(-5.1, y, 0.47);
      lamps[name] = lamp;
      group.add(lamp);
    }

    const glow = new THREE.PointLight(0x43e19f, 0, 11, 2);
    glow.position.set(-5.1, 5, 1.2);
    group.add(glow);

    const base = box(1.2, 0.28, 1.2, 0x253a34, { metalness: 0.18 });
    base.position.y = 0.15;
    group.add(base);

    this.scene.add(group);
    this.signalGroups[axis].push({ lamps, glow });
  }

  createBus(index) {
    const group = new THREE.Group();
    if (this.busTemplate) group.add(this.busTemplate.clone(true));
    else {
      const placeholder = box(9, 2.6, 2.4, 0xbacac7);
      placeholder.position.y = 1.8;
      group.add(placeholder);
    }
    group.scale.setScalar(0.01);
    group.userData.targetScale = 1;
    this.scene.add(group);
    return group;
  }

  setBusCount(count) {
    const desired = Math.max(0, Math.min(Number(count) || 0, MAX_BUSES));
    while (this.buses.length < desired) {
      this.buses.push(this.createBus(this.buses.length));
    }
    while (this.buses.length > desired) {
      const bus = this.buses.pop();
      this.scene.remove(bus);
    }
    this.applyTrafficSnapshot(this.traffic.snapshot());
  }

  setSignal(axis, value) {
    const colors = { "红灯": 0xff4c46, "黄灯": 0xffc44a, "绿灯": 0x43e19f };
    const active = colors[value] ? value : "红灯";
    for (const signal of this.signalGroups[axis]) {
      for (const [name, lamp] of Object.entries(signal.lamps)) {
        lamp.material.color.set(name === active ? colors[name] : 0x172521);
        lamp.material.emissiveIntensity = name === active ? 4.2 : 0.025;
      }
      signal.glow.color.set(colors[active]);
      signal.glow.intensity = 9;
      signal.glow.position.y = active === "红灯" ? 6.82 : active === "黄灯" ? 5.92 : 5.02;
    }
  }

  syncState(sceneState) {
    this.traffic.configure(sceneState);
    this.setBusCount(sceneState.bus_count ?? sceneState.buses ?? 0);
    this.weatherView.set(sceneState.weather ?? "clear");
    this.applyTrafficSnapshot(this.traffic.snapshot());
  }

  applyTrafficSnapshot(snapshot) {
    this.setSignal("EW", snapshot.lights.EW);
    this.setSignal("NS", snapshot.lights.NS);
    this.buses.forEach((bus, index) => {
      const vehicle = snapshot.vehicles[index];
      if (!vehicle) return;
      bus.position.set(vehicle.x, 0.22, vehicle.z);
      bus.rotation.y = vehicle.yaw;
      const currentScale = bus.scale.x;
      const nextScale = THREE.MathUtils.lerp(currentScale, bus.userData.targetScale, 0.12);
      bus.scale.setScalar(nextScale);
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
    this.applyTrafficSnapshot(snapshot);
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
      this.spherical.radius = THREE.MathUtils.clamp(this.spherical.radius + event.deltaY * 0.035, 18, 72);
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
    this.spherical = { ...DEFAULT_CAMERA };
    this.updateCamera();
  }

  setPaused(value) {
    this.visualPaused = Boolean(value);
  }

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
    const delta = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.positionBuses(delta);
    this.renderer.render(this.scene, this.camera);
  }
}
