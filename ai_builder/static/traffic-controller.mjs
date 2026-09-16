// Browser-local, deterministic simulation. Never writes server SceneState.
export const STOP_CENTER = -16;
export const MAX_BUSES = 12;
const EXIT = 14;
const STEP = 0.05;
const SPEED = { clear: 8, rain: 5.5, snow: 3.5, fog: 4 };

export class TrafficController {
  constructor() {
    this.vehicles = [];
    this.running = true;
    this.weather = 'clear';
    this.requested = 'EW';
    this.phase = 'EW';
    this.clearance = 0;
    this.accumulator = 0;
  }

  configure(state) {
    const count = Math.max(0, Math.min(MAX_BUSES, Math.trunc(state.buses ?? state.bus_count ?? 0)));
    while (this.vehicles.length < count) {
      const id = this.vehicles.length;
      this.vehicles.push({ id, route: id % 4, s: -30 - Math.floor(id / 4) * 14, reason: 'ready' });
    }
    this.vehicles.length = count;
    this.running = state.bus_running !== false;
    this.weather = Object.hasOwn(SPEED, state.weather) ? state.weather : 'clear';
    const requested = state.traffic_light === '红灯' ? 'NS' : state.traffic_light === '黄灯' ? null : 'EW';
    if (requested !== this.requested) {
      this.requested = requested;
      this.phase = null;
      this.clearance = 1.5;
    }
  }

  advance(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('Invalid elapsed time');
    // Ignore background-tab backlog: no large teleport through the junction.
    this.accumulator += Math.min(seconds, 0.25);
    while (this.accumulator >= STEP - 1e-9) {
      this.step();
      this.accumulator -= STEP;
    }
    return this.snapshot();
  }

  step() {
    if (this.phase === null) {
      this.clearance = Math.max(0, this.clearance - STEP);
      const occupied = this.vehicles.some(v => v.s > STOP_CENTER && v.s < EXIT);
      if (this.clearance === 0 && !occupied) this.phase = this.requested;
    }
    const gap = this.weather === 'snow' ? 14 : 12;
    for (let route = 0; route < 4; route++) {
      const lane = this.vehicles.filter(v => v.route === route).sort((a, b) => b.s - a.s);
      let leader = Infinity;
      for (const v of lane) {
        const green = this.phase === (route < 2 ? 'EW' : 'NS');
        let limit = leader - gap;
        let reason = 'following';
        if (!green && v.s <= STOP_CENTER && STOP_CENTER < limit) {
          limit = STOP_CENTER;
          reason = 'red_light';
        }
        const previous = v.s;
        if (this.running) v.s = Math.max(v.s, Math.min(v.s + SPEED[this.weather] * STEP, limit));
        v.reason = !this.running ? 'manual_stop' : v.s === previous ? reason : 'moving';
        leader = v.s;
      }
      for (const v of lane) {
        if (v.s > 70 && !lane.some(other => other !== v && other.s < -70 + gap)) v.s = -70;
      }
    }
  }

  snapshot() {
    return {
      lights: { EW: this.phase === 'EW' ? '绿灯' : '红灯', NS: this.phase === 'NS' ? '绿灯' : '红灯' },
      clearance: this.phase === null,
      weather: this.weather,
      vehicles: this.vehicles.map(v => {
        const poses = [[v.s, 3.3, 0], [-v.s, -3.3, Math.PI], [-3.3, v.s, -Math.PI / 2], [3.3, -v.s, Math.PI / 2]];
        const [x, z, yaw] = poses[v.route];
        return { ...v, x, z, yaw };
      }),
    };
  }
}
