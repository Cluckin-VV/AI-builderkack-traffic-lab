# HTTP Pipeline Stage Order v0.1

The browser execution path is locked to:

```text
schema → semantic → execution
```

Schema validation reads only the candidate envelope and rejects malformed, unknown, or unsupported protocol data. Semantic validation may read `SceneState` but must not mutate it. Only the execution stage may call `SceneState.apply`; Renderer observes the resulting state and Event Log records the stage.

Rejection short-circuits the pipeline. A schema rejection never calls semantic validation or `State.apply`. A semantic rejection never calls `State.apply`. Accepted actions call `State.apply` exactly once.

The stage-order tests in `ai_builder/tests/test_http_pipeline_stage_order.py` patch each boundary and assert both call counts and exact order. This is required before real LLM shadow evaluation because a future refactor must not turn validation into a post-execution decoration.
