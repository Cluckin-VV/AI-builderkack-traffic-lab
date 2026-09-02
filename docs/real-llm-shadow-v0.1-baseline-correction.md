# Real LLM Shadow v0.1 Baseline Correction

The first three-case run made three API attempts, but no candidate SceneAction was produced. The adapter returned `API_ERROR` for all three cases. The original evaluator incorrectly treated those error dictionaries as candidates and counted them as `SCHEMA_FAILURE`.

Corrected classification:

```text
API_ERROR: 3
SCHEMA_FAILURE: 0
candidate_generated_count: 0
schema_valid_rate: N/A
semantic_valid_rate: N/A
```

`再来一辆公交车` also has no deterministic reference action (`null`), which is a reference coverage gap, not a model failure. The original result files are retained for audit; no prompt, schema, model, or command protocol was changed.
