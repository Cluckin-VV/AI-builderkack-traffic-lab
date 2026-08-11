import json
import unittest
from pathlib import Path

from ai_builder.model_adapter import FakeModelAdapter, run_model_command
from ai_builder.scene import EventLog, SceneState


CASES = json.loads((Path(__file__).parents[1] / "evaluation_cases.json").read_text(encoding="utf-8"))


class EvaluationCaseTests(unittest.TestCase):
    def test_evaluation_set_has_at_least_20_cases(self):
        self.assertGreaterEqual(len(CASES), 20)

    def test_all_cases_match_expected_pipeline_results(self):
        accepted = rejected = state_errors = log_errors = 0
        for case in CASES:
            state, log = (SceneState(buses=1), EventLog()) if case["expected_action_type"] == "move_bus" else (SceneState(), EventLog())
            result = run_model_command(FakeModelAdapter(), case["command"], state, log)
            event = result["event"]
            self.assertEqual(result["status"], case["expected_status"], case["id"])
            actual_type = event["action_protocol"]["action_type"] if event["action_protocol"] else None
            self.assertEqual(actual_type, case["expected_action_type"], case["id"])
            self.assertEqual(result["state"], case["expected_state_change"], case["id"])
            for field in ("command", "source_command", "action", "validation", "state_before", "state_after", "rejected_reason"):
                if field not in event:
                    log_errors += 1
            self.assertEqual(event["command"], event["source_command"], case["id"])
            if case["expected_status"] == "accepted":
                accepted += 1
            else:
                rejected += 1
                if event["state_before"] != event["state_after"]:
                    state_errors += 1
        self.assertEqual(accepted, 13)
        self.assertEqual(rejected, 10)
        self.assertEqual(state_errors, 0)
        self.assertEqual(log_errors, 0)


if __name__ == "__main__":
    unittest.main()
