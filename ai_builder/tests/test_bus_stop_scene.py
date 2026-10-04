import json
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from threading import Thread

from ai_builder.scene import SceneState, Renderer, EventLog, validate_scene_action_schema
from ai_builder.scene_plan import DeterministicScenePlanner, PendingPlanStore, preview_scene_plan, execute_pending_plan
from ai_builder.server import SceneHandler


class BusStopSceneTests(unittest.TestCase):
    def test_command_produces_layout_action_without_mutating_state(self):
        state = SceneState()
        before = state.snapshot()
        plan = DeterministicScenePlanner().generate_plan("创建公交站情境")
        self.assertEqual(plan["actions"][0]["action_type"], "set_scene_layout")
        self.assertEqual(plan["actions"][0]["parameters"], {"layout": "bus_stop"})
        self.assertEqual(state.snapshot(), before)

    def test_compound_station_preview_has_projected_layout(self):
        state = SceneState()
        plan = DeterministicScenePlanner().generate_plan("创建公交站情境，然后增加两辆公交车并让天气下雪")
        result = preview_scene_plan(plan, state)
        self.assertEqual(result["status"], "preview_ready")
        self.assertEqual(result["projected_state"]["scene_layout"], "bus_stop")
        self.assertEqual(result["projected_state"]["buses"], 2)
        self.assertEqual(state.snapshot(), SceneState().snapshot())

    def test_confirm_commits_layout_and_retains_existing_objects(self):
        state = SceneState(buses=2, weather="snow", traffic_light="红灯")
        plan = DeterministicScenePlanner().generate_plan("创建公交站情境")
        store = PendingPlanStore()
        store.put(plan, preview_scene_plan(plan, state), state)
        result = execute_pending_plan(plan["plan_id"], state, store)
        self.assertEqual(result["status"], "accepted")
        self.assertEqual(state.scene_layout, "bus_stop")
        self.assertEqual((state.buses, state.weather, state.traffic_light), (2, "snow", "红灯"))

    def test_unknown_layout_is_schema_rejected(self):
        payload = {"protocol_version": "0.2", "action_id": "x", "action_type": "set_scene_layout", "parameters": {"layout": "moon"}}
        self.assertTrue(validate_scene_action_schema(payload))

    def test_layout_action_cannot_have_unknown_parameters(self):
        payload = {"protocol_version": "0.2", "action_id": "x", "action_type": "set_scene_layout", "parameters": {"layout": "bus_stop", "execute": "code"}}
        self.assertTrue(validate_scene_action_schema(payload))

    def test_plan_failure_rolls_back_layout_as_well_as_buses(self):
        state = SceneState()
        before = state.snapshot()
        plan = DeterministicScenePlanner().generate_plan("创建公交站情境然后删除一辆公交车")
        result = preview_scene_plan(plan, state)
        self.assertEqual(result["status"], "rejected")
        self.assertEqual(state.snapshot(), before)

    def test_bus_stop_render_data_has_two_approaches_and_docking_bays(self):
        state = SceneState(scene_layout="bus_stop")
        result = Renderer().render_data(state)
        self.assertEqual(result["road"]["approaches"], 2)
        self.assertEqual(result["road"]["layout"], "bus_stop")
        self.assertEqual(result["layout_data"]["station"]["stop_s"], -38)
        self.assertGreater(result["layout_data"]["station"]["dwell_seconds"], 0)

    def test_bus_stop_snapshot_round_trip_is_complete(self):
        state = SceneState(buses=2, scene_layout="bus_stop")
        restored = SceneState(**json.loads(json.dumps(state.snapshot())))
        self.assertEqual(restored.snapshot(), state.snapshot())

    def test_default_snapshot_preserves_existing_four_field_contract(self):
        self.assertEqual(set(SceneState().snapshot()), {"buses", "traffic_light", "bus_running", "weather"})
        self.assertEqual(Renderer().render_data(SceneState())["scene_layout"], "crossroads")

    def test_restore_crossroads_uses_validated_plan(self):
        state = SceneState(scene_layout="bus_stop", buses=1)
        plan = DeterministicScenePlanner().generate_plan("恢复十字路口")
        store = PendingPlanStore()
        store.put(plan, preview_scene_plan(plan, state), state)
        execute_pending_plan(plan["plan_id"], state, store)
        self.assertEqual(state.scene_layout, "crossroads")
        self.assertEqual(state.buses, 1)


class BusStopHttpTests(unittest.TestCase):
    def setUp(self):
        SceneHandler.state = SceneState()
        SceneHandler.event_log = EventLog()
        SceneHandler.plan_store = PendingPlanStore()
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), SceneHandler)
        self.thread = Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(2)

    def request(self, method, path, payload=None):
        connection = HTTPConnection("127.0.0.1", self.server.server_port)
        connection.request(method, path, json.dumps(payload, ensure_ascii=False).encode() if payload is not None else None, {"Content-Type": "application/json"})
        response = connection.getresponse()
        result = json.loads(response.read())
        connection.close()
        return response.status, result

    def test_http_station_preview_confirm_and_event_explain_layout_change(self):
        status, preview = self.request("POST", "/plan/preview", {"command": "创建公交站情境并增加两辆公交车"})
        self.assertEqual(status, 200)
        self.assertEqual(preview["scene"]["scene_layout"], "crossroads")
        self.assertEqual(preview["projected_scene"]["scene_layout"], "bus_stop")
        status, result = self.request("POST", "/plan/execute", {"plan_id": preview["plan"]["plan_id"]})
        self.assertEqual(result["scene"]["scene_layout"], "bus_stop")
        self.assertEqual(result["event"]["state_after"]["scene_layout"], "bus_stop")
        self.assertEqual(result["event"]["steps"][0]["action_type"], "set_scene_layout")

    def test_shared_manifest_is_served_without_mutation(self):
        before = SceneHandler.state.snapshot()
        status, manifest = self.request("GET", "/assets/scene-layouts.json")
        self.assertEqual(status, 200)
        self.assertEqual(manifest["bus_stop"]["road"]["approaches"], 2)
        self.assertEqual(SceneHandler.state.snapshot(), before)
