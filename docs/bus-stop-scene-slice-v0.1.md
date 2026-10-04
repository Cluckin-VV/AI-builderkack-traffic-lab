# Bus-stop scene creation slice v0.1

Date: 2026-09-18. Local, uncommitted, not deployed. No paid API calls.

## Execution boundary

Command → DeterministicScenePlanner → ScenePlan actions → schema validation → semantic validation → clone apply/preview → explicit confirmation and revalidation → atomic live commit → Renderer → Event Log.

`scene.py::SceneState.scene_layout` is domain state. `set_scene_layout` accepts only crossroads/bus_stop. `scene_plan.py::execute_pending_plan` commits layout only after the complete plan succeeds. `scene.py::Renderer.render_data` reads the shared manifest. `scene3d.js::TransitWorld.setLayout` selects cached render groups without writing domain state. `traffic-controller.mjs::TrafficController` handles local presentation timing, docking and queues; it does not parse user commands or write server SceneState.

## Implemented

- Straight bidirectional road and two sheltered platforms, bay markings, benches, ticket machines, timetable signs, tactile paving and crossing.
- Shared stopping location, lateral bay entry, four-second dwell and departure.
- Manual stop freezes dwell. Crossing red stops both directions. Crossroads still has complementary EW/NS phases.
- Preview shows actual target layout and parameters. Restore preserves buses/weather/light/running state and resets visual route positions.
- Layout objects are cached once each; switching does not rebuild meshes repeatedly.
- Legacy default four-field snapshots retained; nondefault layout included in snapshots.

## Evidence

- Full Python suite: 271 tests, OK. New slice has 10 domain and 2 HTTP tests; no old tests removed.
- JavaScript controller suite: 15 tests passed, including 6 station tests, 12-bus queue separation and exact manifest docking position.
- Isolated Playwright browser at local port 8018: station+two buses+snow preview, confirmation, visible CENTRAL EXCHANGE layout and two buses; unsupported meteor command rejected with count 2/layout bus_stop retained; restore confirmed crossroads/count 2/weather snow.
- Screenshots: `../output/playwright/bus-stop-immersive.png` and `../output/playwright/bus-stop-snow.png`. Immersive image was visually inspected.
- Browser initially had zero console errors/warnings. Rejection produced one expected HTTP422 resource console message, not a JavaScript exception. No rendering exception observed.
- `git diff --check` passed (Git emitted ordinary LF/CRLF notices).

## Limits and next decision

Two authored templates, not arbitrary scene synthesis. No live LLM, passenger behavior, modelled snow accumulation, undo, mobile/performance certification or award guarantee. Real-model shadow evaluation remains unmeasured due exhausted API credit; user does not want recharge. No deployment, Git push or competition submission performed.

The largest remaining product gap is editable scene structure, not another synonym: next build a bounded template parameter editor with preview/rollback and an evaluator-ready creation demo. Award competitiveness still needs independent comparison and user evidence.
