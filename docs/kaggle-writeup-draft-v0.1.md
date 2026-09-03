# Kaggle Writeup Draft v0.1 — TransitLab

> Internal status: **DRAFT — do not submit for judging yet.**
>
> The public repository and browser demo are live. Before final submission, add a demo video under three minutes, finish the remaining organizer and evaluation checks, and replace the final `Pending` link below.

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

The user can ask for changes such as adding a bus, removing a bus, changing a traffic light, stopping traffic, or resuming movement. The system never lets a parser or model write directly to scene state. Every candidate must pass a visible action firewall first.

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

TransitLab renders a procedural traffic district directly in the browser with Three.js/WebGL. The scene includes roads, lane markings, a crosswalk, traffic signals, buses, buildings, trees, streetlights, shadows, and an orbitable camera.

Users can:

- add or remove a bus;
- switch the traffic light between red and green;
- stop or resume bus motion;
- orbit, zoom, pause the visual animation, and reset the camera;
- inspect the current `SceneState`;
- follow Candidate → Schema → Semantic → Execution in the interface;
- inspect the raw Event Log for the exact command, action, validation stage, before-state, after-state, rejection reason, and runtime fingerprint.

Unsupported or ambiguous requests are deliberately visible. A request such as “make it snow” or a compound request such as “add a bus and turn the light red” is rejected without changing the scene.

### A versioned action protocol

The scene is controlled through a strict `SceneAction` envelope rather than arbitrary model text:

```json
{
  "protocol_version": "0.2",
  "action_id": "deterministic-id",
  "action_type": "set_traffic_light",
  "parameters": {
    "color": "red"
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

The current local candidate passes 189 automated tests. The suite covers domain behavior, protocol serialization, malformed model output, schema and semantic short-circuiting, HTTP integration, runtime identity, browser assets, deployment configuration, and the invariant that rejected actions cannot mutate state.

The deterministic command evaluation set currently reports:

- expected valid commands accepted: 13/13;
- expected invalid or ambiguous commands rejected: 10/10;
- unsafe state mutations: 0;
- incomplete Event Logs: 0.

Stage-order tests also lock the execution sequence to:

```text
schema → semantic → execution
```

If schema validation fails, semantic validation and execution are never called. If semantic validation fails, execution is never called. This boundary is especially important when the candidate producer is probabilistic.

### Real LLM integration: shadow first

The browser demo currently uses a deterministic adapter so that the world-building and safety mechanics remain reproducible. A real-model adapter exists in Shadow Mode, where it may generate a candidate and run through parsing, schema validation, semantic validation, and comparison—but it cannot call `SceneState.apply`.

This is an intentional capability boundary, not a hidden limitation. The next milestone is to expand the shadow evaluation set, fix remaining diagnostics, and promote real-model candidates only after false acceptance and state-safety metrics support doing so.

### Technical design

- **Renderer:** Three.js r180 / WebGL
- **Server:** Python standard library HTTP server
- **Domain model:** Python `SceneState`, versioned `SceneAction`, schema validator, semantic validator, renderer contract, and Event Log
- **Assets:** procedural geometry generated by the project; no external 3D models or textures
- **Dependency provenance:** Three.js under the MIT License, pinned to a specific version
- **Runtime identity:** `/health`, source fingerprint, protocol versions, and build identity shown in the UI and Event Log

The renderer reads scene state but does not parse language, validate business rules, or mutate server state. The model adapter generates candidates but never receives direct write access to the scene.

### What remains before the final submission

TransitLab is a working public prototype, not yet a finished competition submission. Before judging, the project will add:

1. a sub-three-minute demo video;
2. broader unknown-prompt and judge-prompt evaluation;
3. a corrected real-LLM shadow baseline and evidence-based promotion decision;
4. written clarification from the organizer about disclosure of pre-build work;
5. a final clean-browser reproducibility check and tagged submission commit.

### Links

- Public repository: https://github.com/Cluckin-VV/AI-builderkack-traffic-lab
- Hosted demo: https://ai-builderkack-traffic-lab.onrender.com
- Demo video: **Pending**
- Third-party notices: included in the repository

### Closing thought

AI-native 3D creation should not require trusting a black box with the keys to the world. TransitLab explores a different interaction model: let AI propose, let explicit protocols and validators decide, and let users see exactly why the world changed—or why it safely refused.

## Internal pre-submit checklist

- [x] Kaggle competition team exists and `Cluckin-VV` is team captain.
- [x] Local automated suite: 189 tests, all passing on 2026-09-04.
- [x] Project direction checked against the official announcement and Terms.
- [ ] Organizer registration confirmed from both Microsoft Forms or in writing.
- [ ] Organizer confirms treatment/disclosure of work created before 2026-09-11.
- [x] Local v0.4 changes committed and pushed to the public repository without force-push.
- [x] Hosted demo URL added and verified through public HTTP and a separate browser session.
- [ ] Demo video under three minutes added.
- [ ] Stale real-LLM result artifacts regenerated after diagnostics are corrected.
- [ ] Kaggle page translation disabled before editing to avoid the observed `removeChild` crash.
- [ ] Draft saved on Kaggle.
- [ ] Final Kaggle **Submit** performed only after all links and claims are verified.
