# Real LLM Shadow Mode v0.1

Shadow Mode lets a real model propose a v0.2 candidate while execution remains blocked. The deterministic Compiler is the reference; the model is the candidate. Both are compared on action type and parameters after schema and semantic validation.

Real API use is disabled unless `AI_BUILDER_ENABLE_REAL_LLM=1` and `OPENAI_API_KEY` are present. The key is read only from the environment and never enters logs or results. `AI_BUILDER_LLM_MODEL` overrides the default model and `AI_BUILDER_LLM_MAX_CASES` limits future evaluation runs.

The adapter uses the Responses API `text.format` JSON Schema Structured Outputs shape; strict JSON Schema is preferred over legacy JSON mode for supported models. See the official [Responses API reference](https://platform.openai.com/docs/api-reference/responses-streaming/response/output_item?lang=python).

Smoke evaluation remains an explicit command and is not run by tests. No candidate, even if schema and semantic validation pass, calls `SceneState.apply`.
