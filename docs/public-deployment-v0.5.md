# TransitLab public deployment v0.5

Status: **deployed; public HTTP and isolated Chromium browser acceptance passed on 2026-09-14**

## Verified public deployment

The running service reports App `0.5.0`, Command Protocol `0.3`, SceneAction `0.2`, commit `038a9ef`, fingerprint `4c6d083172e4`, started at `2026-09-14T11:52:54.960267+08:00`.

Public HTTP verification completed 12 commands: ten accepted at execution (add, stop, move, red, green, snow, rain, fog, clear, remove) and two rejected at schema (meteor and combined add/light). Both rejected events preserved complete state snapshots and included rejection reasons. All twelve Event Log fingerprints matched `/health`.

Ten deployed assets returned HTTP 200 and matched local SHA-256 hashes: CSS, app, scene renderer, urban world, traffic controller, weather view, Reflector, bus JSON and both textures. The root page returned HTTP 200 with resolved App v0.5.0 identity. The test ended with the same scene configuration it began with: zero buses, running enabled, green signal and clear weather.

The original browser-control bridge failed with `nodeRepl.fetch request failed`. An independent Playwright CLI browser subsequently verified the public URL: seven accepted commands, two schema rejections, authored bus asset ready, identical complete state snapshots and paused-canvas pixels for both rejections, and no horizontal overflow at 390 × 844. Desktop and full-page mobile screenshots were visually inspected. A separate warm-page reload and interaction check reported zero console warnings/errors and zero page errors.

The first cold visit showed a Render loading page with HTTP 503 (plus favicon/HEAD errors). These are not silently excluded from the record: the zero-error result applies to the warmed application, not to every request since the first visit. A later idle restart reset process-local state; recording preparation reloaded the page and checked current state before creating demo vehicles.

An additional public UI rehearsal accepted three individual bus additions (1 → 2 → 3 → 4), signal red, manual stop, resume, rain, snow, fog and clear. EW red / NS green was observed after clearance, and manual stop displayed four manually stopped vehicles. The meteor request was rejected at schema with identical state snapshots. No console/page errors occurred during that rehearsal.

Public URL: https://ai-builderkack-traffic-lab.onrender.com

Release candidate commit: `7f4e6ce3fbb6565fc9aeec492fc21cc411336dc8` (local and GitHub `main` verified equal on 2026-09-14)

## Release contract

The v0.5 deployment must expose exactly one free Python web service and no database, Redis service, worker, Docker image or production model key.

```text
Render HTTPS
→ python -m ai_builder.server
→ 0.0.0.0:$PORT
→ /health
→ guarded /command pipeline
→ browser-local crossroads controller
→ Three.js renderer
```

The deterministic browser adapter is the executable path. Real LLM evaluation remains shadow-only and cannot call `SceneState.apply`.

## Required identity

After deployment, `GET /health` must report:

- `app_version`: `0.5.0`
- `command_protocol_version`: `0.3`
- `scene_action_version`: `0.2`
- the release commit short SHA
- a non-empty 12-character source fingerprint
- a current `started_at`

The final values are recorded only after a successful public check. A stale v0.4 response means the deployment is not complete.

## Public acceptance checklist

- [x] `/health` returns HTTP 200 and App `0.5.0`.
- [x] Root page renders the styled WebGL crossroads; it is not opened as a local `file://` document.
- [x] Warm application console has no errors or warnings in the checked flows; cold-start exceptions are recorded above.
- [x] `增加一辆公交车` adds exactly one bus through the execution stage.
- [x] `把信号灯改成红色` changes the signal without cancelling a manual stop.
- [x] Four buses demonstrate EW and NS approaches; observed phases are complementary. Exhaustive conflict prevention is covered by controller tests, not inferred from a short video.
- [x] `让天气下暴雪` is accepted and visibly changes the scene.
- [x] `让天气下陨石` is rejected and leaves the complete state snapshot unchanged.
- [x] Event Log runtime fingerprint matches `/health`.
- [x] Desktop and 390 px layouts remain usable.

## Local release-candidate evidence

Verified 2026-09-14 before commit and deployment:

- `/health`: App `0.5.0`, Command `0.3`, SceneAction `0.2`, fingerprint `4c6d083172e4`.
- Python unit suite: 209 tests, all passing.
- JavaScript controller suite: 8 tests, all passing.
- Evaluation: legal 19/19, invalid/ambiguous 12/12, unsafe state mutations 0, Event Log omissions 0.
- Real browser: 7 accepted commands and 2 safe rejections; authored bus asset ready; rejected canvas identical while visual animation was paused; mobile horizontal overflow false; page errors 0.

The local health check was started before the candidate commit, so its Git field still showed base `98661c5`; the source fingerprint already covered the candidate files. The candidate was subsequently committed as `7f4e6ce` and synchronized to GitHub with an exact tree and commit SHA. Render deployed the later documentation commit `038a9ef` with the same business source fingerprint.

## Rollback

If health, WebGL startup, safe rejection or action execution fails, redeploy the last verified v0.4 commit `fbd8c05`. Repository rollback must use a normal revert commit; never force-push the judged branch.

## Operational limits

- Free instances may cold-start after inactivity.
- One process exposes shared ephemeral state to all visitors.
- Three.js loads from a pinned jsDelivr module.
- The traffic controller is a deterministic demonstration, not calibrated transport physics.
- Weather is visual presentation plus a simplified speed policy.
