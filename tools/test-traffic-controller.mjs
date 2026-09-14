import test from 'node:test';
import assert from 'node:assert/strict';
import { TrafficController, STOP_CENTER } from '../ai_builder/static/traffic-controller.mjs';

const config = { buses: 4, bus_running: true, traffic_light: '绿灯', weather: 'clear' };
function tick(controller, seconds) {
  for (let i = 0; i < seconds * 20; i++) controller.advance(0.05);
  return controller.snapshot();
}
function create(patch = {}) {
  const c = new TrafficController();
  c.configure({ ...config, ...patch });
  return c;
}

test('red approaches stop before the line', () => {
  const c = create();
  const state = tick(c, 8);
  assert.equal(state.vehicles[2].s, STOP_CENTER);
  assert.equal(state.vehicles[2].reason, 'red_light');
  assert.ok(state.vehicles[0].s > 0);
});
test('all-red clearance waits for occupied intersection', () => {
  const c = create();
  tick(c, 3);
  c.configure({ ...config, traffic_light: '红灯' });
  assert.deepEqual(c.snapshot().lights, { EW: '红灯', NS: '红灯' });
  tick(c, 1.5);
  assert.equal(c.snapshot().clearance, true);
  tick(c, 3);
  assert.equal(c.snapshot().lights.NS, '绿灯');
});
test('manual stop in junction blocks conflicting release', () => {
  const c = create();
  tick(c, 3);
  c.configure({ ...config, traffic_light: '红灯', bus_running: false });
  const before = c.snapshot().vehicles.map(v => v.s);
  tick(c, 10);
  assert.deepEqual(c.snapshot().vehicles.map(v => v.s), before);
  assert.equal(c.snapshot().clearance, true);
  assert.ok(c.snapshot().vehicles.every(v => v.reason === 'manual_stop'));
});
test('never releases conflicting directions together', () => {
  const c = create({ buses: 12 });
  for (let i = 0; i < 5000; i++) {
    if (i % 100 === 0) c.configure({ ...config, buses: 12, traffic_light: i % 200 ? '红灯' : '绿灯' });
    const s = c.advance(0.05);
    assert.ok(!(s.lights.EW === '绿灯' && s.lights.NS === '绿灯'));
    const occupied = s.vehicles.filter(v => v.s > STOP_CENTER && v.s < 14);
    assert.ok(!occupied.some(a => occupied.some(b => (a.route < 2) !== (b.route < 2))));
  }
});
test('snow lowers progress without changing requested state', () => {
  const sunny = create(), snow = create({ weather: 'snow' });
  assert.ok(tick(snow, 1).vehicles[0].s < tick(sunny, 1).vehicles[0].s);
});
test('fixed steps produce deterministic replay', () => {
  const a = create(), b = create();
  for (let i = 0; i < 100; i++) a.advance(0.1);
  tick(b, 10);
  assert.deepEqual(a.snapshot(), b.snapshot());
});
test('queues maintain separation over repeated circuits', () => {
  const c = create({ buses: 12 });
  for (let i = 0; i < 10000; i++) {
    const state = c.advance(0.05);
    for (let route = 0; route < 4; route++) {
      const positions = state.vehicles.filter(v => v.route === route).map(v => v.s).sort((a,b) => a-b);
      for (let n = 1; n < positions.length; n++) assert.ok(positions[n] - positions[n-1] >= 12 - 1e-8);
    }
  }
});
test('snapshot cannot mutate simulation', () => {
  const c = create();
  c.snapshot().vehicles[0].s = 999;
  assert.equal(c.snapshot().vehicles[0].s, -30);
});
