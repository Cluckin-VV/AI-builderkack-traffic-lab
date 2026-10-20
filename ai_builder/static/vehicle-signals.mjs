// Presentation-only vehicle lighting. Route intent comes from the deterministic
// traffic snapshot; this module never changes a vehicle route or SceneState.
const TURN_END_PROGRESS = .86;

export function turnSignalState({ movement, pathProgress, elapsedSeconds = 0 }) {
  const side = movement === "left" || movement === "right" ? movement : null;
  const stillSignaling = side !== null && Number.isFinite(pathProgress) && pathProgress < TURN_END_PROGRESS;
  // 1.5 complete flashes per second: a conventional, readable cadence without
  // adding browser lights or a physics/animation dependency.
  const lit = Math.floor(Math.max(0, elapsedSeconds) * 3) % 2 === 0;
  return {
    left: stillSignaling && side === "left" && lit,
    right: stillSignaling && side === "right" && lit,
  };
}

export { TURN_END_PROGRESS };
