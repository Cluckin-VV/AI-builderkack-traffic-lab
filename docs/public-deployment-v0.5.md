# TransitLab public deployment v0.5

Status: **release candidate; public verification pending**

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

- [ ] `/health` returns HTTP 200 and App `0.5.0`.
- [ ] Root page renders the styled WebGL crossroads; it is not opened as a local `file://` document.
- [ ] Browser console has no errors or warnings.
- [ ] `增加一辆公交车` adds exactly one bus through the execution stage.
- [ ] `把信号灯改成红色` changes the signal without cancelling a manual stop.
- [ ] Four buses demonstrate both EW and NS approaches without conflicting green phases.
- [ ] `让天气下暴雪` is accepted and visibly changes the scene.
- [ ] `让天气下陨石` is rejected and leaves the complete state snapshot unchanged.
- [ ] Event Log runtime fingerprint matches `/health`.
- [ ] Desktop and 390 px layouts remain usable.

## Local release-candidate evidence

Verified 2026-09-14 before commit and deployment:

- `/health`: App `0.5.0`, Command `0.3`, SceneAction `0.2`, fingerprint `4c6d083172e4`.
- Python unit suite: 209 tests, all passing.
- JavaScript controller suite: 8 tests, all passing.
- Evaluation: legal 19/19, invalid/ambiguous 12/12, unsafe state mutations 0, Event Log omissions 0.
- Real browser: 7 accepted commands and 2 safe rejections; authored bus asset ready; rejected canvas identical while visual animation was paused; mobile horizontal overflow false; page errors 0.

The local health check was started before the candidate commit, so its Git field still showed base `98661c5`; the source fingerprint already covered the candidate files. The candidate was subsequently committed as `7f4e6ce` and synchronized to GitHub with an exact tree and commit SHA. The public section above remains unchecked until Render deploys that commit.

## Rollback

If health, WebGL startup, safe rejection or action execution fails, redeploy the last verified v0.4 commit `fbd8c05`. Repository rollback must use a normal revert commit; never force-push the judged branch.

## Operational limits

- Free instances may cold-start after inactivity.
- One process exposes shared ephemeral state to all visitors.
- Three.js loads from a pinned jsDelivr module.
- The traffic controller is a deterministic demonstration, not calibrated transport physics.
- Weather is visual presentation plus a simplified speed policy.
