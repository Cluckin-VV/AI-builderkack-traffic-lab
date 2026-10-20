# Vehicle turn signals v0.1

## Scope

This slice makes the original, unbranded sedan, SUV and city-bus assets expose
left and right amber signal components. It is a presentation improvement, not a
new traffic action, protocol field or physics rule.

## Source of truth

The renderer derives every signal from the same deterministic traffic snapshot
that supplies `movement` and `pathProgress`:

- `left` routes flash only the left lamps;
- `right` routes flash only the right lamps;
- straight routes remain dark; and
- lamps stop flashing after route progress reaches 0.86, when the vehicle has
  cleared the junction.

The cadence is 1.5 complete flashes per second. The module cannot write routes,
signal phases or `SceneState`; it only changes cloned material emissive
intensity in the browser.

## Asset and budget choices

The sedan and SUV use front fender and rear lamp indicator meshes. The bus
reuses its existing side-marker meshes rather than adding more geometry. This
keeps the bus-plus-texture runtime-art budget at 9,956,195 bytes, below the
project's 10 MB contract. Assets remain editable Blender exports and do not use
game, production-car or brand assets.

## Verification

- `node --test tools/test-*.mjs`: 62 passing tests, including left/right intent,
  deterministic cadence and turn-clear cutoff tests.
- `python -m unittest discover -s ai_builder/tests -v`: 314 passing tests,
  including component and runtime-art budget contracts.
- An isolated production-loader browser smoke test loaded one WebGL canvas with
  the camera enabled and reported zero console errors and zero warnings.

## Boundaries

This is not a driving simulator or a claim of automotive optical accuracy. The
indicators are intentionally subtle at district scale; future close-up work
should be evaluated in rain, fog and night before increasing glow or adding
expensive light sources.
