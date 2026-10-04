// Visual configuration only. No domain state, commands, or network access.
export const QUALITY_PROFILES = Object.freeze({
  low: Object.freeze({ pixelRatio: 1, shadowSize: 1024, reflections: false, particles: 600, glassTransmission: 0 }),
  balanced: Object.freeze({ pixelRatio: 1.5, shadowSize: 2048, reflections: true, particles: 1000, glassTransmission: 0 }),
  high: Object.freeze({ pixelRatio: 2, shadowSize: 2048, reflections: true, particles: 1500, glassTransmission: .08 }),
});

export const WEATHER_PROFILES = Object.freeze({
  clear: Object.freeze({ clouds: .28, sun: 2.7, ambient: 1.2, wet: 0, snow: 0, mist: 0, lamp: .12, exposure: 1.0 }),
  rain: Object.freeze({ clouds: .91, sun: .38, ambient: 1.25, wet: 1, snow: 0, mist: .6, lamp: 1, exposure: 1.02 }),
  snow: Object.freeze({ clouds: .79, sun: .65, ambient: 1.4, wet: 0, snow: 1, mist: .4, lamp: .7, exposure: 1.02 }),
  fog: Object.freeze({ clouds: .72, sun: .45, ambient: 1.25, wet: .1, snow: 0, mist: 1, lamp: .85, exposure: 1.0 }),
});

export function qualityProfile(name) {
  return QUALITY_PROFILES[name] ?? QUALITY_PROFILES.balanced;
}

// Named observation positions, not traffic or scene-generation configuration.
export const CAMERA_PROFILES = Object.freeze({
  bird: Object.freeze({ radius: 92, theta: .82, phi: .59, target: Object.freeze([0, 2.5, 0]) }),
  street: Object.freeze({ radius: 48, theta: .01, phi: 1.525, target: Object.freeze([0, 2.5, 0]) }),
  corner: Object.freeze({ radius: 30.6, theta: -2.24, phi: 1.54, target: Object.freeze([29, 5, 32]) }),
});

export function architecturalLightLevel(weatherLamp, style = 'daylight') {
  const lamp = Number.isFinite(weatherLamp) ? Math.max(0, Math.min(1, weatherLamp)) : 0;
  const dusk = style === 'blue' ? 1 : style === 'golden' ? .45 : 0;
  return .015 + .68 * Math.max(lamp * .45, dusk);
}

export function lightingFogBrightness(blueWeight) {
  const blue = Number.isFinite(blueWeight) ? Math.max(0, Math.min(1, blueWeight)) : 0;
  return 1 - .65 * blue;
}

export class LightingTransition {
  constructor() {
    this.target='daylight';
    this.weights={daylight:1,golden:0,blue:0};
  }
  set(style) {
    if(Object.hasOwn(this.weights,style))this.target=style;
  }
  get settled() { return this.weights[this.target]>.998; }
  advance(seconds) {
    const delta=Number.isFinite(seconds)?Math.max(0,Math.min(seconds,.1)):0;
    const alpha=1-Math.exp(-delta*1.4);
    for(const key of Object.keys(this.weights)) {
      const target=key===this.target?1:0;
      this.weights[key]+=(target-this.weights[key])*alpha;
      if(Math.abs(this.weights[key]-target)<.0001)this.weights[key]=target;
    }
    const total=Object.values(this.weights).reduce((a,b)=>a+b,0);
    for(const key of Object.keys(this.weights))this.weights[key]/=total;
    return {...this.weights};
  }
}

export class AtmosphereTransition {
  constructor(weather = 'clear') {
    this.target = WEATHER_PROFILES[weather] ? weather : 'clear';
    this.weights = { clear: 0, rain: 0, snow: 0, fog: 0 };
    this.weights[this.target] = 1;
  }

  set(weather) {
    this.target = WEATHER_PROFILES[weather] ? weather : 'clear';
  }

  advance(seconds) {
    const alpha = 1 - Math.exp(-Math.max(0, Math.min(seconds, .1)) * 1.6);
    for (const key of Object.keys(this.weights)) {
      const target = key === this.target ? 1 : 0;
      this.weights[key] += (target - this.weights[key]) * alpha;
      if (Math.abs(this.weights[key] - target) < .0001) this.weights[key] = target;
    }
    // Normalise after snapping so rapidly interrupted transitions stay bounded.
    const total = Object.values(this.weights).reduce((sum, value) => sum + value, 0);
    for (const key of Object.keys(this.weights)) this.weights[key] /= total;
    const result = {};
    for (const property of Object.keys(WEATHER_PROFILES.clear)) {
      result[property] = Object.entries(this.weights).reduce(
        (sum, [key, weight]) => sum + WEATHER_PROFILES[key][property] * weight, 0);
    }
    return result;
  }
}
