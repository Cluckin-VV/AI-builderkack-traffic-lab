# Exterior shading candidate — 2026-10-13

The passenger-body boolean wheel openings disturbed the surrounding highlights. Removing weighted normals alone did not fix the visible discontinuity, and removing body bevels also worsened the end-cap highlights. Those experiments were discarded.

This candidate copies the original uncut shell before cutting, transfers custom corner normals with nearest-face interpolation after cutting, and limits transfer distance to 3 mm. The temporary Blender reference is removed before export. Basis: [Blender Data Transfer documentation](https://docs.blender.org/manual/en/3.6/modeling/modifiers/modify/data_transfer.html). Actual generation was verified in Blender 4.5.9; this is not reliance on an untested version assumption.

## Evidence

- Both sedan and SUV exported positions exactly match every batch in HEAD before this change; no geometry, wheel positions or collision dimensions changed.
- Production browser loader: wheel/transparent-cabin assertions passed; triangle/draw counts unchanged.
- Front and rear sedan and front SUV browser images reviewed. Bright ridges above wheel arches are reduced; end-cap/fender discontinuities remain. This does not establish photorealism.
- Local fingerprint `1ea261099cd2`, Python **311 tests passed in 20.583s**.
- Published on 2026-10-15: Render deploy `dep-db862fe89jmc73cbv2s0` is live, source `e858827dd002a816ab352291c9cf983d13d08825`. Public `/health` confirms fingerprint `1ea261099cd2`, git `e858827`, started at `2026-10-15T13:15:50.217086+08:00`.

Street/rain inspection completed locally. Public production-loader checks passed for all three vehicles; the SUV near-view screenshot was visually inspected. Public weather preview, cancel, confirm and undo checks all passed. Browser evidence: `output/playwright/public-vehicle-cabin-{sedan,suv,bus}-browser.png` (local generated artifacts).

Local performance sample: 30.001 seconds, 1097 frames (36.57 FPS), p95 33.4 ms, no frames over 250 ms; 24 vehicles, rain, balanced street view, non-immersive, actual drawing buffer 1500×1132. Geometry 268 and textures 28 stayed unchanged. This is not a 1080p benchmark, ten-minute stability test, or all-device guarantee.

Remaining: body proportions and end-cap/fender continuity still look stylized; the SUV cabin is too angular for the requested realism. Prioritize silhouette/topology over additional small decorations. Do not repeat discarded weighted-normal/bevel experiments, or equate this shading improvement with a topology redesign.
