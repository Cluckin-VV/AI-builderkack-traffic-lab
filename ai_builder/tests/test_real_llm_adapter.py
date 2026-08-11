import unittest

from ai_builder.real_llm_adapter import SYSTEM_PROMPT, RealLLMAdapter
from ai_builder.model_adapter import FakeModelAdapter
from ai_builder.shadow_evaluate import evaluate


class RealLLMAdapterTests(unittest.TestCase):
    def test_system_prompt_requires_json_protocol_and_no_state_write(self):
        self.assertIn("JSON only", SYSTEM_PROMPT)
        self.assertIn("Do not modify SceneState", SYSTEM_PROMPT)
        self.assertIn("Do not add fields", SYSTEM_PROMPT)

    def test_adapter_with_mock_fallback_generates_candidate(self):
        result = RealLLMAdapter(fallback=FakeModelAdapter()).generate_action("增加一辆公交车")
        self.assertEqual(result["action_type"], "add_bus")

    def test_adapter_does_not_receive_state(self):
        adapter = RealLLMAdapter(fallback=FakeModelAdapter())
        self.assertEqual(adapter.generate_action("把信号灯变成红灯")["action_type"], "set_traffic_light")

    def test_shadow_evaluation_does_not_change_state(self):
        result = evaluate()
        self.assertEqual(result["state_changes"], 0)

    def test_shadow_evaluation_records_all_cases(self):
        result = evaluate()
        self.assertEqual(len(result["records"]), 23)

    def test_shadow_evaluation_has_no_protocol_extras_with_fake(self):
        self.assertEqual(evaluate()["extra_fields"], 0)

    def test_invalid_json_fallback_is_recorded_as_rejected(self):
        adapter = RealLLMAdapter(fallback=FakeModelAdapter(mode="invalid_json"))
        self.assertRaises(Exception, lambda: __import__("json").loads(adapter.generate_action("增加一辆公交车")))

    def test_no_api_key_does_not_require_network(self):
        adapter = RealLLMAdapter(fallback=FakeModelAdapter())
        self.assertEqual(adapter.generate_action("增加一辆公交车")["version"], "0.1")


if __name__ == "__main__":
    unittest.main()
