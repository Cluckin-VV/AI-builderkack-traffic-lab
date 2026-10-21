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
