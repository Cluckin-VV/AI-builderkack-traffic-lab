# SUV upper-body silhouette — 2026-10-16

The initial SUV shared the sedan's short passenger roof and had a floating rear window when the roof was extended alone. This revision adds cabin-length body sections at a consistent height, extends the rear roof moderately, and lowers the passenger floor to meet that section. Sedan and bus geometry are unchanged.

## Browser evidence

- Blender 4.5.9 generated the editable `.blend`, `.glb`, and runtime `.json` from `tools/art/build_city_vehicles.py`.
- The actual Three.js production loader showed four independent wheel assemblies, glazing and seat components for the SUV. In the front three-quarter screenshot, the side window no longer visibly floats above the rear wing or gets covered by an upper body shell.
- A 24-vehicle rainy street scene loaded in a headed browser at a 1921×1078 drawing buffer. This is a scene check, not a frame-rate benchmark.
- Python suite: 311 tests passed. Local source fingerprint: `de9efea21d2a`.
- Existing Render free service deployed commit `5f85af19a2172fb6360099b1b9875f81eb42e758` as deploy `dep-db8mrn6i0phs73890750` (live 2026-10-16 00:21:51 UTC). Public `/health` returned source fingerprint `de9efea21d2a`, git `5f85af1`, and start `2026-10-16T08:21:49.148418+08:00`.
- Public headed browser repeated the actual production-loader checks, including SUV near view; weather preview, cancel, confirm and undo all passed. Console: zero errors and warnings in this session. The public near-view image is `output/playwright/public-vehicle-cabin-suv-browser.png` (local evidence file).

The car remains stylized: angular glazing, thick lower window seals and simplified lamps keep it below photoreal game-asset quality. Earlier attempts to lift the shoulder or cut a cabin void produced visible artifacts and were discarded. The next art step is a purpose-built continuous upper-body mesh with door pillars and cabin lining, reviewed from multiple camera angles.
