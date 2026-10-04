// Deterministic browser-local traffic simulation. SceneState remains server-owned.
export const MAX_VEHICLES = 24;
export const MAX_BUSES = 12;

const STEP = 0.05;
const APPROACHES = ['W', 'E', 'S', 'N'];
const MOVEMENTS = ['straight', 'left', 'right'];
const TURN_OUT = {
  W: { left: 'S', right: 'N' },
  E: { left: 'N', right: 'S' },
  S: { left: 'E', right: 'W' },
  N: { left: 'W', right: 'E' },
};
const DEFAULT_JUNCTION = {
  half_width: 15,
  lane_offsets: { left: 1.75, straight: 5.25, right: 8.75 },
  stop_line_s: -20.5,
  entry_s: -15,
  exit_s: 15,
  start_s: -72,
  exit_approach_s: 72,
  signal_phases: [
    { name: 'EW_THROUGH', seconds: 20, groups: ['EW_THROUGH'] },
    { name: 'EW_LEFT', seconds: 8, groups: ['EW_LEFT'] },
    { name: 'NS_THROUGH', seconds: 20, groups: ['NS_THROUGH'] },
    { name: 'NS_LEFT', seconds: 8, groups: ['NS_LEFT'] },
  ],
  yellow_seconds: 3,
  all_red_seconds: 2,
  vehicle_specs: {
    sedan: { length: 4.65, width: 2.18, speed_factor: 1.08, ground_offset: 0.14 },
    suv: { length: 4.95, width: 2.30, speed_factor: 0.98, ground_offset: 0.18 },
    bus: { length: 9.5, width: 3.06, speed_factor: 0.78, ground_offset: 0.20 },
  },
  weather_speeds: { clear: 8.5, rain: 6.2, snow: 4.2, fog: 5.2 },
  following_gap: { normal: 2.5, snow: 4.5 },
  maximum_vehicles: MAX_VEHICLES,
};
const DEFAULT_APPROACHES = {
  W: { forward: [1, 0], right: [0, -1], axis: 'EW' },
  E: { forward: [-1, 0], right: [0, 1], axis: 'EW' },
  S: { forward: [0, 1], right: [1, 0], axis: 'NS' },
  N: { forward: [0, -1], right: [-1, 0], axis: 'NS' },
};

export const STOP_CENTER = DEFAULT_JUNCTION.stop_line_s - DEFAULT_JUNCTION.vehicle_specs.sedan.length / 2;

const clamp01 = value => Math.max(0, Math.min(1, value));
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const scale = (a, amount) => [a[0] * amount, a[1] * amount];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cubic = (a, b, c, d, t) => {
  const u = 1 - t;
  return [0, 1].map(axis => u ** 3 * a[axis] + 3 * u ** 2 * t * b[axis] + 3 * u * t ** 2 * c[axis] + t ** 3 * d[axis]);
};
const cubicTangent = (a, b, c, d, t) => {
  const u = 1 - t;
  return [0, 1].map(axis => 3 * u ** 2 * (b[axis] - a[axis]) + 6 * u * t * (c[axis] - b[axis]) + 3 * t ** 2 * (d[axis] - c[axis]));
};
const axisFor = (approach, config) => config.approaches[approach].axis;
const groupFor = (vehicle, config) => `${axisFor(vehicle.approach, config)}_${vehicle.movement === 'left' ? 'LEFT' : 'THROUGH'}`;

function laneOffset(movement, config) {
  const lane = movement === 'left' ? 'left' : movement === 'right' ? 'right' : 'straight';
  return config.lane_offsets[lane];
}

function routePosition(approach, along, lateral, config) {
  const spec = config.approaches[approach] ?? DEFAULT_APPROACHES[approach];
  const point = add(scale(spec.forward, along), scale(spec.right, lateral));
  return { x: point[0], z: point[1], yaw: Math.atan2(-spec.forward[1], spec.forward[0]) };
}

function turnPath(vehicle, config) {
  const outgoing = TURN_OUT[vehicle.approach]?.[vehicle.movement];
  if (!outgoing) return null;
  const incomingSpec = config.approaches[vehicle.approach] ?? DEFAULT_APPROACHES[vehicle.approach];
  const outgoingSpec = config.approaches[outgoing] ?? DEFAULT_APPROACHES[outgoing];
  const lateral = laneOffset(vehicle.movement, config);
  const entry = config.entry_s;
  const exit = config.exit_s;
  const start = add(scale(incomingSpec.forward, entry), scale(incomingSpec.right, lateral));
  const end = add(scale(outgoingSpec.forward, exit), scale(outgoingSpec.right, lateral));
  const handle = Math.min(10, (exit - entry) * 0.42);
  return {
    start,
    first: add(start, scale(incomingSpec.forward, handle)),
    third: sub(end, scale(outgoingSpec.forward, handle)),
    end,
  };
}

function crossroadsPose(vehicle, config) {
  const start = config.entry_s;
  const end = config.exit_s;
  const offset = laneOffset(vehicle.movement, config);
  if (vehicle.movement === 'straight') {
    const position = routePosition(vehicle.approach, vehicle.s, offset, config);
    return { ...position, outgoingApproach: vehicle.approach, pathProgress: clamp01((vehicle.s - config.start_s) / (config.exit_approach_s - config.start_s)) };
  }
  const outgoing = TURN_OUT[vehicle.approach]?.[vehicle.movement];
  const path = turnPath(vehicle, config);
  if (!path || vehicle.s <= start) {
    const position = routePosition(vehicle.approach, vehicle.s, offset, config);
    return { ...position, outgoingApproach: vehicle.approach, pathProgress: clamp01((vehicle.s - config.start_s) / (config.exit_approach_s - config.start_s)) };
  }
  if (vehicle.s >= end) {
    const position = routePosition(outgoing, vehicle.s, offset, config);
    return { ...position, outgoingApproach: outgoing, pathProgress: clamp01((vehicle.s - config.start_s) / (config.exit_approach_s - config.start_s)) };
  }
  const t = clamp01((vehicle.s - start) / (end - start));
  const point = cubic(path.start, path.first, path.third, path.end, t);
  const direction = cubicTangent(path.start, path.first, path.third, path.end, t);
  return {
    x: point[0], z: point[1], yaw: Math.atan2(-direction[1], direction[0]),
    outgoingApproach: outgoing,
    pathProgress: clamp01((vehicle.s - config.start_s) / (config.exit_approach_s - config.start_s)),
  };
}

function busStopPose(vehicle, config) {
  const station = config.station ?? { lane_z: 3.3 };
  const lane = station.bay_z ?? station.lane_z;
  return { x: vehicle.approach === 'E' ? -vehicle.s : vehicle.s, z: vehicle.approach === 'E' ? -lane : lane,
    yaw: vehicle.approach === 'E' ? Math.PI : 0, pathProgress: clamp01((vehicle.s - config.start_s) / (config.exit_s - config.start_s)) };
}

function stableRoute(index) {
  // Three movements per direction and four approaches: the seed is evenly spread.
  return { approach: APPROACHES[Math.floor(index / MOVEMENTS.length) % APPROACHES.length], movement: MOVEMENTS[index % MOVEMENTS.length] };
}

export class TrafficController {
  constructor() {
    this.vehicles = [];
    this.running = true;
    this.weather = 'clear';
    this.trafficLight = '绿灯';
    this.layout = 'crossroads';
    this.layoutData = null;
    this.config = DEFAULT_JUNCTION;
    this.mode = 'automatic';
    this.manualAxis = 'EW';
    this.phaseIndex = 0;
    this.stage = 'green';
    this.remaining = DEFAULT_JUNCTION.signal_phases[0].seconds;
    this.accumulator = 0;
  }

  configure(state) {
    const layout = state.scene_layout ?? 'crossroads';
    if (!['crossroads', 'bus_stop'].includes(layout)) throw new RangeError('Unsupported scene layout');
    const changedLayout = this.layout !== layout;
    this.layout = layout;
    this.layoutData = state.layout_data ?? null;
    this.config = this.layoutData?.junction ?? DEFAULT_JUNCTION;
    this.running = state.bus_running !== false;
    this.trafficLight = state.traffic_light ?? '绿灯';
    this.weather = Object.hasOwn(this.config.weather_speeds, state.weather) ? state.weather : 'clear';
    this.mode = state.signal_mode === 'automatic' ? 'automatic' : 'manual';
    if (this.mode === 'manual') this.manualAxis = state.traffic_light === '绿灯' ? 'EW' : null;
    if (changedLayout && layout === 'crossroads') {
      this.phaseIndex = 0;
      this.stage = 'green';
      this.remaining = this.config.signal_phases?.[0]?.seconds ?? 20;
      this.accumulator = 0;
    }
    const vehicleSource = Array.isArray(state.vehicles) ? state.vehicles : null;
    const legacyCount = Math.min(MAX_BUSES, Math.max(0, Math.trunc(state.buses ?? state.bus_count ?? 0)));
    const requested = vehicleSource
      ? vehicleSource.slice(0, this.config.maximum_vehicles ?? MAX_VEHICLES)
      : Array.from({ length: legacyCount }, (_, id) => ({ id: `legacy-bus-${id}`, type: 'bus' }));
    const old = new Map(this.vehicles.map(vehicle => [vehicle.id, vehicle]));
    const requestedForLayout = this.layout === 'bus_stop'
      ? requested.filter(item => (item.type ?? 'bus') === 'bus').map((item, index) => ({ ...item, approach: index % 2 ? 'E' : 'W', movement: 'straight' }))
      : requested;
    this.vehicles = requestedForLayout.map((item, index) => {
      const type = Object.hasOwn(this.config.vehicle_specs ?? DEFAULT_JUNCTION.vehicle_specs, item.type) ? item.type : 'sedan';
      const spec = (this.config.vehicle_specs ?? DEFAULT_JUNCTION.vehicle_specs)[type];
      const prior = !changedLayout ? old.get(item.id) : null;
      if (prior) return { ...prior, type, ...spec };
      const route = stableRoute(index);
      const approach = APPROACHES.includes(item.approach) ? item.approach : vehicleSource === null && this.layout === 'crossroads' ? APPROACHES[index % 4] : route.approach;
      const movement = MOVEMENTS.includes(item.movement) ? item.movement : vehicleSource === null && this.layout === 'crossroads' ? 'straight' : route.movement;
      const start = this.layout === 'bus_stop' ? (this.layoutData?.start_s ?? -70) : (this.config.start_s ?? -72);
      const s = start - (this.layout === 'bus_stop' ? Math.floor(index / 2) * 14 : Math.floor(index / 12) * 16);
      const stopS = this.layout === 'bus_stop'
        ? this.layoutData?.station?.stop_s ?? -38
        : this.config.stop_line_s - spec.length / 2;
      return {
        id: item.id ?? `${type}-${index + 1}`, type, approach, movement,
        route: APPROACHES.indexOf(approach), s, stopS, currentSpeed: 0, reason: 'ready', ...spec,
      };
    });
  }

  advance(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('Invalid elapsed time');
    this.accumulator += Math.min(seconds, 0.25);
    while (this.accumulator >= STEP - 1e-9) {
      this.step();
      this.accumulator -= STEP;
    }
    return this.snapshot();
  }

  step() {
    if (this.layout === 'bus_stop') return this.stepBusStop();
    if (this.mode === 'automatic') this.advanceSignal();
    const groups = this.signalGroups();
    const lanes = new Map();
    for (const vehicle of this.vehicles) {
      const key = `${vehicle.approach}:${vehicle.movement}`;
      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key).push(vehicle);
    }
    for (const lane of lanes.values()) {
      lane.sort((a, b) => b.s - a.s);
      let leader = null;
      for (const vehicle of lane) {
        const allowed = groups[groupFor(vehicle, this.config)] === 'green';
        let limit = Infinity;
        let reason = 'moving';
        if (leader) {
          const gap = this.weather === 'snow' ? this.config.following_gap.snow : this.config.following_gap.normal;
          limit = leader.s - (leader.length + vehicle.length) / 2 - gap;
          reason = 'following';
        }
        if (!allowed && vehicle.s <= vehicle.stopS && vehicle.stopS < limit) {
          limit = vehicle.stopS;
          reason = this.mode === 'manual' && this.trafficLight === '黄灯' || this.stage === 'yellow'
            ? 'yellow_light' : 'red_light';
        }
        const desired = this.config.weather_speeds[this.weather] * vehicle.speed_factor;
        const held = !this.running && (this.layout === 'bus_stop' || vehicle.type === 'bus');
        const distance = Math.max(0, limit - vehicle.s);
        const stoppingBuffer = reason === 'red_light' ? 1.8 : 0.65;
        const safeApproachSpeed = Number.isFinite(limit) ? Math.sqrt(2 * 3.2 * Math.max(0, distance - stoppingBuffer)) : desired;
        const target = held ? 0 : Math.min(desired, safeApproachSpeed);
        const rate = target < vehicle.currentSpeed ? 5.2 : 2.4;
        vehicle.currentSpeed += Math.sign(target - vehicle.currentSpeed) * Math.min(Math.abs(target - vehicle.currentSpeed), rate * STEP);
        vehicle.s = Math.min(vehicle.s + vehicle.currentSpeed * STEP, limit);
        vehicle.reason = held ? (vehicle.currentSpeed < 0.05 ? 'manual_stop' : 'braking_for_stop')
          : vehicle.currentSpeed < 0.05 ? reason : reason === 'moving' ? 'moving' : `approaching_${reason}`;
        leader = vehicle;
      }
    }
    const start = this.config.start_s ?? -72;
    const wrap = this.config.wrap_s ?? start;
    const safeSpawnGap = this.config.following_gap.normal;
    const exit = this.config.exit_approach_s ?? 72;
    for (const vehicle of this.vehicles) if (vehicle.s > exit) {
      // Re-enter behind the rearmost same-lane vehicle. A fixed wrap point can
      // teleport the follower into a vehicle that has already completed a lap.
      const laneVehicles = this.vehicles.filter(other => other !== vehicle && other.approach === vehicle.approach && other.movement === vehicle.movement);
      const rearmost = laneVehicles.reduce((rear, other) => !rear || other.s < rear.s ? other : rear, null);
      const safeStart = Math.min(wrap, start - vehicle.length - safeSpawnGap);
      const behindQueue = rearmost
        ? rearmost.s - (rearmost.length + vehicle.length) / 2 - safeSpawnGap
        : safeStart;
      vehicle.s = Math.min(safeStart, behindQueue);
      vehicle.currentSpeed = 0;
      vehicle.reason = 'ready';
    }
  }

  stepBusStop() {
    const station = this.layoutData?.station ?? { stop_s: -38, entry_s: -56, exit_s: -24, lane_z: 3.3, dwell_seconds: 4 };
    const speed = this.config.weather_speeds?.[this.weather] ?? DEFAULT_JUNCTION.weather_speeds[this.weather];
    for (const approach of ['W', 'E']) {
      const lane = this.vehicles.filter(vehicle => vehicle.approach === approach).sort((a, b) => b.s - a.s);
      let leader = null;
      for (const vehicle of lane) {
        const followingLimit = leader ? leader.s - 14 : Infinity;
        if (!this.running) {
          vehicle.reason = 'manual_stop';
          leader = vehicle;
          continue;
        }
        if (vehicle.s >= station.entry_s && vehicle.s <= station.exit_s && vehicle.dwell === undefined) vehicle.dwell = station.dwell_seconds;
        const docking = vehicle.dwell > 0 && vehicle.s >= station.entry_s && vehicle.s <= station.exit_s;
        const signalStop = this.trafficLight === '红灯' && vehicle.s >= station.stop_s;
        const stopAt = docking || signalStop ? station.stop_s : Infinity;
        const limit = Math.min(followingLimit, stopAt);
        if (docking && limit === station.stop_s) {
          vehicle.dwell = Math.max(0, vehicle.dwell - STEP);
          vehicle.s = station.stop_s;
          vehicle.currentSpeed = 0;
          vehicle.reason = 'station_dwell';
        } else if (signalStop && limit === station.stop_s) {
          vehicle.s = station.stop_s;
          vehicle.currentSpeed = 0;
          vehicle.reason = 'red_light';
        } else {
          const target = Number.isFinite(limit)
            ? Math.min(speed * vehicle.speed_factor, Math.sqrt(2 * 3.2 * Math.max(0, limit - vehicle.s - .18)))
            : speed * vehicle.speed_factor;
          vehicle.currentSpeed += Math.sign(target - vehicle.currentSpeed) * Math.min(Math.abs(target - vehicle.currentSpeed), (target < vehicle.currentSpeed ? 5.2 : 2.4) * STEP);
          vehicle.s = Math.min(vehicle.s + vehicle.currentSpeed * STEP, limit);
          vehicle.reason = vehicle.currentSpeed < .05 ? leader ? 'following' : 'moving' : 'moving';
          if (vehicle.s > (this.layoutData?.exit_s ?? 120)) {
            vehicle.s = this.layoutData?.wrap_s ?? -120;
            vehicle.currentSpeed = 0;
          }
        }
        leader = vehicle;
      }
    }
  }

  advanceSignal() {
    this.remaining = Math.max(0, this.remaining - STEP);
    if (this.remaining > 0) return;
    if (this.stage === 'green') { this.stage = 'yellow'; this.remaining = this.config.yellow_seconds; return; }
    if (this.stage === 'yellow') { this.stage = 'all_red'; this.remaining = this.config.all_red_seconds; return; }
    if (this.junctionOccupied()) { this.remaining = STEP; return; }
    this.phaseIndex = (this.phaseIndex + 1) % this.config.signal_phases.length;
    this.stage = 'green';
    this.remaining = this.config.signal_phases[this.phaseIndex].seconds;
  }

  junctionOccupied() {
    const halfLength = this.config.half_width;
    return this.vehicles.some(vehicle => vehicle.s + vehicle.length / 2 > -halfLength && vehicle.s - vehicle.length / 2 < halfLength);
  }

  signalGroups() {
    const result = { EW_THROUGH: 'red', EW_LEFT: 'red', NS_THROUGH: 'red', NS_LEFT: 'red' };
    if (this.layout === 'bus_stop') { result.EW_THROUGH = 'green'; return result; }
    if (this.mode === 'manual') {
      if (this.manualAxis) result[`${this.manualAxis}_THROUGH`] = 'green';
      else if (this.trafficLight === '黄灯') for (const key of Object.keys(result)) result[key] = 'yellow';
      return result;
    }
    const phase = this.config.signal_phases[this.phaseIndex];
    if (this.stage === 'green') for (const key of phase.groups) result[key] = 'green';
    if (this.stage === 'yellow') for (const key of phase.groups) result[key] = 'yellow';
    return result;
  }

  snapshot() {
    const signalGroups = this.signalGroups();
    const has = (axis, color) => Object.entries(signalGroups).some(([key, value]) => key.startsWith(axis) && value === color);
    const manualCaution = this.mode === 'manual' && this.trafficLight === '黄灯';
    const active = this.layout === 'bus_stop' ? 'BUS_CORRIDOR'
      : this.mode === 'automatic' ? this.config.signal_phases[this.phaseIndex].name
        : manualCaution ? 'ALL_CAUTION' : this.manualAxis ? `${this.manualAxis}_THROUGH` : 'ALL_RED';
    const light = axis => has(axis, 'green') ? '绿灯' : has(axis, 'yellow') ? '黄灯' : '红灯';
    const layoutData = this.layoutData ?? {};
    const junction = this.layout === 'crossroads' ? (layoutData.junction ?? this.config) : null;
    return {
      layout: this.layout, mode: this.mode, phase: active,
      stage: manualCaution ? 'manual_caution' : this.mode === 'manual' && !this.manualAxis ? 'all_red' : this.stage,
      remainingSeconds: this.mode === 'manual' ? 0 : Math.ceil(this.remaining), signalGroups,
      lights: { EW: light('EW'), NS: this.layout === 'bus_stop' ? null : light('NS') },
      clearance: this.stage === 'all_red' || (this.mode === 'manual' && !this.manualAxis && !manualCaution),
      weather: this.weather, junction,
      vehicles: this.vehicles.map(vehicle => ({ ...vehicle, ...(this.layout === 'bus_stop' ? busStopPose(vehicle, layoutData) : crossroadsPose(vehicle, this.config)) })),
    };
  }
}
