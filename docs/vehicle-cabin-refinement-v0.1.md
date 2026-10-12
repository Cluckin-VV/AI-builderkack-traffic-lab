# Vehicle cabin and wheel refinement — 2026-10-11

## Scope

Incremental correction, not a final photorealistic release. Sedan and SUV assets were regenerated from the editable Blender script. Bus geometry, traffic rules, protocol, validators and state transitions were not changed.

- Replaced the opaque cabin obscuring the windscreen with coplanar painted frames, seals and glass; corrected side-window winding for browser culling.
- Replaced floating roof slabs with crowned roofs; aligned mirrors, lamps, SUV roof rails and spoiler.
- Cut wheel openings into the body; tires and rims now have open hubs and concentric axle centers.
- Reduced and moved calipers behind spokes. Separate steering and spinning groups keep calipers from spinning with tires.

## Verification

- Final local fingerprint `4a9206eba9ef`, App 0.8.0 / SceneAction 0.3.
- Final complete Python suite: **310 passed**, 20.215 seconds.
- JavaScript: **56 passed** after runtime changes; subsequent edits only regenerated assets and improved the inspection harness.
- Two new geometry regressions cover windscreen visibility and open tire hubs/concentric axles. Windscreen test failed against the previous asset.
- Browser harness verifies four wheel pivots for each vehicle and unchanged caliper matrices during tire spin. Old loader failed independent-spin assertion.
- Actual UI preview/cancel/confirm/undo passed before the final caliper-only geometry adjustment.
- Final browser close-ups passed; console **0 errors, 0 warnings**.
- Evidence: `output/playwright/vehicle-cabin-{sedan,suv,bus}-browser.png`, `vehicle-cabin-sedan-rear-browser.png`.

The inspection harness uses the production loader and Three.js in an isolated browser scene, not Blender stills or full-city screenshots. Triangle/draw-call totals include ground/sky. No new ten-minute or 24-vehicle performance benchmark was completed.

## Remaining gaps

Bodies remain stylized: broad flat panels, simplified door seams and lamps, opaque glazing without visible modeled interiors. Wheel-arch shading needs further refinement. Prioritize body surface continuity and cabin depth over more decorative parts. This is not GTA/Forza-equivalent rendering, suspension physics or DLSS.

## Publication

GitHub remote check failed: `schannel: server closed abruptly (missing close_notify)`. Not pushed or deployed this pass. Authentication, remote configuration, history and Render resources were not changed. Local fingerprint must not be presented as public deployment identity.

### 2026-10-12 follow-up

The validated correction was committed as `9362a5a`. Recalculating weighted normals after wheel-hole booleans was tried and visually rejected: it intensified arch highlights. The generator was restored to the validated design and assets regenerated; runtime JSON is identical to the validated commit (fingerprint `4a9206eba9ef`). Blender/GLB binaries were re-exported. Python **310 passed in 20.412s** and the browser wheel-assembly audit passed again. This experiment does not count as a realism improvement. GitHub connectivity recovered; remote main was independently read as `c005b6f`. Publication is pending verification below.

### Verified public release

- Normal push and fetch succeeded; local and remote source HEAD `46b23f6d0209505c79f9bff0712d6651fef1a746` matched.
- Existing free Render service, auto-deploy off; single deploy `dep-db6305flk1mc73bo2s00` became **live at 2026-10-12T00:57:03Z**.
- Public `/health`: App `0.8.0`, Command `0.3`, SceneAction `0.3`, fingerprint `4a9206eba9ef`, git `46b23f6`, started `2026-10-12T00:56:54.886510+00:00`.
- Public production-loader close-ups passed all wheel checks; sedan screenshot visually inspected. Evidence uses `public-vehicle-cabin-` filenames to preserve local captures.
- Public real-UI preview/cancel/confirm/undo passed; console zero errors/warnings.
- Render error-level log query from 00:57:03 to 00:57:50 returned no entries. This is a short post-deploy window, not a long-run stability claim.
- Follow-up changes are documentation and inspection-harness output paths only; no extra deployment needed for these.
