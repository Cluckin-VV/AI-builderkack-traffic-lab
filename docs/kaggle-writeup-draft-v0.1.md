# Kaggle Writeup Draft v0.1 — TransitLab

> Internal status: **FINAL SUBMISSION CANDIDATE — online form verification pending.**
>
> The public repository, v0.5 browser demo and 2:12 English-captioned MP4 are live and independently verified through 2026-09-16. This local draft is not proof that the online Writeup has been saved or submitted.

## Kaggle fields

**Project title**

TransitLab: A Guardrailed AI World Builder for Live 3D Traffic Scenes

**Subtitle**

Natural-language commands become versioned, validated actions before a browser-native Three.js world is allowed to change.

**Track**

AI 3D Scene Generation

**Short description**

TransitLab is a browser-native 3D traffic world builder that makes AI execution inspectable. A user describes a scene change, a model adapter proposes a versioned `SceneAction`, and strict schema and semantic validators either execute exactly one state mutation or reject the request without changing the world. The Three.js scene, action trace, state inspector, and event log make every accepted or rejected decision visible.

## Writeup body

### Why another prompt-to-3D tool?

Most prompt-to-3D demos focus on the moment an object appears. The risky and technically interesting step happens immediately before that: how does unconstrained language become an operation that is allowed to change a live world?

TransitLab treats that boundary as the product.

The user can ask for changes such as adding or removing a bus, changing the traffic signal, stopping or resuming buses, and switching between clear, rain, snow and fog. The system never lets a parser or model write directly to scene state. Every candidate must pass a visible action firewall first.

```text
User command
→ ModelAdapter candidate
→ SceneAction Protocol v0.2
→ Schema validation
→ Semantic validation
→ SceneState.apply
→ Three.js renderer
→ Explainable Event Log
```

This produces a small but complete AI-native world-building loop: language proposes intent, a protocol constrains it, validators protect the world, and the renderer turns approved state into an interactive 3D experience.

### The live browser experience

TransitLab renders a procedural four-way traffic district directly in the browser with Three.js/WebGL. The scene includes two crossing roads, lane markings, crossings, four signal groups, buses, buildings, trees, streetlights, shadows, weather and an orbitable camera.

Users can:

- add or remove a bus;
- switch the traffic light between red and green;
- stop or resume bus motion;
- switch between clear, rain, snow and fog;
- watch buses obey mutually exclusive EW/NS phases, stop lines, following distance and an all-red clearance phase;
- orbit, zoom, pause the visual animation, and reset the camera;
- inspect the current `SceneState`;
- follow Candidate → Schema → Semantic → Execution in the interface;
- inspect the raw Event Log for the exact command, action, validation stage, before-state, after-state, rejection reason, and runtime fingerprint.

Unsupported or ambiguous requests are deliberately visible. A request such as “make meteors fall” or a compound request such as “add a bus and turn the light red” is rejected without changing the scene.

### A versioned action protocol

The scene is controlled through a strict `SceneAction` envelope rather than arbitrary model text:

```json
{
  "protocol_version": "0.2",
  "action_id": "deterministic-id",
  "action_type": "set_traffic_light",
  "parameters": {
    "color": "红灯"
  },
  "source": "model",
  "metadata": {
    "confidence": 0.98
  }
}
```

The schema rejects missing fields, protocol-version mismatches, unknown action types, extra fields, invalid parameter types, and illegal enum values. Semantic validation then checks the proposed transition against the live scene—for example, a bus cannot be stopped or removed when no bus exists.

Only an action that passes both stages may reach `SceneState.apply`, and a valid action is applied exactly once.

### Safety that can be demonstrated, not merely claimed

The v0.5 release candidate passes 215 Python tests plus 9 standalone JavaScript traffic-controller tests. The suites cover domain behavior, protocol serialization, malformed model output, schema and semantic short-circuiting, HTTP integration, runtime identity, browser assets, deployment configuration, signal conflict prevention, red-light stopping, the 12-bus visible-capacity contract, and the invariant that rejected actions cannot mutate state.

The deterministic command evaluation set currently reports:

- expected valid commands accepted: 19/19;
- expected invalid or ambiguous commands rejected: 12/12;
- unsafe state mutations: 0;
- incomplete Event Logs: 0.

Stage-order tests also lock the execution sequence to:

```text
schema → semantic → execution
```

If schema validation fails, semantic validation and execution are never called. If semantic validation fails, execution is never called. This boundary is especially important when the candidate producer is probabilistic.

### Real LLM integration: shadow first

The browser demo currently uses a deterministic adapter so that the world-building and safety mechanics remain reproducible. A real-model adapter exists in Shadow Mode, where it may generate a candidate and run through parsing, schema validation, semantic validation, and comparison—but it cannot call `SceneState.apply`.

This is an intentional capability boundary, not a hidden limitation. Real-model candidates will be promoted only after a larger shadow evaluation demonstrates acceptable structure, intent matching and safe-rejection behavior.

### Technical design

- **Renderer:** Three.js r180 / WebGL
- **Server:** Python standard library HTTP server
- **Domain model:** Python `SceneState`, versioned `SceneAction`, schema validator, semantic validator, renderer contract, and Event Log
- **Traffic behavior:** deterministic browser-local fixed-step controller, isolated from server state mutation
- **Assets:** original Blender-authored bus, project-generated city geometry, and original AI-generated asphalt/limestone textures
- **Dependency provenance:** Three.js under the MIT License, pinned to a specific version
- **Runtime identity:** `/health`, source fingerprint, protocol versions, and build identity shown in the UI and Event Log

The renderer reads scene state but does not parse language, validate business rules, or mutate server state. The model adapter generates candidates but never receives direct write access to the scene.

### Development chronology and disclosure

TransitLab began as a personal deterministic traffic-scene prototype before the official build period; that history remains visible in the public Git repository. During the official build period, the project added the v0.5 four-way crossroads world, original Blender bus and procedural city presentation, weather modes, fixed-step right-of-way controller, public browser acceptance, competition video, and the final cross-layer capacity contract.

Open-source, pre-existing and AI-assisted materials are disclosed in `THIRD_PARTY_NOTICES.md`. The repository does not rewrite or conceal pre-build commits. All submitted materials are project-owned or used under the documented terms.

### Current scope and honest limits

- The public executable path is deterministic and supports a documented single-action command set; it does not claim arbitrary-language world generation.
- The real LLM adapter remains evaluation-only and cannot mutate the scene.
- Traffic and weather are interactive demonstrations, not calibrated transport or meteorological simulation.
- State is shared and process-local on the free demo service and resets when the service restarts.
- Judges may use prompts outside the supported examples; unsupported prompts are safely rejected and explained rather than guessed.

### Links

- Public repository: https://github.com/Cluckin-VV/AI-builderkack-traffic-lab
- Hosted demo: https://ai-builderkack-traffic-lab.onrender.com
- Demo video (2:12, English captions): https://github.com/Cluckin-VV/AI-builderkack-traffic-lab/releases/download/v0.5.0-rc.1/transitlab-v05-demo-final.mp4
- Demonstrated source release: https://github.com/Cluckin-VV/AI-builderkack-traffic-lab/releases/tag/v0.5.0-rc.1
- Third-party notices: included in the repository

### Closing thought

AI-native 3D creation should not require trusting a black box with the keys to the world. TransitLab explores a different interaction model: let AI propose, let explicit protocols and validators decide, and let users see exactly why the world changed—or why it safely refused.

## Internal pre-submit checklist

- [x] Kaggle competition team exists and `Cluckin-VV` is team captain.
- [x] Local automated suite: 215 Python tests and 9 JavaScript tests, all passing at final verification on 2026-09-16.
- [x] Project direction checked against the official announcement and Terms.
- [x] Organizer registration forms completed by the participant; no organizer confirmation email has been independently verified in this document.
- [x] Pre-build prototype history and build-period additions are explicitly disclosed; third-party and AI-assisted materials are documented under Terms 7.1–7.4.
- [x] Local v0.5 release candidate committed and pushed to the public repository without force-push (`7f4e6ce`).
- [x] Hosted demo URL added and verified through public HTTP and a separate browser session.
- [x] Demo video under three minutes added to this local draft; anonymous MP4 download and SHA-256 verified on 2026-09-14.
- [ ] Kaggle accepts/displays the GitHub Release MP4 link; online Writeup updated and saved.
- [x] Offline shadow evaluator reports expected-valid acceptance and expected-invalid rejection separately with zero state mutation.
- [ ] Kaggle page translation disabled before editing to avoid the observed `removeChild` crash.
- [ ] Draft saved on Kaggle.
- [ ] Final Kaggle **Submit** performed only after all links and claims are verified and the user confirms the final submission action.
