# Follow-camera foreground composition v0.1

The vehicle-follow view is a read-only inspection lens. Previously its fixed
angle occasionally placed a black signal head over the close-up vehicle. A
single ray to the vehicle centre was insufficient: a head could still cover
the roof or surrounding composition.

The city now records simple bounds for its eight authored buildings and for
each signal pole, arm, and housing before static facade batching. The follow
camera checks a few points around the vehicle and the projected foreground
bounds, then chooses a clear candidate angle when one exists. In follow mode
only, a signal head directly covering the central observation frame is hidden
from rendering. The underlying signal phase, lamps' state, traffic controller,
SceneState, preview/confirmation/undo, and Event Log are unchanged. Returning
to street/corner/overview restores all heads. Manual camera orbit takes
precedence over automatic angle selection.

Verification: pure geometry tests cover blocked and clear sight lines,
foreground versus distant boxes, and non-mutation of the target. A restarted
local service is mandatory for visual checks because its source fingerprint
also keys browser assets. In isolated headed Chromium at the new fingerprint,
follow mode showed one live WebGL canvas with three unobscured near cars in a
sampled queue frame; `data-camera-foreground-signals-hidden=3`. Switching to
street mode returned that value to `0`. Console errors/warnings were `0/0`,
and `/api/state` remained the original 12-car clear scene with no event.

This improves sampled near-junction compositions, not every possible camera
orbit or vehicle position. Trees and every decorative object are not part of
the obstruction proxy, and foreground-head culling is a presentation choice,
not a traffic-engineering rule. It is not a photorealism or performance claim.
