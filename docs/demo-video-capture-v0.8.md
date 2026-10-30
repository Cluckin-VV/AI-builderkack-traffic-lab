# TransitLab v0.8 — public-browser demonstration

Recorded 2026-10-29 UTC; encoded and reviewed 2026-10-30 Asia/Shanghai.

## Build and artifact

- Demo: https://ai-builderkack-traffic-lab.onrender.com/
- Captured commit: `b29bfb374e19b91349d0d4f92f1f5bfea7cc72de`
- Runtime source fingerprint: `c5f00237fa53`
- App 0.8.0; Command Protocol 0.3; SceneAction 0.3.
- `transitlab-v08-demo-en.mp4`: 65.000 seconds, H.264, 1600x990, 25 fps, no audio, English captions; 12,916,406 bytes.
- SHA256: `176f5538942518613abe7226a80d9cda8d9021727dbf99299ec203a6b5f86daf`
- Published as [v0.8.0-demo.1](https://github.com/Cluckin-VV/AI-builderkack-traffic-lab/releases/tag/v0.8.0-demo.1), a separate prerelease targeting the captured commit. GitHub reported both MP4 and SRT uploaded, `isDraft=false`, and an MP4 SHA256 matching the local artifact. An independent unauthenticated download-header check hit a connection reset; end-to-end anonymous download remains unverified in this pass.

This is an actual public-browser recording, not a Blender animation or generated mockup. It uses deterministic rule parsing. Real LLM execution is **not** enabled; the model adapter remains shadow-only. Vehicles and buildings are stylized original assets, not game-quality photorealism.

## What the video shows

1. Enter `增加两辆SUV，切换雨天` (add two SUVs and switch to rain).
2. Three atomic actions are previewed: two individual vehicle additions and one weather change. The viewport shows the projected 14/rain scene while the committed-state inspector stays 12/clear.
3. Confirm the plan; committed state becomes 14/rain.
4. Observe the vehicle-follow view and automatic traffic.
5. Preview undo, then confirm it; committed state returns to 12/clear.
6. Request unsupported meteor weather; the candidate is rejected and state stays unchanged.

After recording, a separate public `/api/state` read confirmed 12 vehicles, clear weather, undo unavailable, and the final rejected event at candidate stage. This restores the scene configuration, not the event-log history or continuous vehicle animation positions.

## Capture and verification

- Script: `tools/record-demo-v08.js`; captions: `docs/demo-video-en-v0.8.srt`; encoder: `tools/encode-demo-v08.ps1`.
- Source capture: ignored local file `output/playwright/transitlab-v08-take4-raw.webm`, duration 298.28 seconds. The encoder preserves the continuous interval 20–85 seconds at normal speed; only idle lead-in/tail is removed. No action is reordered or accelerated.
- Full output video decoded with FFmpeg without errors. Six output frames at 14, 24, 36, 46, 54 and 62 seconds were visually inspected for correct stage, readable captions and no caption overlap with the app.
- Initial takes were not accepted: a missing recorder FFmpeg component; a transient public connection failure before mutations; and an incorrect recorder expectation of two rather than three atomic actions. The failed preview was cancelled.
- The successful interaction take reached the final console check after all state assertions. Chromium logged the intentional HTTP 422 rejection as a resource error, so that script invocation exited with an error rather than a clean pass. Video frames and the independent state read verify the interaction and restoration. The script now reports expected HTTP 422 separately, only for `/plan/preview` after verifying rejection and unchanged state. That final reporting refinement was syntax-checked, not re-recorded.
- No application code, protocol, model assets, paid API, or Render configuration changed for this artifact. No application redeployment is necessary.

## Remaining limitations

This short demonstration is not a four-weather benchmark, exhaustive traffic safety proof, photorealism claim, award prediction or competition submission receipt. The existing release-gate audit records separate performance/weather evidence. Current submission-channel access still needs authoritative confirmation; publishing a GitHub video does not submit to Kaggle or the organizer.
