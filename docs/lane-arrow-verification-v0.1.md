# Lane arrow correction — 2026-10-04

## Change

Left/right road arrows now retain an incoming stem and bend toward the intended
exit instead of rotating a straight arrow sideways. Geometry is metre-based in
the shared approach's forward/driver-right basis. Three.js triangulates the
concave polygon. No traffic controller, state, protocol or command changes.

## Evidence

- Four new geometry tests first failed on the missing export, then passed.
- `node --test tools/test-*.mjs`: 50 passed, no skips.
- `python -m unittest discover -s ai_builder/tests -v`: 308 passed in 19.875 s.
- Actual headed browser, 1920×1080 viewport, 12 vehicles, clear/balanced:
  `output/playwright/lane-arrows-corrected.png`; console 0 errors / 0 warnings.
- Local source fingerprint: `1bd86a99a5d3`. Started before commit; its old
  git_commit is not the publication identity. Public identity must be checked
  after deployment.

## Frame pacing investigation, not a performance certification

The previous public screenshot showed 1 FPS. Re-focusing the same public page
without changing production code and sampling RAF/timer intervals for 12 s
produced 1,034 frames, average RAF interval 11.609 ms (about 86 FPS), p95
12.6 ms, zero intervals over 250 ms. The 100 ms timer had mean 100.026 ms.
Document visibility was visible and focus true. This only proves the problem
was not continuously present in that sample. It does not isolate the cause or
establish ten-minute stability, 24-vehicle performance or all-device behaviour.
No frame samples were excluded and no quality was silently reduced.

Further work: repeat the controlled long run and investigate window occlusion,
GPU scheduling and resource growth if the low cadence returns. Near-camera
assets and weather realism still need work; this is not GTA/DLSS equivalence.
