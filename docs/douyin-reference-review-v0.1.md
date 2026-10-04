# Video reference review and rain-surface refinement

Date: 2026-10-05. Scope: TransitLab browser presentation, without changing the
traffic controller, command protocols, validators or SceneState.

## What was actually accessible

The Codex in-app browser still timed out on navigation. A separate headed
Chromium session opened the public Douyin pages successfully. The site's own
close button dismissed an optional login prompt; no account, private likes,
cookies, credentials or undocumented endpoints were used. The video player
was sampled through ordinary media seek controls and browser screenshots.
The initially captured temple samples were obscured by another login prompt;
they were discarded as visual evidence. The later `*-visible.png` samples
were inspected and contain the actual scene.

This is sampled visual inspection, not a claim that the complete three videos
were watched with audio. The model names, generation claims and rankings in
the titles/captions belong to the videos' authors. These clips do not establish
model performance, rendering hardware, frame rate, prompt parity or source-code
provenance.

| Public video | Inspected times | Directly visible observations |
| --- | --- | --- |
| [AI examples comparison](https://www.douyin.com/video/7689208243867880744) | 00:18, 00:40, 01:00 | Ski scene: long directional shadows, fine snow haze behind the character; ship: distinct wood, cloth and rope silhouettes; exploded toy: separated parts with readable material highlights. |
| [Temple comparison](https://www.douyin.com/video/7691513560190438691) | 00:12, 00:42, 01:02, 01:25; also a smaller playback frame around 01:36 | Stone steps establish a foreground, gates/hall occupy the middle, trees recede behind roofs. Warm lamps punctuate restrained red/grey architecture. Stone panels vary in tone. Later sampled courtyard has a low-contrast distant tree layer. The small night playback frame shows warm windows against a blue environment. |
| [Grassland game comparison](https://www.douyin.com/video/7688571158563975161) | 00:05, 00:16, 00:24 | Upper scene: dense, varied grass, shadows across terrain, atmospheric distance and bright backlighting. Lower scene: sparse, repeated bright blades, visibly simpler rock/tree silhouettes. Both show readable characters and action UI. |

Local inspection evidence is under `output/playwright/`:

- `temple-12-visible.png`, `temple-42-visible.png`, `temple-62-visible.png`,
  `temple-85-visible.png`, `douyin-temple-frame.png`.
- `reference1-18.png`, `reference1-40.png`, `reference1-60.png`.
- `reference3-5.png`, `reference3-16.png`, `reference3-24.png`.

Screenshots remain local reference evidence. They are not repackaged as project
assets. Player overlays and the vertical montage limit detail inspection;
frame samples cannot prove animation quality or inspect the original renderer.
The temple page's chapter text also discusses rain, fog, smoke and water
reflections. Those statements are page-text evidence, not independently
verified implementation details of the source scene.

## What this implies for TransitLab

1. Keep the junction as the visual centre, with street-level foreground detail,
   buildings in the middle and a softened distant skyline. A large empty horizon
   and identical facades still undermine realism in the current prototype.
2. Tie rain, pavement and lighting together: rain should meet the surface,
   small impacts should disturb local reflection, and pavement should remain wet
   briefly when the weather clears. This causal consistency is more valuable
   than simply increasing global glare.
3. Make dusk consistent across sky, clouds, ambient light and illuminated
   windows. Daylight-bright clouds above a dark street break the illusion.
4. Increase actual asset variation before adding stronger post-processing.
   The grassland comparison makes the remaining vegetation/material gap visible.
   TransitLab still needs better tree silhouettes, storefront variation and
   vehicle surface detail; this pass does not close that gap.
5. Keep all scene changes previewed and confirmed. Presentation may retain wet
   pavement after the selected weather becomes clear, but this visual history
   must not alter the domain snapshot or the traffic rules.

## Implemented in this pass

- Rain streak lower endpoints stop at the asphalt plane instead of penetrating it.
- Wet-road perturbation uses small asynchronous radial impacts. The impacts
  are an artistic GPU effect, not a fluid solver or a collision simulation;
  they are not individually correlated with each airborne rain particle.
- World-space puddle variation is shared across perpendicular road arms. The
  secondary water film discards the shared intersection rectangle so the
  centre does not accumulate two transparent reflection layers.
- Wetness builds quickly and dries gradually, with bounded presentation time
  steps. Snow suppresses the retained wet appearance. Reload starts a fresh
  presentation history, and low quality keeps reflection disabled.
- Cloud brightness follows the already interpolated lighting preset.
- The soak setup accepts an already-active street camera; previously it waited
  for a button whose label had changed to the alternate camera name.

## Verification so far

- JavaScript suite: 56 passed, including the existing 30-minute simulated
  mixed-fleet safety test and two new wetness-history tests.
- Python suite: 308 passed in 20.057 seconds. Expected negative CLI test messages
  appeared; no real API evaluation was run.
- Actual local browser fingerprint: `993af5e7ccdf`.
- Real UI rain preview/confirm, clear preview/cancel, and clear preview/confirm
  passed. Wetness was 0.988 in rain and 0.757 after clear weather settled.
  The selected domain weather was already `clear` while the road was drying.
- `rain-surface-dusk.png` and `rain-surface-after-rain.png` were visually inspected.
  They show the actual Three.js output, not Blender stills or generated artwork.
- A single HUD reading is not a benchmark. Long-run foreground measurements
  and deployment status will be recorded separately after completion.

## Ten-minute browser run

The same browser remained on the local candidate while twenty 30-second
foreground samples were collected (small CLI gaps between segments). Every
segment rejected hidden/unfocused execution and changes to camera, vehicle
count, weather, canvas or quality. Evidence:
`output/playwright/rain-soak-20261005.log`, `rain-soak-24-end.png`.

- Hardware inventory: NVIDIA GeForce RTX 5080 **Laptop** GPU (Intel Graphics
  also present), Intel Core Ultra 9 275HX. This is not a desktop 5080 benchmark;
  the OS inventory alone does not prove which GPU Chrome selected.
- 24 vehicles, rain, dusk, street camera, immersive view, balanced quality.
  Viewport 1961×1433; actual drawing buffer 1920×1081; DPR approximately 1.
- Measured foreground duration 600.160 seconds; 36,293 animation frames.
- Aggregate 60.47 FPS. Segment averages 57.53–63.44 FPS; maximum segment
  p95 frame time 20.9 ms. This is not a locked-60 assertion.
- Zero frames over 250 ms in these segments. Initial page load and shader
  warmup happened before measurement, so they are not included.
- Renderer resource counters remained 249 geometries and 27 textures. These
  counters do not measure total JavaScript heap or prove the absence of all leaks.
- Final browser console: zero errors and zero warnings.

No GTA, DLSS, real-time ray tracing, model ranking or award-level claim follows
from these results. Low-end hardware and mobile performance remain unverified.

## Immersive-mode issue found during acceptance

The post-soak weather check exposed an existing UI defect: immersive mode hid
the control rail, including the only preview-confirmation buttons. Weather
could be previewed from the visible stage but could not be confirmed there.
The fix returns to the workstation when a preview becomes ready, scrolls its
review panel into view, and focuses Cancel. Entering immersive mode while a
plan is pending keeps the review controls visible. Both weather and undo use
the same path; confirmation still calls the unchanged validated server pipeline.

`tools/audit-immersive-preview.js` exercised preview without state changes,
attempted re-entry into immersive mode, cancellation, confirmation, and an undo
preview/confirmation restoring the initial weather. All assertions passed on
the final local fingerprint `7bb6e09fd7ee`. Snow/low-quality visual inspection
also passed (`rain-pass-snow-low.png`); all 16 snow surfaces were attached and
visible before switching quality. Final console: zero errors and warnings.

The 10-minute run above predates this UI-only fix and used fingerprint
`993af5e7ccdf`; no renderer, shader or simulation code changed afterward.
It must not be misreported as a second 10-minute run on the final fingerprint.

## Published verification

- Source commit: `8580b810fe5c46e8e8d6d9a739bf8d302f275537`, normal Git push succeeded.
- Existing Render free service, deployment `dep-db1biop42hec73etdc30`:
  confirmed `live`, finished 2026-10-04 20:40:14 UTC. No new service or paid API.
- Public `/health`: app `0.8.0`, command protocol `0.3`, SceneAction `0.3`,
  fingerprint `7bb6e09fd7ee`, git commit `8580b81`, started at
  `2026-10-04T20:40:11.477808+00:00`.
- The public headed browser displayed the same fingerprint. Immersive preview,
  cancellation, confirmation and undo regression passed again against public UI.
- Public rain/clear UI check passed: rain wetness 0.984, clear-after-rain 0.758;
  cancelling the clear preview preserved rain. Actual browser screenshots
  `public-rain-surface-dusk.png` and `public-rain-surface-after-rain.png`
  were visually inspected. Browser console: zero errors and warnings.
- Public acceptance ran at 1920x1080 viewport with 12 vehicles. Screenshot HUD
  samples were 48 and 51 FPS; these short samples are not the local 24-vehicle
  immersive benchmark above and must not be presented as a public locked-60 test.
- Render error-log retrieval failed with a connector transport error. Deployment
  status and HTTP/browser checks succeeded independently; server logs remain
  unverified rather than being declared clean.
- This publication record is documentation only and does not require another
  deployment. Near-field asset realism and lower-end performance remain open.
