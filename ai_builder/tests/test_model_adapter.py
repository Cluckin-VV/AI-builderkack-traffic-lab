import unittest
import json
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from threading import Thread

from ai_builder.model_adapter import FakeModelAdapter, ModelAdapter, run_model_command
from ai_builder.scene import EventLog, SceneState
from ai_builder.server import SceneHandler


class ModelAdapterTests(unittest.TestCase):
    def _post(self, adapter, command):
        SceneHandler.state = SceneState()
        SceneHandler.event_log = EventLog()
        SceneHandler.adapter = adapter
        server = ThreadingHTTPServer(("127.0.0.1", 0), SceneHandler)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            connection = HTTPConnection("127.0.0.1", server.server_port)
            connection.request("POST", "/command", json.dumps({"command": command}, ensure_ascii=False).encode("utf-8"), {"Content-Type": "application/json"})
            response = connection.getresponse()
            return response.status, json.loads(response.read())
        finally:
            server.shutdown()
            server.server_close()

    def test_fake_adapter_is_model_adapter_and_returns_valid_add_action(self):
        adapter = FakeModelAdapter()
        self.assertIsInstance(adapter, ModelAdapter)
        result = run_model_command(adapter, "增加一辆公交车", SceneState(), EventLog())
        self.assertEqual(result["status"], "accepted")
        self.assertEqual(result["state"]["buses"], 1)

    def test_fake_adapter_returns_valid_red_light_action(self):
        result = run_model_command(FakeModelAdapter(), "把信号灯变成红灯", SceneState(), EventLog())
        self.assertEqual(result["status"], "accepted")
        self.assertEqual(result["state"]["traffic_light"], "红灯")

    def test_invalid_json_is_rejected(self):
        log, state = EventLog(), SceneState()
        result = run_model_command(FakeModelAdapter(mode="invalid_json"), "增加一辆公交车", state, log)
        self.assertEqual(result["status"], "rejected")
        self.assertEqual(result["event"]["rejected_reason"], "invalid JSON")

    def test_missing_field_is_rejected(self):
        result = run_model_command(FakeModelAdapter(mode="missing_field"), "增加一辆公交车", SceneState(), EventLog())
        self.assertEqual(result["status"], "rejected")
        self.assertEqual(result["event"]["rejected_reason"], "missing required field")

    def test_unknown_action_type_is_rejected(self):
        result = run_model_command(FakeModelAdapter(mode="unknown_action"), "增加一辆公交车", SceneState(), EventLog())
        self.assertEqual(result["status"], "rejected")
        self.assertEqual(result["event"]["rejected_reason"], "unknown action_type")

    def test_illegal_parameter_is_rejected(self):
        result = run_model_command(FakeModelAdapter(mode="illegal_color"), "把信号灯变成红灯", SceneState(), EventLog())
        self.assertEqual(result["status"], "rejected")
        self.assertEqual(result["event"]["rejected_reason"], "illegal color")

    def test_combined_action_output_is_rejected_and_state_is_unchanged(self):
        state, log = SceneState(), EventLog()
        before = state.snapshot()
        result = run_model_command(FakeModelAdapter(mode="combined_action"), "增加公交车并变红", state, log)
        self.assertEqual(result["status"], "rejected")
        self.assertEqual(state.snapshot(), before)
        self.assertEqual(log.events[-1]["rejected_reason"], "unknown action_type")

    def test_valid_model_action_can_be_replayed_deterministically(self):
        adapter = FakeModelAdapter()
        first, second = SceneState(), SceneState()
        log = EventLog()
        result = run_model_command(adapter, "增加一辆公交车", first, log)
        action_json = result["action_json"]
        replay = run_model_command(FakeModelAdapter(raw_output=action_json), "增加一辆公交车", second, EventLog())
        self.assertEqual(first.snapshot(), second.snapshot())
        self.assertEqual(replay["status"], "accepted")

    def test_http_uses_injected_adapter_for_valid_output(self):
        status, result = self._post(FakeModelAdapter(), "增加一辆公交车")
        self.assertEqual(status, 200)
        self.assertEqual(result["status"], "accepted")
        self.assertEqual(result["scene"]["bus_count"], 1)

    def test_http_rejects_invalid_model_output(self):
        _, result = self._post(FakeModelAdapter(mode="invalid_json"), "增加一辆公交车")
        self.assertEqual(result["status"], "rejected")
        self.assertEqual(result["event"]["rejected_reason"], "invalid JSON")

    def test_http_records_validator_rejection(self):
        _, result = self._post(FakeModelAdapter(mode="illegal_color"), "把信号灯变成红灯")
        self.assertEqual(result["status"], "rejected")
        self.assertEqual(result["event"]["validation_result"]["status"], "rejected")

    def test_http_rejection_keeps_state_unchanged(self):
        _, result = self._post(FakeModelAdapter(mode="combined_action"), "增加公交车并变红")
        self.assertEqual(result["event"]["state_before"], result["event"]["state_after"])

    def test_http_event_log_has_complete_model_pipeline_fields(self):
        _, result = self._post(FakeModelAdapter(mode="missing_field"), "增加一辆公交车")
        event = result["event"]
        for field in ("command", "source_command", "action", "validation", "state_before", "state_after", "rejected_reason"):
            self.assertIn(field, event)


if __name__ == "__main__":
    unittest.main()
