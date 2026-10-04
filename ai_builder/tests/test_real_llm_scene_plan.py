import json
import os
import unittest
from unittest.mock import Mock, patch

from ai_builder.real_llm_plan import OpenAIScenePlanAdapter, evaluate_plan_candidate
from ai_builder.scene import SceneState
from ai_builder.scene_plan_shadow_evaluate import load_cases, run_evaluation, main


def candidate(*actions):
    return {"plan_version": "0.1", "actions": list(actions)}


ADD = {"action_type": "add_bus", "parameters": {}}


class RealLLMScenePlanTests(unittest.TestCase):
    def test_disabled_adapter_makes_no_network_request(self):
        opener = Mock(side_effect=AssertionError("network forbidden"))
        with patch.dict(os.environ, {"AI_BUILDER_ENABLE_REAL_LLM": "0"}):
            result = OpenAIScenePlanAdapter(api_key="test", opener=opener).generate_scene_plan("增加公交车")
        self.assertEqual(result["error_category"], "CONFIG_ERROR")
        opener.assert_not_called()

    def test_request_uses_strict_plan_schema_and_no_storage(self):
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = json.dumps({"output_text": json.dumps(candidate(ADD))}).encode()
        opener = Mock(return_value=response)
        with patch.dict(os.environ, {"AI_BUILDER_ENABLE_REAL_LLM": "1"}):
            result = OpenAIScenePlanAdapter(api_key="test", opener=opener).generate_scene_plan("增加公交车")
        body = json.loads(opener.call_args.args[0].data)
        self.assertFalse(body["store"])
        self.assertTrue(body["text"]["format"]["strict"])
        self.assertEqual(body["text"]["format"]["schema"]["required"], ["plan_version", "actions"])
        self.assertEqual(result, candidate(ADD))

    def test_plan_transport_retains_token_usage_and_raw_output(self):
        raw = json.dumps(candidate(ADD))
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = json.dumps({"output_text": raw, "usage": {"input_tokens": 42, "output_tokens": 12}}).encode()
        adapter = OpenAIScenePlanAdapter(api_key="test", opener=Mock(return_value=response))
        with patch.dict(os.environ, {"AI_BUILDER_ENABLE_REAL_LLM": "1"}):
            adapter.generate_scene_plan("加车")
        self.assertEqual(adapter.last_usage["input_tokens"], 42)
        self.assertEqual(adapter.last_raw_output, raw)

    def test_valid_plan_preserves_live_state(self):
        state = SceneState()
        before = state.snapshot()
        result = evaluate_plan_candidate("增加公交车", candidate(ADD), state, [ADD])
        self.assertTrue(result["overall_match"])
        self.assertEqual(state.snapshot(), before)
        self.assertEqual(result["projected_state"]["buses"], 1)
        self.assertEqual(result["state_mutation_count"], 0)

    def test_missing_field_is_schema_failure(self):
        result = evaluate_plan_candidate("增加公交车", {"actions": [ADD]}, SceneState(), [ADD])
        self.assertEqual(result["error_category"], "SCHEMA_FAILURE")

    def test_extra_fields_are_rejected(self):
        value = {**candidate(ADD), "explanation": "hello"}
        self.assertEqual(evaluate_plan_candidate("x", value, SceneState(), [ADD])["error_category"], "SCHEMA_FAILURE")

    def test_invalid_color_is_rejected_without_mutation(self):
        state = SceneState(buses=1)
        before = state.snapshot()
        value = candidate({"action_type": "set_traffic_light", "parameters": {"color": "紫色"}})
        result = evaluate_plan_candidate("紫灯", value, state, [])
        self.assertEqual(result["error_category"], "SCHEMA_FAILURE")
        self.assertEqual(state.snapshot(), before)

    def test_nonexistent_bus_is_semantic_failure(self):
        value = candidate({"action_type": "remove_bus", "parameters": {}})
        result = evaluate_plan_candidate("删除公交车", value, SceneState(), [])
        self.assertEqual(result["error_category"], "SEMANTIC_FAILURE")

    def test_order_and_parameters_must_match(self):
        snow = {"action_type": "set_weather", "parameters": {"weather": "snow"}}
        result = evaluate_plan_candidate("先下雪再加车", candidate(ADD, snow), SceneState(), [snow, ADD])
        self.assertTrue(result["semantic_valid"])
        self.assertFalse(result["overall_match"])

    def test_empty_plan_is_safe_rejection_for_unsupported_intent(self):
        result = evaluate_plan_candidate("飞上月球", candidate(), SceneState(), [])
        self.assertTrue(result["safe_rejection"])
        self.assertFalse(result["unsafe_acceptance"])

    def test_transport_error_is_not_safe_rejection(self):
        result = evaluate_plan_candidate("飞上月球", {"ok": False, "error_category": "API_ERROR"}, SceneState(), [])
        self.assertFalse(result["safe_rejection"])

    def test_supported_but_wrong_plan_is_unsafe_acceptance(self):
        result = evaluate_plan_candidate("飞上月球", candidate(ADD), SceneState(), [])
        self.assertTrue(result["unsafe_acceptance"])

    def test_over_limit_plan_is_rejected(self):
        result = evaluate_plan_candidate("增加七辆", candidate(*([ADD] * 7)), SceneState(), [])
        self.assertEqual(result["error_category"], "SCHEMA_FAILURE")

    def test_canonical_ids_are_deterministic(self):
        first = evaluate_plan_candidate("原话", candidate(ADD), SceneState(), [ADD])
        second = evaluate_plan_candidate("原话", candidate(ADD), SceneState(), [ADD])
        self.assertEqual(first["plan"], second["plan"])
        self.assertEqual(first["plan"]["source_command"], "原话")
        self.assertEqual(first["plan"]["actions"][0]["source"], "real_llm_plan")
        self.assertEqual(first["plan"]["actions"][0]["metadata"], {})

    def test_dataset_has_at_least_fifty_unique_cases(self):
        cases = load_cases()
        self.assertGreaterEqual(len(cases), 50)
        self.assertEqual(len({x["id"] for x in cases}), len(cases))
        self.assertEqual(len({x["command"] for x in cases}), len(cases))

    def test_dry_run_has_zero_api_calls(self):
        adapter = Mock(side_effect=AssertionError("no API"))
        summary, rows = run_evaluation(load_cases(), adapter=adapter, dry_run=True)
        self.assertEqual(summary["api_call_count"], 0)
        self.assertEqual(summary["state_mutation_count"], 0)
        self.assertEqual(summary["measurement_mode"], "dry_run_reference_replay")
        adapter.generate_scene_plan.assert_not_called()

    def test_fake_boundary_checks_all_reference_cases(self):
        cases = load_cases()
        adapter = Mock()
        adapter.generate_scene_plan.side_effect = [candidate(*x["expected_actions"]) for x in cases]
        summary, rows = run_evaluation(cases, adapter=adapter, dry_run=False)
        self.assertEqual(summary["overall_match_rate"], 1.0)
        self.assertEqual(summary["unsafe_acceptance"], 0)
        self.assertEqual(summary["state_mutation_count"], 0)

    def test_simulation_never_applies_to_live_instance(self):
        state = SceneState()
        original = SceneState.apply
        objects = []
        def tracked(instance, *args, **kwargs):
            objects.append(instance)
            return original(instance, *args, **kwargs)
        with patch.object(SceneState, "apply", tracked):
            result = evaluate_plan_candidate("增加公交", candidate(ADD), state, [ADD])
        self.assertTrue(result["semantic_valid"])
        self.assertTrue(objects)
        self.assertTrue(all(instance is not state for instance in objects))

    def test_malformed_parameter_types_never_raise_or_mutate(self):
        state = SceneState()
        for value in ([], None, 1, {"color": []}):
            with self.subTest(value=value):
                result = evaluate_plan_candidate("x", candidate({"action_type": "set_traffic_light", "parameters": value}), state, [])
                self.assertEqual(result["error_category"], "SCHEMA_FAILURE")
                self.assertEqual(state.snapshot(), SceneState().snapshot())

    def test_wrong_valid_plan_does_not_inflate_match_score(self):
        adapter = Mock()
        adapter.generate_scene_plan.return_value = candidate({"action_type": "set_weather", "parameters": {"weather": "rain"}})
        case = {"id": "test", "command": "加车", "expected_status": "accepted", "expected_actions": [ADD]}
        summary, _ = run_evaluation([case], adapter, False)
        self.assertEqual(summary["expected_valid_acceptance"], 1.0)
        self.assertEqual(summary["overall_match_rate"], 0.0)

    def test_missing_key_is_configuration_error_without_network(self):
        opener = Mock()
        with patch.dict(os.environ, {"AI_BUILDER_ENABLE_REAL_LLM": "1", "OPENAI_API_KEY": ""}):
            result = OpenAIScenePlanAdapter(opener=opener).generate_scene_plan("加车")
        self.assertEqual(result["error_category"], "CONFIG_ERROR")
        opener.assert_not_called()

    def test_unknown_action_type_is_rejected(self):
        result = evaluate_plan_candidate("x", candidate({"action_type": "delete_database", "parameters": {}}), SceneState(), [])
        self.assertEqual(result["error_category"], "SCHEMA_FAILURE")

    def test_invalid_json_response_is_not_schema_failure(self):
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = b'{"output_text":"not JSON"}'
        with patch.dict(os.environ, {"AI_BUILDER_ENABLE_REAL_LLM": "1"}):
            value = OpenAIScenePlanAdapter(api_key="test", opener=Mock(return_value=response)).generate_scene_plan("x")
        result = evaluate_plan_candidate("x", value, SceneState(), [])
        self.assertEqual(result["error_category"], "INVALID_JSON")
        self.assertFalse(result["safe_rejection"])

    def test_live_cli_without_opt_in_fails_before_adapter_creation(self):
        with patch.dict(os.environ, {"AI_BUILDER_ENABLE_REAL_LLM": "0"}), patch("ai_builder.scene_plan_shadow_evaluate.OpenAIScenePlanAdapter") as adapter:
            with self.assertRaises(SystemExit) as error:
                main(["--live"])
        self.assertEqual(error.exception.code, 2)
        adapter.assert_not_called()

    def test_unknown_case_id_fails_before_adapter_creation(self):
        with patch("ai_builder.scene_plan_shadow_evaluate.OpenAIScenePlanAdapter") as adapter:
            with self.assertRaises(SystemExit):
                main(["--case-ids", "not-a-case"])
        adapter.assert_not_called()

    def test_model_refusal_is_not_claimed_as_intent_understanding(self):
        result = evaluate_plan_candidate("x", {"ok": False, "error_category": "MODEL_REFUSAL"}, SceneState(), [])
        self.assertFalse(result["safe_rejection"])

    def test_six_action_compound_plan_is_supported(self):
        actions = [ADD] * 4 + [{"action_type": "set_traffic_light", "parameters": {"color": "红灯"}}, {"action_type": "set_weather", "parameters": {"weather": "snow"}}]
        state = SceneState(buses=2)
        result = evaluate_plan_candidate("复合计划", candidate(*actions), state, actions)
        self.assertTrue(result["overall_match"])
        self.assertEqual(result["projected_state"]["buses"], 6)
        self.assertEqual(state.buses, 2)

    def test_quota_failure_is_unmeasured_not_model_failure_and_stops_batch(self):
        cases = load_cases()[:3]
        adapter = Mock()
        adapter.generate_scene_plan.return_value = {"ok": False, "error_category": "API_ERROR", "diagnostic": {"openai_error_code": "credit_balance_exhausted"}}
        summary, rows = run_evaluation(cases, adapter, False)
        self.assertIsNone(summary["overall_match_rate"])
        self.assertIsNone(summary["expected_valid_acceptance"])
        self.assertEqual(summary["false_rejection"], 0)
        self.assertEqual(summary["api_call_count"], 1)
        self.assertEqual(summary["unavailable_case_count"], 1)
        self.assertEqual(summary["aborted_reason"], "credit_balance_exhausted")
        adapter.generate_scene_plan.assert_called_once()

    def test_reclassify_saved_rows_excludes_provider_errors(self):
        from ai_builder.scene_plan_shadow_evaluate import summarize_rows
        cases = load_cases()[:1]
        row = evaluate_plan_candidate(cases[0]["command"], {"ok": False, "error_category": "API_ERROR"}, SceneState(), [ADD])
        row.update(expected_status="accepted", latency_ms=1, token_usage={})
        summary = summarize_rows(cases, [row], dry_run=False)
        self.assertIsNone(summary["expected_valid_acceptance"])
        self.assertIsNone(summary["overall_match_rate"])
        self.assertEqual(summary["false_rejection"], 0)


if __name__ == "__main__":
    unittest.main()
