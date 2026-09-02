# SceneAction Protocol Audit v0.1

- `SceneAction` is defined in `ai_builder/scene.py`.
- The v0.1 allowlist is `add_bus`, `remove_bus`, `set_traffic_light`, `stop_bus`, and `move_bus`.
- Parameters are empty for bus actions and `{color}` for `set_traffic_light`.
- Legacy semantic checks are in `Validator.validate`; state mutation is guarded by `SceneState.apply`.
- Before this audit, schema and semantic checks were combined in `Validator`.
- Model output enters through `run_model_command` in `ai_builder/model_adapter.py`, then JSON decoding, `SceneAction`, `Validator`, and only then `SceneState.apply`.
- Unknown fields were rejected by parameter-set comparison, but there was no independent structured schema error model.
- `SceneState.apply` rejects missing or mismatched validation results as a second defense.

Protocol v0.2 adds independent `validate_scene_action_schema` and `validate_scene_action_semantics` functions plus structured `ValidationError` values. The legacy v0.1 constructor remains source-compatible while the new envelope is introduced for the next adapter boundary.
