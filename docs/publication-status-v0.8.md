# v0.8 source publication status

2026-10-04. This is not proof of a public deployment.

- Source savepoint: `0b78cfb` — typed junction scenes, original vehicle assets, preview/confirm/undo, presentation and regression tools.
- Evidence savepoint: `7b1674b` — README, measured limitations and three real-browser images.
- Verified local tests: Python 308, JavaScript 42; supported commands 19/19, unsupported/ambiguous rejection 12/12. No paid model request was made in this round.
- Runtime source fingerprint: `507a7158df77`; a restarted process is required to report the new Git commit.
- Normal `git push origin main` failed with `Recv failure: Connection was reset`. Do not assume remote main contains these commits. No force push, credential change or history rewrite was used.
- Render Blueprint uses `autoDeployTrigger: off`. A successful push alone cannot update the public service. Browser automation currently fails at the Chrome transport, and no Render API/MCP authentication is available in this session.
- Public health must return the same source fingerprint after an explicitly verified deploy; until then, the public demo version is unverified.

Next safe sequence: normal push → verify `main == origin/main` → manually trigger the existing free Render service through a working authorized connection → inspect deploy status/build logs and `/health` → browser smoke check. Do not create a duplicate or paid service as a workaround.
