import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAX_VEHICLES, TrafficController, STOP_CENTER } from '../ai_builder/static/traffic-controller.mjs';
const layouts = JSON.parse(readFileSync(new URL('../ai_builder/scene_layouts.json', import.meta.url)));

const config = {
  buses: 4, bus_running: true, traffic_light: '绿灯', weather: 'clear',
  layout_data: layouts.crossroads,
  vehicles: [
    {id:'w', type:'sedan', approach:'W', movement:'straight'},
    {id:'e', type:'suv', approach:'E', movement:'straight'},
    {id:'s', type:'bus', approach:'S', movement:'straight'},
    {id:'n', type:'sedan', approach:'N', movement:'straight'},
  ],
};
function tick(controller, seconds) {
  for (let i = 0; i < seconds * 20; i++) controller.advance(0.05);
  return controller.snapshot();
}
function create(patch = {}) {
  const c = new TrafficController();
  const state = { ...config, ...patch };
  if (!Object.hasOwn(patch, 'vehicles')) {
    const count = patch.buses ?? config.buses;
    state.vehicles = count === 4 ? config.vehicles : Array.from({length:count}, (_, index) => ({
      id:`bus-${index}`, type:'bus', approach:['W','E','S','N'][Math.floor(index/3)%4], movement:['straight','left','right'][index%3],
    }));
  }
  c.configure(state);
  return c;
}

test('red approaches stop before the line', () => {
  const c = create();
  const state = tick(c, 10);
  assert.ok(state.vehicles[2].s <= state.vehicles[2].stopS);
  assert.ok(state.vehicles[2].s >= state.vehicles[2].stopS - 2);
  assert.equal(state.vehicles[2].reason, 'red_light');
  assert.ok(state.vehicles[0].s > 0);
});
test('red command prevents entry and reports vehicles still braking toward the line', () => {
  const c = create({ traffic_light: '红灯' });
  tick(c, 8);
  const state = c.snapshot();
  assert.deepEqual(state.lights, { EW: '红灯', NS: '红灯' });
  assert.ok(state.vehicles.every(vehicle => vehicle.s <= vehicle.stopS));
  assert.ok(state.vehicles.every(vehicle => ['red_light', 'approaching_red_light'].includes(vehicle.reason)));
});
test('green command releases only the EW approach', () => {
  const c = create({ traffic_light: '绿灯' });
  tick(c, 8);
  const state = c.snapshot();
  assert.deepEqual(state.lights, { EW: '绿灯', NS: '红灯' });
  assert.ok(state.vehicles.filter(vehicle => ['W','E'].includes(vehicle.approach)).every(vehicle => vehicle.s > vehicle.stopS));
  assert.ok(state.vehicles.filter(vehicle => ['S','N'].includes(vehicle.approach)).every(vehicle => vehicle.s <= vehicle.stopS));
});
test('legacy stop-bus command stops buses without freezing unrelated traffic', () => {
  const c = create();
  tick(c, 3);
  c.configure({ ...config, traffic_light: '红灯', bus_running: false });
  const before = c.snapshot().vehicles.map(v => v.s);
  tick(c, 10);
  const after = c.snapshot().vehicles.map(v => v.s);
  assert.ok(after[2] >= before[2] && after[2] - before[2] < 5);
  assert.equal(c.snapshot().vehicles[2].currentSpeed, 0);
  assert.ok(after.some((value,index) => index !== 2 && value > before[index]));
  assert.equal(c.snapshot().clearance, true);
  assert.equal(c.snapshot().vehicles[2].reason, 'manual_stop');
});
test('never releases conflicting directions together', () => {
  const c = create({ buses: 12 });
  for (let i = 0; i < 5000; i++) {
    if (i % 100 === 0) c.configure({ ...config, buses: 12, traffic_light: i % 200 ? '红灯' : '绿灯' });
    const s = c.advance(0.05);
    assert.ok(!(s.lights.EW === '绿灯' && s.lights.NS === '绿灯'));
    const half = s.junction.half_width;
    const occupied = s.vehicles.filter(v => v.s + v.length/2 > -half && v.s - v.length/2 < half);
    assert.ok(!occupied.some(a => occupied.some(b => (['W','E'].includes(a.approach)) !== (['W','E'].includes(b.approach)))));
  }
});
test('snow lowers progress without changing requested state', () => {
  const sunny = create(), snow = create({ weather: 'snow' });
  assert.ok(tick(snow, 5).vehicles[0].s < tick(sunny, 5).vehicles[0].s);
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
    for (const approach of ['W','E','S','N']) for (const movement of ['straight','left','right']) {
      const lane = state.vehicles.filter(v => v.approach === approach && v.movement === movement).sort((a,b) => b.s-a.s);
      for (let n = 1; n < lane.length; n++) {
        const requiredGap = (lane[n-1].length + lane[n].length)/2 + state.junction.following_gap.normal;
        assert.ok(lane[n-1].s - lane[n].s >= requiredGap - 1e-8);
      }
    }
  }
});
test('30-minute mixed-fleet simulation soak keeps phases safe, queues separated and traffic circulating', () => {
  const movements = ['straight', 'left', 'right'];
  const approaches = ['W', 'E', 'S', 'N'];
  const types = ['sedan', 'suv', 'bus'];
  const vehicles = Array.from({ length: 24 }, (_, index) => ({
    id: `soak-${index + 1}`,
    type: types[index % types.length],
    approach: approaches[Math.floor((index % 12) / movements.length)],
    movement: movements[index % movements.length],
  }));
  const c = create({ vehicles, signal_mode: 'automatic', traffic_light: '绿灯' });
  const phases = new Set();
  const previous = new Map(vehicles.map(vehicle => [vehicle.id, -Infinity]));
  let wraps = 0;

  for (let i = 0; i < 30 * 60 * 20; i++) {
    const state = c.advance(0.05);
    phases.add(state.phase);
    const green = Object.entries(state.signalGroups).filter(([, color]) => color === 'green').map(([group]) => group);
    assert.ok(!(green.some(group => group.startsWith('EW')) && green.some(group => group.startsWith('NS'))));

    const half = state.junction.half_width;
    const occupied = state.vehicles.filter(vehicle => vehicle.s + vehicle.length / 2 > -half && vehicle.s - vehicle.length / 2 < half);
    const occupiedAxes = new Set(occupied.map(vehicle => ['W', 'E'].includes(vehicle.approach) ? 'EW' : 'NS'));
    assert.ok(!(occupiedAxes.has('EW') && occupiedAxes.has('NS')));

    for (const approach of approaches) for (const movement of movements) {
      const lane = state.vehicles.filter(vehicle => vehicle.approach === approach && vehicle.movement === movement).sort((a, b) => b.s - a.s);
      for (let n = 1; n < lane.length; n++) {
        const required = (lane[n - 1].length + lane[n].length) / 2 + state.junction.following_gap.normal;
        assert.ok(lane[n - 1].s - lane[n].s >= required - 1e-8,
          `lane gap collapsed at frame ${i} (${approach}/${movement}): ${lane[n - 1].id}@${lane[n - 1].s} -> ${lane[n].id}@${lane[n].s}; required ${required}`);
      }
    }

    for (const vehicle of state.vehicles) {
      if (vehicle.s < previous.get(vehicle.id) - 1) wraps++;
      previous.set(vehicle.id, vehicle.s);
    }
  }
  for (const phase of ['EW_THROUGH', 'EW_LEFT', 'NS_THROUGH', 'NS_LEFT']) assert.ok(phases.has(phase));
  assert.ok(wraps > 0, 'mixed fleet should complete repeated visible routes');
});
test('snapshot cannot mutate simulation', () => {
  const c = create();
  c.snapshot().vehicles[0].s = 999;
  assert.equal(c.snapshot().vehicles[0].s, layouts.crossroads.junction.start_s);
});
test('vehicle capacity is explicit and enforced', () => {
  const c = create({ vehicles: Array.from({length: MAX_VEHICLES + 1}, (_, id) => ({id:`sedan-${id}`, type:'sedan'})) });
  assert.equal(MAX_VEHICLES, 24);
  assert.equal(c.snapshot().vehicles.length, MAX_VEHICLES);
});

test('automatic controller cycles through straight and protected turn phases', () => {
  const c = create({ signal_mode: 'automatic', vehicles: [] });
  const seen = new Set();
  for (let i = 0; i < 1400; i++) seen.add(c.advance(0.05).phase);
  for (const phase of ['EW_THROUGH', 'EW_LEFT', 'NS_THROUGH', 'NS_LEFT']) assert.ok(seen.has(phase));
});

test('vehicle catalogue preserves stable ids and physical dimensions', () => {
  const c = create({ vehicles: [
    {id:'car-a', type:'sedan'}, {id:'suv-a', type:'suv'}, {id:'bus-a', type:'bus'},
  ]});
  const vehicles = c.snapshot().vehicles;
  assert.deepEqual(vehicles.map(v => v.id), ['car-a', 'suv-a', 'bus-a']);
  assert.ok(vehicles[0].length < vehicles[1].length);
  assert.ok(vehicles[1].length < vehicles[2].length);
});

test('routes include straight left and right movement without lateral drift', () => {
  const c = create({ vehicles: [
    {id:'straight', type:'sedan', movement:'straight', approach:'W'},
    {id:'left', type:'suv', movement:'left', approach:'W'},
    {id:'right', type:'bus', movement:'right', approach:'W'},
  ]});
  const movements = new Set(c.snapshot().vehicles.map(v => v.movement));
  assert.deepEqual(movements, new Set(['straight', 'left', 'right']));
  for (let i = 0; i < 2000; i++) {
    const state = c.advance(0.05);
    for (const v of state.vehicles) {
      assert.ok(Number.isFinite(v.x) && Number.isFinite(v.z) && Number.isFinite(v.yaw));
      assert.ok(v.pathProgress >= 0 && v.pathProgress <= 1);
    }
  }
});

test('signal snapshot never exposes conflicting green groups', () => {
  const c = create({ vehicles: [] });
  for (let i = 0; i < 5000; i++) {
    const frame = c.advance(0.05);
    const green = Object.entries(frame.signalGroups).filter(([, value]) => value === 'green').map(([key]) => key);
    assert.ok(!(green.some(key => key.startsWith('EW')) && green.some(key => key.startsWith('NS'))));
  }
});

test('manual green exposes only the safe EW through group', () => {
  const c = create({ signal_mode: 'manual', traffic_light: '绿灯', vehicles: [] });
  const frame = c.snapshot();
  assert.deepEqual(frame.signalGroups, {
    EW_THROUGH: 'green', EW_LEFT: 'red', NS_THROUGH: 'red', NS_LEFT: 'red',
  });
  assert.equal(frame.phase, 'EW_THROUGH');
});

test('manual red is all-red and manual yellow is visible all-way caution without vehicle release', () => {
  const red = create({ signal_mode: 'manual', traffic_light: '红灯', vehicles: [] }).snapshot();
  assert.ok(Object.values(red.signalGroups).every(value => value === 'red'));
  assert.equal(red.clearance, true);
  assert.equal(red.phase, 'ALL_RED');

  const yellowController = create({
    signal_mode: 'manual', traffic_light: '黄灯',
    vehicles: [{ id: 'sedan-1', type: 'sedan', approach: 'W', movement: 'straight' }],
  });
  let yellow;
  for (let i = 0; i < 400; i++) yellow = yellowController.advance(0.05);
  assert.ok(Object.values(yellow.signalGroups).every(value => value === 'yellow'));
  assert.equal(yellow.clearance, false);
  assert.equal(yellow.phase, 'ALL_CAUTION');
  assert.ok(yellow.vehicles[0].s <= yellow.vehicles[0].stopS);
  assert.match(yellow.vehicles[0].reason, /yellow_light/);
});

test('yellow and all-red intervals occur between conflicting green phases', () => {
  const c = create({ signal_mode: 'automatic', vehicles: [] });
  let sawYellow = false, sawAllRed = false;
  for (let i = 0; i < 800; i++) {
    const frame = c.advance(0.05);
    sawYellow ||= frame.stage === 'yellow';
    sawAllRed ||= frame.stage === 'all_red';
  }
  assert.ok(sawYellow);
  assert.ok(sawAllRed);
});

test('shared road manifest defines three lanes and the same protected signal phases', () => {
  const junction = create({vehicles:[]}).snapshot().junction;
  assert.equal(layouts.crossroads.road.lanes_per_direction, 3);
  assert.equal(layouts.crossroads.road.width, 30);
  assert.deepEqual(junction.signal_phases.map(phase=>phase.name), ['EW_THROUGH','EW_LEFT','NS_THROUGH','NS_LEFT']);
  assert.equal(junction.stop_line_s, -20.5);
});

test('approach headings and lane positions agree with right-hand traffic', () => {
  const vehicles = [
    {id:'west',type:'sedan',approach:'W',movement:'straight'},
    {id:'east',type:'sedan',approach:'E',movement:'straight'},
    {id:'south',type:'sedan',approach:'S',movement:'straight'},
    {id:'north',type:'sedan',approach:'N',movement:'straight'},
  ];
  const frames=create({vehicles}).snapshot().vehicles;
  const expected = { west:[1,0,0,-72,-5.25], east:[-1,0,Math.PI,72,5.25], south:[0,1,-Math.PI/2,5.25,-72], north:[0,-1,Math.PI/2,-5.25,72] };
  for(const v of frames) {
    const [fx,fz,yaw,x,z]=expected[{W:'west',E:'east',S:'south',N:'north'}[v.approach]];
    assert.ok(Math.abs(Math.cos(yaw)-fx)<1e-8);
    assert.ok(Math.abs(-Math.sin(yaw)-fz)<1e-8);
    assert.ok(Math.abs(v.x-x)<1e-8);
    assert.ok(Math.abs(v.z-z)<1e-8);
  }
});

test('all three vehicle models stop with their front bumper behind the common stop line', () => {
  const c=create({traffic_light:'红灯',vehicles:[
    {id:'car',type:'sedan',approach:'W',movement:'straight'},
    {id:'suv',type:'suv',approach:'E',movement:'straight'},
    {id:'bus',type:'bus',approach:'S',movement:'straight'},
  ]});
  const state=tick(c,20);
  for(const v of state.vehicles) assert.ok(v.s + v.length/2 <= state.junction.stop_line_s + 1e-8);
});

test('protected left routes turn to the geometrically correct outgoing approaches', () => {
  const routes = {W:'S',E:'N',S:'E',N:'W'};
  for(const [approach,outgoing] of Object.entries(routes)) {
    const c=create({vehicles:[{id:'turn',type:'sedan',approach,movement:'left'}]});
    c.vehicles[0].s=14.99;
    const before=c.snapshot().vehicles[0];
    c.vehicles[0].s=15.01;
    const after=c.snapshot().vehicles[0];
    assert.ok(Math.hypot(before.x-after.x,before.z-after.z)<0.2);
    assert.equal(after.outgoingApproach,outgoing);
    assert.equal(after.movement,'left');
    assert.ok(Number.isFinite(after.yaw));
    const heading={W:[1,0],E:[-1,0],S:[0,1],N:[0,-1]}[outgoing];
    assert.ok(Math.abs(Math.cos(after.yaw)-heading[0])<1e-8);
    assert.ok(Math.abs(-Math.sin(after.yaw)-heading[1])<1e-8);
  }
});

test('three-lane stop-line and per-approach signal placements share the same manifest', () => {
  const junction=create({vehicles:[]}).snapshot().junction;
  for(const approach of ['W','E','S','N']) {
    const definition=junction.approaches[approach];
    assert.equal(definition.forward.length,2);
    assert.equal(definition.pole_position.length,2);
    assert.ok(Math.abs(Math.hypot(...definition.forward)-1)<1e-8);
    assert.ok(Math.abs(definition.signal_yaw)<=Math.PI+1e-8);
  }
  assert.ok(junction.lane_offsets.left<junction.lane_offsets.straight);
  assert.ok(junction.lane_offsets.straight<junction.lane_offsets.right);
  assert.ok(junction.crosswalk_s>junction.stop_line_s);
});
