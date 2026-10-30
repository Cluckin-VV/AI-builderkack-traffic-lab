# TransitLab v0.8 — submission draft

Status: **DRAFT, NOT SUBMITTED**. Prepared 2026-10-30. Supersedes the v0.5 claims in `kaggle-writeup-draft-v0.1.md`; that historical file is not current submission copy. The authenticated submission channel, registration acceptance and final receipt remain unverified.

## Suggested form fields

**Title:** TransitLab: Preview-First 3D Traffic Scenarios

**Subtitle:** Describe a change, inspect its consequences, confirm it, and undo it in a live browser world.

**Proposed focus category:** AI 3D Scene Generation (confirm the category name against the actual submission form).

**Repository:** https://github.com/Cluckin-VV/AI-builderkack-traffic-lab

**Browser demo:** https://ai-builderkack-traffic-lab.onrender.com/

**65-second English-captioned demonstration:** https://github.com/Cluckin-VV/AI-builderkack-traffic-lab/releases/download/v0.8.0-demo.1/transitlab-v08-demo-en.mp4

## Short description

TransitLab is a bounded, browser-native traffic scenario editor. Chinese commands become explicit, validated scene plans: visitors preview changes, confirm them, observe automatic traffic and weather, and can preview and confirm an undo. The current public version uses deterministic rules, not live LLM inference. AI coding assistance and generated textures supported development; a real-model adapter exists only for shadow evaluation. The project explores the safe execution boundary for future AI scene editing without disguising its current language-understanding limits.

## What the reviewer can try

Open the demo and wait for the Three.js scene. Its default configuration is six sedans, four SUVs and two buses. Enter `增加两辆SUV，切换雨天` (add two SUVs and switch to rain), then select the yellow preview button.

The plan contains three actions: two vehicle additions and one weather change. The preview shows 14 vehicles and rain, while the committed-state inspector remains at 12 vehicles and clear weather. Confirm the plan to commit all actions together. The undo button opens another preview; confirm it to restore the previous configuration. Request `让天气下陨石` (make meteors fall) to see an unsupported request rejected without changing the scene.

The camera can orbit or follow vehicles. A fixed crossroads provides straight, left and right routes, automatic directional phases, yellow transitions and all-red clearance. Weather controls cover clear skies, rain, snow and fog. Original Blender sedan, SUV and bus assets include visible cabins and driver silhouettes. A bounded fixed-seed weather comparison illustrates different speed and spacing rules; it is not a calibrated traffic forecast.

## Technical approach

The public rule planner emits SceneAction v0.3 steps in a ScenePlan. Each action is checked for protocol structure and scene semantics. A detached state is used to preview the complete plan before confirmation. Rejected or cancelled plans do not commit partial state changes. The interface separates the projected view from the committed SceneState and exposes execution/rejection records. Stable vehicle IDs, shared road metadata and runtime fingerprints help diagnose mismatches between intent, simulation and deployment.

The backend uses Python's standard library; Three.js renders the interactive world. No paid model API is required to try the demo. Editable Blender files and reproducible asset-generation scripts are included. The application is intentionally a small scene editor, not an open-world city, certified driving simulator or unrestricted text-to-3D generator.

## Evidence and limitations

The video captures public app v0.8.0 at commit `b29bfb3`, source fingerprint `c5f00237fa53`. It shows the actual confirmation/undo loop at normal speed. Details and the file hash are in `docs/demo-video-capture-v0.8.md`.

The last application regression recorded 326 Python and 80 JavaScript passing tests, covering protocol/state behavior, traffic invariants and asset structure. These counts do not establish visual quality. A separate 10-minute measurement on an RTX 5080 Laptop GPU at a 1920x1080 viewport, balanced quality and 24 vehicles in clear weather averaged 37.22 FPS; the slowest 30-second segment was 32.78 FPS. Short weather checks are separately scoped in `docs/release-gate-audit-v0.1.md`. Neither the video FPS counter nor that single-device measurement is a universal performance guarantee.

The free hosted instance may cold-start. Visitors share process-local scene configuration, which resets on server restart. Models remain stylized; no GTA, DLSS, photorealism or award-equivalence claim is made. Unsupported language rejects rather than being interpreted by a live model. The limited runtime role of AI is a material limitation, not something hidden by the word "AI" in the project history.

## Provenance and chronology

Development used AI coding assistance. Some road/surface textures were AI-generated, not photographed. Original vehicle assets were built with Blender scripts; no ripped game vehicle assets are included. Three.js is MIT-licensed; see `THIRD_PARTY_NOTICES.md` and the asset-generation sources for attribution.

The project includes prototype work and textures created before the announced September 11 build period. Do not claim that every asset or line of code was made during the build period. Disclose the chronology and obtain organizer clarification about eligibility if needed; this draft is not an eligibility certification.

## Submission gate — do not paste as a success claim

- Official build-period news and terms still state November 11, 2026 as the deadline when checked on October 30. The terms specify 16:30 CEST (UTC+2); preserve that wording and ask for clarification if platform timing differs.
- The official news requests a public repository, hosted browser demo, video under three minutes, short description and focus category. Those materials are prepared, but preparation is not submission.
- The Kaggle overview yielded no readable submission controls in this check. Prior earlier-close observations do not prove the current authenticated form is closed, nor that a replacement channel exists.
- Before final submission, verify the organizer-designated route, registration acceptance, required consent and the receipt. Do not guess a destination or submit through an unrelated discussion post.

Sources: [official building-period announcement](https://www.victoriavr.com/news/ai-builder-hackathon-2026-the-building-period-2042daf3), [official terms](https://www.victoriavr.com/hackathon/2026/terms).
