# Junction paint correction

2026-10-04. Presentation-only correction; command parsing, protocol versions, validation and traffic-controller behavior are unchanged.

The old centre paint used full 160 m boxes through the intersection (four yellow stripes, not a true double line). Its four stop bars also spanned both carriageways, visually stopping outgoing traffic. The renderer now consumes `junctionPaint(definition)` from a pure metre-based module using the shared approach forward/right vectors and stop-line coordinate. It creates two yellow lines on each arm, ending 0.2 m upstream of the stop coordinate, and an inbound-only bar per approach. Crosswalks and vehicle stop coordinates remain unchanged.

Verification:

- New Node test initially failed because the module did not exist, then passed after implementation. Four added tests cover intersection clearance, inbound-only stop bars, invalid dimensions and actual renderer integration.
- Complete JavaScript suite: 46 passed. Python suite: 308 passed in 19.908 s. Command evaluation: 19/19 supported, 12/12 unsupported/ambiguous rejected, all error counters zero.
- Separate real headed browser at `http://127.0.0.1:8040/`, 1920x1080 viewport, runtime fingerprint `cff3afbdfb98`, original vehicle assets ready, twelve vehicles, automatic phases, zero console errors/warnings. Screenshot: `output/playwright/road-paint-corrected.png`. Visual inspection confirms the junction centre has no crossing yellow paint and stop bars no longer span outgoing lanes. Viewport resolution is not a full-canvas performance benchmark.
- New module is explicitly served as JavaScript and included in source identity; no paid API/dependency was introduced.

The three Douyin clips remain unseen: Chrome extension transport still returns `nodeRepl.fetch request failed`. This correction is based on directly verified project geometry, not a claim to have analyzed those videos. Building/vegetation detail, long-duration performance and reference-driven lighting are still unfinished.
