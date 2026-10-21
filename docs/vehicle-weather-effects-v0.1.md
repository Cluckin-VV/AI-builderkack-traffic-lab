# Vehicle weather effects v0.1

## Scope

This presentation-only increment adds restrained wheel spray behind moving vehicles in rain. It makes the browser scene respond locally to the existing rain transition without changing traffic semantics.

## Inputs and limits

- The renderer reads the existing blended `rainIntensity` from `WeatherView`.
- A vehicle must be moving above a small threshold before spray is visible.
- Spray intensity is bounded by rain weight, vehicle speed, and the selected presentation quality tier.
- `low`, `balanced`, and `high` draw at most 8, 14, and 20 points respectively.

The effect is attached to each original sedan, SUV, or bus render group. It follows the vehicle route and is removed with that render object.

## Safety boundary

Wheel spray has no command, protocol, SceneState, event-log, signal, route, or collision authority. It does not influence a vehicle's speed or routing, and it never makes a weather action appear committed before the existing preview-and-confirm flow commits it.

## Verification

- Node tests prove that spray requires both rainfall and motion, stays bounded for invalid input, and only reduces presentation density across quality tiers.
- Browser verification uses `切换雨天` through the normal preview-and-confirm flow, then verifies one WebGL canvas, committed rain state, no remaining preview marker, and a clean console.

The fixed **车流近景** observer is offset away from the foreground signal masts so that it frames the vehicle lanes rather than obscuring them. It remains camera-only.

This is an illustrative wet-road cue, not a fluid simulation or a claim of real-world tyre physics.
