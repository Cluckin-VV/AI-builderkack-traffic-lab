import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

// Presentation only: reads weather configuration and animates pixels; never writes SceneState.
export class WeatherView {
  constructor(world) {
    this.world = world;
    this.weather = "clear";
    this.rain = this.makeParticles(1500, 0x9bcde5, 0.055, 0.58);
    this.snow = this.makeParticles(1100, 0xffffff, 0.18, 0.92);
    world.scene.add(this.rain, this.snow);
    this.set("clear");
  }

  makeParticles(count, color, size, opacity) {
    let seed = count * 2026;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const values = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      values[i * 3] = (random() - .5) * 100;
      values[i * 3 + 1] = random() * 35 + .5;
      values[i * 3 + 2] = (random() - .5) * 100;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(values, 3));
    const material = new THREE.PointsMaterial({ color, size, transparent: true, opacity, depthWrite: false });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    return points;
  }

  set(value) {
    this.weather = ["clear", "rain", "snow", "fog"].includes(value) ? value : "clear";
    this.rain.visible = this.weather === "rain";
    this.snow.visible = this.weather === "snow";
    for (const wet of this.world.wetRoads ?? []) wet.visible = this.weather === "rain";
    const palette = {
      clear: [0xa7b6c5, 95, 260, 3.1, 1.05, 0x769bbd, 0xf5d8bd, 0x848b7d],
      rain:  [0x697983, 45, 145, 1.15, .72, 0x526a7b, 0x889398, 0x657064],
      snow:  [0xd9e2e5, 58, 175, 1.65, 1.18, 0xb9cbd5, 0xf0f1ed, 0xd8ddd2],
      fog:   [0xaeb8b6, 18, 82, .85, .82, 0x9daaaa, 0xc7ccca, 0x8a9187],
    }[this.weather];
    const [color, near, far, sun, hemisphere, top, bottom, ground] = palette;
    this.world.scene.background.set(color);
    this.world.scene.fog.color.set(color);
    this.world.scene.fog.near = near;
    this.world.scene.fog.far = far;
    this.world.sun.intensity = sun;
    this.world.hemisphere.intensity = hemisphere;
    this.world.sky.material.uniforms.top.value.set(top);
    this.world.sky.material.uniforms.bottom.value.set(bottom);
    this.world.groundMaterial.color.set(ground);
    this.world.roadMaterial.roughness = this.weather === "rain" ? .26 : this.weather === "snow" ? .68 : .42;
    this.world.container.dataset.weather = this.weather;
  }

  update(seconds) {
    const points = this.weather === "rain" ? this.rain : this.weather === "snow" ? this.snow : null;
    if (!points) return;
    const values = points.geometry.attributes.position.array;
    const fall = this.weather === "rain" ? 24 : 3.2;
    for (let i = 0; i < values.length; i += 3) {
      values[i + 1] -= fall * seconds;
      if (this.weather === "snow") values[i] += Math.sin(values[i + 1] * .7 + i) * seconds * .7;
      if (values[i + 1] < .3) values[i + 1] += 35;
    }
    points.geometry.attributes.position.needsUpdate = true;
  }
}
