# Weather-responsive vehicle headlamps — 2026-10-16

Sedan and SUV headlamp meshes already existed, but the live renderer did not vary their emissive intensity. Their lenses now follow the blended weather and light-style values. Daylight stays subdued; rain, fog, snow and blue hour brighten the lenses gradually. This is an emissive material cue, not real headlight beams or a new shadow-casting light for every vehicle. Each moving vehicle owns its lamp materials; those copies are disposed when it is removed.

The scene root exposes `data-vehicle-headlamp-intensity`, read from the first active headlamp material, for browser verification. It is diagnostic state, not an input to the command protocol.

## Evidence

- `node --test` across five JS suites: 57 passed, including bounded lamp behavior.
- Python scene and protocol suite: 311 passed.
- Headed browser using `tools/audit-vehicle-lighting.js`: actual lens intensity was 0.19 during daylight settling, 1.16 during blue-hour settling, and 0.96 in rain. The test followed real UI weather preview and confirmation; no direct SceneState edit was used.
- A separate clean browser session recorded zero console errors and warnings. An earlier exploratory scene-editor request returned 422 while trying a three-type deletion; it was a separate editor action-budget issue, subsequently fixed by commit `f6e565d` and checked in a headed browser.
- The 24-vehicle rain and blue-hour view rendered with readable red signal heads and wet-road highlights. A transient HUD reading of 12–14 FPS in the headed audit browser is not a controlled performance benchmark; no speed improvement is claimed.

The lens cue is subtle at junction camera distance. Higher-fidelity vehicle silhouettes, real beam falloff, headlight reflection placement and low-end GPU performance remain open art and performance work.

## Bus parity follow-up — 2026-10-17

The bus's existing Blender headlight geometry lacked the `headlamp` component tag, so it stayed fixed while sedan/SUV lenses followed weather and dusk. The editable Blender script now tags both bus front lamps, and the `.blend`, `.glb`, and browser `.json` exports were regenerated. The JSON has one `Headlight LED|headlamp|` batch (376 triangles). No vehicle geometry or traffic semantics were intentionally changed.

In a fresh local browser, two preview/confirm operations reduced the demo fleet to one bus without bypassing the six-action plan limit. With only that bus present, the runtime lens material reported 0.19 during daylight settling and 1.20 at dusk. The street-camera image places the bus far away, so it does not establish close-up photorealism or visible road beams. Browser console: zero errors and warnings. JS 58/58 and Python 311/311 passed. This is local evidence only until GitHub and Render are synchronized.

## Public deployment verified — 2026-10-17

- Network diagnosis: direct HTTPS to github.com timed out; Windows already had an enabled loopback proxy. A read-only HTTPS probe and Git remote query succeeded through that existing proxy. Using a per-command proxy override, normal push and fetch succeeded without changing saved Git settings or rewriting history. Local and remote source HEAD both became `6f1bd134270e2d0b296fcd70e6e845b6e7e50b0e`.
- Existing free Render service, auto-deploy off: deployment `dep-db9ov5ks728c73cgejug` became live at `2026-10-17T15:10:27Z`. Public `/health` reports app `0.8.0`, command `0.3`, SceneAction `0.3`, source `0b0d1db5f47c`, commit `6f1bd13`, started `2026-10-17T15:10:22.316160+00:00`.
- A tab loaded during rollout initially retained old page/module fingerprint `de9efea21d2a` even after `/health` changed. That run was excluded. After reload, the app script URL and health both carried `0b0d1db5f47c`. Check both before accepting future browser evidence.
- Public real UI: immersive preview stayed reachable, preview/cancel preserved live weather, confirmation applied it, and undo restored it. Lamp material values: daylight 0.12, dusk 1.16, rain 0.96; 12 vehicles. Editor target 1 sedan + 1 SUV + 0 buses produced the six-action limit explanation, left 12 live vehicles and no confirmation button.
- Production-loader browser closeups checked all three vehicle assets and four wheel pivots per vehicle. These are isolated browser inspection views using the production loader, not screenshots of the live junction camera. Passenger glazing/interior and stationary caliper checks passed. Public closeup screenshots: `output/playwright/public-vehicle-cabin-{sedan,suv,bus}-browser.png`.
- Closeups confirm remaining quality gaps: thick SUV window framing and flat front styling; opaque-looking bus glazing and simplified panels. This deployment does not resolve vehicle photorealism. The inspection rig uses its own lighting; its lens brightness is not a measurement of live weather response.
- Post-reload browser console had zero errors/warnings. Render error-level logs contained no entries from 15:10:27Z to 15:14:13Z (short verification window). The initial cold-loading page returned 503 before the new deployment was live.

## Bus cabin-depth candidate — 2026-10-18

The public closeup exposed a concrete mismatch with the other two vehicle types: the bus had an opaque window band and no readable cabin. The Blender source now exports alpha glazing with a `glass` component plus a generic passenger floor, paired seats, rails, and a driver seat/console. It uses only original simple geometry and has no brand marks.

The browser loader already applies alpha glazing consistently at the chosen quality tier. An asset contract test verifies at least one glass batch with opacity between 0.2 and 0.6, separate seat geometry, and enough cabin triangles to remain visible. The production loader closeup now shows the interior through the window line. It is an early depth pass: seat forms, body panels, and glazing are still stylized rather than vehicle-scan quality.

Local verification: JS 59/59, Python 311/311. The candidate source fingerprint is `8f8dcfcacd64`; it has not yet been pushed or deployed.
