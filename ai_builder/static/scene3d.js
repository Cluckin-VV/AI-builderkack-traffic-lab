import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const BUS_COLORS = [0xf2b632, 0x46b6a2, 0xe56b5d, 0x5b8def, 0xd48ade, 0xf08c46];
const DEFAULT_CAMERA = { radius: 45, theta: 0.78, phi: 1.02 };

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
    this.busRunning = true;
    this.visualPaused = false;
    this.lastTime = performance.now();
    this.spherical = { ...DEFAULT_CAMERA };
    this.target = new THREE.Vector3(0, 2.5, 0);
    this.pointer = null;
    this.signalLamps = {};

    try {
      this.setupRenderer();
      this.setupScene();
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
    this.scene.background = new THREE.Color(0x071513);
    this.scene.fog = new THREE.FogExp2(0x071513, 0.013);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
    this.updateCamera();

    const hemisphere = new THREE.HemisphereLight(0xa9d8cf, 0x17231e, 2.3);
    this.scene.add(hemisphere);

    const sun = new THREE.DirectionalLight(0xffe1a3, 3.5);
    sun.position.set(-25, 40, 24);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -55;
    sun.shadow.camera.right = 55;
    sun.shadow.camera.top = 42;
    sun.shadow.camera.bottom = -42;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0003;
    this.scene.add(sun);

    this.createGround();
    this.createRoad();
    this.createSignal();
    this.createStreetFurniture();
    this.createDistrict();
  }

  createGround() {
    const ground = mesh(
      new THREE.PlaneGeometry(220, 180),
      new THREE.MeshStandardMaterial({ color: 0x0f251d, roughness: 0.96 }),
      false,
      true,
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.04;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(180, 90, 0x1c4a3c, 0x123128);
    grid.position.y = 0.015;
    grid.material.transparent = true;
    grid.material.opacity = 0.2;
    this.scene.add(grid);
  }

  createRoad() {
    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x1c292b, roughness: 0.91, metalness: 0.02 });
    const road = mesh(new THREE.BoxGeometry(130, 0.22, 17), roadMaterial, false, true);
    road.position.y = 0.08;
    this.scene.add(road);

    const shoulderMaterial = new THREE.MeshStandardMaterial({ color: 0x334840, roughness: 0.93 });
    for (const z of [-9.3, 9.3]) {
      const shoulder = mesh(new THREE.BoxGeometry(130, 0.32, 1.5), shoulderMaterial, false, true);
      shoulder.position.set(0, 0.14, z);
      this.scene.add(shoulder);
    }

    const lineMaterial = new THREE.MeshStandardMaterial({
      color: 0xd7d7bd,
      emissive: 0x64644d,
      emissiveIntensity: 0.15,
      roughness: 0.8,
    });
    for (let x = -59; x <= 59; x += 8) {
      for (const z of [-4.15, 4.15]) {
        const dash = mesh(new THREE.BoxGeometry(4.2, 0.035, 0.14), lineMaterial);
        dash.position.set(x, 0.215, z);
        this.scene.add(dash);
      }
    }

    const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xe9c957, emissive: 0x5c4c10, emissiveIntensity: 0.12 });
    for (const z of [-7.9, 7.9]) {
      const edge = mesh(new THREE.BoxGeometry(130, 0.035, 0.11), edgeMaterial);
      edge.position.set(0, 0.22, z);
      this.scene.add(edge);
    }

    const crosswalkMaterial = new THREE.MeshStandardMaterial({ color: 0xd9e1dc, roughness: 0.86 });
    for (let z = -7.2; z <= 7.2; z += 1.4) {
      const stripe = mesh(new THREE.BoxGeometry(1.9, 0.045, 0.72), crosswalkMaterial);
      stripe.position.set(11, 0.23, z);
      this.scene.add(stripe);
    }
  }

  createSignal() {
    const group = new THREE.Group();
    group.position.set(15.5, 0, -9.8);

    const pole = box(0.34, 7.8, 0.34, 0x243734, { metalness: 0.54, roughness: 0.42 });
    pole.position.y = 3.9;
    group.add(pole);

    const arm = box(5.7, 0.3, 0.3, 0x243734, { metalness: 0.54, roughness: 0.42 });
    arm.position.set(-2.7, 7.2, 0);
    group.add(arm);

    const housing = box(1.25, 3.25, 0.9, 0x101918, { metalness: 0.25, roughness: 0.55 });
    housing.position.set(-5.1, 5.9, 0);
    group.add(housing);

    const lampGeometry = new THREE.SphereGeometry(0.36, 24, 16);
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
      this.signalLamps[name] = lamp;
      group.add(lamp);
    }

    this.signalGlow = new THREE.PointLight(0x43e19f, 0, 11, 2);
    this.signalGlow.position.set(-5.1, 5, 1.2);
    group.add(this.signalGlow);

    const base = box(1.2, 0.28, 1.2, 0x253a34, { metalness: 0.18 });
    base.position.y = 0.15;
    group.add(base);

    this.scene.add(group);
    this.setTrafficLight("绿灯");
  }

  createStreetFurniture() {
    for (let x = -52; x <= 52; x += 17) {
      for (const z of [-12.5, 12.5]) {
        const lamp = new THREE.Group();
        const pole = box(0.18, 5.2, 0.18, 0x28443b, { metalness: 0.48, roughness: 0.4 });
        pole.position.y = 2.6;
        lamp.add(pole);
        const head = box(1.35, 0.18, 0.34, 0x263a35, { metalness: 0.4 });
        head.position.set(z < 0 ? 0.58 : -0.58, 5.18, 0);
        lamp.add(head);
        const bulb = box(0.58, 0.07, 0.22, 0xffd989, {
          emissive: 0xffbf4d,
          emissiveIntensity: 2.2,
          cast: false,
        });
        bulb.position.set(z < 0 ? 0.82 : -0.82, 5.06, 0);
        lamp.add(bulb);
        lamp.position.set(x, 0, z);
        this.scene.add(lamp);
      }
    }

    const trees = [-44, -30, -10, 7, 35, 51];
    for (const x of trees) {
      for (const z of [-16.5, 16.5]) {
        const trunk = box(0.42, 2.3, 0.42, 0x4d3a26, { roughness: 1 });
        trunk.position.set(x, 1.15, z);
        this.scene.add(trunk);
        const crown = mesh(
          new THREE.IcosahedronGeometry(1.6, 1),
          new THREE.MeshStandardMaterial({ color: x % 2 ? 0x246b4c : 0x1c5a41, roughness: 0.96 }),
          true,
          true,
        );
        crown.scale.set(1, 1.35, 1);
        crown.position.set(x, 3.45, z);
        this.scene.add(crown);
      }
    }
  }

  createDistrict() {
    const buildingSpecs = [
      [-45, -29, 13, 15, 12, 0x17372f],
      [-27, -30, 14, 23, 11, 0x1c4037],
      [-7, -31, 19, 12, 12, 0x17342f],
      [16, -31, 15, 19, 11, 0x23483e],
      [39, -30, 20, 27, 13, 0x1c3b34],
      [-42, 30, 18, 23, 13, 0x1b3f36],
      [-18, 31, 20, 14, 12, 0x20483c],
      [8, 30, 16, 26, 12, 0x17382f],
      [31, 31, 18, 17, 12, 0x23463d],
      [52, 29, 13, 24, 11, 0x193b34],
    ];

    for (const [x, z, width, height, depth, color] of buildingSpecs) {
      const building = box(width, height, depth, color, { roughness: 0.82, metalness: 0.08 });
      building.position.set(x, height / 2, z);
      this.scene.add(building);

      const rows = Math.max(2, Math.floor(height / 3));
      const columns = Math.max(2, Math.floor(width / 3.2));
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          if ((row + column + Math.round(x)) % 3 === 0) continue;
          const windowPane = box(1.1, 0.74, 0.08, 0x9ec7b9, {
            emissive: 0x5d8e7f,
            emissiveIntensity: 0.36,
            cast: false,
          });
          windowPane.position.set(
            x - width / 2 + 1.8 + column * ((width - 3.6) / Math.max(1, columns - 1)),
            2 + row * 2.55,
            z + (z < 0 ? depth / 2 + 0.05 : -depth / 2 - 0.05),
          );
          this.scene.add(windowPane);
        }
      }
    }
  }

  createBus(index) {
    const group = new THREE.Group();
    const color = BUS_COLORS[index % BUS_COLORS.length];
    const bodyMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.52, metalness: 0.08 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x132126, roughness: 0.26, metalness: 0.38 });
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0x8ed1d6,
      emissive: 0x16434b,
      emissiveIntensity: 0.42,
      roughness: 0.18,
      metalness: 0.35,
    });

    const lower = mesh(new THREE.BoxGeometry(6.4, 1.35, 2.45), bodyMaterial, true, true);
    lower.position.y = 1.35;
    group.add(lower);

    const upper = mesh(new THREE.BoxGeometry(5.75, 1.3, 2.35), bodyMaterial, true, true);
    upper.position.set(-0.15, 2.6, 0);
    group.add(upper);

    const roof = box(5.2, 0.12, 2.1, 0xe8ece8, { roughness: 0.64 });
    roof.position.set(-0.15, 3.32, 0);
    group.add(roof);

    for (const z of [-1.225, 1.225]) {
      for (const x of [-1.85, -0.45, 0.95, 2.18]) {
        const windowPane = mesh(new THREE.BoxGeometry(1.02, 0.68, 0.055), windowMaterial);
        windowPane.position.set(x, 2.62, z);
        group.add(windowPane);
      }
    }

    const windshield = mesh(new THREE.BoxGeometry(0.06, 0.85, 1.72), windowMaterial);
    windshield.position.set(3.22, 2.55, 0);
    group.add(windshield);

    const wheelGeometry = new THREE.CylinderGeometry(0.55, 0.55, 0.34, 24);
    for (const x of [-2.15, 2.1]) {
      for (const z of [-1.25, 1.25]) {
        const wheel = mesh(wheelGeometry, darkMaterial, true, true);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(x, 0.63, z);
        group.add(wheel);
      }
    }

    const lightMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff2bf,
      emissive: 0xffd46a,
      emissiveIntensity: 2,
    });
    for (const z of [-0.72, 0.72]) {
      const headlight = mesh(new THREE.BoxGeometry(0.08, 0.26, 0.34), lightMaterial);
      headlight.position.set(3.24, 1.2, z);
      group.add(headlight);
    }

    group.scale.setScalar(0.01);
    group.userData.targetScale = 1;
    group.userData.lane = index % 2 === 0 ? -2.55 : 2.55;
    group.userData.direction = index % 2 === 0 ? 1 : -1;
    group.userData.phase = (index * 16.5) % 110;
    group.userData.speed = 4.6 + (index % 3) * 0.55;
    group.rotation.y = group.userData.direction === 1 ? 0 : Math.PI;
    this.scene.add(group);
    return group;
  }

  setBusCount(count) {
    const desired = Math.max(0, Math.min(Number(count) || 0, 12));
    while (this.buses.length < desired) {
      this.buses.push(this.createBus(this.buses.length));
    }
    while (this.buses.length > desired) {
      const bus = this.buses.pop();
      this.scene.remove(bus);
    }
    this.positionBuses(0);
  }

  setTrafficLight(value) {
    const colors = { "红灯": 0xff4c46, "黄灯": 0xffc44a, "绿灯": 0x43e19f };
    const active = this.signalLamps[value] ? value : "绿灯";
    for (const [name, lamp] of Object.entries(this.signalLamps)) {
      lamp.material.color.set(name === active ? colors[name] : 0x172521);
      lamp.material.emissiveIntensity = name === active ? 4.2 : 0.025;
    }
    this.signalGlow.color.set(colors[active]);
    this.signalGlow.intensity = 13;
    this.signalGlow.position.y = active === "红灯" ? 6.82 : active === "黄灯" ? 5.92 : 5.02;
  }

  syncState(sceneState) {
    this.setBusCount(sceneState.bus_count ?? sceneState.buses ?? 0);
    this.busRunning = sceneState.bus_running !== false;
    this.setTrafficLight(sceneState.traffic_light ?? "绿灯");
  }

  positionBuses(deltaSeconds) {
    for (const bus of this.buses) {
      if (!this.visualPaused && this.busRunning) {
        bus.userData.phase += deltaSeconds * bus.userData.speed;
      }
      const position = ((bus.userData.phase + 55) % 110) - 55;
      bus.position.set(position * bus.userData.direction, 0.22, bus.userData.lane);
      const currentScale = bus.scale.x;
      const nextScale = THREE.MathUtils.lerp(currentScale, bus.userData.targetScale, 0.12);
      bus.scale.setScalar(nextScale);
    }
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
