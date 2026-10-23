# Vehicle Observer v0.1

The live 3D scene now exposes a small, read-only vehicle observer in the Trace Inspector. It answers the reviewer's most immediate traffic question: why is that particular vehicle moving, slowing, or stopped?

## What it reads

The observer receives only the existing browser-local `traffic-frame` snapshot. Each displayed row derives its stable vehicle ID, type, route, instantaneous speed and controller reason from that snapshot. It has no API call, no state mutation, no command path and no effect on `SceneState`.

The module is served via the explicit `/assets/vehicle-observer.mjs` allowlist and participates in the runtime source fingerprint. A deployment cannot silently omit this dependency while presenting the same runtime identity.

## Display order

At most three rows are shown, prioritising controlled vehicles: red-light waiting, yellow-light braking, stop-line braking, car-following, manual stop, station dwell, then moving traffic. Equal priorities use stable vehicle IDs, so the panel does not visually reshuffle on every animation tick.

## Review value and safety boundary

This is an explanation surface, not a simulation control. The authoritative command path remains:

`natural language → Schema → Semantic → preview → confirm → apply → undo`.

The panel makes the controller's existing reasons legible without introducing a second, mutable traffic path.

## Preview-versus-live honesty

When a detached plan is being previewed, the observer now labels its projected vehicle frame `PREVIEW`, and the viewport HUD labels its projected count `预演车辆`. The Trace Inspector's `SceneState` section continues showing the committed server state. Cancelling or confirming restores the HUD/observer labels to `车辆总数` and `LIVE` respectively. This prevents a projected fleet from being mistaken for an executed change; the label itself does not write to the server or alter traffic behavior.

## Browser-loading regression and release gate

The first public Vehicle Observer deployment exposed a missing static route for `vehicle-paint.mjs`. `/health` and the observer module returned successfully, but the WebGL entry module could not load, leaving the scene in its fallback state. The HTTP host now serves that dependency explicitly. A regression test checks that every local module URL imported by `scene3d.js` returns JavaScript from the host, and the vehicle-paint source participates in the runtime fingerprint. Release verification must also open the public page in a real browser and confirm an active WebGL scene, populated observer, and no module-loading errors; a healthy `/health` response alone is insufficient.
