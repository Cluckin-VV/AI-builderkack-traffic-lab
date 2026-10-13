# Exterior shading candidate — 2026-10-13

The passenger-body boolean wheel openings disturbed the surrounding highlights. Removing weighted normals alone did not fix the visible discontinuity, and removing body bevels also worsened the end-cap highlights. Those experiments were discarded.

This candidate copies the original uncut shell before cutting, transfers custom corner normals with nearest-face interpolation after cutting, and limits transfer distance to 3 mm. The temporary Blender reference is removed before export. Basis: [Blender Data Transfer documentation](https://docs.blender.org/manual/en/3.6/modeling/modifiers/modify/data_transfer.html). Actual generation was verified in Blender 4.5.9; this is not reliance on an untested version assumption.

## Evidence

- Both sedan and SUV exported positions exactly match every batch in HEAD before this change; no geometry, wheel positions or collision dimensions changed.
- Production browser loader: wheel/transparent-cabin assertions passed; triangle/draw counts unchanged.
- Front and rear sedan and front SUV browser images reviewed. Bright ridges above wheel arches are reduced; end-cap/fender discontinuities remain. This does not establish photorealism.
- Local fingerprint `1ea261099cd2`, Python **311 tests passed in 20.583s**.
- Candidate has not been published; public remains `f2143595f8dc`.

Next: inspect the same candidate under street/weather lighting before deployment. Do not repeat discarded weighted-normal/bevel experiments, or equate this shading improvement with a topology redesign.
