import unittest
import json
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from threading import Thread

from ai_builder.model_adapter import FakeModelAdapter, run_model_command
from ai_builder.scene import (
    EventLog,
    MAX_BUSES,
    SceneAction,
    SceneState,
    ValidationResult,
    Validator,
)
from ai_builder.server import SceneHandler


class BusCapacityContractTests(unittest.TestCase):
    def test_twelfth_bus_is_accepted(self):
        state = SceneState(buses=MAX_BUSES - 1)

        result = run_model_command(
            FakeModelAdapter(), "增加一辆公交车", state, EventLog()
        )

        self.assertEqual(result["status"], "accepted")
        self.assertEqual(state.buses, MAX_BUSES)

    def test_thirteenth_bus_is_rejected_before_state_apply(self):
        state = SceneState(buses=MAX_BUSES)
        before = state.snapshot()

        result = run_model_command(
            FakeModelAdapter(), "增加一辆公交车", state, EventLog()
        )

        self.assertEqual(result["status"], "rejected")
        self.assertEqual(result["event"]["validation_stage"], "semantic")
        self.assertEqual(result["event"]["error_code"], "SEMANTIC_CAPACITY_REACHED")
        self.assertEqual(result["event"]["rejected_reason"], "SEMANTIC_CAPACITY_REACHED")
        self.assertEqual(state.snapshot(), before)

    def test_removing_from_capacity_allows_one_bus_to_be_added_again(self):
        state = SceneState(buses=MAX_BUSES)

        removed = run_model_command(
            FakeModelAdapter(), "删除一辆公交车", state, EventLog()
        )
        added = run_model_command(
            FakeModelAdapter(), "增加一辆公交车", state, EventLog()
        )

        self.assertEqual(removed["status"], "accepted")
        self.assertEqual(added["status"], "accepted")
        self.assertEqual(state.buses, MAX_BUSES)

    def test_legacy_validator_uses_the_same_capacity_contract(self):
        state = SceneState(buses=MAX_BUSES)
        action = SceneAction(
            "add_bus", "road", {}, "增加一辆公交车", "capacity-test"
        )

        validation = Validator().validate(action, state)

        self.assertEqual(validation.status, "rejected")
        self.assertEqual(validation.reason, "bus capacity reached")

    def test_scene_state_defends_capacity_invariant(self):
        state = SceneState(buses=MAX_BUSES)
        before = state.snapshot()
        action = SceneAction(
            "add_bus", "road", {}, "增加一辆公交车", "capacity-test"
        )
        forged_acceptance = ValidationResult("accepted", "valid", action.action_id)

        with self.assertRaisesRegex(ValueError, "公交车容量上限"):
            state.apply(action, forged_acceptance)

        self.assertEqual(state.snapshot(), before)

    def test_http_command_rejects_bus_beyond_visible_capacity(self):
        original_state = SceneHandler.state
        original_log = SceneHandler.event_log
        original_adapter = SceneHandler.adapter
        SceneHandler.state = SceneState(buses=MAX_BUSES)
        SceneHandler.event_log = EventLog()
        SceneHandler.adapter = FakeModelAdapter()
        server = ThreadingHTTPServer(("127.0.0.1", 0), SceneHandler)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            body = json.dumps({"command": "增加一辆公交车"}).encode("utf-8")
            connection = HTTPConnection("127.0.0.1", server.server_port, timeout=5)
            connection.request(
                "POST",
                "/command",
                body=body,
                headers={"Content-Type": "application/json", "Content-Length": str(len(body))},
            )
            response = connection.getresponse()
            payload = json.loads(response.read().decode("utf-8"))
            connection.close()

            self.assertEqual(response.status, 200)
            self.assertEqual(payload["status"], "rejected")
            self.assertEqual(payload["event"]["validation_stage"], "semantic")
            self.assertEqual(payload["scene"]["bus_count"], MAX_BUSES)
            self.assertEqual(SceneHandler.state.buses, MAX_BUSES)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)
            SceneHandler.state = original_state
            SceneHandler.event_log = original_log
            SceneHandler.adapter = original_adapter


if __name__ == "__main__":
    unittest.main()
