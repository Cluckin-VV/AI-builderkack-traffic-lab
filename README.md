# AI Builder Traffic Lab

A browser-based AI traffic-scene prototype exploring natural-language-to-action workflows for interactive smart transportation environments.

## What this is

This repository contains the reproducible v0.3.0 baseline of the AI Builder traffic-scene prototype. It is not the final Kaggle Hackathon submission.

Execution chain:

```text
Browser
→ ModelAdapter / Compiler
→ SceneAction
→ Validator
→ State.apply
→ Renderer
→ Event Log
```

Current versions: App `v0.3.0`, Command Protocol `v0.3`, SceneAction Protocol `v0.1`.

The prototype provides deterministic command parsing, a versioned SceneAction protocol, safe rejection of unknown and invalid actions, browser scene updates, Event Log tracing, Runtime Identity, `/health`, evaluation cases, and standard-library tests.

## Run

From the repository root:

```powershell
python -m unittest discover -s ai_builder/tests -v
python -m ai_builder.server
```

Open `http://127.0.0.1:8000` for the browser demo and `http://127.0.0.1:8000/health` for runtime identity.

## Limits

- No real LLM is connected; model adapters are fake or shadow-only.
- No FastAPI, Redis, PostgreSQL, LangGraph, RAG, external API, or database is used.
- The system validates a deterministic action pipeline; it is not a complete traffic simulator.
- The browser renderer is a minimal Canvas perspective scene.

## Roadmap

Runtime verification → SceneAction protocol → LLM adapter → evaluation → agent workflow → deployment

See `docs/github-baseline-v0.1.md` for the baseline verification record.
