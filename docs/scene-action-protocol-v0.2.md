# SceneAction Protocol v0.2

v0.2 separates shape validation from meaning validation so an LLM can propose an action without gaining state-write authority.

```json
{
  "protocol_version": "0.2",
  "action_id": "deterministic-id",
  "action_type": "set_traffic_light",
  "parameters": {"color": "红灯"},
  "source": "model",
  "metadata": {"request_id": "r-1", "confidence": 0.9}
}
```

Allowed actions: `add_bus`, `remove_bus`, `set_traffic_light`, `stop_bus`, `move_bus`.
All actions use an object `parameters`; only `set_traffic_light` requires `{color: 红灯|黄灯|绿灯}`. Extra envelope or parameter fields are rejected.

Schema validation asks whether the envelope is well formed. Semantic validation asks whether the action is executable in the current `SceneState`, such as whether a bus exists or a transition is meaningful. A rejection never calls `State.apply`; all state writes remain behind validation.

Stable error codes include `MISSING_FIELD`, `INVALID_TYPE`, `UNKNOWN_FIELD`, `UNSUPPORTED_PROTOCOL_VERSION`, `UNKNOWN_ACTION_TYPE`, `INVALID_PARAMETER`, `INVALID_ENUM`, `SEMANTIC_TARGET_NOT_FOUND`, and `SEMANTIC_INVALID_STATE_TRANSITION`.

Future LLM adapters may return only this JSON envelope. They have no access to `SceneState`, Python execution, or renderer internals. v0.1's `version`, target, and source-command compatibility fields remain supported by the existing deterministic path during migration; new model-facing envelopes use `protocol_version: 0.2`.

Known limitation: the current browser path still uses the compatibility v0.1 adapter shape; migration of that path is intentionally a separate step.
