// Deterministic presentation palettes for project-owned, unbranded vehicle
// meshes.  These values never enter SceneState or the traffic simulator.
const PALETTES = Object.freeze({
  sedan: Object.freeze([
    Object.freeze([.055, .22, .39]),  // deep metallic blue
    Object.freeze([.18, .055, .065]), // restrained wine red
    Object.freeze([.105, .12, .14]),  // graphite
  ]),
  suv: Object.freeze([
    Object.freeze([.16, .31, .21]),   // urban green
    Object.freeze([.17, .20, .25]),   // midnight blue-grey
    Object.freeze([.31, .285, .23]),  // warm graphite
  ]),
});

function stableIndex(value, size) {
  let hash = 2166136261;
  for (const character of String(value ?? '')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % size;
}

export function vehiclePaintColor({ vehicleType = 'sedan', vehicleId = '' } = {}) {
  const palette = PALETTES[vehicleType] ?? PALETTES.sedan;
  return palette[stableIndex(vehicleId, palette.length)];
}
