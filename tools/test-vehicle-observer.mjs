import test from 'node:test';
import assert from 'node:assert/strict';
import { observeVehicles, vehicleObserverSummary, vehicleObserverCountLabel } from '../ai_builder/static/vehicle-observer.mjs';

test('vehicle observer prioritises a controlled vehicle and preserves its stable id', () => {
  const observed = observeVehicles({ vehicles: [
    { id: 'sedan-04', type: 'sedan', movement: 'straight', currentSpeed: 6, reason: 'moving' },
    { id: 'bus-01', type: 'bus', movement: 'left', currentSpeed: 0, reason: 'red_light' },
    { id: 'suv-02', type: 'suv', movement: 'right', currentSpeed: 0, reason: 'following' },
  ] });
  assert.equal(observed.length, 3);
  assert.equal(observed[0].id, 'bus-01');
  assert.equal(observed[0].reasonLabel, '停止线前等待红灯');
  assert.equal(observed[0].speedKph, 0);
  assert.equal(observed[1].typeLabel, 'SUV');
});

test('vehicle observer makes malformed frames safe and gives an empty-state summary', () => {
  assert.deepEqual(observeVehicles(undefined), []);
  assert.equal(vehicleObserverSummary({ vehicles: [] }), '当前场景没有可观察的车辆。');
  const observed = observeVehicles({ vehicles: [{ id: 'x'.repeat(20), currentSpeed: -4, reason: 'unknown' }] });
  assert.equal(observed[0].speedKph, 0);
  assert.equal(observed[0].reason, 'ready');
  assert.match(observed[0].displayId, /…$/);
});

test('observer distinguishes projected vehicles from committed live vehicles', () => {
  const projected = { vehicles: Array.from({ length: 14 }, (_, index) => ({ id: `suv-${index}` })) };
  assert.equal(vehicleObserverCountLabel(projected, true), 'PREVIEW · 14');
  assert.equal(vehicleObserverCountLabel(projected, false), 'LIVE · 14');
  assert.equal(vehicleObserverCountLabel(undefined, true), 'PREVIEW · 0');
});
