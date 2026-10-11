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
