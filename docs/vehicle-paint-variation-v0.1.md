# Deterministic vehicle paint variation v0.1

## Purpose

The original sedan and SUV now receive a restrained, deterministic metal-paint
variant from their stable vehicle ID. This gives a mixed city fleet visual
variety without changing any domain data, vehicle catalogue dimensions,
traffic route, traffic seed, natural-language protocol, preview/confirm flow,
or Event Log.

## Material boundary

The Blender export marks the primary sculpted body and roof as `paint`.
Runtime colour variation applies only to that tag. Black lower trim, intake
mesh, wheels, brake hardware, glazing, lamps, mirrors and registration plates
keep their authored material values. Rain finish continues to operate on
painted body surfaces without changing colour.

## Determinism

`vehicle-paint.mjs` uses a small fixed project palette and a stable hash of the
already-existing vehicle ID. The same vehicle gets the same paint after a
reload; no random number generator or state field is introduced. Buses keep
their authored two-tone public-transit livery for silhouette clarity.

## Verification and limits

- Blender 4.5.9 regenerated editable `.blend`, `.glb` and runtime JSON assets.
- Source audit images for sedan and SUV were rendered from those Blender files.
  They verify authored geometry/materials but are not substituted for browser
  performance evidence.
- Node tests assert deterministic and finite palette selection; Python tests
  require the `paint` component on passenger models.
- This is original, generic vehicle art. It is not a license to claim a
  manufacturer paint match, a scanned vehicle, a GTA/Forza asset, or a
  physical paint shader.
