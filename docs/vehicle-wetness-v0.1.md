# Vehicle wetness v0.1

Rain now changes the original Blender vehicle body panels as well as the road:
their roughness decreases modestly, while clear-coat and environment response
increase within fixed bounds.  Each instantiated vehicle receives its own body
material, so one vehicle cannot alter another vehicle's finish.

## Boundaries

- This is browser presentation only.  It does not modify SceneState, actions,
  previews, validation, the traffic controller, or Event Log.
- Only meshes labelled `body` are adjusted.  Headlamps, brake lamps, turn
  signals, glass, and traffic signals keep their dedicated material paths.
- Rain builds and dries using the existing `SurfaceWetness` history.  Snow
  suppresses this wet-film treatment instead of whitening vehicle paint.
- Values are clamped to avoid excessive mirror reflections or overexposure.

This is a real-time stylised wet-finish cue, not ray-traced water droplets,
a manufacturer material scan, or a claim of console/PC-game rendering parity.
