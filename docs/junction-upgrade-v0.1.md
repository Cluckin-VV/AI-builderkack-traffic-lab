# TransitLab junction upgrade v0.1

Status: local, unreleased App 0.8.0 candidate. This document describes the implementation in the current worktree, not the public Render deployment.

## Product slice

TransitLab is a browser-native, fixed urban intersection builder—not a Cities: Skylines-scale city simulator. Its authored scene is one four-way, right-hand-drive junction with three lanes per approach, sidewalks, crosswalks, fixed buildings/greenery and twelve approach-specific signal heads. Users can orbit between the default oblique camera and a street camera. Weather and vehicle mix are the bounded mutable parts.

The useful loop is: enter a supported natural-language scene request → inspect a detached preview → confirm one atomic plan → watch the traffic/weather update → inspect the trace or undo the last change. The parser is deterministic and local; it does not claim to understand arbitrary language, and no paid model request is needed.

## One junction definition

`ai_builder/scene_layouts.json` is the shared source for the road dimensions, lane offsets, approach headings, stop line, turn phases, signal pole positions, car envelopes, weather speed factors and vehicle cap. The Python renderer returns this manifest to the browser. `traffic-controller.mjs` uses it for routes, stopping and phase control; `urban-world.js` uses it for road markings and geometry; `scene3d.js` uses it to place and aim the signal heads. This keeps visible lane/signal geometry tied to the same configuration as simulation and tests.

The controller runs a demo cycle of EW through/right, EW protected left, NS through/right and NS protected left. Through phases are 20 seconds; protected-left phases are 8 seconds; each phase ends with 3 seconds of yellow and at least 2 seconds of all-red clearance, extended while a vehicle occupies the junction. Right turns are signal-controlled. Vehicle speeds use fixed 50 ms steps, weather-dependent desired speed, per-type dimensions, braking distance and following gaps. Vehicles loop only after passing the visible exit.

These are deterministic presentation parameters, not a traffic-engineering or road-safety certification. Pedestrians, emergency vehicles and collision-grade physics are out of scope.

## Signal semantics

- New scene state starts in `automatic` mode.
- A confirmed `把信号灯改成红色` request enters manual all-red; vehicles stop before the common stop line.
- A confirmed green request releases only `EW_THROUGH` (which includes the right-turn group). Protected left and NS groups remain red; this intentionally avoids implying that every approach is green.
- A manual yellow request shows yellow on all approaches as a caution-only state: no movement group is released, approaching vehicles stop before the line, and vehicles already in the junction are allowed to clear. It is described in the UI as an all-way caution—not a normal traffic phase.
- `恢复自动信号` is a v0.3 `set_signal_mode` action and uses the same preview/confirm path. It resumes the automatic controller.
- Each physical signal head carries approach/movement identity and a text/icon cue, in addition to lamp color. State text also spells out the active phase.

The v0.2 action envelope remains accepted for existing commands. v0.3 extends it with typed add/remove vehicle and signal-controller mode actions. Schema → semantics → isolated preview → explicit commit remains the only plan execution route.

## Vehicle assets

The final fleet is deliberately three original models—not an unbounded catalog:

| Runtime type | Design intent | Overall body envelope |
|---|---|---:|
| `sedan` | Branded-free GT sport sedan, low roof and long hood | 4.65 × 2.18 m |
| `suv` | Distinct upright body, roof rails and wheel cladding | 4.95 × 2.30 m |
| `bus` | Low-floor electric city bus | 9.49 × 3.06 m |

Models are authored in Blender using metre units and exported as editable `.blend`, GLB and material-batched runtime mesh JSON. The browser consumes the compact JSON so wheel pivots and brake lamps can be controlled independently; GLB is provided as a standard interchange artifact. The meshes are original, unbranded designs. Broad readability techniques (clear silhouettes, material separation and restrained detail) may be informed by mainstream real-time games, but no game asset, licensed production-car mesh, badge, screenshot or logo is copied.

Rebuild with the included Blender 4.5-compatible scripts:

```powershell
& "output/tools/blender-4.5.9-windows-x64/blender.exe" --background --python tools/art/build_city_vehicles.py
& "output/tools/blender-4.5.9-windows-x64/blender.exe" --background --python tools/art/build_city_bus.py
```

The Blender executable is authoring-only and is not needed to run the web app. Assets are served as browser content; `.blend` source files are not public routes.

## Weather and rendering

Clear, rain, snow and fog each update presentation and the simplified speed/following policy. The fixed district, architecture and road do not change. Rain uses restrained wet-road response/reflections; snow uses visible precipitation and longer following gaps; fog lowers visibility. Performance and visual quality depend on GPU and display settings; this is not photoreal path tracing or headset VR.

## Verification record

### Local verification — 2026-09-22

- The browser weather editor now compiles all four of its own labels (`晴 / 雨 / 雪 / 雾`) into valid preview plans. Regression coverage also includes the exact phrase `切换雨天`, which previously rejected.
- Fog uses a longer fade range (`near=40`, `far=165`): the junction remains legible while distant blocks soften. Snow toggles both falling flakes and thin accumulation on walkways; rain enables the wet-road reflection layer.
- Actual local-browser preview → confirm → render was exercised for fog, snow, rain, then clear. Runtime ended on clear, with all 12 default vehicles present and Blender assets reporting `ready`. Playwright console: 0 errors, 0 warnings.
- `/health`: App `0.8.0`, Command Protocol `0.3`, SceneAction `0.3`, source fingerprint `f3c9e3fc1981`, started `2026-09-22T17:24:03.207417+08:00`, Git commit `c62afae` (the working changes are uncommitted, so this Git SHA is not the source identity).
- Python: `python -m unittest discover -s ai_builder/tests -v` — 306 passed. JavaScript: all three `tools/test-*.mjs` suites — 34 passed, including a 30-simulated-minute accelerated traffic soak (36,000 fixed steps; not 30 minutes of wall-clock browser runtime). `python -m compileall -q ai_builder` passed.
- Deterministic evaluation: 19/19 supported cases accepted; 12/12 invalid or ambiguous cases rejected; false rejects 0, dangerous accepts 0, state changes 0, missing Event Logs 0.
- `git diff --check` reports no whitespace errors; it prints existing LF→CRLF normalization warnings for modified tracked files.

### Visual evidence

- Clear final UI: `output/playwright/transitlab-final-clear.png`.
- Weather canvases: `output/playwright/weather-clear-final.png`, `weather-rain-final.png`, `weather-snow-final.png`, `weather-fog-final.png` under `output/playwright/`.
- Three Blender audit renders: `output/playwright/vehicle-sedan-final-audit.png`, `vehicle-suv-final-audit.png`, `vehicle-bus-final-audit.png`.
- Exactly three unique original vehicle models are built and reused for fleet instances: one sport sedan, one urban SUV, and one low-floor electric bus. Editable `.blend`, GLB, and browser runtime JSON are generated for each. Their current envelopes are sedan 4.65 × 2.18 × 1.47 m, SUV 4.95 × 2.30 × 1.818 m, bus 9.491 × 3.06 × 3.264 m.

### Still not verified / not claimed

- No 10-minute wall-clock browser soak, low-end-device benchmark, or broad hardware frame-rate guarantee has been performed.
- The art is a cohesive original real-time prototype, not photoreal AAA/VR quality. Snow accumulation is limited to walkways; the travelled asphalt is not snow-covered. The fog/rain/snow visuals are stylized browser effects, not a meteorological simulation.
- No public deployment, GitHub push, Kaggle writeup edit, or competition submission was performed in this pass. The local changes remain uncommitted. No award placement is implied.

## Competition boundary

This slice more clearly maps natural language to a validated, interactive 3D traffic scenario and gives reviewers visible causal behavior. It is a stronger, more coherent prototype, not evidence of award placement or full arbitrary-scene generation. The remaining competition-critical work is a recorded browser run covering preview, automatic phase changes, three vehicles, snow/rain, rejection and undo; public deployment of this exact fingerprint; and a transparent writeup describing the deterministic parser and the simulation limits.
