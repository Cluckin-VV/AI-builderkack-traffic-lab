import test from 'node:test';
import assert from 'node:assert/strict';
import { rainSprayState } from '../ai_builder/static/vehicle-weather-effects.mjs';

test('rain spray requires both rainfall and actual vehicle motion', () => {
  assert.equal(rainSprayState({ rainWeight: 1, speed: 0 }).visible, false);
  assert.equal(rainSprayState({ rainWeight: 0, speed: 9 }).visible, false);
  assert.equal(rainSprayState({ rainWeight: 1, speed: 9 }).visible, true);
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
