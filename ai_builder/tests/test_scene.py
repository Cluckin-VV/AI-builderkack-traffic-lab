import unittest
import json
from http.client import HTTPConnection
from threading import Thread

from ai_builder.scene import (
    EventLog,
    SceneAction,
    SceneCompiler,
    SceneState,
    Validator,
    render_command,
)
from ai_builder.server import SceneHandler
from http.server import ThreadingHTTPServer


class ScenePipelineTests(unittest.TestCase):
    def setUp(self):
        self.state = SceneState()
        self.log = EventLog()

    def test_add_bus_command(self):
        result = render_command("增加一辆公交车", self.state, self.log)
        self.assertEqual(result["status"], "accepted")
        self.assertEqual(self.state.buses, 1)
        self.assertIn("公交车：1", result["rendered"])

    def test_red_light_command(self):
        result = render_command("把信号灯变成红灯", self.state, self.log)
        self.assertEqual(result["status"], "accepted")
        self.assertEqual(self.state.traffic_light, "红灯")

    def test_unknown_command_is_rejected_without_state_change(self):
        before = self.state.snapshot()
        result = render_command("增加一架飞机", self.state, self.log)
        self.assertEqual(result["status"], "rejected")
        self.assertEqual(self.state.snapshot(), before)

    def test_validator_rejects_illegal_action(self):
        action = SceneAction("set_traffic_light", {"color": "紫灯"})
        validation = Validator().validate(action, self.state)
        self.assertEqual(validation.status, "rejected")
        self.assertEqual(self.state.snapshot(), {"buses": 0, "traffic_light": "绿灯", "bus_running": True, "weather": "clear"})

    def test_two_legal_commands_update_one_state(self):
        render_command("增加一辆公交车", self.state, self.log)
        render_command("把信号灯变成红灯", self.state, self.log)
        self.assertEqual(self.state.snapshot(), {"buses": 1, "traffic_light": "红灯", "bus_running": True, "weather": "clear"})

    def test_event_log_explains_command_action_validation_and_state_change(self):
        render_command("增加一辆公交车", self.state, self.log)
        event = self.log.events[0]
        self.assertEqual(event["command"], "增加一辆公交车")
        self.assertEqual(event["action"], {"name": "add_bus", "parameters": {}})
        self.assertEqual(event["validation"], {"status": "accepted", "reason": "valid"})
        self.assertEqual(event["state_change"], {"before": {"buses": 0, "traffic_light": "绿灯", "bus_running": True, "weather": "clear"}, "after": {"buses": 1, "traffic_light": "绿灯", "bus_running": True, "weather": "clear"}})

    def test_browser_http_endpoint_returns_scene_and_event_log(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), SceneHandler)
        SceneHandler.state = SceneState()
        SceneHandler.event_log = EventLog()
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            connection = HTTPConnection("127.0.0.1", server.server_port)
            connection.request("POST", "/command", json.dumps({"command": "增加一辆公交车"}, ensure_ascii=False).encode("utf-8"), {"Content-Type": "application/json"})
            response = connection.getresponse()
            result = json.loads(response.read())
            self.assertEqual(response.status, 200)
            self.assertEqual(result["scene"]["buses"], 1)
            self.assertEqual(result["event"]["command"], "增加一辆公交车")
        finally:
            server.shutdown()
            server.server_close()

    def test_renderer_exposes_read_only_3d_scene_data(self):
        result = render_command("增加一辆公交车", self.state, self.log)
        self.assertEqual(result["scene"]["projection"], "perspective")
        self.assertEqual(result["scene"]["road"], {"layout": "crossroads", "approaches": 4, "lanes_per_road": 2, "length": 160})
        self.assertEqual(result["scene"]["bus_count"], 1)
        self.assertEqual(result["scene"]["traffic_light"], "绿灯")

    def test_add_bus_aliases(self):
        for command in ("增加一辆公交车", "场景里来一辆公交车", "放一辆公交车到道路上"):
            state, log = SceneState(), EventLog()
            self.assertEqual(render_command(command, state, log)["status"], "accepted")
            self.assertEqual(state.buses, 1)

    def test_remove_bus_aliases(self):
        for command in ("删除一辆公交车", "移除一辆公交车", "删除公交车"):
            state, log = SceneState(buses=1), EventLog()
            self.assertEqual(render_command(command, state, log)["status"], "accepted")
            self.assertEqual(state.buses, 0)

    def test_red_light_aliases(self):
        for command in ("把信号灯变成红灯", "红灯", "设置为红色"):
            state, log = SceneState(), EventLog()
            self.assertEqual(render_command(command, state, log)["status"], "accepted")
            self.assertEqual(state.traffic_light, "红灯")

    def test_green_light_aliases(self):
        for command in ("把信号灯变成绿灯", "绿灯", "设置为绿色"):
            state, log = SceneState(traffic_light="红灯"), EventLog()
            self.assertEqual(render_command(command, state, log)["status"], "accepted")
            self.assertEqual(state.traffic_light, "绿灯")

    def test_stop_bus_aliases(self):
        for command in ("让公交车停下", "公交车停止", "让公交车停住"):
            state, log = SceneState(buses=1), EventLog()
            self.assertEqual(render_command(command, state, log)["status"], "accepted")
            self.assertFalse(state.bus_running)

    def test_move_bus_aliases(self):
        for command in ("让公交车前进", "公交车继续行驶", "让公交车继续前进"):
            state, log = SceneState(buses=1, bus_running=False), EventLog()
            self.assertEqual(render_command(command, state, log)["status"], "accepted")
            self.assertTrue(state.bus_running)

    def test_boundary_commands_are_rejected_without_state_change(self):
        for command in ("", "弄一下交通", "增加公交车并变红", "让出租车停下", "设置为蓝色"):
            state, log = SceneState(), EventLog()
            before = state.snapshot()
            result = render_command(command, state, log)
            self.assertEqual(result["status"], "rejected")
            self.assertEqual(state.snapshot(), before)

    def test_motion_requires_an_existing_bus(self):
        for command in ("让公交车停下", "让公交车前进"):
            state, log = SceneState(), EventLog()
            self.assertEqual(render_command(command, state, log)["status"], "rejected")
            self.assertEqual(state.buses, 0)

    def test_event_log_preserves_original_command_and_action(self):
        state, log = SceneState(), EventLog()
        render_command("场景里来一辆公交车", state, log)
        self.assertEqual(log.events[-1]["command"], "场景里来一辆公交车")
        self.assertEqual(log.events[-1]["action"]["name"], "add_bus")
        self.assertEqual(log.events[-1]["validation"]["status"], "accepted")

    def test_add_bus_alias_scene_arrival(self):
        self.assertEqual(render_command("场景里来一辆公交车", SceneState(), EventLog())["status"], "accepted")

    def test_add_bus_alias_road(self):
        self.assertEqual(render_command("放一辆公交车到道路上", SceneState(), EventLog())["status"], "accepted")

    def test_remove_bus_alias_short(self):
        self.assertEqual(render_command("删除公交车", SceneState(buses=1), EventLog())["status"], "accepted")

    def test_red_light_alias_short(self):
        self.assertEqual(render_command("红灯", SceneState(), EventLog())["status"], "accepted")

    def test_green_light_alias_short(self):
        self.assertEqual(render_command("绿灯", SceneState(traffic_light="红灯"), EventLog())["status"], "accepted")

    def test_stop_bus_alias_short(self):
        self.assertEqual(render_command("公交车停止", SceneState(buses=1), EventLog())["status"], "accepted")

    def test_move_bus_alias_short(self):
        self.assertEqual(render_command("公交车继续行驶", SceneState(buses=1), EventLog())["status"], "accepted")

    def test_move_bus_natural_alias_with_request(self):
        self.assertEqual(render_command("让公交车继续行驶", SceneState(buses=1, bus_running=False), EventLog())["status"], "accepted")

    def test_move_bus_natural_alias_changes_motion_state(self):
        state, log = SceneState(buses=1, bus_running=False), EventLog()
        render_command("让公交车继续行驶", state, log)
        self.assertTrue(state.bus_running)

    def test_red_light_natural_alias_with_change(self):
        self.assertEqual(render_command("把信号灯改成红色", SceneState(), EventLog())["status"], "accepted")

    def test_red_light_natural_alias_sets_red(self):
        state, log = SceneState(), EventLog()
        render_command("把信号灯改成红色", state, log)
        self.assertEqual(state.traffic_light, "红灯")

    def test_green_light_natural_alias_with_change(self):
        self.assertEqual(render_command("把红灯变回绿色", SceneState(traffic_light="红灯"), EventLog())["status"], "accepted")

    def test_green_light_natural_alias_sets_green(self):
        state, log = SceneState(traffic_light="红灯"), EventLog()
        render_command("把红灯变回绿色", state, log)
        self.assertEqual(state.traffic_light, "绿灯")

    def test_combined_natural_motion_and_light_is_rejected(self):
        state, log = SceneState(buses=1), EventLog()
        before = state.snapshot()
        self.assertEqual(render_command("让公交车继续行驶并把信号灯变红", state, log)["status"], "rejected")
        self.assertEqual(state.snapshot(), before)
        self.assertEqual(log.events[-1]["rejected_reason"], "unknown command")

    def test_combined_natural_add_and_light_is_rejected(self):
        state, log = SceneState(), EventLog()
        before = state.snapshot()
        self.assertEqual(render_command("增加公交车并把灯改成绿色", state, log)["status"], "rejected")
        self.assertEqual(state.snapshot(), before)
        self.assertEqual(log.events[-1]["rejected_reason"], "unknown command")

    def test_invalid_color_is_rejected(self):
        state, log = SceneState(), EventLog()
        self.assertEqual(render_command("设置为蓝色", state, log)["status"], "rejected")

    def test_combined_action_is_rejected(self):
        state, log = SceneState(), EventLog()
        self.assertEqual(render_command("增加公交车并变红", state, log)["status"], "rejected")

    def test_scene_action_has_protocol_fields(self):
        action = SceneCompiler().compile("增加一辆公交车")
        self.assertEqual(set(action.to_dict()), {"version", "action_type", "target", "parameters", "source_command", "action_id"})

    def test_scene_action_json_round_trip(self):
        action = SceneCompiler().compile("红灯")
        self.assertEqual(SceneAction.from_json(action.to_json()), action)

    def test_json_round_trip_preserves_action_id(self):
        action = SceneCompiler().compile("增加一辆公交车")
        self.assertEqual(SceneAction.from_json(action.to_json()).action_id, action.action_id)

    def test_validator_rejects_unknown_action_type(self):
        action = SceneAction("bad", "traffic_light", {}, "x", "bad")
        self.assertEqual(Validator().validate(action, SceneState()).status, "rejected")

    def test_validator_rejects_unknown_parameter(self):
        action = SceneAction("set_traffic_light", "traffic_light", {"color": "红灯", "extra": 1}, "x", "bad")
        self.assertEqual(Validator().validate(action, SceneState()).status, "rejected")

    def test_validator_rejects_wrong_parameter_type(self):
        action = SceneAction("set_traffic_light", "traffic_light", {"color": 1}, "x", "bad")
        self.assertEqual(Validator().validate(action, SceneState()).status, "rejected")

    def test_validator_rejects_unsupported_version(self):
        action = SceneAction("add_bus", "road", {}, "x", "bad", version="9.9")
        self.assertEqual(Validator().validate(action, SceneState()).status, "rejected")

    def test_validator_rejects_missing_required_field(self):
        action = SceneAction("", "road", {}, "x", "bad")
        self.assertEqual(Validator().validate(action, SceneState()).status, "rejected")

    def test_state_rejects_unvalidated_action(self):
        state = SceneState()
        with self.assertRaises(ValueError):
            state.apply(SceneCompiler().compile("增加一辆公交车"))

    def test_same_action_replay_is_deterministic(self):
        action = SceneCompiler().compile("增加一辆公交车")
        first, second = SceneState(), SceneState()
        validator = Validator()
        first.apply(action, validator.validate(action, first))
        second.apply(SceneAction.from_json(action.to_json()), validator.validate(action, second))
        self.assertEqual(first.snapshot(), second.snapshot())

    def test_event_log_contains_protocol_explanation(self):
        state, log = SceneState(), EventLog()
        render_command("红灯", state, log)
        event = log.events[-1]
        for field in ("action_id", "source_command", "action", "validation_result", "state_before", "state_after", "rejected_reason"):
            self.assertIn(field, event)

    def test_illegal_action_rejected_without_state_change_and_logged(self):
        state = SceneState()
        event_log = EventLog()
        state_before = state.snapshot()
        action = SceneAction("set_traffic_light", "traffic_light", {"color": "蓝灯"}, "设置为蓝色", "illegal-color")

        validation = Validator().validate(action, state)
        self.assertEqual(validation.status, "rejected")
        if validation.status == "accepted":
            state.apply(action, validation)
        event_log.append({
            "action_id": action.action_id,
            "source_command": action.source_command,
            "action": action.to_dict(),
            "validation_result": validation.as_dict(),
            "state_before": state_before,
            "state_after": state.snapshot(),
            "rejected_reason": validation.reason,
        })

        self.assertEqual(state.snapshot(), state_before)
        self.assertEqual(event_log.events[-1]["rejected_reason"], "illegal color")


if __name__ == "__main__":
    unittest.main()
