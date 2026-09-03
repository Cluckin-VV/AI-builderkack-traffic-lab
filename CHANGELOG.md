# Changelog

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
