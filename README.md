# TransitLab — Guardrailed AI World Builder

TransitLab is a browser-native 3D traffic-scene prototype. A visitor describes a
change in Chinese, reviews a projected scene, confirms it, watches vehicles and
weather respond, and can preview and confirm an undo. The public demo is
[here](https://ai-builderkack-traffic-lab.onrender.com/); its current runtime
identity is available at [/health](https://ai-builderkack-traffic-lab.onrender.com/health).

The application is App **v0.8.0**, Command Protocol **v0.3**, SceneAction
**v0.3**. Check `/health` for the exact public commit and source fingerprint:
Render deploys are deliberately manual, and the free instance can cold-start.

## Try the five-step demo

1. Open the public demo and wait for the live WebGL crossroads, not a static
   image. The default scene contains 6 sedans, 4 SUVs and 2 buses.
2. Enter `增加两辆SUV，切换雨天` and choose **生成并预演**.
3. Compare the projected view with the read-only SceneState inspector. Until
   confirmation, the inspector still represents the committed scene.
4. Choose **确认执行全部动作**. Watch the weather, vehicle count, signal phases and
   per-vehicle waiting reasons change.
5. Choose **撤销上次修改**, inspect the undo preview, then confirm it. Cancellation
   or rejection leaves the committed scene unchanged.

The UI also offers supported example commands, a bounded scene-structure
editor, clear/rain/snow/fog controls, a 60-second fixed-seed weather comparison,
and camera/lighting presets. The comparison is a local model demonstration,
**not** a real-world traffic prediction.

## What is actually implemented

- One fixed right-hand-traffic crossroads and a separate bus-stop template,
  rendered in Three.js. Blender-authored, editable sedan, SUV and bus assets
  are included as `.blend`, `.glb` and compact browser meshes. The buildings,
  road markings, signals and vegetation are original project assets; no
  licensed game vehicle or production-car scan is bundled.
- Three vehicle types with stable IDs and an explicit **24-vehicle** scene cap.
  The browser controller uses shared lane/stop-line metadata, straight, left
  and right routes, spacing, and an automatic four-phase signal cycle. Yellow
  transitions and all-red clearance separate conflicting phases. A manual
  signal request cannot directly create conflicting greens.
- Clear, rain, snow and fog presentation with bounded weather-aware speed and
  spacing rules. Sunlight, golden-hour and dusk are presentation controls.
- A deterministic command planner. Each SceneAction passes **Schema → Semantic**
  validation before execution. Multi-action ScenePlans are tested on detached
  state, previewed and committed only after explicit confirmation; the latest
  change has a guarded undo path. The six-action plan limit may require two
  separately confirmed batches for a large fleet change.
- Runtime fingerprint, `/health`, read-only SceneState, vehicle observer and
  Event Log make execution and rejection inspectable.

This is a constrained, explainable prompt-to-scene editor—not arbitrary
language understanding, an open-world city, certified traffic physics, VR, or
AAA photorealism. The public command path uses rules. A real-model adapter
exists for **shadow evaluation only**; it cannot execute public scene changes
and no paid model API is needed for the demo. Unsupported or ambiguous
instructions reject safely instead of being guessed into an action.

## Run and verify locally

The server needs Python 3.13 or a compatible Python 3 interpreter. It uses the
standard library; no database, Docker, Redis or model key is needed. The live
Three.js module loads from a pinned CDN, so first browser load needs internet.

```powershell
cd "D:\ai-builder-traffic-lab"
python -m unittest discover -s ai_builder/tests -v
node --test tools/test-*.mjs
python -m ai_builder.server
```

Open the HTTP address printed by the server; do **not** open
`ai_builder/static/index.html` as a `file://` page. At the last full source
regression, **326 Python and 80 JavaScript tests passed**. Those tests protect
protocol validation, state integrity, asset structure and traffic invariants;
they do not certify visual realism or performance on every machine.

Editable vehicle assets can be regenerated from
[`tools/art/build_city_vehicles.py`](tools/art/build_city_vehicles.py). The
browser source and tests live under [`ai_builder`](ai_builder) and [`tools`](tools).
The Render Blueprint is [`render.yaml`](render.yaml); automatic deployment is
off to prevent a documentation-only commit silently changing the judged demo.

## Evidence and limits

The current [release-gate audit](docs/release-gate-audit-v0.1.md) records
same-camera weather observations and the remaining review gates. Earlier
[vehicle close-up](docs/vehicle-interior-depth-v0.1.md),
[camera-occlusion](docs/follow-camera-occlusion-v0.1.md), and
[traffic-junction](docs/junction-upgrade-v0.1.md) notes include narrower
implementation and verification evidence. The three Douyin reference clips
were sampled where accessible, not watched in full; their evidence boundary is
recorded [here](docs/douyin-reference-review-v0.1.md).

The [2:12 English-captioned video](https://github.com/Cluckin-VV/AI-builderkack-traffic-lab/releases/download/v0.5.0-rc.1/transitlab-v05-demo-final.mp4)
documents the **older v0.5** release. It does **not** show the current v0.8
mixed-fleet scene or revised workflow and should not be presented as current
footage. A new under-three-minute demonstration is needed for a final entry.

Known operational limits: scene state and Event Log are process-local and reset
on restart; visitors to one instance share the current scene; a free Render
instance may sleep; asset/lighting cost varies by device. Current vehicle
models are stylized rather than scanned or physically simulated.

## Hackathon status

The project is aimed at the [AI Builder Hackathon 2026](https://www.victoriavr.com/news/ai-builder-hackathon-2026-build-the-future-of-ai-native-3d-experiences-5915194b).
The [organizer's terms](https://www.victoriavr.com/hackathon/2026/terms)
require a public repository, hosted browser demo, video under three minutes,
short description and focus category. They list **11 November 2026, 16:30
CEST** as the submission deadline, while the Kaggle competition has displayed
an earlier close date. The authenticated submission route and any changed
instructions must therefore be confirmed with the organizer/Kaggle before
claiming the entry is submitted. Registration, public deployment and a draft
writeup are not a final submission. Pre-build prototype work and third-party
provenance must be disclosed accurately; see
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

No award placement is promised. The current priority is a credible live demo,
current video and submission evidence—not unbounded feature growth.
