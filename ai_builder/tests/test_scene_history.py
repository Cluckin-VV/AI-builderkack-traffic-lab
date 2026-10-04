"""End-user guarantees for reversible, validated scene edits."""
import json
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from unittest.mock import patch

from ai_builder.scene import SceneState, EventLog
from ai_builder.scene_plan import DeterministicScenePlanner, PendingPlanStore, preview_scene_plan, execute_pending_plan
from ai_builder.scene_history import SceneHistory
from ai_builder.server import SceneHandler


class SceneHistoryTests(unittest.TestCase):
    def setUp(self):
        self.state = SceneState()
        self.store = PendingPlanStore()
        self.history = SceneHistory()

    def commit(self, command):
        before = self.state.snapshot()
        plan = DeterministicScenePlanner().generate_plan(command)
        self.store.put(plan, preview_scene_plan(plan, self.state), self.state)
        result = execute_pending_plan(plan['plan_id'], self.state, self.store)
        self.assertEqual(result['status'], 'accepted')
        self.history.record(command, before, self.state.snapshot())

    def test_undo_preview_is_detached_and_confirm_restores_all_fields(self):
        initial = self.state.snapshot()
        self.commit('创建公交站情境然后增加两辆公交车并让天气下雪并把灯变成红色')
        after = self.state.snapshot()
        change_id = self.history.status(self.state)['change_id']
        undo = self.history.prepare_undo(change_id, self.state, self.store)
        self.assertEqual(undo['status'], 'preview_ready')
        self.assertEqual(undo['projected_state'], initial)
        self.assertEqual(self.state.snapshot(), after)
        result = execute_pending_plan(undo['plan']['plan_id'], self.state, self.store)
        self.assertEqual(result['status'], 'accepted')
        self.history.finish_undo(change_id)
        self.assertEqual(self.state.snapshot(), initial)
        self.assertFalse(self.history.status(self.state)['available'])

    def test_restore_six_deleted_stopped_buses_includes_implicit_motion_state(self):
        self.state = SceneState(buses=6, bus_running=False)
        before = self.state.snapshot()
        self.commit('删除六辆公交车')
        change_id = self.history.status(self.state)['change_id']
        undo = self.history.prepare_undo(change_id, self.state, self.store)
        self.assertEqual(undo['projected_state'], before)
        self.assertEqual(len(undo['steps']), 7)
        self.assertEqual(preview_scene_plan(undo['plan'], self.state)['error_code'], 'INVALID_PLAN_LENGTH')
        result = execute_pending_plan(undo['plan']['plan_id'], self.state, self.store)
        self.assertEqual(result['status'], 'accepted')
        self.assertEqual(self.state.snapshot(), before)

    def test_undo_cannot_override_a_newer_change(self):
        self.commit('增加一辆公交车')
        old = self.history.status(self.state)['change_id']
        self.commit('让天气下雪')
        before = self.state.snapshot()
        self.assertEqual(self.history.prepare_undo(old, self.state, self.store)['status'], 'rejected')
        self.assertEqual(self.state.snapshot(), before)

    def test_undo_uses_both_validators_and_never_applies_to_live_state_during_preview(self):
        self.commit('增加一辆公交车')
        from ai_builder import scene_plan
        with patch.object(scene_plan, 'validate_scene_action_schema', wraps=scene_plan.validate_scene_action_schema) as schema, patch.object(scene_plan, 'validate_scene_action_semantics', wraps=scene_plan.validate_scene_action_semantics) as semantic:
            undo = self.history.prepare_undo(self.history.status(self.state)['change_id'], self.state, self.store)
        self.assertEqual(undo['status'], 'preview_ready')
        self.assertTrue(schema.called and semantic.called)
        self.assertEqual(self.state.buses, 1)

    def test_noop_does_not_displace_latest_change_and_history_is_bounded(self):
        self.history = SceneHistory(max_changes=2)
        self.commit('增加一辆公交车')
        self.commit('让天气下雪')
        latest = self.history.status(self.state)['change_id']
        self.commit('让天气下雪')
        self.assertEqual(self.history.status(self.state)['change_id'], latest)
        self.commit('把灯变成红色')
        self.assertEqual(self.history.status(self.state)['depth'], 2)


class WorkbenchHttpTests(unittest.TestCase):
    def setUp(self):
        class Handler(SceneHandler):
            state = SceneState()
            event_log = EventLog()
            plan_store = PendingPlanStore()
            history = SceneHistory()
        self.handler = Handler
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.thread = Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(2)

    def request(self, path, data=None):
        connection = HTTPConnection('127.0.0.1', self.server.server_port, timeout=3)
        connection.request('GET' if data is None else 'POST', path, None if data is None else json.dumps(data).encode(), {'Content-Type': 'application/json'})
        response = connection.getresponse()
        result = json.loads(response.read())
        connection.close()
        return response.status, result

    def preview(self, command):
        return self.request('/plan/preview', {'command': command})[1]

    def execute(self, preview):
        return self.request('/plan/execute', {'plan_id': preview['plan']['plan_id']})[1]

    def test_cancelled_plan_is_not_executable(self):
        preview = self.preview('增加一辆公交车')
        self.request('/plan/cancel', {'plan_id': preview['plan']['plan_id']})
        self.assertEqual(self.execute(preview)['status'], 'rejected')
        self.assertEqual(self.handler.state.buses, 0)

    def test_undo_is_preview_first_and_event_links_original_change(self):
        executed = self.execute(self.preview('创建公交站情境然后增加两辆公交车并让天气下雪'))
        change = executed['undo']['change_id']
        _, preview = self.request('/history/undo-preview', {'change_id': change})
        self.assertEqual(self.handler.state.buses, 2)
        undone = self.execute(preview)
        self.assertEqual(undone['event']['undo_of'], change)
        self.assertEqual(undone['event']['validation_stage'], 'execution')
        self.assertEqual(self.handler.state.snapshot(), SceneState().snapshot())
        self.assertFalse(undone['undo']['available'])
        self.assertEqual(self.execute(preview)['status'], 'rejected')

    def test_new_accepted_change_invalidates_existing_previews(self):
        old = self.preview('让天气下雪')
        self.execute(self.preview('增加一辆公交车'))
        self.assertEqual(self.execute(old)['status'], 'rejected')
        self.assertEqual(self.handler.state.weather, 'clear')

    def test_single_command_also_invalidates_previews_and_supports_undo(self):
        old = self.preview('让天气下雪')
        _, result = self.request('/command', {'command': '增加一辆公交车'})
        self.assertTrue(result['undo']['available'])
        self.assertEqual(self.execute(old)['status'], 'rejected')

    def test_same_prompt_gets_independent_confirmations(self):
        first = self.preview('增加一辆公交车')
        second = self.preview('增加一辆公交车')
        self.assertNotEqual(first['plan']['plan_id'], second['plan']['plan_id'])
        self.execute(first)
        self.assertEqual(self.execute(second)['status'], 'rejected')

    def test_client_cannot_supply_an_undo_target(self):
        status, _ = self.request('/history/undo-preview', {'change_id': 'invented', 'state_before': {'buses': 999}})
        self.assertEqual(status, 400)
        self.assertEqual(self.handler.state.buses, 0)

    def test_non_object_request_returns_400(self):
        self.assertEqual(self.request('/plan/preview', ['command'])[0], 400)

    def test_browser_exposes_preview_scene_and_undo_controls(self):
        page = (SceneHandler.page())
        script = (Path(__file__).resolve().parents[1] / 'static' / 'app.js').read_text(encoding='utf-8')
        self.assertIn('id="undo-last"', page)
        self.assertIn('id="preview-badge"', page)
        self.assertIn('/history/undo-preview', script)
        self.assertIn('projected_scene', script)
