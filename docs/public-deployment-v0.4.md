# TransitLab public deployment v0.4

Status: prepared, not deployed

## Deployment contract

TransitLab is deployed as one Python web service. It has no package installation step, database, Redis instance, Docker image, worker, cron job, or production API key.

```text
Render HTTPS endpoint
→ python -m ai_builder.server
→ 0.0.0.0:$PORT
→ GET /health
→ browser UI and guarded POST /command pipeline
```

The normal browser path remains deterministic. Real LLM evaluation is not enabled by the deployment configuration and cannot control the scene.

## Reproducible configuration

- Blueprint: `render.yaml`
- Runtime: Python `3.13.5`, pinned by `.python-version`
- Plan: free
- Build: compile the package and run the full unit suite
- Start: `python -m ai_builder.server`
- Health check: `GET /health`
- Automatic deployment: off

`server.resolve_bind_address` preserves `127.0.0.1:8000` for local use. When the platform supplies `PORT`, the service binds to `0.0.0.0:$PORT`.

## First deployment

1. Confirm `main` and `origin/main` point to the intended v0.4 release commit.
2. Open the Render Blueprint URL:
   `https://dashboard.render.com/blueprint/new?repo=https://github.com/Cluckin-VV/AI-builderkack-traffic-lab`
3. Connect the GitHub repository if Render requests authorization.
4. Confirm the Blueprint uses the free plan and does not set
   `maxShutdownDelaySeconds`, which Render does not support for free services.
5. Verify that the Blueprint creates exactly one free Python web service and no datastore.
6. Apply the Blueprint and wait for the deploy status to become `live`.
7. Record the assigned `https://*.onrender.com` URL in the README and Kaggle draft only after verification.

Do not add `OPENAI_API_KEY` to this service. A later real-model experiment must use a separate, explicitly reviewed deployment configuration.

## Post-deploy acceptance

Run these checks from a clean browser profile and a separate command shell:

1. `GET /health` returns HTTP 200 with App `0.4.0`, Command Protocol `0.3`, SceneAction `0.2`, a source fingerprint, start time, and Git commit.
2. `/` loads the WebGL scene without console or network errors.
3. `增加一辆公交车` is accepted and visibly adds one bus.
4. `把信号灯改成红色` is accepted and visibly changes the signal.
5. `让天气下暴雪` is rejected and leaves the state snapshot unchanged.
6. The Event Log fingerprint matches `/health`.
7. A cold start completes and the health check becomes green.

## Rollback

Trigger rollback if the health endpoint fails, the WebGL scene cannot load, accepted commands stop changing state, rejected commands mutate state, or new browser errors appear.

Preferred rollback:

1. In Render, redeploy the previous successful commit.
2. Verify `/health`, the root page, one accepted command, and one rejected command.
3. Keep automatic deployment off while investigating.

Repository rollback uses a normal `git revert` of the deployment commit followed by a regular push. Never force-push the judged branch.

## Known operational limits

- Free instances may cold-start after inactivity.
- SceneState and Event Log are process-local, shared by visitors to the same instance, and reset on restart.
- Three.js is loaded from the pinned jsDelivr URL, so the client still needs CDN access.
- There is no authentication or persistence; this is a public competition demo, not a multi-tenant service.
- Runtime logs and the health endpoint provide minimum observability; no external monitoring account is configured yet.
