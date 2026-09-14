# TransitLab v0.5 — public browser demo

This prerelease packages the real public-browser demonstration of the existing deployed v0.5 candidate. It is **not a final Kaggle submission**.

- [Run the live demo](https://ai-builderkack-traffic-lab.onrender.com)
- Deployed source commit: `038a9ef74758652e351ac0e1bd53944e0f2bfc91`
- Runtime fingerprint: `4c6d083172e4`
- App `0.5.0`; Command Protocol `0.3`; SceneAction Protocol `0.2`

## Video attachment

`transitlab-v05-demo-final.mp4` is a 2:12 continuous capture from the public demo: bus additions, four-way crossroads, signal clearance, manual stop/resume, rain/snow/fog/clear, and safe rejection of an unsupported meteor request. English captions are included; there is no audio. The full page is retained with a separate caption band, without time compression or synthetic footage.

- H.264 / MP4, 1600 × 1090, 25 fps
- Size: 15,637,234 bytes
- SHA-256: `2669281bcf1ffa45d28120a8836576daba3d67a0ce8be68951eca70b4c9551ec`

The SRT and capture report are included as separate attachments for accessibility and auditability.

## Evidence and limits

- Release verification: 209 Python tests and 8 JavaScript controller tests passed.
- Deterministic evaluation: 19/19 valid accepted, 12/12 invalid rejected, zero unsafe state mutations and incomplete Event Logs.
- Public HTTP, isolated-browser and 390 px layout checks passed.
- Recorded UI sequence: 10 accepted commands; 1 safe schema rejection; no console/page errors during recording.
- Browser execution uses the deterministic FakeModelAdapter. The real LLM remains **shadow-only** and cannot modify scene state.
- The traffic controller is a simplified four-straight-route demonstration, not calibrated traffic physics. Snow has one presentation mode, not an intensity parameter.
- The free Render instance may cold-start; all visitors share ephemeral server state, which resets on restart.

No existing release/tag is replaced. This prerelease does not make any claim of final competition eligibility, organizer confirmation, or prize outcome.
