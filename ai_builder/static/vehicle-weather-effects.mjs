// Presentation-only vehicle weather cues. Inputs are renderer snapshots; this
// module cannot change a route, signal phase, SceneState or vehicle speed.
const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function rainSprayState({ rainWeight = 0, speed = 0, quality = 'balanced' } = {}) {
  const rain = clamp(rainWeight);
  const speedValue = Number.isFinite(speed) ? speed : 0;
  const motion = clamp((speedValue - 1.1) / 6.4);
  const qualityScale = quality === 'high' ? 1 : quality === 'low' ? .48 : .74;
  const intensity = rain * motion * qualityScale;
  return Object.freeze({
    visible: intensity > .025,
    opacity: Math.min(.44, .055 + intensity * .40),
    scale: .72 + intensity * .85,
    particles: quality === 'high' ? 20 : quality === 'low' ? 8 : 14,
  });
}

// Presentation only: a steady, bounded front-windscreen sweep.  It consumes
// the renderer's rain weight, never vehicle speed, routes or domain state.
export function wiperSweepState({ rainWeight = 0, elapsedSeconds = 0 } = {}) {
  const rain = clamp(rainWeight);
  const time = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
  const active = rain > .025;
  const angle = active ? Math.sin(time * 3.2) * .42 * rain : 0;
  return Object.freeze({active, angle: Math.max(-.42, Math.min(.42, angle))});
}
