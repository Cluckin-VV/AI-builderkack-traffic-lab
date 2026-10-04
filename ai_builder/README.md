# AI Builder runtime

This package contains the guarded scene-action pipeline and the browser demo host.

> Local candidate (2026-09-22): the fixed crossroads, four-phase controller,
> typed vehicle set, weather and browser workbench are under active development.
> This build is not deployed. Check `/health` before treating any browser result
> as current source.

## Versions

- App: `0.8.0`
- Command Protocol: `0.3`
- SceneAction Protocol: `0.3` (v0.2 compatibility retained)

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

`static/urban-world.js` builds the read-only crossroads city, instanced foliage and wet-road reflections. `static/weather-view.js` presents clear, rain, snow and fog modes. `static/scene3d.js` consumes Blender-authored meshes for one original sport sedan, one SUV and one low-floor bus from `static/models/`; editable `.blend`, GLB and compact browser-mesh exports are included. Each runtime model exposes four animated wheel pivots and brake-lamp components. `static/textures/` contains original AI-generated base-color textures. Models, textures and browser modules are covered by the runtime fingerprint and served through explicit allowlisted routes.

Blender is an **authoring tool**, not a runtime dependency. A normal server launch does not download or run Blender and does not generate images. The runtime art payload is approximately 9 MB before HTTP compression/caching; weak mobile GPUs and slow connections need further testing. Bus asset loading failure displays an explicit simplified-model warning.

See [visual upgrade verification](../docs/visual-city-upgrade-v0.1.md) and [intersection verification](../docs/intersection-control-progress-v0.1.md).

## Atmosphere and presentation

The viewport provides daylight, golden-hour and blue-hour lighting plus low/balanced/high quality tiers. These are presentation controls only. Clear/rain/snow/fog buttons still require preview and confirmation. Rain uses shared planar reflection, snowfall uses independently controlled surface coverage, and clouds/lighting/fog blend between weather profiles. FPS is measured native frame timing, not DLSS or generated frames; visible compilation hitches are counted.

See [browser atmosphere evidence and limitations](../docs/atmosphere-polish-v0.1.md). Pure visual configuration tests: `node --test tools/test-atmosphere-profile.mjs`.

The corner refinement adds bird/street/corner observations, dusk-lit architectural windows and eight roof snow surfaces alongside eight sidewalk surfaces. Balanced/low quality disable vehicle-glass transmission while preserving reflective glass; high quality enables it. The FPS badge suspends measurements when hidden or unfocused, but OS occlusion can still throttle a window that reports focus. It is not a benchmark guarantee. See [latest real-browser evidence](../docs/corner-weather-refinement-v0.1.md).

## Model boundary

The browser path uses the deterministic ScenePlan parser. Real LLM support is shadow-only: it may generate and validate a candidate, but it is not allowed to call `SceneState.apply` or control the browser scene. This implementation adds no paid API call.

## Limits

- only the documented Chinese command protocol is executable;
- process-local state is not persistent;
- the fixed-step traffic model supports straight, protected-left and right turns, but remains a visual prototype without pedestrians, collision-grade physics or route optimization;
- weather modes are simplified presentation and speed policies, with no independent intensity parameter;
- signal timing is a configurable demo policy, not traffic-engineering certification;
- the compact vehicle models are original prototype assets, not photoreal scans or licensed production-car replicas;
- Three.js is loaded from a pinned jsDelivr URL on first page load.
- one running server process exposes one shared, ephemeral scene to all visitors.
