# ScenePlan real-model shadow evaluation v0.1

Date: 2026-09-18. Local unreleased development; not evidence of a deployed real-LLM browser feature or an award-ready product.

## Boundary and implementation evidence

- `ai_builder/real_llm_plan.py::OpenAIScenePlanAdapter.generate_scene_plan` accepts only a command and returns a JSON candidate. It has no SceneState reference, apply method or pending-plan store.
- `PLAN_OUTPUT_SCHEMA` requires `plan_version` and `actions`, rejects additional fields, permits only the six existing action types and at most six actions. Counts expand into repeated actions; empty actions explicitly decline unsupported intent.
- `scene_plan.py::build_scene_plan` supplies local IDs and the original command. Real candidates use `source=real_llm_plan`; no model confidence is invented.
- `real_llm_plan.py::evaluate_plan_candidate` validates the envelope and every SceneAction schema, then calls `preview_scene_plan` on a detached copy. Simulation may apply validated actions to copies; it never applies to or commits the live state.
- `scene_plan_shadow_evaluate.py::run_evaluation` independently compares the original state snapshot after every case. No HTTP browser path is switched to the real adapter.
- Shared transport: `real_llm_shadow.py::OpenAIRealLLMAdapter`, Responses API, `store=false`, strict `text.format` schema, no automatic retries. Records sanitized output and numeric usage when available, not authorization headers.

Official API source: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Strict objects require all declared properties and `additionalProperties=false`; the action union uses nested `anyOf`, not a root union. Structured output does not prove semantic intent correctness.

## Dataset and metrics

`ai_builder/eval/scene_plan_shadow_v01.jsonl`: 50 unique authored commands, 30 supported and 20 unsupported/ambiguous/adversarial. Includes quantity expansion, ordered compound commands, Chinese/English, unknown objects and prompt injection. Each case specifies independent expected semantic actions and initial state. These are authored references, not a genuine user study, hidden holdout or exhaustive security proof.

Report separates:

- expected supported acceptance from exact sequence/parameter correctness;
- expected unsupported safe rejection from accidental transport failure;
- false rejection from dangerous acceptance;
- unmeasured provider failures from model mistakes;
- offline reference replay from actual real-model measurement.

An accepted but wrong plan can pass semantic validation and still fail exact matching. This is essential: validators prove feasibility, not that a model understood the request. Empty unsupported plans are safe rejection, not a model failure. API/config/network failures do not enter model-quality denominators; `null` means unmeasured. Candidate format failures are still counted when actual model output exists.

## Offline verification

Command: `python -m ai_builder.scene_plan_shadow_evaluate --max-cases 50`

| Metric | Result |
| --- | --- |
| Cases | 50 (30 supported, 20 rejected) |
| Network/API calls | 0 |
| Reference replay acceptance | 30/30 |
| Reference replay rejection | 20/20 |
| Exact reference replay match | 30/30 |
| Live-state mutations | 0 |
| Selected-case fingerprint | e213d30cc499 |

This verifies report plumbing and reference feasibility; the input is the authored expected candidate, so the 100% result is NOT a model benchmark.

## First actual three-request smoke baseline

Model configured: `gpt-4o-mini`. No prompt tuning or further real request after this run.

| Case | Request | Actual provider result | Latency |
| --- | --- | --- | --- |
| valid-19 | 先下雪，再增加两辆公交车，然后把信号灯改成红色 | 429, insufficient_quota / credit_balance_exhausted | 9207.18 ms |
| valid-03 | Could you add a bus to the road? | Same credit error | 8903.16 ms |
| reject-12 | 让天气下雪并召唤龙 | Same credit error | 7542.80 ms |

- Requests attempted: 3; usable model responses: 0.
- Schema/semantic/sequence/parameter quality: **not measured**.
- Model false rejection: 0 measured; this is not a claim that the model correctly accepted anything.
- Unsafe acceptance: 0 observed; live-state mutation: 0.
- Token usage: no usage supplied for these rejected requests. Monetary charge was not independently verified.
- Average failed-request latency: 8551.05 ms; this is not inference latency.

Original evidence stays in `artifacts/scene-plan-shadow-v0.1-live-smoke/`. Its first summary incorrectly displayed zero model rates and two false rejections; it is superseded, not erased. Corrected scoring is in `artifacts/scene-plan-shadow-v0.1-live-smoke-reclassified/`, regenerated from the same rows with **zero additional API calls**. The selected-case fingerprint is `af1fc3ba207a`. The evaluator now stops a future batch at the first exhausted-credit response, rather than repeating this mistake.

## Testing and remaining award-readiness gaps

New tests prove disabled/no-key mode has zero network activity, strict request shape, invalid JSON classification, missing/unknown fields, invalid color and parameter types, six-action bounds, semantic rejection, action order, deterministic local IDs, no live-instance apply, wrong-plan matching failure, offline replay, and exhausted-credit short-circuiting.

Final regression: `python -m unittest discover -s ai_builder/tests -v` ran **259 tests, OK** (29 new ScenePlan real-adapter/evaluator tests relative to the 230-test local baseline). `node --test tools/test-traffic-controller.mjs` ran **9 tests, all passed**. `git diff --check` passed. No new live API requests after the original three; no deployment, GitHub push or Kaggle submission.

Remaining unverified: real-model correctness; API quota restored; real browser integration; p95 latency/cost under load; a hidden evaluation set; domain users' clarity; scene generation beyond the authored district. The current constrained schema cannot create arbitrary buildings, pedestrians, road layouts or per-vehicle routes. Adding a real model does not by itself satisfy the creative breadth expected of a winning scene builder.

Next promotion condition: restore API credits, rerun the same three smoke cases without changing the prompt, then assess all 50 cases plus a held-out set. Require zero unsafe acceptance/live mutation and publish exact plan mismatch cases before considering browser preview integration. No automatic rollout or award guarantee.
