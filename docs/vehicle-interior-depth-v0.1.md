# Passenger vehicle cabin depth — 2026-10-13

## Scope

Sedan and SUV now include upper-cabin seats, head restraints, dashboard, steering wheel and column behind tinted glazing. Original Blender sources, GLB exports and runtime JSON are retained. Headlights use separate projectors and a thin running-light strip; mirrors have rear-facing reflective inserts. Bus materials and traffic/state/protocol behavior are unchanged.

Glass uses alpha 0.52, front faces, no depth writing and no shadow casting. This inexpensive approximation reveals the interior without a refraction render pass; it is not physically accurate automotive glass. The lower cabin remains hidden by the opaque body.

## Evidence

- New opacity/interior asset regression failed before implementation, then passed.
- Complete Python suite: 311 tests passed, 20.795 seconds; JavaScript suite: 56 passed.
- Production Three.js loader audit checks four independent wheel assemblies, fixed brake calipers and transparent passenger glazing with modeled seats.
- Local fingerprint: `f2143595f8dc`.
- Actual browser front/rear close-ups reviewed, not Blender stills. Evidence in `output/playwright/vehicle-cabin-*-browser.png`.
- Oct13 real-UI immersive preview/cancel/confirm/undo passed. Console: zero errors/warnings.
- 24 vehicles, rain, street camera, balanced, immersive: 30.020 seconds / 1259 frames (~41.94 FPS); p95 29.3 ms, frames over 250 ms: 0. Actual draw buffer **2890×1600**, not 1080p. Geometry 272 and textures 29 stayed stable over this short sample. Screenshot: `output/playwright/vehicle-rain-candidate.png`.
- The initial 1080p setup timed out because it assumed uncapped devicePixelRatio. This is disclosed rather than relabeling the sample. The harness now uses the actual canvas-to-CSS ratio.

## Remaining limitations

Body panels still look stylized and wheel-arch highlights have visible discontinuities. Interior proportions/detail are simplified; no suspension simulation, driver animation or physical refraction. Bus interior was not upgraded. This is a verifiable incremental improvement, not the requested final realism level. The 30-second sample is not a ten-minute stability test or a guarantee for all devices.

## Publication

Pending normal push, existing free Render deployment and public fingerprint/browser verification. Do not identify this candidate as live until those checks complete.
