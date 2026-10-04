# TransitLab award-readiness audit v0.6

Date: 2026-09-17. This is an engineering assessment, not a promise of placement.

## Official target

The organizer's build-period guidance says the project must turn plain language into 3D scenes and working logic in the browser. It highlights innovation, performance, effectiveness, functionality, usability, technical execution, scalability, visual quality and overall experience. The final package requires a public repository, hosted browser demo, video under three minutes, short description and category.

Source: <https://www.victoriavr.com/news/ai-builder-hackathon-2026-the-building-period-2042daf3>

## Comparable quality bar

No previous winners for this exact 2026 competition exist yet. Two useful contemporary comparables are therefore treated as references, not alleged past winners:

- **Enginuity** turns conversational intent and drawings into a visible CAD feature pipeline and live browser 3D result. Its strength is that AI produces editable structure, not only a final image.
- **Musée du Monde** connects generated 3D scenes into an immediately explorable browser experience. Its strength is a memorable interaction concept and strong visual story.

References:

- <https://cerebralvalley.ai/e/zero-to-agent-london/hackathon/gallery/20>
- <https://www.worldlabs.ai/labs/showcase/musee-du-monde>

## Current evidence-based assessment

| Dimension | Current evidence | Assessment |
| --- | --- | --- |
| Browser-native 3D | Interactive Three.js crossroads, Blender bus, weather, traffic phases, orbit camera | Strong prototype |
| Working logic | Signals, queues, stop lines, clearance phase, capacity and weather speed policy | Strong |
| Safety and technical execution | Versioned actions, schema + semantic validation, state protection, runtime identity, Event Log | Distinctive strength |
| User experience | Polished three-column workbench, responsive layout, visible trace | Strong, but must remain understandable in a 30-second judge test |
| Natural-language intelligence | Public v0.5 uses a deterministic fixed-expression adapter | Material weakness |
| Scene generation breadth | One authored district; state changes do not yet generate new layouts or object classes | Material weakness |
| AI role | Real LLM is shadow-only | Not yet strong enough for a top-place claim |
| Submission readiness | Repository, hosted demo and short video exist; final online submission remains unverified | Conditional |

## v0.6 milestone implemented locally

ScenePlan v0.1 adds a preview-first compositional workflow:

1. One request may produce one to six SceneAction v0.2 steps.
2. Every step passes schema and semantic validation in order.
3. Validation runs against detached state; preview never mutates the live scene.
4. A failed step rejects the complete plan.
5. Confirmation executes a stored plan once.
6. A state change between preview and confirmation produces `STALE_PLAN`.
7. Pending plans are bounded in memory.
8. Event Log records the complete plan execution and runtime fingerprint.

This is the correct execution substrate for an LLM planner, but the deterministic planner must not be marketed as general AI understanding.

## Remaining path to a credible top-tier entry

1. Replace only ScenePlan candidate generation with a real structured-output LLM adapter; preserve preview, validators and explicit confirmation.
2. Build a blind evaluation set of at least 50 unfamiliar Chinese and English requests, including compound, unsupported and adversarial prompts.
3. Add at least one genuinely generative scene dimension—layout, time of day, road furniture or object placement—without turning the protocol into arbitrary code execution.
4. Give judges a guided 60-second story: create a snowy rush-hour incident, inspect the plan, confirm it, then show a rejected unsafe request.
5. Deploy v0.6, rerun desktop/mobile/WebGL acceptance, recapture the sub-three-minute video and update the final writeup.

## Stop conditions

Do not claim award readiness or promote the LLM to execution if any of these remain true:

- model output can bypass SceneAction validation;
- a failed plan partially mutates state;
- unfamiliar valid requests have no measured success rate;
- the hosted demo lacks a working AI path during judging;
- the writeup calls deterministic phrase matching an LLM.
