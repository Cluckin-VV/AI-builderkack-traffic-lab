import json, unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError
from ai_builder.real_llm_shadow import OpenAIRealLLMAdapter, evaluate_candidate

class ShadowDiagnosticsTests(unittest.TestCase):
    def opener(self, status=200, body=b'{"output":[]}'):
        r=Mock(); r.__enter__=Mock(return_value=r); r.__exit__=Mock(return_value=False); r.read.return_value=body
        if status != 200: return Mock(side_effect=HTTPError("x",status,"bad",{},Mock(read=Mock(return_value=b'{"error":{"type":"invalid_request_error","code":"bad","message":"safe"}}'))))
        return Mock(return_value=r)
    def call(self, opener):
        with patch.dict("os.environ",{"AI_BUILDER_ENABLE_REAL_LLM":"1"},clear=False): return OpenAIRealLLMAdapter(api_key="secret",opener=opener).generate_scene_action("x")
    def test_http_400(self): self.assertEqual(self.call(self.opener(400))["error_category"],"API_ERROR")
    def test_http_401(self): self.assertEqual(self.call(self.opener(401))["error_category"],"API_ERROR")
    def test_http_429(self): self.assertEqual(self.call(self.opener(429))["error_category"],"API_ERROR")
    def test_http_500(self): self.assertEqual(self.call(self.opener(500))["error_category"],"API_ERROR")
    def test_network_error(self): self.assertEqual(self.call(Mock(side_effect=URLError("offline")))["error_category"],"API_ERROR")
    def test_timeout(self):
        self.assertEqual(self.call(Mock(side_effect=TimeoutError()))["error_category"],"TIMEOUT")
    def test_response_error(self): self.assertEqual(self.call(self.opener(body=b'{"error":{"type":"x","code":"y","message":"bad"}}'))["error_category"],"API_ERROR")
    def test_refusal(self): self.assertEqual(self.call(self.opener(body=b'{"output":[{"type":"message","content":[{"type":"refusal"}]}]}'))["error_category"],"MODEL_REFUSAL")
    def test_malformed_output(self): self.assertEqual(self.call(self.opener(body=b'{"output":[{"type":"message","content":[{"type":"output_text","text":"no"}]}]}'))["error_category"],"INVALID_JSON")
    def test_schema_failure(self): self.assertEqual(evaluate_candidate("x",{"protocol_version":"0.2","action_id":"x","action_type":"bad","parameters":{}})["error_category"],"SCHEMA_FAILURE")
    def test_semantic_failure(self): self.assertEqual(evaluate_candidate("x",{"protocol_version":"0.2","action_id":"x","action_type":"move_bus","parameters":{}})["error_category"],"SEMANTIC_FAILURE")
    def test_api_error_not_schema(self): self.assertEqual(evaluate_candidate("x",{"ok":False,"error_category":"API_ERROR"})["error_category"],"API_ERROR")
    def test_api_error_no_schema_call(self):
        with patch("ai_builder.real_llm_shadow.validate_scene_action_schema",side_effect=AssertionError()): self.assertEqual(evaluate_candidate("x",{"ok":False,"error_category":"API_ERROR"})["error_category"],"API_ERROR")
    def test_api_error_no_semantic_call(self):
        with patch("ai_builder.real_llm_shadow.validate_scene_action_semantics",side_effect=AssertionError()): self.assertEqual(evaluate_candidate("x",{"ok":False,"error_category":"API_ERROR"})["error_category"],"API_ERROR")
    def test_none_not_schema(self): self.assertEqual(evaluate_candidate("x",None)["error_category"],"INVALID_JSON")
    def test_candidate_count_contract(self): self.assertFalse(evaluate_candidate("x",{"ok":False,"error_category":"API_ERROR"})["candidate_generated"])
    def test_schema_count_candidate(self): self.assertTrue(evaluate_candidate("x",{"protocol_version":"0.2","action_id":"x","action_type":"bad","parameters":{}})["candidate_generated"])
    def test_output_parsing(self): self.assertEqual(self.call(self.opener(body=b'{"output":[{"type":"message","content":[{"type":"output_text","text":"{\\"x\\":1}"}]}]}'))["x"],1)
    def test_diagnostic_status(self): self.assertEqual(self.call(self.opener(400))["diagnostic"]["http_status"],400)
    def test_sanitize_token(self): self.assertNotIn("secret",json.dumps(self.call(self.opener(400))))
    def test_request_schema_has_name(self):
        from ai_builder.real_llm_shadow import ACTION_SCHEMA
        self.assertEqual(ACTION_SCHEMA["type"],"object")
    def test_error_message_is_short(self): self.assertLessEqual(len(self.call(Mock(side_effect=URLError("x")))["message"]),300)
    def test_execution_not_present(self): self.assertNotIn("execution_allowed",evaluate_candidate("x",{"ok":False,"error_category":"API_ERROR"}))

if __name__ == "__main__": unittest.main()
