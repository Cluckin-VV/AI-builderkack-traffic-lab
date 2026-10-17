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
