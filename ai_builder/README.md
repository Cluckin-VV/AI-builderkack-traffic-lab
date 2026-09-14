# AI Builder runtime

This package contains the guarded scene-action pipeline and the browser demo host.

> Release candidate (2026-09-14): the tested intersection controller and weather
> presentation are connected to the browser. The public URL may remain on v0.4
> until `/health` reports App 0.5.0. See the
> [implementation and browser evidence](../docs/intersection-control-progress-v0.1.md).

## Versions

- App: `0.5.0`
- Command Protocol: `0.3`
- SceneAction Protocol: `0.2`

## Run

```powershell
python -m unittest discover -s ai_builder/tests -v
python -m ai_builder.server
```

Open `http://127.0.0.1:8000`. Do not open `static/index.html` directly: the page depends on HTTP template rendering, API routes and ES modules.

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

After an accepted update, `traffic-controller.mjs` reads the desired scene configuration and advances a browser-local fixed-step simulation. It owns EW/NS right-of-way, all-red clearance, stop-line waiting and vehicle placement. `scene3d.js` only maps that snapshot to Three.js objects. The simulation cannot call the command endpoint or `SceneState.apply`.

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
- use **沉浸场景 / 返回工作台** to expand or restore the city viewport.

## City art assets

`static/urban-world.js` builds the read-only crossroads city, instanced foliage and wet-road reflections. `static/weather-view.js` presents clear, rain, snow and fog modes. `static/scene3d.js` loads the Blender-authored bus from `static/models/city-bus-v1.json`; its editable `.blend` and GLB are included. `static/textures/` contains two original AI-generated base-color textures. Models, textures and browser modules are covered by the runtime fingerprint and served through explicit allowlisted routes.

Blender is an **authoring tool**, not a runtime dependency. A normal server launch does not download or run Blender and does not generate images. The runtime art payload is approximately 9 MB before HTTP compression/caching; weak mobile GPUs and slow connections need further testing. Bus asset loading failure displays an explicit simplified-model warning.

See [visual upgrade verification](../docs/visual-city-upgrade-v0.1.md) and [intersection verification](../docs/intersection-control-progress-v0.1.md).

## Model boundary

The normal browser path uses a deterministic adapter. Real LLM support is shadow-only: it may generate and validate a candidate, but it is not allowed to call `SceneState.apply` or control the browser scene.

## Limits

- only the documented Chinese command protocol is executable;
- process-local state is not persistent;
- the fixed-step traffic model supports straight approaches only; no turns, pedestrians, collision-grade physics or route planning;
- weather modes are simplified presentation and speed policies, with no independent intensity parameter;
- Three.js is loaded from a pinned jsDelivr URL on first page load.
- one running server process exposes one shared, ephemeral scene to all visitors.
