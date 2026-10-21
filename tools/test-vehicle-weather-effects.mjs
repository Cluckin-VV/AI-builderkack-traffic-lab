import test from 'node:test';
import assert from 'node:assert/strict';
import { rainSprayState, wiperSweepState } from '../ai_builder/static/vehicle-weather-effects.mjs';

test('rain spray requires both rainfall and actual vehicle motion', () => {
  assert.equal(rainSprayState({ rainWeight: 1, speed: 0 }).visible, false);
  assert.equal(rainSprayState({ rainWeight: 0, speed: 9 }).visible, false);
  assert.equal(rainSprayState({ rainWeight: 1, speed: 9 }).visible, true);
});

test('rain wiper sweep is a bounded presentation cue independent of vehicle motion', () => {
  assert.deepEqual(wiperSweepState({rainWeight: 0, elapsedSeconds: 3}), {active:false, angle:0});
  const rain = wiperSweepState({rainWeight: 1, elapsedSeconds: .31});
  assert.equal(rain.active, true);
  assert.ok(Math.abs(rain.angle) <= .42);
  assert.deepEqual(wiperSweepState({rainWeight: NaN, elapsedSeconds: Infinity}), {active:false, angle:0});
});

test('rain spray is bounded and quality only changes presentation density', () => {
  const low = rainSprayState({ rainWeight: 9, speed: 99, quality: 'low' });
  const high = rainSprayState({ rainWeight: 9, speed: 99, quality: 'high' });
  assert.ok(low.opacity > 0 && low.opacity <= .44);
  assert.ok(high.opacity >= low.opacity && high.opacity <= .44);
  assert.equal(low.particles, 8);
  assert.equal(high.particles, 20);
  for (const value of [NaN, Infinity, -2]) assert.equal(rainSprayState({ rainWeight: value, speed: value }).visible, false);
});
