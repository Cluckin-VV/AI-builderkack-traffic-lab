import unittest

from ai_builder.scene import (
    SceneAction, SceneState, ValidationError, validate_scene_action_schema,
    validate_scene_action_semantics,
)


class SceneActionV02Tests(unittest.TestCase):
    def valid(self, **overrides):
        value = {"protocol_version": "0.2", "action_id": "abc123", "action_type": "add_bus", "parameters": {}, "source": "model", "metadata": {"confidence": 0.8}}
        value.update(overrides)
        return value

    def codes(self, payload):
        return {e.code for e in validate_scene_action_schema(payload)}

    def test_valid_envelope(self): self.assertEqual(self.codes(self.valid()), set())
    def test_each_action_type_is_allowed(self):
        for name in ("add_bus", "remove_bus", "set_traffic_light", "stop_bus", "move_bus"):
            p = {"color": "红灯"} if name == "set_traffic_light" else {}
            self.assertEqual(self.codes(self.valid(action_type=name, parameters=p)), set())
    def test_protocol_version_is_v02(self): self.assertEqual(self.valid()["protocol_version"], "0.2")
    def test_deterministic_action_id(self):
        a, b = SceneAction("add_bus", {}, source_command="x"), SceneAction("add_bus", {}, source_command="x")
        self.assertEqual(a.action_id, b.action_id)
    def test_missing_protocol(self): self.assertIn("MISSING_FIELD", self.codes({"action_id":"x","action_type":"add_bus","parameters":{}}))
    def test_old_protocol(self): self.assertIn("UNSUPPORTED_PROTOCOL_VERSION", self.codes(self.valid(protocol_version="0.1")))
    def test_missing_action_type(self):
        payload = self.valid(); payload.pop("action_type")
        self.assertIn("MISSING_FIELD", self.codes(payload))
    def test_unknown_action_type(self): self.assertIn("UNKNOWN_ACTION_TYPE", self.codes(self.valid(action_type="destroy_city")))
    def test_parameters_type(self): self.assertIn("INVALID_TYPE", self.codes(self.valid(parameters=[])))
    def test_missing_color(self): self.assertIn("MISSING_FIELD", self.codes(self.valid(action_type="set_traffic_light", parameters={})))
    def test_unknown_field(self): self.assertIn("UNKNOWN_FIELD", self.codes(self.valid(execute_python="os.system('x')")))
    def test_executable_field(self): self.assertIn("UNKNOWN_FIELD", self.codes(self.valid(execute_python="x")))
    def test_invalid_enum(self): self.assertIn("INVALID_ENUM", self.codes(self.valid(action_type="set_traffic_light", parameters={"color":"蓝灯"})))
    def test_empty_action_id(self): self.assertIn("INVALID_TYPE", self.codes(self.valid(action_id="")))
    def test_action_id_type(self): self.assertIn("INVALID_TYPE", self.codes(self.valid(action_id=7)))
    def test_confidence_bounds(self): self.assertIn("INVALID_PARAMETER", self.codes(self.valid(metadata={"confidence": 2})))
    def test_semantic_missing_bus(self):
        action = SceneAction("remove_bus", "road", {}, "删除", "x")
        self.assertEqual(validate_scene_action_semantics(action, SceneState())[0].code, "SEMANTIC_TARGET_NOT_FOUND")
    def test_semantic_state_transition_is_explicit(self):
        state = SceneState(); action = SceneAction("stop_bus", "bus", {}, "停下", "x")
        self.assertEqual(validate_scene_action_semantics(action, state)[0].code, "SEMANTIC_TARGET_NOT_FOUND")
    def test_semantic_valid_transition(self):
        state = SceneState(buses=1)
        action = SceneAction("move_bus", "bus", {}, "前进", "x")
        self.assertEqual(validate_scene_action_semantics(action, state), [])
    def test_semantic_rejection_does_not_mutate(self):
        state = SceneState(); before = state.snapshot()
        action = SceneAction("move_bus", "bus", {}, "前进", "x")
        self.assertTrue(validate_scene_action_semantics(action, state)); self.assertEqual(state.snapshot(), before)
    def test_schema_rejection_does_not_mutate(self):
        state = SceneState(); before = state.snapshot()
        self.assertTrue(validate_scene_action_schema(self.valid(execute_python="x"))); self.assertEqual(state.snapshot(), before)
    def test_validation_error_shape(self):
        error = ValidationError("UNKNOWN_FIELD", "bad", "x")
        self.assertEqual(set(error.as_dict()), {"code", "message", "field"})
    def test_combined_action_is_rejected(self): self.assertIn("UNKNOWN_ACTION_TYPE", self.codes(self.valid(action_type="add_bus_and_set_light")))


if __name__ == "__main__": unittest.main()
