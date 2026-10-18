# Passenger wheel detail v0.1

This presentation-only pass improves the original Blender sedan and SUV wheel
assemblies without touching traffic routes, SceneState, SceneAction, command
parsing, or the preview/confirm/undo flow.

## What changed

- Both passenger models retain their four named, independent wheel pivots.
- Each open-alloy wheel now contains five unbranded lug nuts and a fixed brake
  caliper behind the spinning wheel assembly.
- The tyre shoulder has 32 small, alternating all-season tread blocks per
  wheel. They are deliberately hard-edge, fine blocks: the earlier rounded
  experiment added roughly 18k SUV triangles and was rejected before release.
- Lug nuts are merged into the existing wheel batch. They rotate with the
  wheel and do not create an extra draw call per wheel.

The models remain original stylised realtime assets, not scans, licensed game
assets, or a claim of vehicle-physics simulation.

## Local verification

At runtime fingerprint `306536663c64`, the production Three.js loader checked
all sedan/SUV/bus models for four wheel pivots, spinning subassemblies,
transparent glazing, visible cabin geometry, and calipers that stay fixed
while their wheel spin changes. Browser console: 0 errors, 0 warnings.

| model | audit triangles | audit draw calls |
| --- | ---: | ---: |
| Sedan | 35,962 | 41 |
| SUV | 38,908 | 41 |
| Bus | 24,602 | 24 |

The asset JSON declares `open_alloy`, `five_lug_nuts`,
`alternating_tread_blocks`, and `fixed_caliper` as wheel-detail features.
`ai_builder.tests.test_visual_assets` verifies that passenger assets retain
these features; the full suite passed: Python 311/311 and Node 59/59.

The detailed camera is valuable for an evaluator inspecting the models. At the
normal traffic camera distance, the main readability cues are the moving wheel,
the wheel-arch clearance, brake lamp state, and correct signal-aware movement;
it does not imply road-contact tyre physics.

## Public release

Commit `cdd82d7` was pushed normally to `main` and deployed once to the
existing Render free service. Deploy `dep-dbabgum7bikc73e0lamg` became live at
2026-10-18T12:17:10Z. Public `/health` returned:

```json
{
  "app_version": "0.8.0",
  "command_protocol_version": "0.3",
  "scene_action_version": "0.3",
  "source_fingerprint": "306536663c64",
  "git_commit": "cdd82d7"
}
```

An isolated public-browser session confirmed that the page's fingerprinted
`app.js` URL matched that health fingerprint. The production loader generated
fresh public screenshots for all three vehicle classes, including the SUV
close-up. Its wheel/glazing/cabin assertions completed before screenshots were
written; console remained at 0 errors and 0 warnings. A later direct attempt
to return the full 5 MB SUV JSON through the browser CLI exceeded the CLI's
30-second command window, so that timeout is not treated as a payload proof.
