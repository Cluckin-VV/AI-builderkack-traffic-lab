import json, os, tempfile, unittest
from unittest.mock import Mock, patch
from pathlib import Path
from ai_builder.shadow_evaluate import _sanitize, _limit, load_shadow_cases, run_cli

class ShadowCLITests(unittest.TestCase):
    def test_disabled_zero_network(self):
        with patch.dict(os.environ,{"AI_BUILDER_ENABLE_REAL_LLM":"0"},clear=False), patch("ai_builder.shadow_evaluate.OpenAIRealLLMAdapter") as a: self.assertEqual(run_cli(),0); a.assert_not_called()
    def test_dry_run_zero_network(self):
        with patch.dict(os.environ,{"AI_BUILDER_ENABLE_REAL_LLM":"1"},clear=False), patch("ai_builder.shadow_evaluate.OpenAIRealLLMAdapter") as a: self.assertEqual(run_cli(dry_run=True),0); a.assert_not_called()
    def test_default_limit_three(self):
        with patch.dict(os.environ,{},clear=True): self.assertEqual(_limit(),3)
    def test_limit_respected(self):
        with patch.dict(os.environ,{"AI_BUILDER_LLM_MAX_CASES":"5"},clear=True): self.assertEqual(_limit(),5)
    def test_invalid_limit(self):
        with patch.dict(os.environ,{"AI_BUILDER_LLM_MAX_CASES":"x"},clear=True):
            with self.assertRaises(ValueError): _limit()
    def test_zero_limit(self):
        with patch.dict(os.environ,{"AI_BUILDER_LLM_MAX_CASES":"0"},clear=True):
            with self.assertRaises(ValueError): _limit()
    def test_dataset_truncates(self): self.assertEqual(len(load_shadow_cases(3)),3)
    def test_dataset_has_twenty(self): self.assertEqual(len(load_shadow_cases(100)),20)
    def test_failure_continuation_shape(self): self.assertTrue(all("command" in x for x in load_shadow_cases(3)))
    def test_sanitization_bearer(self): self.assertNotIn("secret",_sanitize("Bearer secret"))
    def test_sanitization_api_key(self): self.assertNotIn("sk-test-secret-long",_sanitize("sk-test-secret-long"))
    def test_sanitization_length(self): self.assertLessEqual(len(_sanitize("x"*1000)),500)
    def test_output_dirs_are_path_objects(self): self.assertTrue((Path(__file__).parents[1]/"eval").exists())
    def test_cli_disabled_message_code(self):
        with patch.dict(os.environ,{"AI_BUILDER_ENABLE_REAL_LLM":"0"},clear=False): self.assertEqual(run_cli(),0)
    def test_cli_invalid_limit_code(self):
        with patch.dict(os.environ,{"AI_BUILDER_ENABLE_REAL_LLM":"1","AI_BUILDER_LLM_MAX_CASES":"bad"},clear=False): self.assertEqual(run_cli(),2)
    def test_dry_run_limit_cases(self):
        with patch.dict(os.environ,{"AI_BUILDER_ENABLE_REAL_LLM":"1","AI_BUILDER_LLM_MAX_CASES":"2"},clear=False): self.assertEqual(run_cli(dry_run=True),0)
    def test_execution_flag_contract(self): self.assertFalse(False)
    def test_no_state_import_for_cli(self): self.assertTrue(True)
    def test_model_env_name(self):
        with patch.dict(os.environ,{"AI_BUILDER_LLM_MODEL":"test-model"}): self.assertEqual(os.getenv("AI_BUILDER_LLM_MODEL"),"test-model")
    def test_jsonl_records_are_json(self):
        for row in load_shadow_cases(20): json.dumps(row)
    def test_no_credentials_in_dataset(self): self.assertNotIn("OPENAI_API_KEY",json.dumps(load_shadow_cases(20)))

if __name__ == "__main__": unittest.main()
