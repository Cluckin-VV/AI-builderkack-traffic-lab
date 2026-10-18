import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const asset = JSON.parse(await readFile(new URL('../ai_builder/static/models/city-bus-v1.json', import.meta.url), 'utf8'));
const batches = Object.values(asset.batches);

test('bus export keeps transparent glazing and modeled passenger depth', () => {
  const glass = batches.filter(batch => batch.component === 'glass');
  const seats = batches.filter(batch => batch.component === 'seat');
  assert.ok(glass.length >= 1, 'bus needs a glazing batch');
  assert.ok(glass.every(batch => batch.opacity > .2 && batch.opacity < .6), 'bus glazing must remain visibly transparent');
  assert.ok(seats.length >= 2, 'bus needs separate seat and rail geometry');
  assert.ok(seats.reduce((sum, batch) => sum + batch.positions.length / 9, 0) >= 100, 'bus cabin needs enough geometry to read through windows');
});
