import unittest
from unittest.mock import patch

from ai_builder.model_adapter import FakeModelAdapter, run_model_command
from ai_builder.scene import SceneState, EventLog, ValidationError


class StageOrderTests(unittest.TestCase):
    def payload(self, action_type="add_bus", parameters=None):
        return {"protocol_version": "0.2", "action_id": "stage-order-1", "action_type": action_type,
                "parameters": {} if parameters is None else parameters, "source": "fake_model"}

    def execute(self, payload, state=None):
        adapter = FakeModelAdapter(raw_output=payload)
        state = state or SceneState()
        return state, run_model_command(adapter, "测试指令", state, EventLog())

    def test_schema_validation_runs_before_semantic_validation(self):
        order = []
        with patch("ai_builder.model_adapter.validate_scene_action_schema", side_effect=lambda p: order.append("schema") or []), \
             patch("ai_builder.model_adapter.validate_scene_action_semantics", side_effect=lambda a, s: order.append("semantic") or []):
            self.execute(self.payload())
        self.assertEqual(order, ["schema", "semantic"])

    def test_schema_reject_skips_semantic_validation(self):
        with patch("ai_builder.model_adapter.validate_scene_action_semantics", side_effect=AssertionError("semantic validation must not run after schema rejection")) as semantic:
            _, result = self.execute({"protocol_version": "0.2", "action_id": "x", "action_type": "add_bus", "parameters": {}, "execute_python": "x"})
        self.assertEqual(result["status"], "rejected"); self.assertEqual(semantic.call_count, 0)

    def test_schema_reject_skips_state_apply(self):
        state = SceneState()
        with patch.object(state, "apply", side_effect=AssertionError("state.apply must not run before all validation passes")) as apply:
            result = run_model_command(FakeModelAdapter(raw_output={"protocol_version": "0.1"}), "x", state, EventLog())
        self.assertEqual(result["status"], "rejected"); self.assertEqual(apply.call_count, 0)

    def test_semantic_validation_runs_only_after_schema_success(self):
        with patch("ai_builder.model_adapter.validate_scene_action_schema", return_value=[]) as schema, \
             patch("ai_builder.model_adapter.validate_scene_action_semantics", return_value=[]) as semantic:
            self.execute(self.payload())
        self.assertEqual(schema.call_count, 1); self.assertEqual(semantic.call_count, 1)

    def test_semantic_reject_skips_state_apply(self):
        state = SceneState()
        with patch("ai_builder.model_adapter.validate_scene_action_semantics", return_value=[ValidationError("SEMANTIC_TARGET_NOT_FOUND", "missing")]), \
             patch.object(state, "apply", side_effect=AssertionError("state.apply must not run after semantic rejection")) as apply:
            result = run_model_command(FakeModelAdapter(raw_output=self.payload("move_bus")), "x", state, EventLog())
        self.assertEqual(result["status"], "rejected"); self.assertEqual(apply.call_count, 0)

    def test_execution_runs_only_after_both_validation_stages_pass(self):
        state = SceneState()
        with patch.object(state, "apply", wraps=state.apply) as apply:
            result = run_model_command(FakeModelAdapter(raw_output=self.payload()), "x", state, EventLog())
        self.assertEqual(result["status"], "accepted"); self.assertEqual(apply.call_count, 1)

    def test_exact_pipeline_order_for_valid_action(self):
        order = []
        with patch("ai_builder.model_adapter.validate_scene_action_schema", side_effect=lambda p: order.append("schema") or []), \
             patch("ai_builder.model_adapter.validate_scene_action_semantics", side_effect=lambda a, s: order.append("semantic") or []):
            state = SceneState()
            with patch.object(state, "apply", side_effect=lambda a, v: order.append("execution")):
                self.execute(self.payload(), state)
        self.assertEqual(order, ["schema", "semantic", "execution"])

    def test_event_log_schema_rejection_stage(self):
        _, result = self.execute({"protocol_version": "0.2", "action_id": "x", "action_type": "add_bus", "parameters": {}, "bad": 1})
        self.assertEqual(result["event"]["validation_stage"], "schema")

    def test_event_log_semantic_rejection_stage(self):
        _, result = self.execute(self.payload("move_bus"))
        self.assertEqual(result["event"]["validation_stage"], "semantic")

    def test_event_log_success_stage(self):
        _, result = self.execute(self.payload())
        self.assertEqual(result["event"]["validation_stage"], "execution")

    def test_rejected_action_does_not_mutate_state_snapshot(self):
        state = SceneState(); before = state.snapshot()
        self.execute(self.payload("move_bus"), state)
        self.assertEqual(state.snapshot(), before)

    def test_valid_action_mutates_state_only_once(self):
        state = SceneState()
        with patch.object(state, "apply", wraps=state.apply) as apply:
            self.execute(self.payload(), state)
        self.assertEqual(apply.call_count, 1); self.assertEqual(state.buses, 1)


if __name__ == "__main__": unittest.main()
