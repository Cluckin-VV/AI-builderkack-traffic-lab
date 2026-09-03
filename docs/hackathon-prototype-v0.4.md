# TransitLab Hackathon Prototype v0.4

Status: implementation candidate, not a final submission
Verified against official pages: 2026-08-23

## Product thesis

Most prompt-to-3D demos optimize for spectacle but hide the transition from language to executable state. TransitLab treats that transition as the product:

> A user describes a traffic-world change; the system turns it into one versioned candidate action, visibly validates structure and scene semantics, then either performs exactly one mutation or explains a safe rejection.

This gives the project a stronger identity than “an LLM that adds objects.” It is a browser-native scene builder with an inspectable action firewall.

## Official requirement fit

Sources:

- [Official announcement](https://www.victoriavr.com/news/ai-builder-hackathon-2026-build-the-future-of-ai-native-3d-experiences-5915194b)
- [Official terms and conditions](https://www.victoriavr.com/hackathon/2026/terms)
- [Kaggle competition page](https://www.kaggle.com/competitions/ai-builder-hackathon-2026)

| Requirement | Prototype evidence | Status |
| --- | --- | --- |
| Runs in a browser | Standard-library HTTP host plus WebGL UI | Implemented locally |
| Plain language to 3D scenes and working logic | Prompt → SceneAction → validators → state → Three.js | Implemented for six action classes |
| Public code repository | `Cluckin-VV/AI-builderkack-traffic-lab` exists | Current local v0.4 changes not yet synchronized |
| Hosted browser demo | Render Blueprint, cloud port binding, and health check prepared | Deployment pending |
| Demo video under three minutes | No final recording | Missing |
| Short written description | Product thesis and README | Draft |
| Selected focus category | AI 3D Scene Generation | Proposed |
| Accessible throughout judging | No production host or uptime check | Missing |
| Third-party rights and attribution | Three.js pinned; procedural scene assets; notice file | Implemented for current dependency |

## What v0.4 adds

- genuine Three.js WebGL rendering instead of Canvas perspective drawing;
- an explorable district with procedural roads, buildings, trees, streetlights, traffic signal, and buses;
- camera orbit, zoom, keyboard control, reset, and visual pause;
- server-state hydration through read-only `GET /api/state`;
- visible Candidate → Schema → Semantic → Execution stages;
- human-readable rejection explanations and raw Event Log inspection;
- responsive desktop, tablet, and mobile layouts;
- explicit runtime build fingerprint;
- content-security and basic browser hardening headers;
- pinned Three.js dependency and third-party notice.

## Truthful capability boundary

The browser demo currently uses `FakeModelAdapter`. It is deterministic and supports a known Chinese command protocol. A real OpenAI adapter exists only in Shadow Mode:

```text
real model output
→ parse
→ schema validation
→ semantic validation
→ compare
→ no SceneState.apply
```

Therefore the current demo is an AI-ready, guardrailed interaction prototype—not yet proof that a real LLM reliably understands arbitrary user language.

The renderer performs visual animation only. It does not infer traffic behavior, parse language, or modify domain state. Buses moving along a loop are presentation, not traffic simulation.

## Safety invariant

The only browser mutation route is:

```text
POST /command
→ injected ModelAdapter
→ SceneAction Protocol v0.2
→ validate_scene_action_schema
→ validate_scene_action_semantics
→ SceneState.apply
```

Schema rejection skips semantic validation and execution. Semantic rejection skips execution. An accepted action calls `SceneState.apply` once.

## Manual demo sequence

1. Open the page and orbit the 3D district.
2. Choose “增加一辆公交车”; verify one procedural bus appears and the four pipeline stages turn successful.
3. Choose “把信号灯改成红色”; verify the WebGL signal changes and the SceneState inspector reports `红灯`.
4. Choose “让公交车停下”; verify visual bus motion stops.
5. Choose “让公交车继续行驶”; verify motion resumes.
6. Choose “让天气下暴雪”; verify Schema rejection, unchanged scene state, and a readable explanation.
7. Expand the raw Event Log and compare its runtime fingerprint with the header build identity.

## Three-minute video skeleton

- 0:00–0:20 — Problem: prompt-to-3D systems hide unsafe execution.
- 0:20–0:45 — Product thesis and visible validation firewall.
- 0:45–1:35 — Three accepted commands changing the WebGL world.
- 1:35–2:05 — Unsupported and impossible commands safely rejected.
- 2:05–2:30 — Event Log, Runtime Identity, and deterministic replay.
- 2:30–2:50 — Real LLM Shadow Mode and evaluation metrics.
- 2:50–3:00 — Vision: a safe AI-native operating layer for interactive worlds.

## Eligibility issue requiring organizer confirmation

The official terms list a build period from 2026-09-11 to 2026-11-11 and separately allow pre-existing tools and third-party materials under licensing conditions. They do not clearly state, in the sections reviewed, whether a participant's own pre-existing project may be submitted unchanged or how much work must occur during the build period.

Before treating this repository as the judged submission, ask the organizer in writing:

1. May a pre-existing personal prototype be used as the starting point?
2. Must all judged features be implemented after 2026-09-11?
3. How should pre-build commits and AI-assisted contributions be disclosed?

Until answered, v0.4 should be described as preparation, not a compliant final entry.

## Manual acceptance checklist

- [x] Page loads locally with a real WebGL canvas and no fallback message.
- [x] Isolated Chrome reports no console errors, page errors, or failed requests.
- [x] Camera drag, reset, and visual pause work; keyboard focus order is logical.
- [x] Add, light, stop, and move commands produce visible changes; remove remains covered by automated HTTP/domain tests.
- [x] Unsupported command is rejected without state mutation.
- [x] Pipeline stage colors match the Event Log stage.
- [x] `/health`, page build, and Event Log fingerprint agree.
- [x] Layout remains usable without horizontal overflow at 320, 390, 768, 1024, and 1440 pixels.
- [x] Hosted build can start without local files, databases, or secrets.
- [ ] Hosted URL has been created and verified from a clean browser profile.

## Remaining work before submission

1. Confirm pre-build eligibility and registration status.
2. Promote a real LLM only after a larger shadow evaluation proves safe behavior.
3. Add judge-prompt coverage beyond exact aliases.
4. Apply the prepared Render Blueprint, verify the public URL, and decide whether a CDN fallback is required.
5. Record the sub-three-minute demo from the deployed build.
6. Prepare the Kaggle writeup and final repository disclosure.
7. Freeze a tagged submission commit and verify all links from a clean browser profile.
