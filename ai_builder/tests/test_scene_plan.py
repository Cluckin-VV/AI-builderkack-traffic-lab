import unittest
import json
from pathlib import Path
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from threading import Thread

from ai_builder.scene import EventLog, SceneState
from ai_builder.server import SceneHandler
from ai_builder.scene_plan import (
    DeterministicScenePlanner,
    PendingPlanStore,
    execute_pending_plan,
    preview_scene_plan,
)


class ScenePlanTests(unittest.TestCase):
    def test_compound_prompt_produces_ordered_actions(self):
        plan = DeterministicScenePlanner().generate_plan(
            "让天气下雪，然后增加两辆公交车并把信号灯改成红色"
        )

        self.assertEqual(
            [step["action_type"] for step in plan["actions"]],
            ["set_weather", "add_bus", "add_bus", "set_traffic_light"],
        )

    def test_preview_never_mutates_live_state(self):
        state = SceneState()
        before = state.snapshot()
        plan = DeterministicScenePlanner().generate_plan("增加两辆公交车并把信号灯改成红色")

        result = preview_scene_plan(plan, state)

        self.assertEqual(result["status"], "preview_ready")
        self.assertEqual(state.snapshot(), before)
        self.assertEqual(result["projected_state"]["buses"], 2)
        self.assertEqual(result["projected_state"]["traffic_light"], "红灯")

    def test_unknown_expression_is_rejected_without_state_change(self):
        state = SceneState(buses=1)
        before = state.snapshot()

        result = DeterministicScenePlanner().try_generate_plan("让公交车飞上月球")

        self.assertEqual(result["status"], "rejected")
        self.assertEqual(result["error_code"], "UNSUPPORTED_INTENT")
        self.assertEqual(state.snapshot(), before)

    def test_recognized_action_with_unknown_tail_is_rejected(self):
        result = DeterministicScenePlanner().try_generate_plan("增加一辆公交车飞上月球")

        self.assertEqual(result["status"], "rejected")
        self.assertEqual(result["error_code"], "UNSUPPORTED_INTENT")

    def test_blind_test_natural_variants_compile(self):
        planner = DeterministicScenePlanner()

        self.assertEqual(planner.generate_plan("帮我把公交车停下来")["actions"][0]["action_type"], "stop_bus")
        self.assertEqual(planner.generate_plan("道路上再来一辆公交")["actions"][0]["action_type"], "add_bus")
        red = planner.generate_plan("把信号灯调成红色")["actions"][0]
        self.assertEqual((red["action_type"], red["parameters"]), ("set_traffic_light", {"color": "红灯"}))

    def test_weather_editor_phrases_compile_for_all_weather_states(self):
        planner = DeterministicScenePlanner()
        cases = {
            "让天气变成晴天": "clear",
            "切换雨天": "rain",
            "让天气下雪": "snow",
            "让天气起雾": "fog",
        }

        for command, expected in cases.items():
            with self.subTest(command=command):
                action = planner.generate_plan(command)["actions"][0]
                self.assertEqual(action["action_type"], "set_weather")
                self.assertEqual(action["parameters"], {"weather": expected})

    def test_semantic_failure_rejects_whole_plan_atomically(self):
        state = SceneState(buses=0)
        plan = DeterministicScenePlanner().generate_plan("删除一辆公交车然后让天气下雪")

        result = preview_scene_plan(plan, state)

        self.assertEqual(result["status"], "rejected")
        self.assertEqual(result["validation_stage"], "semantic")
        self.assertEqual(state.snapshot(), SceneState().snapshot())

    def test_capacity_failure_rejects_whole_plan_atomically(self):
        state = SceneState(buses=11)
        plan = DeterministicScenePlanner().generate_plan("增加两辆公交车")

        result = preview_scene_plan(plan, state)

        self.assertEqual(result["status"], "rejected")
        self.assertEqual(result["error_code"], "SEMANTIC_CAPACITY_REACHED")
        self.assertEqual(state.buses, 11)

    def test_confirmed_plan_executes_all_steps_once(self):
        state = SceneState()
        store = PendingPlanStore()
        plan = DeterministicScenePlanner().generate_plan("增加两辆公交车并把信号灯改成红色")
        preview = preview_scene_plan(plan, state)
        store.put(plan, preview, state)

        result = execute_pending_plan(plan["plan_id"], state, store)

        self.assertEqual(result["status"], "accepted")
        self.assertEqual(state.buses, 2)
        self.assertEqual(state.traffic_light, "红灯")
        self.assertEqual(result["applied_action_count"], 3)
        replay = execute_pending_plan(plan["plan_id"], state, store)
        self.assertEqual(replay["status"], "rejected")

    def test_stale_preview_cannot_execute(self):
        state = SceneState()
        store = PendingPlanStore()
        plan = DeterministicScenePlanner().generate_plan("增加一辆公交车")
        preview = preview_scene_plan(plan, state)
        store.put(plan, preview, state)
        state.buses = 1

        result = execute_pending_plan(plan["plan_id"], state, store)

        self.assertEqual(result["status"], "rejected")
        self.assertEqual(result["error_code"], "STALE_PLAN")
        self.assertEqual(state.buses, 1)

    def test_pending_plan_store_has_bounded_capacity(self):
        state = SceneState()
        store = PendingPlanStore(max_plans=2)
        planner = DeterministicScenePlanner()
        plans = [planner.generate_plan(command) for command in ("增加一辆公交车", "让天气下雪", "把信号灯改成红色")]
        for plan in plans:
            store.put(plan, preview_scene_plan(plan, state), state)

        self.assertIsNone(store.pop(plans[0]["plan_id"]))
        self.assertIsNotNone(store.pop(plans[2]["plan_id"]))

    def test_plan_actions_use_scene_action_v02(self):
        plan = DeterministicScenePlanner().generate_plan("让天气下雨并增加一辆公交车")

        self.assertTrue(plan["actions"])
        self.assertTrue(all(action["protocol_version"] == "0.2" for action in plan["actions"]))


class ScenePlanHttpTests(unittest.TestCase):
    def setUp(self):
        SceneHandler.state = SceneState()
        SceneHandler.event_log = EventLog()
        SceneHandler.plan_store = PendingPlanStore()
        SceneHandler.planner = DeterministicScenePlanner()
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), SceneHandler)
        self.thread = Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def post(self, path, payload):
        connection = HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        connection.request("POST", path, json.dumps(payload, ensure_ascii=False).encode("utf-8"), {"Content-Type": "application/json"})
        response = connection.getresponse()
        body = json.loads(response.read().decode("utf-8"))
        connection.close()
        return response.status, body

    def test_preview_endpoint_returns_plan_without_mutating_scene(self):
        status, body = self.post("/plan/preview", {"command": "让天气下雪并增加两辆公交车"})

        self.assertEqual(status, 200)
        self.assertEqual(body["status"], "preview_ready")
        self.assertEqual(body["projected_scene"]["buses"], 2)
        self.assertEqual(SceneHandler.state.buses, 0)

    def test_execute_endpoint_commits_stored_plan(self):
        _, preview = self.post("/plan/preview", {"command": "增加一辆公交车并把信号灯改成红色"})

        status, result = self.post("/plan/execute", {"plan_id": preview["plan"]["plan_id"]})

        self.assertEqual(status, 200)
        self.assertEqual(result["status"], "accepted")
        self.assertEqual(result["scene"]["buses"], 1)
        self.assertEqual(result["scene"]["traffic_light"], "红灯")
        self.assertEqual(result["event"]["validation_stage"], "execution")

    def test_rejected_preview_does_not_create_executable_plan(self):
        status, body = self.post("/plan/preview", {"command": "让公交车飞上月球"})

        self.assertEqual(status, 422)
        self.assertEqual(body["status"], "rejected")
        self.assertEqual(SceneHandler.state.snapshot(), SceneState().snapshot())

    def test_browser_exposes_preview_and_confirm_workflow(self):
        root = Path(__file__).resolve().parents[1] / "static"
        page = (root / "index.html").read_text(encoding="utf-8")
        script = (root / "app.js").read_text(encoding="utf-8")

        self.assertIn('id="plan-preview"', page)
        self.assertIn('id="confirm-plan"', page)
        self.assertIn('fetch("/plan/preview"', script)
        self.assertIn('fetch("/plan/execute"', script)

    def test_browser_exposes_previewed_resume_to_automatic_signals(self):
        root = Path(__file__).resolve().parents[1] / "static"
        page = (root / "index.html").read_text(encoding="utf-8")
        script = (root / "app.js").read_text(encoding="utf-8")

        self.assertIn('id="resume-auto-signal"', page)
        self.assertIn('const command = "恢复自动信号"', script)
        self.assertIn('projected.signal_mode', script)


if __name__ == "__main__":
    unittest.main()
