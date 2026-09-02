import json, os, unittest
from unittest.mock import Mock, MagicMock, patch
from ai_builder.real_llm_shadow import OpenAIRealLLMAdapter, evaluate_candidate, shadow_case, ACTION_SCHEMA
from ai_builder.scene import SceneState

class ShadowV01Tests(unittest.TestCase):
    def candidate(self, **kw):
        x={"protocol_version":"0.2","action_id":"shadow-1","action_type":"add_bus","parameters":{}}
        x.update(kw); return x
    def test_disabled_by_default(self):
        with patch.dict(os.environ, {"AI_BUILDER_ENABLE_REAL_LLM":"0"}, clear=False): self.assertEqual(OpenAIRealLLMAdapter(api_key="x").generate_scene_action("x")["error_category"],"CONFIG_ERROR")
    def test_missing_api_key(self):
        with patch.dict(os.environ,{"AI_BUILDER_ENABLE_REAL_LLM":"1"},clear=True): self.assertEqual(OpenAIRealLLMAdapter().generate_scene_action("x")["error_category"],"CONFIG_ERROR")
    def test_v02_candidate(self): self.assertEqual(self.candidate()["protocol_version"],"0.2")
    def test_wrong_protocol_rejected(self): self.assertEqual(evaluate_candidate("x",self.candidate(protocol_version="0.1"))["error_category"],"SCHEMA_FAILURE")
    def test_unknown_field_rejected(self): self.assertEqual(evaluate_candidate("x",self.candidate(execute_python="x"))["error_category"],"SCHEMA_FAILURE")
    def test_unknown_action_rejected(self): self.assertEqual(evaluate_candidate("x",self.candidate(action_type="destroy_city"))["error_category"],"SCHEMA_FAILURE")
    def test_candidate_passes_schema(self): self.assertTrue(evaluate_candidate("增加一辆公交车",self.candidate())["schema_valid"])
    def test_candidate_fails_schema(self): self.assertFalse(evaluate_candidate("x",{})["schema_valid"])
    def test_candidate_fails_semantic(self): self.assertEqual(evaluate_candidate("move",self.candidate(action_type="move_bus"))["error_category"],"SEMANTIC_FAILURE")
    def test_shadow_never_calls_apply(self):
        state=SceneState(); state.apply=Mock(side_effect=AssertionError("shadow must not apply"))
        result=shadow_case(Mock(generate_scene_action=Mock(return_value=self.candidate())),"x",state)
        self.assertTrue(result["schema_valid"]); self.assertEqual(state.apply.call_count,0)
    def test_shadow_never_changes_state(self):
        state=SceneState(); before=state.snapshot(); shadow_case(Mock(generate_scene_action=Mock(return_value=self.candidate())),"x",state); self.assertEqual(before,state.snapshot())
    def test_action_type_match(self): self.assertTrue(evaluate_candidate("增加一辆公交车",self.candidate())["action_type_match"])
    def test_action_type_mismatch(self): self.assertEqual(evaluate_candidate("增加一辆公交车",self.candidate(action_type="move_bus"))["error_category"],"SEMANTIC_FAILURE")
    def test_parameter_mismatch(self): self.assertEqual(evaluate_candidate("红灯",self.candidate(action_type="set_traffic_light",parameters={"color":"绿灯"}), state=SceneState(traffic_light="红灯"))["error_category"],"PARAMETER_MISMATCH")
    def test_api_error_category(self):
        opener=Mock(side_effect=OSError())
        with patch.dict(os.environ,{"AI_BUILDER_ENABLE_REAL_LLM":"1"}): self.assertEqual(OpenAIRealLLMAdapter(api_key="x",opener=opener).generate_scene_action("x")["error_category"],"API_ERROR")
    def test_timeout_category(self):
        opener=Mock(side_effect=TimeoutError())
        with patch.dict(os.environ,{"AI_BUILDER_ENABLE_REAL_LLM":"1"}): self.assertEqual(OpenAIRealLLMAdapter(api_key="x",opener=opener).generate_scene_action("x")["error_category"],"TIMEOUT")
    def test_malformed_response_category(self):
        response=MagicMock(); response.read.return_value=b'{"output":[]}'
        response.__enter__.return_value=response
        opener=Mock(return_value=response)
        with patch.dict(os.environ,{"AI_BUILDER_ENABLE_REAL_LLM":"1"}): self.assertEqual(OpenAIRealLLMAdapter(api_key="x",opener=opener).generate_scene_action("x")["error_category"],"MALFORMED_RESPONSE")
    def test_summary_fields_exist(self):
        result=evaluate_candidate("增加一辆公交车",self.candidate());
        for key in ("schema_valid","semantic_valid","action_type_match","parameters_match","overall_match","latency_ms","model","error_category"): self.assertIn(key,result)
    def test_no_key_in_result(self):
        result=evaluate_candidate("x",{"error_category":"CONFIG_ERROR","message":"missing"}); self.assertNotIn("secret",json.dumps(result))
    def test_disabled_zero_network(self):
        opener=Mock()
        with patch.dict(os.environ,{"AI_BUILDER_ENABLE_REAL_LLM":"0"},clear=False): OpenAIRealLLMAdapter(api_key="x",opener=opener).generate_scene_action("x")
        opener.assert_not_called()
    def test_structured_schema_is_strict(self): self.assertTrue(ACTION_SCHEMA["additionalProperties"] is False)
    def test_model_instruction_blocks_execution(self):
        from ai_builder.real_llm_shadow import SYSTEM_INSTRUCTIONS
        self.assertIn("state mutations",SYSTEM_INSTRUCTIONS)

if __name__ == "__main__": unittest.main()
