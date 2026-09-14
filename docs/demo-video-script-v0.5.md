# TransitLab v0.5 demo video script

Status: **English-captioned video completed and publicly hosted on 2026-09-14**. Actual duration: **2:12**. The original storyboard below targeted 2:35; actual footage timing is recorded in the capture report.

## Completed artifact

- Final video: `output/playwright/transitlab-v05-demo-final.mp4` (H.264, 1600 × 1090, 25 fps, silent).
- Original continuous public-page capture: `output/playwright/transitlab-v05-raw.webm` (1600 × 1000, 25 fps).
- English captions: `docs/demo-video-en-v0.5.srt`.
- Reproducible browser interactions: `tools/record-demo-v05.js`.
- Encoder: `tools/encode-demo-v05.ps1` (run from repository root; requires local FFmpeg and Windows Arial).
- No time compression, synthetic footage, private desktop capture or paid-model calls. A 90-pixel caption band is added below the complete browser content.
- Full decode passed. One-frame-per-second contact sheets covering the entire export and full-size snow/Event Log frames were visually reviewed. This is sampled visual review, not a claim that every one of the 3,300 frames was individually inspected.
- Browser recording assertions passed: ten accepted commands, one rejected command, unchanged rejected snapshots, zero console/page errors during recording. Four demo-owned buses were removed through normal validated commands afterward, returning to zero buses, green and clear.
- [Public MP4](https://github.com/Cluckin-VV/AI-builderkack-traffic-lab/releases/download/v0.5.0-rc.1/transitlab-v05-demo-final.mp4): anonymous HTTP 200, exact size and SHA-256 verified. Final Kaggle submission is **not** completed by publishing this artifact.

See [capture evidence](demo-video-capture-v0.5.md).

## Story

The video should answer one question: how can natural language change a live 3D world without giving a probabilistic model direct write access?

| Time | Screen action | Narration point |
| --- | --- | --- |
| 00:00–00:15 | Open the public URL and orbit the crossroads | TransitLab is a browser-native, interactive 3D traffic world—not a rendered background. |
| 00:15–00:35 | Submit `增加一辆公交车` | A model adapter proposes one versioned SceneAction; schema and semantics decide whether it may execute. |
| 00:35–00:55 | Add buses until EW and NS approaches are visible | The browser-local controller owns positions and right-of-way but cannot write server state. |
| 00:55–01:15 | Submit `把信号灯改成红色` | Show the all-red clearance phase, then the complementary direction receiving green. Never show conflicting greens. |
| 01:15–01:35 | Submit `让公交车停下`, then `让公交车继续行驶` | Manual intent remains distinct from red-light waiting. |
| 01:35–01:55 | Submit `让天气下暴雪`, then `让天气起雾` | Weather is a validated scene action and changes visible rendering and simplified speed policy. |
| 01:55–02:15 | Submit `让天气下陨石` | The unknown request is rejected before execution; before/after state remains identical. |
| 02:15–02:30 | Open Event Log and `/health` | Show action type, validation stage, state snapshots, runtime fingerprint and release identity. |
| 02:30–02:35 | Closing frame | “Language proposes. Validators decide. The world responds.” |

## Truthful claims

- App v0.5.0; Command Protocol v0.3; SceneAction v0.2.
- 209 Python tests plus 8 JavaScript controller tests at release-candidate verification.
- Deterministic browser adapter; real LLM remains shadow-only.
- Straight-route traffic demonstration, not collision-grade physics or a digital twin.
- Clear/rain/snow/fog are supported; meteor and compound requests are rejected.

## Capture acceptance

- Use the public HTTPS URL only after `/health` reports v0.5.0.
- Capture a clean browser window with no private tabs, notifications or credentials.
- Keep the command and resulting status visible together.
- Confirm captions do not obscure the state inspector.
- Watch the final encoded video from start to finish and verify duration is under three minutes.
- Upload to a judge-accessible public or unlisted location; then replace `Demo video: Pending` in the Writeup.
