# Scene Structure Editor v0.1

Date: 2026-09-21. Local, uncommitted, not deployed. No paid API calls.

## What it does

The editor exposes four bounded target fields: `scene_layout`, bus count 0–12, weather and traffic light. `static/scene-editor.mjs::buildEditorCommand` converts the current state and target into the minimal sequence of existing natural-language clauses. It never receives a SceneState reference capable of mutation and has no HTTP write endpoint.

The generated text goes through the existing chain:

```text
Scene Structure Editor
→ existing command clauses
→ DeterministicScenePlanner
→ ScenePlan preview
→ Schema validation
→ Semantic validation
→ explicit confirmation
→ atomic SceneState commit
→ Renderer / Event Log
```

The UI does not invent new action payloads. Layout changes use `set_scene_layout`; vehicle, weather and light changes use the existing actions. The six-action plan limit remains active, so an oversized delta is rejected as a whole.

## Evidence

- `tools/test-scene-editor.mjs`: 4 tests passed for minimal add/remove/layout/weather/light command generation, no-op targets and invalid targets.
- Existing Python suite: 271 tests passed.
- Combined traffic JavaScript suite: 19 tests passed.
- Isolated Playwright browser at local port 8019: selected Central Exchange, 2 buses, snow and red light; clicked “生成配置预演”; projection showed `双向公交站 · 2 辆公交车 · 红灯 · 雪` while live count remained `0`; after explicit confirmation the page reported `已原子执行 5 个场景动作`, layout `bus_stop`, count `2`, light `红灯`, weather `snow`.
- Browser screenshot: `../output/playwright/editor-bus-stop.png`; visually inspected. Console errors: 0.

## Intentional limits

This is a bounded configuration editor, not arbitrary scene generation. It does not add new geometry from free-form prose, live LLM control, undo history or external persistence. The correct next product question is whether a small set of editable templates is more useful to a newcomer than another list of synonyms; it should be evaluated with a fresh-user walkthrough before expanding the protocol.
