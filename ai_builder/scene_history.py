"""Bounded server-owned checkpoints; undo is a validated compensating plan."""

from copy import deepcopy
from dataclasses import dataclass, field
from uuid import uuid4

from ai_builder.scene_plan import MAX_PLAN_ACTIONS, build_scene_plan, preview_scene_plan


def _restore_specs(current, target):
    specs = []
    delta = target['buses'] - current['buses']
    specs.extend([('add_bus' if delta > 0 else 'remove_bus', {}) for _ in range(abs(delta))])
    # Removing the last bus implicitly resets running=True; restore that detail too.
    running_after_count = True if target['buses'] == 0 else current['bus_running']
    if target['bus_running'] != running_after_count:
        specs.append(('move_bus' if target['bus_running'] else 'stop_bus', {}))
    for key, kind, parameter, default in (
        ('scene_layout', 'set_scene_layout', 'layout', 'crossroads'),
        ('weather', 'set_weather', 'weather', 'clear'),
        ('traffic_light', 'set_traffic_light', 'color', '绿灯'),
    ):
        if current.get(key, default) != target.get(key, default):
            specs.append((kind, {parameter: target.get(key, default)}))
    current_mode = current.get('signal_mode', 'automatic')
    target_mode = target.get('signal_mode', 'automatic')
    if current_mode != target_mode:
        specs.append(('set_signal_mode', {'mode': target_mode}))
    return specs


@dataclass
class SceneHistory:
    max_changes: int = 20
    _changes: list = field(default_factory=list)

    def record(self, command, before, after):
        if before == after:
            return
        if self._changes and self._changes[-1]['after'] != before:
            self._changes.clear()  # A replaced SceneState must never inherit checkpoints.
        self._changes.append({'change_id': uuid4().hex, 'command': command,
                              'before': deepcopy(before), 'after': deepcopy(after)})
        self._changes = self._changes[-self.max_changes:]

    def status(self, state):
        latest = self._changes[-1] if self._changes else None
        available = latest is not None and latest['after'] == state.snapshot()
        return {'available': available, 'depth': len(self._changes) if available else 0,
                'change_id': latest['change_id'] if available else None,
                'command': latest['command'] if available else None}

    def prepare_undo(self, change_id, state, store):
        status = self.status(state)
        if not status['available'] or status['change_id'] != change_id:
            return {'status': 'rejected', 'error_code': 'STALE_UNDO',
                    'reason': '没有可撤销的修改，或场景已有新变化。'}
        saved = self._changes[-1]
        plan = build_scene_plan('撤销：' + saved['command'],
                                _restore_specs(state.snapshot(), saved['before']), source='history_undo')
        plan['plan_id'] = uuid4().hex
        # One extra compensation is needed if deleting all six stopped buses reset
        # bus_running. Ordinary user/LLM plans retain the six-action limit.
        preview = preview_scene_plan(plan, state, max_actions=MAX_PLAN_ACTIONS + 1)
        if preview['status'] == 'preview_ready' and preview['projected_state'] == saved['before']:
            store.put(plan, preview, state, undo_of=change_id)
            return {**preview, 'plan': plan, 'undo_of': change_id}
        return {'status': 'rejected', 'error_code': 'UNDO_NOT_REPRESENTABLE',
                'reason': '这次修改不能通过现有动作完整撤销。',
                'state_before': state.snapshot(), 'state_after': state.snapshot()}

    def finish_undo(self, change_id):
        if not self._changes or self._changes[-1]['change_id'] != change_id:
            raise ValueError('undo must refer to the latest checkpoint')
        self._changes.pop()
