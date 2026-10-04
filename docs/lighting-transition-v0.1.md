# Coordinated lighting transition

Publication update (2026-10-05): the change below was published in commit
`6bc7e294c2f49bdbce73a9a10c7ff08b85207ea2`. A fresh public `/health`
response on 2026-10-05 confirmed `git_commit: 6bc7e29` and
`source_fingerprint: a924e44106f3`. The original local-only record below
is retained as historical evidence. Subsequent rain-surface refinements are
tracked in `douyin-reference-review-v0.1.md`.

2026-10-04, local browser verification. Not yet published.

Daylight/golden/blue-hour selection now smoothly blends solar elevation,
linear-space light colours and intensity, sky, ambient light, street lamps and
architectural emissive intensity. Retargeting starts from the current mixture.
This is a presentation change only, not a real astronomical clock or a change
to SceneState, traffic phases, command parsing or action protocols.

The reflection environment refresh waits for both weather and lighting to
settle; it is not regenerated on every animation frame. Signal lenses retain
their existing untone-mapped colours. Paused/background time does not fast-forward
the interpolation. Invalid time inputs cannot produce nonfinite weights.

Four new Node tests failed before implementation and then passed; complete
Node suite: 54 tests passed. Final Python regression suite after the dusk fog
correction: 308 passed in 20.034 s. Final browser console: 0 errors,
0 warnings.

Actual headed local browser at 1920×1080 viewport, 12 vehicles, clear/balanced:
golden switch observed blending then settled; `/api/state` remained identical.
Blue-hour switch after reloading the correct source fingerprint observed
blending then settled, screenshot inspected. Evidence:

- `output/playwright/lighting-daylight.png`
- `output/playwright/lighting-golden.png`
- `output/playwright/lighting-blue.png`

Combined rain, snow and fog at blue hour were confirmed through the actual UI
preview/confirmation flow. Fog colour now follows the continuous dusk weight
(daylight brightness 1, blue-hour brightness .35); previously it retained the
daytime palette and washed out the scene. This is an artistic parameter, not
physically simulated volumetric scattering. Inspected 1920×1080 evidence:

- `output/playwright/lighting-rain-blue-refined.png`
- `output/playwright/lighting-snow-blue-refined.png`
- `output/playwright/lighting-fog-blue-refined.png`

Final local fingerprint: `a924e44106f3`. The initial test service retained its
startup fingerprint and cached the old module; it was explicitly stopped and
restarted before the final browser verification. Do not mistake the pre-restart
blue-hour screenshot or old settled marker for verification of the final code.

Outstanding: public publication/deployment, long-duration performance and
improving actual asset realism. This
change removes abrupt preset transitions; it does not establish GTA/DLSS parity
or substitute for analysis of the still-unread Douyin videos.
