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

Follow-up near-1080p sample: **1921×1081**, same 24/rain/street/balanced settings, 30.027 seconds / 909 frames (**30.27 FPS**), p95 **41.6 ms**, no >250 ms frames, geometry/textures unchanged. Traffic had moved and visible draw calls rose to 947, so this is not a controlled resolution comparison. The slower sample is important: consistent 30+ FPS is not yet proven and performance remains an open item.

Body panels still look stylized and wheel-arch highlights have visible discontinuities. Interior proportions/detail are simplified; no suspension simulation, driver animation or physical refraction. Bus interior was not upgraded. This is a verifiable incremental improvement, not the requested final realism level. The 30-second sample is not a ten-minute stability test or a guarantee for all devices.

## Publication

Source commit `5878ca14e32d165aab68d734838eab1e5bb65290` was normally pushed and deployed to the existing free service. Deployment `dep-db6okjou01pc73av97og` became live at 2026-10-13T01:34:50Z. Public health independently returned fingerprint `f2143595f8dc`, git `5878ca1`, started 2026-10-13T01:34:46.783369Z.

Public production-loader checks and preview/cancel/confirm/undo passed. Public sedan screenshot was visually inspected. A fresh browser session after deployment had zero console errors/warnings. An earlier session recorded 503/501/favicon404 during cold-start/switch-over; these were not hidden or treated as successful loads. Render error-level logs from 01:34:50 through 01:35:37Z contained no entries (short window only). Follow-up commits only record evidence and do not require another deploy.

## 2026-10-23 seat and driver-silhouette follow-up

All three original Blender vehicle sources now include a seated, anonymous driver silhouette: a bounded head, jacket torso and forearms. Sedan/SUV seats gained upholstered inserts and revised back/headrest proportions; bus passenger seats gained back inserts and headrests, while its driver seat gained a separate back and headrest. The sedan dimensions were corrected after the first audit showed an excessively tall headrest near the roof. This is static visual geometry, not an animated person, NPC, or traffic decision maker.

The driver's skin/jacket materials are intentionally subdued and unbranded. At normal scene scale the silhouette is subtle; a Blender audit confirms presence but cannot prove human-level realism or visibility from every browser camera. A test checks the silhouette in all three exports, within the body width/length and below overall roof bounds. The bus+texture runtime asset budget remains below 10 MB, and the full initial art budget remains below 25 MB. The sampled Douyin frames remain reference only, not licensed source assets.

### Human-scale correction after browser feedback

A close browser crop revealed that the previous passenger-vehicle floor was almost level with the dashboard (`~1.015 m` versus `~1.04 m` dashboard top). That made the seat cushions appear to sit on the dashboard. The sedan floor is now `0.54 m` and the SUV floor `0.60 m`; both cushion tops are more than `0.25 m` below their dashboard tops. Opaque door shells hide the lower seat bases, as expected. Front and rear rows are separated by about `1.02 m` longitudinally. The sloping rear roof requires shorter rear backrests/headrests than the front row; the first render exposed this and the second corrected it. Exported `interior_layout` measurements and actual cushion/rear-rest geometry are covered by regression tests. This is an approximate visual proportion, not ergonomic certification.

The model now also records longitudinal measurements so the problem cannot recur by moving a seat forward: the rear row is over 0.8 m behind the front row, the front row is over 0.4 m behind the steering wheel, and the wheel sits behind the dashboard. The driver's head remains aligned with the front seat, rather than hovering at the windshield. The optional `side` Blender audit view makes this relationship visible in repeatable stills; it does not substitute for checking the Three.js import.

On 2026-10-26 a headed localhost Chromium session loaded the regenerated fleet, selected **车辆跟拍**, zoomed and orbited to a lower street-side angle. The side-on browser view showed the seat bases behind the opaque door shell and the backs/headrests behind the side glazing, with the front row behind the steering wheel. The browser console had zero errors and zero warnings. This is a visual spot-check only; that automation session reported 1 FPS, so it is not performance evidence. The bus silhouette is subtler and still needs a dedicated close-up acceptance. The app remains stylized, not photorealistic.
