# v0.8 source publication status

2026-10-04. This is not proof of a public deployment.

## Confirmed update: source is now on GitHub

The GitHub Git-data API fallback uploaded the existing objects and verified every blob, tree and commit SHA before updating `main` with `force: false`. Source/evidence commits `0b78cfb`, `7b1674b`, `b3bda7a` and uploader commit `d9ba0df` were reproduced exactly, including parents and author/committer timestamps. The original CLI push failures below remain historical facts, not the current source-upload status.

`git fetch origin` then succeeded: both `main` and `origin/main` equalled `d9ba0df3d9c104eeb798f59a0a8615b4715b57f9`; the worktree was clean. This document update follows that verified source commit. No branch history was rewritten and no credential or persistent Git configuration was changed.

The bounded tool `tools/git_object_publish.py` is dry-run by default. It only publishes the named repository's linear fast-forward chain, aborts on SHA mismatch/remote drift/unsupported headers/deletions, and uses the existing `gh` authentication without printing tokens. Six offline safety tests passed. API behavior follows the official [commit](https://docs.github.com/en/rest/git/commits), [tree](https://docs.github.com/en/rest/git/trees), [blob](https://docs.github.com/en/rest/git/blobs) and [reference](https://docs.github.com/en/rest/git/refs#update-a-reference) endpoints.

**Deployment still not verified.** A Render integration was discovered and offered for installation; it is not confirmed installed or connected. Chrome transport still fails. Connecting the existing free Render account is the next external requirement; publishing source alone does not trigger this Blueprint.

- Source savepoint: `0b78cfb` — typed junction scenes, original vehicle assets, preview/confirm/undo, presentation and regression tools.
- Evidence savepoint: `7b1674b` — README, measured limitations and three real-browser images.
- Verified local tests: Python 308, JavaScript 42; supported commands 19/19, unsupported/ambiguous rejection 12/12. No paid model request was made in this round.
- Runtime source fingerprint: `507a7158df77`; a restarted process is required to report the new Git commit.
- Normal `git push origin main` failed with `Recv failure: Connection was reset`. Do not assume remote main contains these commits. No force push, credential change or history rewrite was used.
- Render Blueprint uses `autoDeployTrigger: off`. A successful push alone cannot update the public service. Browser automation currently fails at the Chrome transport, and no Render API/MCP authentication is available in this session.
- Public health must return the same source fingerprint after an explicitly verified deploy; until then, the public demo version is unverified.

Next safe sequence: trigger the existing free Render service through a working authorized connection → inspect deploy status/build logs and `/health` → browser smoke check. Do not create a duplicate or paid service as a workaround. Source upload and matching local/remote history are now verified as above.
