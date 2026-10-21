# Traffic experiment observability v0.1

## Why this exists

TransitLab demonstrates a natural-language-controlled traffic scene, not a certified traffic model. A weather change should therefore expose an observable consequence instead of only changing rain, snow, fog or colour grading.

## Read-only live observation

The WebGL overlay now reads the same browser-local `TrafficController` frame used for vehicle movement and signal display. It reports:

- vehicles currently moving;
- vehicles that are effectively stopped by a controlled condition;
- instantaneous mean speed of moving vehicles;
- the active speed cap, following gap and red-light stopping buffer.

For example, confirmed rain shows a 22 km/h cap, 3.5 m target following gap and 2.4 m red-light buffer. These are configurable demonstration settings, not roadway standards.

## Preview and state boundary

During preview the overlay may visualise the projected controller frame, but the large preview badge remains visible and server-owned `SceneState.weather` remains unchanged. Cancelling returns the overlay to the real frame. Confirming the plan is the only route that changes weather, after the normal Schema and Semantic checks.

The values are intentionally instantaneous. The comparison's “average controlled stop” is a sample average of vehicles already stopped by the local controller, not a trip wait time. Neither display is presented as an average journey speed, a safety score, a traffic optimisation result or a real-world prediction.

## Fixed-seed weather comparison

The **Compare 60s** control starts four separate browser-local controllers from the same scene seed and signal plan, then reports 60 seconds of fixed-step observation for clear, rain, snow and fog. It neither advances the live controller nor sends an HTTP command. This makes the weather trade-off demonstrable without presenting a visual effect as a real-world forecast.

## Verification

- Controller tests assert the rain policy values, finite metrics, immutability and deterministic derivation from the same vehicle frame.
- Browser contract tests assert that the page renders the observation field and consumes controller-owned frame data.
- A local browser check exercised rain preview, cancel, confirm and console output without writing state before confirmation.
