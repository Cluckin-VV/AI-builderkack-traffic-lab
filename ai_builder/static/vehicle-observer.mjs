const VEHICLE_LABELS = Object.freeze({ sedan: '轿车', suv: 'SUV', bus: '公交车' });
const MOVEMENT_LABELS = Object.freeze({ straight: '直行', left: '左转', right: '右转' });

const reasonDescription = Object.freeze({
  moving: '按当前安全相位行驶',
  ready: '准备进入车流',
  red_light: '停止线前等待红灯',
  approaching_red_light: '接近红灯，正在减速',
  yellow_light: '黄灯阶段，安全制动',
  approaching_yellow_light: '黄灯阶段，准备制动',
  braking_for_stop: '为停止线平稳制动',
  following: '保持与前车的安全间距',
  manual_stop: '手动全红或安全停止',
  station_dwell: '站台停靠中',
});

const reasonPriority = Object.freeze({
  red_light: 0,
  yellow_light: 1,
  braking_for_stop: 2,
  following: 3,
  manual_stop: 4,
  station_dwell: 5,
  moving: 6,
  ready: 7,
});

function canonicalReason(value) {
  const raw = typeof value === 'string' ? value : 'ready';
  if (raw.startsWith('approaching_red_light')) return 'approaching_red_light';
  if (raw.startsWith('approaching_yellow_light')) return 'approaching_yellow_light';
  return Object.hasOwn(reasonDescription, raw) ? raw : 'ready';
}

function vehicleLabel(type) {
  return VEHICLE_LABELS[type] ?? '车辆';
}

function displayId(value) {
  const id = typeof value === 'string' && value.trim() ? value.trim() : 'unassigned';
  return id.length > 15 ? `${id.slice(0, 15)}…` : id;
}

// This is a read-only projection of a browser-local traffic frame. It does
// not select, mutate or reorder the server-owned SceneState vehicle collection.
export function observeVehicles(frame, { limit = 3 } = {}) {
  const vehicles = Array.isArray(frame?.vehicles) ? frame.vehicles : [];
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 3;
  return Object.freeze(vehicles.map((vehicle, index) => {
    const reason = canonicalReason(vehicle?.reason);
    const speed = Number.isFinite(vehicle?.currentSpeed) ? Math.max(0, vehicle.currentSpeed) : 0;
    const type = typeof vehicle?.type === 'string' ? vehicle.type : 'vehicle';
    const movement = typeof vehicle?.movement === 'string' ? vehicle.movement : 'straight';
    const id = typeof vehicle?.id === 'string' ? vehicle.id : `vehicle-${index + 1}`;
    return Object.freeze({
      id,
      displayId: displayId(id),
      type,
      typeLabel: vehicleLabel(type),
      movement,
      movementLabel: MOVEMENT_LABELS[movement] ?? '路线待定',
      reason,
      reasonLabel: reasonDescription[reason],
      speedKph: Math.round(speed * 3.6 * 10) / 10,
      priority: reasonPriority[reason] ?? reasonPriority.ready,
    });
  }).sort((first, second) => first.priority - second.priority || first.id.localeCompare(second.id)).slice(0, safeLimit));
}

export function vehicleObserverSummary(frame) {
  const vehicles = Array.isArray(frame?.vehicles) ? frame.vehicles : [];
  if (!vehicles.length) return '当前场景没有可观察的车辆。';
  const watched = observeVehicles(frame, { limit: 1 })[0];
  return `优先显示受控车辆：${watched.typeLabel} ${watched.displayId} · ${watched.reasonLabel}`;
}
