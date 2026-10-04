# v0.8 source publication status

2026-10-04. Source publication and the public deployment are now independently verified below.

## Confirmed update: source is now on GitHub

The GitHub Git-data API fallback uploaded the existing objects and verified every blob, tree and commit SHA before updating `main` with `force: false`. Source/evidence commits `0b78cfb`, `7b1674b`, `b3bda7a` and uploader commit `d9ba0df` were reproduced exactly, including parents and author/committer timestamps. The original CLI push failures below remain historical facts, not the current source-upload status.

`git fetch origin` then succeeded: both `main` and `origin/main` equalled `d9ba0df3d9c104eeb798f59a0a8615b4715b57f9`; the worktree was clean. This document update follows that verified source commit. No branch history was rewritten and no credential or persistent Git configuration was changed.

The bounded tool `tools/git_object_publish.py` is dry-run by default. It only publishes the named repository's linear fast-forward chain, aborts on SHA mismatch/remote drift/unsupported headers/deletions, and uses the existing `gh` authentication without printing tokens. Six offline safety tests passed. API behavior follows the official [commit](https://docs.github.com/en/rest/git/commits), [tree](https://docs.github.com/en/rest/git/trees), [blob](https://docs.github.com/en/rest/git/blobs) and [reference](https://docs.github.com/en/rest/git/refs#update-a-reference) endpoints.

## Confirmed update: existing free Render service is live

After the user confirmed `My Workspace`, the authenticated Render connector resolved the existing free service `srv-dacq9rgn74is738lg070`. Its repository and `main` branch matched this project; automatic deployment was off. The previously live commit was `5560a2c`, explaining the public/local version difference. No new service or paid plan was created.

One explicit deployment, `dep-db111aid0e5s73djkb90`, deployed commit `122996c298bca9491b618c23891562fa5dc0d970`. Render reported `live`, finished at `2026-10-04T08:40:21.575556Z`; build logs reported `Build successful`, `Ran 308 tests in 19.532s` and `OK`. The build command also runs compileall. The prior local JavaScript result remains 42 passed; this deployment did not change application source.

Public [health](https://ai-builderkack-traffic-lab.onrender.com/health) returned App `0.8.0`, Command Protocol `0.3`, SceneAction `0.3`, source fingerprint `507a7158df77`, Git commit `122996c`, started at `2026-10-04T08:40:14.674669+00:00`. The fingerprint matches the local source. A post-live error-log query returned no entries; some separate filtered log queries had connector transport errors, not application failures.

A separate headed browser loaded the public demo and showed all 12 default vehicles (6 sedan / 4 SUV / 2 bus), automatic traffic phases, and the matching runtime banner. Actual UI smoke checks exercised snow preview without committing, cancellation, snow confirmation, undo preview, and confirmation restoring clear weather. Undo intentionally requires confirmation. Console inspection returned zero errors and zero warnings. Local evidence is `output/playwright/public-v08-snow.png` and `output/playwright/public-v08-clear.png`; these are browser captures, not Blender stills. This is a smoke check, not a new 10-minute performance certification.

The three Douyin videos are still unseen because Chrome transport fails. The asset detail and lighting are not proven comparable to the requested reference videos or GTA/DLSS. This public deployment milestone does not complete the overall visual-quality goal.

## Historical publication boundaries (superseded where stated above)

- Source savepoint: `0b78cfb` — typed junction scenes, original vehicle assets, preview/confirm/undo, presentation and regression tools.
- Evidence savepoint: `7b1674b` — README, measured limitations and three real-browser images.
- Verified local tests: Python 308, JavaScript 42; supported commands 19/19, unsupported/ambiguous rejection 12/12. No paid model request was made in this round.
- Runtime source fingerprint: `507a7158df77`; a restarted process is required to report the new Git commit.
- Normal `git push origin main` failed with `Recv failure: Connection was reset`; the exact-object API fallback subsequently published the commits as verified above. No force push, credential change or history rewrite was used.
- Render Blueprint uses `autoDeployTrigger: off`. A successful push alone cannot update the public service. Chrome extension transport remains unavailable, but the newly connected Render integration performed the verified deployment above.
- Public health now returns the same source fingerprint; future application-source changes still require explicit deployment and re-verification.

Next work: recover authorized video access, analyze the actual reference footage, improve representative near-camera assets, and repeat focused browser/long-duration performance validation. Do not create duplicate or paid services as a workaround.
