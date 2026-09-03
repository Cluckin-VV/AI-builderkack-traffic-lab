# AI Builder runtime

This package contains the guarded scene-action pipeline and the browser demo host.

## Versions

- App: `0.4.0`
- Command Protocol: `0.3`
- SceneAction Protocol: `0.2`

## Run

```powershell
python -m unittest discover -s ai_builder/tests -v
python -m ai_builder.server
```

Open `http://127.0.0.1:8000`.

For a cloud runtime, set `PORT`; the module then binds to `0.0.0.0:$PORT`. Local execution without `PORT` remains restricted to `127.0.0.1:8000`. The repository-level `render.yaml` runs this same module and uses `/health` for deployment checks.

## Browser execution chain

```text
Prompt
→ FakeModelAdapter (dependency injected)
→ SceneAction JSON
→ validate_scene_action_schema
→ validate_scene_action_semantics
→ SceneState.apply
→ Renderer data
→ Three.js WebGL scene
→ Event Log inspector
```

The browser renderer never parses a command and never writes `SceneState`. Unknown commands, malformed candidates, unsupported parameters, combined actions, and impossible state transitions are rejected before execution.

## Runtime endpoints

- `GET /` — browser world builder
- `GET /health` — version, start time, source fingerprint, Git commit
- `GET /api/state` — read-only renderer state and latest event
- `POST /command` — the only browser action pipeline
- `GET /assets/*` — pinned local UI modules and styles

## Visual controls

- drag the viewport to orbit;
- use the mouse wheel to zoom;
- use arrow keys while the viewport is focused;
- reset the camera from the viewport toolbar;
- pause visual animation without changing `SceneState`.

## Model boundary

The normal browser path uses a deterministic adapter. Real LLM support is shadow-only: it may generate and validate a candidate, but it is not allowed to call `SceneState.apply` or control the browser scene.

## Limits

- only the documented Chinese command protocol is executable;
- process-local state is not persistent;
- vehicle motion is visual, not a traffic simulation;
- Three.js is loaded from a pinned jsDelivr URL on first page load.
- one running server process exposes one shared, ephemeral scene to all visitors.
