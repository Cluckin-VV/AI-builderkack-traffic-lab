const LAYOUTS = new Set(['crossroads', 'bus_stop']);
const WEATHERS = new Set(['clear', 'rain', 'snow', 'fog']);
const LIGHTS = new Set(['红灯', '黄灯', '绿灯']);
const VEHICLES = ['sedan', 'suv', 'bus'];
const WORDS = ['', '一', '两', '三', '四', '五', '六'];

function countsFromState(state = {}) {
  const counts = { sedan: 0, suv: 0, bus: 0 };
  if (Array.isArray(state.vehicles)) {
    for (const vehicle of state.vehicles) if (Object.hasOwn(counts, vehicle.type)) counts[vehicle.type] += 1;
  } else {
    counts.sedan = Number(state.sedan ?? state.sedans ?? 0);
    counts.suv = Number(state.suv ?? state.suvs ?? 0);
    counts.bus = Number(state.buses ?? state.bus_count ?? 0);
  }
  return counts;
}

function phrase(type, count, removing) {
  if (!Number.isInteger(count) || count < 1 || count > 6) {
    if (type === 'bus') throw new RangeError('buses change must be between 1 and 6 per plan');
    throw new RangeError('每个计划中每种车辆的增删数量必须在 1 到 6 之间');
  }
  const names = { sedan: '小轿车', suv: 'SUV', bus: '公交车' };
  const verb = removing ? '删除' : '增加';
  return `${verb}${WORDS[count]}辆${names[type]}`;
}

function normalize(state = {}) {
  return {
    scene_layout: state.scene_layout ?? 'crossroads',
    ...countsFromState(state),
    weather: state.weather ?? 'clear',
    traffic_light: state.traffic_light ?? '绿灯',
  };
}

/** Convert a typed target fleet into deterministic, preview-first command clauses. */
export function buildEditorCommand(currentState, targetState) {
  const current = normalize(currentState);
  const target = normalize(targetState);
  if (!LAYOUTS.has(target.scene_layout)) throw new RangeError('layout is unsupported');
  if (!WEATHERS.has(target.weather)) throw new RangeError('weather is unsupported');
  if (!LIGHTS.has(target.traffic_light)) throw new RangeError('traffic_light is unsupported');
  for (const type of VEHICLES) {
    if (!Number.isInteger(target[type]) || target[type] < 0 || target[type] > 24) {
      throw new RangeError(`${type} count must be between 0 and 24`);
    }
  }
  if (VEHICLES.reduce((total, type) => total + target[type], 0) > 24) {
    throw new RangeError('十字路口最多容纳 24 辆车');
  }

  const clauses = [];
  if (target.scene_layout !== current.scene_layout) {
    clauses.push(target.scene_layout === 'bus_stop' ? '创建公交站情境' : '恢复十字路口');
  }
  const deltas = VEHICLES.map(type => [type, target[type] - current[type]]);
  for (const [type, delta] of deltas) if (delta < 0) clauses.push(phrase(type, -delta, true));
  for (const [type, delta] of deltas) if (delta > 0) clauses.push(phrase(type, delta, false));
  if (target.weather !== current.weather) {
    clauses.push({ clear: '让天气变成晴天', rain: '切换雨天', snow: '让天气下雪', fog: '让天气起雾' }[target.weather]);
  }
  if (target.traffic_light !== current.traffic_light) {
    clauses.push({ '红灯': '把信号灯变成红灯', '黄灯': '把信号灯变成黄灯', '绿灯': '把信号灯变成绿灯' }[target.traffic_light]);
  }
  if (clauses.length > 6) throw new RangeError('一个原子预演最多包含 6 个动作');
  return clauses.join('然后');
}
