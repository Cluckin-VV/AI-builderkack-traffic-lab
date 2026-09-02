# Real LLM Shadow Audit v0.1

The existing `shadow_evaluate.py` evaluates deterministic fixtures and records candidate validity. Reference actions come from `SceneCompiler`. `OpenAIRealLLMAdapter` belongs in a provider-neutral shadow module and returns plain dictionaries only. Validation is performed by the shared v0.2 schema and semantic functions.

The shadow evaluator never receives a state writer and never calls `SceneState.apply`; it creates a candidate, validates it read-only, and compares it with the reference action.
