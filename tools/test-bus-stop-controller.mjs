import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TrafficController } from '../ai_builder/static/traffic-controller.mjs';
const layouts = JSON.parse(readFileSync(new URL('../ai_builder/scene_layouts.json', import.meta.url)));
const configure = (traffic, extra={}) => traffic.configure({buses:2, scene_layout:'bus_stop', layout_data:layouts.bus_stop, traffic_light:'绿灯', ...extra});
const ticks = (traffic, n) => { for(let i=0;i<n;i++) traffic.advance(.05); };

test('station has only two valid straight routes', () => {
  const t=new TrafficController(); configure(t,{buses:12});
  assert(t.snapshot().vehicles.every(v=>v.route<2));
});
test('bus docks at the shared manifest location then departs', () => {
  const t=new TrafficController(); configure(t); ticks(t,80);
  let bus=t.snapshot().vehicles[0];
  assert.equal(bus.reason,'station_dwell'); assert.equal(bus.s,-38); assert.equal(bus.z,6.2);
  ticks(t,100); assert(t.snapshot().vehicles[0].s>-38);
});
test('manual stop freezes position and station dwell timer', () => {
  const t=new TrafficController(); configure(t); ticks(t,80);
  configure(t,{bus_running:false}); const before=t.snapshot().vehicles;
  ticks(t,120); const after=t.snapshot().vehicles;
  assert.equal(after[0].s,before[0].s); assert.equal(after[0].dwell,before[0].dwell);
  assert.equal(after[0].reason,'manual_stop');
});
test('red station signal stops traffic at pedestrian crossing after docking', () => {
  const t=new TrafficController(); configure(t,{traffic_light:'红灯'}); ticks(t,500);
  assert(t.snapshot().vehicles.every(v=>v.s<=-16));
  assert.equal(t.snapshot().lights.NS,null);
});
test('station queue maintains safe gaps for twelve buses in snow', () => {
  const t=new TrafficController(); configure(t,{buses:12,weather:'snow'});
  for(let i=0;i<2400;i++) {
    t.advance(.05);
    for(const route of [0,1]) {
      const lane=t.snapshot().vehicles.filter(v=>v.route===route).sort((a,b)=>b.s-a.s);
      for(let j=1;j<lane.length;j++) assert(lane[j-1].s-lane[j].s>=14-1e-6);
    }
  }
});
test('layout change resets simulation routes once, not on every hydrate', () => {
  const t=new TrafficController(); t.configure({buses:4}); configure(t,{buses:4});
  ticks(t,10); const before=t.snapshot().vehicles.map(v=>v.s);
  configure(t,{buses:4}); assert.deepEqual(t.snapshot().vehicles.map(v=>v.s),before);
  t.configure({buses:4,scene_layout:'crossroads',layout_data:layouts.crossroads});
  assert.deepEqual(t.snapshot().vehicles.map(v=>v.route),[0,1,2,3]);
});
