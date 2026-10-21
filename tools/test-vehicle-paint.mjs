import test from 'node:test';
import assert from 'node:assert/strict';
import { vehiclePaintColor } from '../ai_builder/static/vehicle-paint.mjs';

test('vehicle paint is deterministic for a stable vehicle id', () => {
  assert.equal(vehiclePaintColor({vehicleType:'sedan', vehicleId:'sedan-07'}), vehiclePaintColor({vehicleType:'sedan', vehicleId:'sedan-07'}));
  assert.equal(vehiclePaintColor({vehicleType:'suv', vehicleId:'suv-02'}).length, 3);
});

test('vehicle paint accepts malformed values without creating an invalid colour', () => {
  for (const value of [undefined, null, {}, []]) {
    const color=vehiclePaintColor({vehicleType:value, vehicleId:value});
    assert.ok(color.every(channel=>Number.isFinite(channel)&&channel>=0&&channel<=1));
  }
});
