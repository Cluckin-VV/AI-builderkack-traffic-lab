// Metre-based presentation geometry; does not change traffic or SceneState.
const APPROACHES = {
  W: {forward:[1,0], right:[0,-1]}, E: {forward:[-1,0], right:[0,1]},
  S: {forward:[0,1], right:[1,0]}, N: {forward:[0,-1], right:[-1,0]},
};

// Points are [incoming-forward, driver-right] in metres. A turn keeps its
// upstream stem; rotating a straight arrow sideways would lose that meaning.
export function laneArrowPolygon(movement) {
  if (movement === 'straight') return [
    [-2,-.22],[.65,-.22],[.65,-.7],[2,0],[.65,.7],[.65,.22],[-2,.22],
  ];
  if (!['left','right'].includes(movement)) throw new RangeError('Unknown lane movement');
  const right = [
    [-2,-.22],[1.22,-.22],[1.22,.65],[1.7,.65],[1,1.5],
    [.3,.65],[.78,.65],[.78,.22],[-2,.22],
  ];
  return movement === 'right' ? right : right.map(([f,r])=>[f,-r]);
}

export function junctionPaint(definition = {}) {
  const junction = definition.junction ?? {};
  const halfWidth = (definition.road?.width ?? 30) / 2;
  const stopS = junction.stop_line_s ?? -20.5;
  const end = 80; // createCity's fixed 160 m road meshes.
  const start = Math.abs(stopS) + .2;
  if (!Number.isFinite(halfWidth) || halfWidth <= 1 || !Number.isFinite(stopS)
      || stopS >= 0 || start >= end) throw new RangeError('Invalid road paint dimensions');
  const stopBars = Object.entries(junction.approaches ?? APPROACHES).map(([approach, axes]) => {
    const lateral = halfWidth / 2;
    return {
      approach,
      x: axes.forward[0] * stopS + axes.right[0] * lateral,
      z: axes.forward[1] * stopS + axes.right[1] * lateral,
      width: axes.forward[0] ? .34 : halfWidth - .7,
      depth: axes.forward[0] ? halfWidth - .7 : .34,
    };
  });
  const dividers = [];
  for (const axis of ['EW','NS']) for (const arm of [-1,1]) for (const offset of [-.18,.18]) {
    const along = arm * (start + end) / 2;
    dividers.push({
      x: axis === 'EW' ? along : offset,
      z: axis === 'EW' ? offset : along,
      width: axis === 'EW' ? end - start : .10,
      depth: axis === 'EW' ? .10 : end - start,
    });
  }
  return {stopBars, dividers};
}
