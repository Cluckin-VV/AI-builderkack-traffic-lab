import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
const { AtmosphereTransition, LightingTransition, lightingFogBrightness, qualityProfile, architecturalLightLevel } = await import(new URL(
  './atmosphere-profile.mjs' + new URL(import.meta.url).search, import.meta.url).href);

// Presentation only: reads weather configuration and animates pixels; never writes SceneState.
export class WeatherView {
  constructor(world) {
    this.world = world;
    this.weather = "clear";
    this.transition = new AtmosphereTransition();
    this.lighting = new LightingTransition();
    this.time = 0;
    this.lightStyle = 'daylight';
    this.environmentWeather = 'clear';
    this.blendedColor = new THREE.Color();
    this.rain = this.makeParticles(1500, 0xb8d4e3, 0.13, 0.66, "rain");
    this.snow = this.makeParticles(1500, 0xf8fcff, 0.58, 0.94, "snow");
    world.scene.add(this.rain, this.snow);
    this.set("clear");
  }

  makeParticles(count, color, size, opacity, style) {
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
    if (style === 'rain') {
      const streaks = new Float32Array(count * 6);
      for (let i=0;i<count;i++) {
        streaks.set(values.subarray(i*3,i*3+3),i*6);
        streaks.set([values[i*3]-.08,values[i*3+1]-.8,values[i*3+2]],i*6+3);
      }
      geometry.setAttribute('position',new THREE.BufferAttribute(streaks,3));
      const lines = new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({
        color,transparent:true,opacity:.38,depthWrite:false}));
      lines.frustumCulled=false; return lines;
    }
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 16;
    textureCanvas.height = style === 'snow' ? 16 : 64;
    const context = textureCanvas.getContext("2d");
    if (style === "snow") {
      const gradient = context.createRadialGradient(8, 8, 0, 8, 8, 7);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(.56, "rgba(255,255,255,.92)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(8, 8, 7, 0, Math.PI * 2);
      context.fill();
    } else {
      const gradient = context.createLinearGradient(0, 0, 0, 64);
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(.24, "rgba(255,255,255,.95)");
      gradient.addColorStop(.76, "rgba(255,255,255,.95)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.strokeStyle = gradient;
      context.lineWidth = 2.2;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(9, 2);
      context.lineTo(6, 62);
      context.stroke();
    }
    const sprite = new THREE.CanvasTexture(textureCanvas);
    sprite.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.PointsMaterial({ color, map: sprite, size, transparent: true, opacity, alphaTest: .025, depthWrite: false });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    return points;
  }

  set(value) {
    this.weather = ["clear", "rain", "snow", "fog"].includes(value) ? value : "clear";
    this.transition.set(this.weather);
    this.world.container.dataset.weather = this.weather;
  }

  setLightStyle(style) {
    if (!['daylight','golden','blue'].includes(style)) return;
    this.lightStyle=style;
    this.lighting.set(style);
    this.world.container.dataset.lightStyle=style;
    this.world.container.dataset.lightingTransition=this.lighting.settled?'settled':'blending';
  }

  applyAtmosphere(seconds) {
    const view=this.transition.advance(seconds);
    const lighting=this.lighting.advance(seconds);
    const weights=this.transition.weights;
    this.rain.visible = weights.rain>.001;
    this.rain.material.opacity=weights.rain*.38;
    this.snow.visible = this.weather === "snow" || weights.snow>.001;
    this.snow.material.opacity=weights.snow*.88;
    const profile=qualityProfile(this.world.quality);
    this.rain.geometry.setDrawRange(0,profile.particles*2);
    this.snow.geometry.setDrawRange(0,profile.particles);
    for (const surface of this.world.snowSurfaces ?? []) {
      surface.visible = this.weather === "snow" || weights.snow>.001;
      surface.material.opacity=weights.snow*.82;
    }
    for (const wet of this.world.wetRoads ?? []) {
      wet.visible = view.wet>.02 && profile.reflections;
      wet.material.uniforms.wetness.value=view.wet;
      wet.material.uniforms.time.value=this.time;
    }
    // Preserve near-road legibility in fog; blend distant visibility instead.
    const palettes = {
      clear: [0xa7b6c5, 95, 260, 3.1, 1.05, 0x769bbd, 0xf5d8bd, 0x848b7d],
      rain:  [0x697983, 45, 145, 1.15, .72, 0x526a7b, 0x889398, 0x657064],
      snow:  [0x8798a2, 58, 175, 1.45, 1.12, 0xa0b6c5, 0xe7ecee, 0xcbd5d4],
      fog:   [0xaeb8b6, 40, 165, .85, .82, 0x9daaaa, 0xc7ccca, 0x8a9187],
    };
    const blendColor=(index,target)=>{
      target.setRGB(0,0,0);
      for(const [name,weight] of Object.entries(weights)) {
        this.blendedColor.set(palettes[name][index]);
        target.r+=this.blendedColor.r*weight;target.g+=this.blendedColor.g*weight;target.b+=this.blendedColor.b*weight;
      }
    };
    blendColor(0,this.world.scene.background);
    this.world.scene.fog.near=Object.entries(weights).reduce((s,[n,w])=>s+palettes[n][1]*w,0);
    this.world.scene.fog.far=Object.entries(weights).reduce((s,[n,w])=>s+palettes[n][2]*w,0);
    const uniforms=this.world.sky.material.uniforms;
    blendColor(5,uniforms.top.value);blendColor(6,uniforms.bottom.value);
    blendColor(7,this.world.groundMaterial.color);
    const blue=lighting.blue, golden=lighting.golden;
    this.world.scene.background.multiplyScalar(lightingFogBrightness(blue));
    this.world.scene.fog.color.copy(this.world.scene.background);
    this.world.sun.position.set(-35,48-36*blue-29*golden,25);
    this.world.sun.color.set(0xfff1dc).multiplyScalar(lighting.daylight)
      .add(this.blendedColor.set(0xffc18a).multiplyScalar(golden))
      .add(this.blendedColor.set(0xb2caff).multiplyScalar(blue));
    this.world.sun.intensity=view.sun*(1-.75*blue-.2*golden);
    this.world.hemisphere.color.set(0xd7e5f2).lerp(this.blendedColor.set(0x94b1da),blue);
    this.world.hemisphere.groundColor.set(0x6f7474);
    this.world.hemisphere.intensity=view.ambient*(1-.38*blue);
    uniforms.clouds.value=view.clouds;uniforms.time.value=this.time;
    uniforms.sunDirection.value.copy(this.world.sun.position).normalize();
    uniforms.sunColor.value.copy(this.world.sun.color);
    uniforms.sunStrength.value=(1-view.clouds)*(1-.82*blue);
    uniforms.top.value.multiplyScalar(1-.58*blue);
    uniforms.bottom.value.lerp(this.blendedColor.set(0xf0c8a7),weights.clear*.55*golden)
      .lerp(this.blendedColor.set(0x7e93b2),blue);
    this.world.scene.environmentIntensity=.72-.27*blue;
    this.world.renderer.toneMappingExposure=view.exposure;
    this.world.roadMaterial.color.set(0x7b858d).multiplyScalar(1-view.wet*.25);
    this.world.roadMaterial.roughness=.74-view.wet*.40;
    for(const light of this.world.streetLights??[]) light.intensity=14*Math.max(view.lamp,blue+golden*.5);
    for(const material of this.world.architecturalLights??[])
      material.emissiveIntensity=Object.entries(lighting).reduce((sum,[style,weight])=>
        sum+weight*architecturalLightLevel(view.lamp,style),0);
    this.world.container.dataset.atmosphereTransition=weights[this.weather]>.998?'settled':'blending';
    this.world.container.dataset.lightingTransition=this.lighting.settled?'settled':'blending';
    const environmentKey=this.weather+':'+this.lightStyle;
    if(weights[this.weather]>.998 && this.lighting.settled && this.environmentWeather!==environmentKey) {
      this.environmentWeather=environmentKey;
      this.world.refreshEnvironment?.();
    }
  }

  update(seconds) {
    this.time+=seconds;
    this.applyAtmosphere(seconds);
    for(const [points,stride,fall] of [[this.rain,6,24],[this.snow,3,2.4]]) {
      if(!points.visible)continue;
      const values=points.geometry.attributes.position.array;
      for(let i=0;i<values.length;i+=stride) {
        values[i+1]-=fall*seconds;
        if(stride===3) values[i]+=Math.sin(this.time*.7+i)*seconds*.32;
        if(values[i+1]<.3)values[i+1]+=35;
        if(stride===6){values[i+3]=values[i]-.08;values[i+4]=values[i+1]-.8;values[i+5]=values[i+2];}
      }
      points.geometry.attributes.position.needsUpdate=true;
    }
  }
}
