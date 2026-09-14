# Changelog

## [0.5.0] - 2026-09-14

### Added

- Four-way browser-native crossroads with deterministic EW/NS right-of-way, stop lines, following distance and an all-red clearance phase.
- Clear, rain, snow and fog actions and presentation modes.
- Original editable Blender bus, browser mesh export, AI-generated material textures, detailed streetscape and wet-road reflections.
- Standalone JavaScript traffic-controller tests and expanded command evaluation coverage.

### Changed

- Scene renderer now consumes read-only traffic-controller snapshots instead of owning traffic decisions.
- Runtime fingerprint now covers the visual modules and authored assets used by the browser.
- Documentation and submission draft now distinguish the deterministic browser path from real-LLM shadow evaluation.

### Safety

- Weather changes still enter through a single SceneAction and the existing schema → semantic → execution boundary.
- Combined, unknown and impossible requests remain rejected without state mutation.
- The browser-local controller cannot call `SceneState.apply` or the command endpoint.

### Known limitations

- Traffic routes are straight-only and are not calibrated transport physics.
- Weather is a presentation and speed-policy demonstration, not meteorological simulation.
- Real LLM output remains shadow-only and has no browser execution authority.

## [0.4.0] - 2026-09-03

### Added

- Browser-native Three.js/WebGL traffic district with orbit, zoom, scene inspection, and visible pipeline stages.
- SceneAction Protocol v0.2 schema and semantic validation with strict execution ordering.
- Read-only real-LLM Shadow Mode, diagnostics, and a reproducible 20-case evaluation set.
- Runtime identity, security headers, static-asset fingerprinting, and a dedicated health endpoint.
- Render Blueprint and environment-aware server binding for a reproducible public demo.

### Security

- Rejected actions cannot reach `SceneState.apply`.
- Real-model candidates have no execution authority.
- Public deployment configuration contains no API key or datastore.

### Known limitations

- The normal browser path is deterministic and supports a bounded Chinese command protocol.
- Scene state is shared in memory and resets when the server restarts.
- The hosted URL and final demo video remain pending.
