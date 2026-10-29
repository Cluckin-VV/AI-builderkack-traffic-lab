# TransitLab release-gate audit v0.1

Date: 2026-10-27 (Asia/Shanghai). Local `main` and the public Render service
reported commit `ca71637` and source fingerprint `acdb2c35f77e` when this audit
began. This is acceptance evidence, not a claim of game-engine photorealism,
traffic-engineering certification, or competition eligibility.

## Same-camera weather check

In a headed Chromium browser at a 1920×1080 viewport, the original default
bird's-eye camera, natural daylight and balanced quality were kept unchanged.
The default scene had 12 vehicles. Each weather state was generated through the
visible UI as a detached ScenePlan preview, held long enough for the visual
transition to settle, then cancelled before testing the next weather. No weather
preview was submitted. Local screenshot evidence (ignored, not bundled with the
repository) is stored in `output/playwright/weather-audit-{clear,rain-preview,
snow-preview,fog-preview}.png`.

| State | Observed in the browser | Visual limitation |
| --- | --- | --- |
| Clear | Bright roads and building shadows; lane and zebra markings legible. | Street geometry and vehicles still look stylized. |
| Rain | Falling rain, cooler dimmer atmosphere, darker road and some wet sheen. | Wet-road reflection is subtle from the high camera; this does not resemble a ray-traced game capture. |
| Snow | Falling flakes and white accumulation on roofs and non-road ground. | Snow detail is modest and road remains visibly dark. |
| Fog | Distant roads, roofs and buildings fade while nearer junction remains readable. | Strong pale veil reduces contrast substantially. |

The browser reported one WebGL canvas and zero console warnings/errors during
the sampled states. During preview the SceneState inspector continued to show
`weather=clear`, `vehicle_count=12`; the local `/api/state` agreed and had no
last event. The preview overlay explicitly identified the view as uncommitted.
This verifies the sampled visual differences and the non-mutating preview path,
not every camera angle, lighting preset, or device.

## Foreground 24-vehicle performance

The current build was opened in a headed Chromium window on a laptop whose
WebGL debug renderer identified `NVIDIA GeForce RTX 5080 Laptop GPU` via
ANGLE/Direct3D 11. At a 1920×1080 browser viewport, the WebGL drawing buffer
was 1900×1090. With 12 sedans, 8 SUVs and 4 buses, default bird's-eye camera,
clear weather and balanced quality, the existing foreground RAF measurement
(`tools/audit-render-soak.js`) completed twenty 30-second segments. Every
segment checked visibility/focus and a stable canvas, vehicle count, weather,
camera, quality and immersive setting.

Across 600,298.3 measured milliseconds and 22,341 frames, the aggregate was
**37.22 FPS**. The slowest 30-second segment averaged **32.78 FPS**; the
largest per-segment p95 was **33.4 ms**; there were **zero frames over 250 ms**.
The scene reported 318 geometries and 29 textures throughout. These are
current-machine, current-setting observations, not all-device guarantees,
low-end-device evidence, or a precise benchmark between commits. The 30-minute
accelerated controller unit test is separate from this ten-minute wall-clock
browser run.

Rain at the same 24-vehicle settings had one 30-second segment: 1,138 frames
in 30,011.8 ms (**37.92 FPS**), p95 **50 ms**, zero frames over 250 ms. This is
only a short weather spot check; the geometry count changed 324→328 during it,
so it is **not** evidence of stable rain resources over ten minutes.

At the same balanced-quality drawing-buffer size, snow yielded 1,047 frames in
30,001.0 ms (**34.90 FPS**), p95 **37.5 ms**; fog yielded 943 frames in
30,014.1 ms (**31.42 FPS**), p95 **58.4 ms**. Neither had a frame over 250 ms;
geometries/textures stayed at 330/29 within those short segments. Fog's p95 is
visibly weaker frame pacing despite its above-30 aggregate. In **low** quality,
fog yielded 1,168 frames in 30,011.6 ms (**38.92 FPS**), p95 **33.3 ms**, with
no >250 ms frame. Low quality reduced the WebGL buffer to 1267×727 and disabled
some effects, so this is an intentional quality/performance trade-off, not a
same-resolution optimization claim.

## Open release gates

- Longer wet-weather performance and lower-end-device measurements; one short
  rain segment and one high-end-laptop clear soak do not establish them.
- The reviewer-style public workflow was exercised on the existing v0.8 service:
  `增加两辆SUV，切换雨天` projected 14 vehicles and rain while the committed
  scene stayed at 12/clear; explicit confirmation produced 14/rain; undo
  preview projected 12/clear without mutation, and its confirmation restored
  the shared scene to 12/clear. The previous visible placeholder used
  `添加两辆 SUV，切换雨天`, which the rule parser rejected as unsupported. The
  source placeholder and a parser/preview regression test were corrected.
  A fresh local browser then exposed a related display mismatch: the projected
  rain scene's corner HUD said "晴" while the live-state inspector correctly
  said `clear`. The corner HUD now follows projected weather during preview,
  and returns to committed weather on cancel/confirm. The local browser checked
  preview HUD 雨 / 14, live inspector clear / 12, then cancel HUD 晴 / 12,
  with one WebGL canvas and no console warnings/errors. These checks were
  local at this audit point; compare public `/health` and repeat the browser
  check after deployment before claiming the public fix is live.
- Competition submission access and all required materials must be verified
  separately; a working demo URL is not a Kaggle submission. The existing
  2:12 English-captioned video is for v0.5 and cannot stand in for a current
  mixed-fleet v0.8 walkthrough. The [organizer terms](https://www.victoriavr.com/hackathon/2026/terms)
  list 11 November 2026 at 16:30 CEST for submission, whereas the Kaggle
  competition has displayed a September close date. The authenticated entry
  route is not verified by this audit.
- The near-car silhouette and wet-road appearance are still visual-quality
  weaknesses. Any further art pass must be judged in real WebGL, not a Blender
  still, and must not invalidate traffic/command safety.
