# TransitLab city art upgrade v0.1

Implemented 2026-09-07; final local verification 2026-09-10. Historical note: this began as an uncommitted App 0.4.0 visual candidate and was incorporated into the App 0.5.0 release candidate on 2026-09-14. Protocol versions did not change.

## What actually changed

- Original Blender electric bus: beveled body, smoked glazing, passenger doors, mirrors, headlights, route LEDs, wheel hubs and roof equipment. 17,436 triangles, nine material batches.
- Actual editable `ai_builder/static/models/city-bus-v1.blend`, interchange `city-bus-v1.glb`, and browser-consumed `city-bus-v1.json`.
- AI-generated asphalt and limestone base-color textures applied to geometry. These are generated materials, not reference photographs or background scene illustrations.
- Detailed city architecture: window mullions, stone cladding, parapets, shop signs, roof equipment, bus shelter, tactile paving, drains, bollards and streetlights.
- Instanced alpha-tested leaf sprays and branch geometry replace solid polygon tree crowns.
- Directional shadows, environment reflections and an actual planar reflection pass for patchy rain-film road reflections. Reflection target is limited to 768 × 512, no multisampling.
- Static geometry is merged by material/shadow properties before signals and buses are added. Dynamic command-controlled objects remain separate.
- An immersive viewport toggle changes only layout. Narrow/short layouts retain the validation pipeline.

![Real browser capture](transitlab-city-art-v1.png)

## Unchanged domain boundary

```text
Browser command → FakeModelAdapter → candidate v0.2 JSON
→ schema validation → semantic validation → SceneState.apply
→ read-only render data → Three.js + local art assets → Event Log
```

The art pass itself made no modifications to SceneCompiler, SceneAction, schema/semantic rules, model adapter, or SceneState implementation. No real-model calls, database or paid hosting plan were introduced. The later crossroads/weather integration moved the app to 0.5.0 while Command remains 0.3 and SceneAction remains 0.2.

Static artwork is presentation, not domain objects: decorative parked cars and buildings cannot be commanded. The initial bus count is still zero. A bus is created only after an accepted command; model loading never adds a bus to state. Motion remains the previous presentation loop, not red-light-aware traffic physics.

## Reproduce

Normal use needs only the existing runtime; Blender is not required:

```powershell
python -m unittest discover -s ai_builder/tests -v
python -m ai_builder.server
```

Open `http://127.0.0.1:8000`, add a bus, stop it, change the signal, and use **沉浸场景**. The verification preview for this task uses port 8011 to avoid touching another local service.

To rebuild the authored bus with Blender 4.5.9 LTS, run from the project root:

```powershell
blender --background --python tools/art/build_city_bus.py
```

The script creates an empty authoring scene and overwrites only its three named bus exports. Save any hand-edited bus model under a different name before regenerating. Blender is an authoring-only tool downloaded from its official distribution; the portable binary is under ignored `output/tools/`, not committed or required on Render.

Automated browser verification (requires Node/npm and Chromium available to Playwright):

```powershell
# Start a separate local preview server first:
$env:AI_BUILDER_PORT="8011"
python -m ai_builder.server
# In another terminal, from the same project root:
& tools/art/verify_browser.ps1
```

The script operates the local preview through the real form, records real HTTP responses, verifies model loading, takes actual browser captures and checks a 390px viewport. It modifies only that preview's ephemeral scene. It does not publish anything or contact a model API. Use a fresh preview process for reproducible initial state.

## Verification evidence

- `python -m unittest discover -s ai_builder/tests -q`: **198 tests, OK**. Original 189 preserved; nine art-asset tests added.
- `python -m ai_builder.evaluate`: legal commands 13/13; illegal rejection 10/10; incorrect state changes 0; incomplete Event Logs 0.
- Real browser form: add, stop, move, red, green and remove all accepted at execution stage.
- Real browser form: `让天气下暴雪` and `增加公交车并把灯改成绿色` rejected at schema stage with `unknown action_type`; complete state snapshots equal before and after.
- The two rejection cases also produced **identical WebGL canvas pixels**, with a static scene. DOM status messages are intentionally excluded because rejection feedback must change. Capture waits for UI completion and a render frame; ordinary element screenshots include overlaid messages and are not a valid scene-only pixel comparison.
- Blender model finished loading (`data-bus-asset=ready`); browser page errors 0. Earlier manual console check of the reflection scene: errors 0, warnings 0.
- Mobile viewport 390 × 844: no horizontal overflow. Full-page screenshot visually inspected. This is desktop Chromium viewport emulation, not testing a physical phone's GPU.
- `git diff --check`: no whitespace errors (Git reports existing LF-to-CRLF normalization warnings).
- Runtime identity: App 0.4.0, Command 0.3, SceneAction 0.2, source fingerprint `cd6dde6401db`, base Git commit `98661c5`. Git SHA alone does not include these uncommitted art changes; the source fingerprint does.

New unit tests cover finite triangle data, metre scale/Y-up coordinates, GLB header integrity, PNG signatures/resolution, state/log read-only behavior, denied source/traversal routes, fingerprint sensitivity, module MIME types and a runtime art payload under 10 MB.

## Asset provenance and budget

| Asset | Origin | Bytes |
| --- | --- | ---: |
| city-bus-v1.json | Authored in Blender by included script | 2,327,494 |
| city-bus-v1.glb | Same authored model, interchange export | 973,660 |
| city-bus-v1.blend | Editable authoring source | 2,356,905 |
| asphalt-ai-v1.png | Built-in image generation | 3,594,773 |
| limestone-ai-v1.png | Built-in image generation | 3,048,245 |

Browser normally loads the JSON and two textures: 8,970,512 bytes, plus scripts. It does not load `.blend` or GLB. `.blend` is deliberately not an HTTP route. Assets and visual modules participate in Runtime Identity; nested imports/texture URLs inherit the fingerprint query to avoid stale visuals.

Asphalt prompt: production-ready square seamless tileable PBR base color for modern urban asphalt after light rain; strict orthographic top-down scan; flat diffuse lighting; dark neutral grey basalt aggregate, fine cracks, subtle damp tonal variation; no markings, lettering, objects, perspective, baked reflections or dramatic shadows.

Limestone prompt: square seamless warm light-grey limestone architectural cladding, horizontal rectangular panels, thin recessed joints, fine porous stone grain, restrained tonal variation and subtle weathering; flat diffuse lighting, no objects, signage, perspective or highlights.

Original generated images were preserved outside the project and copied into its texture directory. The generated panel count differs from the requested three-by-three grid; it is accepted as a material variation, not reported as exact prompt adherence. Neither image is a complete scanned PBR material set: height/bump is an approximation using base-color luminance, not a physically measured normal map.

Three.js r180 Reflector is MIT-licensed and vendored with license text; see `THIRD_PARTY_NOTICES.md`. Storefront names are fictional. No downloaded third-party vehicle or building model is included.

## Remaining limits and next step

This is a more detailed real-time city scene, **not photogrammetry, film-quality photorealism, or an accurate reconstruction of Shanghai**. Repeated facades, procedural foliage and simplified parked cars remain visible art limitations. The approximate 9 MB art download, planar reflection pass and dense foliage need measurements on low-end GPUs and slower networks. Runtime motion does not implement collisions, traffic law or passenger logic.

The screenshot is local release-candidate evidence and must not be claimed as public until Render `/health` reports App 0.5.0. The existing v0.4.0 tag remains historical and must not be moved. A final competition entry still requires a verified public deployment and video.
