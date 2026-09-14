# TransitLab v0.5 demo video script

Status: **recording script; no finished video is claimed**. Target duration: 2:35.

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
