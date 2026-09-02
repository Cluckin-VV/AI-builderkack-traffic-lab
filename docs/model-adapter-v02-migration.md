# Model Adapter v0.2 Migration

The browser path now consumes a v0.2 envelope from `FakeModelAdapter`:

```text
command → adapter → schema validation → SceneAction → semantic validation → State.apply → Renderer → Event Log
```

The old path constructed a v0.1 `SceneAction` directly from adapter output and passed it to the combined `Validator`. The new HTTP path does not upgrade v0.1 payloads: missing `protocol_version: 0.2` is a schema rejection.

The adapter owns candidate generation only. Schema validation owns shape and allowlist checks. Semantic validation owns state-dependent checks. `SceneState.apply` remains the guarded mutation boundary, and Event Log records protocol version, stage, status, and error code.

Legacy v0.1 constructor fields remain in `scene.py` only for deterministic compiler tests and migration documentation; they are not accepted by the browser HTTP pipeline. The next safe step is a real-LLM shadow adapter that emits the same v0.2 envelope without execution authority.
