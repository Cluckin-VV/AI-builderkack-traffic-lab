import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEditorCommand } from '../ai_builder/static/scene-editor.mjs';

test('editor emits only the minimal supported command sequence', () => {
  const command = buildEditorCommand(
    { scene_layout: 'crossroads', buses: 1, weather: 'clear', traffic_light: '绿灯' },
    { scene_layout: 'bus_stop', buses: 3, weather: 'snow', traffic_light: '红灯' },
  );
  assert.equal(command, '创建公交站情境然后增加两辆公交车然后让天气下雪然后把信号灯变成红灯');
});

test('changing the signal in the typed editor preserves sedan and SUV counts', () => {
  const command = buildEditorCommand(
    { scene_layout: 'crossroads', vehicles: [
      ...Array.from({ length: 6 }, (_, i) => ({ id: `sedan-${i}`, type: 'sedan' })),
      ...Array.from({ length: 4 }, (_, i) => ({ id: `suv-${i}`, type: 'suv' })),
      ...Array.from({ length: 2 }, (_, i) => ({ id: `bus-${i}`, type: 'bus' })),
    ], weather: 'clear', traffic_light: '绿灯' },
    { scene_layout: 'crossroads', sedan: 6, suv: 4, buses: 2, weather: 'clear', traffic_light: '黄灯' },
  );
  assert.equal(command, '把信号灯变成黄灯');
});

test('editor emits removals and restoration without direct state access', () => {
  const command = buildEditorCommand(
    { scene_layout: 'bus_stop', buses: 3, weather: 'snow', traffic_light: '红灯' },
    { scene_layout: 'crossroads', buses: 1, weather: 'clear', traffic_light: '绿灯' },
  );
  assert.equal(command, '恢复十字路口然后删除两辆公交车然后让天气变成晴天然后把信号灯变成绿灯');
});

test('editor returns empty command for an unchanged target', () => {
  assert.equal(buildEditorCommand(
    { scene_layout: 'crossroads', buses: 2, weather: 'clear', traffic_light: '绿灯' },
    { scene_layout: 'crossroads', buses: 2, weather: 'clear', traffic_light: '绿灯' },
  ), '');
});

test('editor rejects invalid target values before creating a plan', () => {
  assert.throws(() => buildEditorCommand(
    { scene_layout: 'crossroads', buses: 0, weather: 'clear', traffic_light: '绿灯' },
    { scene_layout: 'moon', buses: 0, weather: 'clear', traffic_light: '绿灯' },
  ), /layout/);
  assert.throws(() => buildEditorCommand(
    { scene_layout: 'crossroads', buses: 0, weather: 'clear', traffic_light: '绿灯' },
    { scene_layout: 'crossroads', buses: 13, weather: 'clear', traffic_light: '绿灯' },
  ), /buses/);
});
