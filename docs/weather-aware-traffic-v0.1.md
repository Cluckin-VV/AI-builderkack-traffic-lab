# Weather-aware traffic v0.1

## Purpose

Weather already selected an existing visual atmosphere and target travel speed. This increment makes the browser-local traffic controller explain and apply a consistent cautious-driving margin in rain, snow and fog.

## Demonstration policy

| Weather | Speed cap | Following gap | Red-light stopping buffer |
| --- | ---: | ---: | ---: |
| Clear | 8.5 m/s | 2.5 m | 1.8 m |
| Rain | 6.2 m/s | 3.5 m | 2.4 m |
| Snow | 4.2 m/s | 4.5 m | 3.2 m |
| Fog | 5.2 m/s | 3.1 m | 2.2 m |

These are deliberately labelled as configurable **demonstration parameters**, not road-design standards or a traffic-engineering certification.

## Boundary

The policy is derived inside the browser traffic controller from the shared junction configuration. It changes neither SceneAction v0.3, server-owned SceneState, parser, Schema/Semantic pipeline, preview/confirm, Event Log nor undo. The UI reports the active weather strategy alongside the existing per-movement signal explanation.

## Verification

- Pure policy tests cover weather fallbacks and monotonic rain/snow/fog caution.
- A same-lane rain scenario proves the rendered controller preserves the larger rain headway.
- Existing long soak and signal-conflict tests continue to cover movement safety.
