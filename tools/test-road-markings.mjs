import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { junctionPaint } from '../ai_builder/static/road-markings.mjs';

const layouts = JSON.parse(readFileSync(new URL('../ai_builder/scene_layouts.json', import.meta.url)));

for (const [name, layout] of Object.entries(layouts)) {
  if (!layout.junction) continue;
  test(`${name}: centre dividers leave the intersection and crosswalks unpainted`, () => {
    const paint = junctionPaint(layout);
    const stop = Math.abs(layout.junction.stop_line_s);
    assert.equal(paint.dividers.length, 8);
    for (const box of paint.dividers) {
      const along = box.width > box.depth ? box.x : box.z;
      const length = Math.max(box.width, box.depth);
      assert.ok(Math.abs(along) - length / 2 >= stop + .2 - 1e-9);
      assert.ok(Math.abs(along) + length / 2 <= 80 + 1e-9);
    }
  });
  test(`${name}: stop bars cover only their right-hand inbound carriageway`, () => {
    const paint = junctionPaint(layout);
    assert.equal(paint.stopBars.length, 4);
    for (const bar of paint.stopBars) {
      const approach = layout.junction.approaches[bar.approach];
      const longitudinal = bar.x * approach.forward[0] + bar.z * approach.forward[1];
      const lateral = bar.x * approach.right[0] + bar.z * approach.right[1];
      assert.equal(longitudinal, layout.junction.stop_line_s);
      assert.ok(lateral - Math.max(bar.width, bar.depth) / 2 > 0);
      assert.ok(lateral + Math.max(bar.width, bar.depth) / 2 < layout.road.width / 2);
    }
  });
}

test('road paint rejects invalid dimensions rather than producing inverted boxes', () => {
  assert.throws(() => junctionPaint({road:{width:0}}), RangeError);
  assert.throws(() => junctionPaint({junction:{stop_line_s:-90}}), RangeError);
});

test('renderer consumes the tested geometry rather than full-width stop bars', () => {
  const source = readFileSync(new URL('../ai_builder/static/urban-world.js', import.meta.url), 'utf8');
  assert.match(source, /junctionPaint\(definition\)/);
  assert.match(source, /paint\.stopBars/);
  assert.match(source, /paint\.dividers/);
});
