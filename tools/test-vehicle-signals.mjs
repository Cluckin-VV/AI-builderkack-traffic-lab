import test from 'node:test';
import assert from 'node:assert/strict';
import { TURN_END_PROGRESS, turnSignalState } from '../ai_builder/static/vehicle-signals.mjs';

test('left and right route intent select only their matching indicator', () => {
  assert.deepEqual(turnSignalState({ movement: 'left', pathProgress: .35, elapsedSeconds: 0 }), { left: true, right: false });
  assert.deepEqual(turnSignalState({ movement: 'right', pathProgress: .35, elapsedSeconds: 0 }), { left: false, right: true });
  assert.deepEqual(turnSignalState({ movement: 'straight', pathProgress: .35, elapsedSeconds: 0 }), { left: false, right: false });
});

test('turn indicators blink predictably without changing route intent', () => {
  assert.equal(turnSignalState({ movement: 'left', pathProgress: .2, elapsedSeconds: .34 }).left, false);
  assert.equal(turnSignalState({ movement: 'left', pathProgress: .2, elapsedSeconds: .68 }).left, true);
});

test('indicators stop after the turn has cleared the junction', () => {
  assert.deepEqual(turnSignalState({ movement: 'left', pathProgress: TURN_END_PROGRESS, elapsedSeconds: 0 }), { left: false, right: false });
  assert.deepEqual(turnSignalState({ movement: 'right', pathProgress: 1, elapsedSeconds: 0 }), { left: false, right: false });
});
