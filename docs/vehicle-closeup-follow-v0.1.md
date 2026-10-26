# Vehicle close-up and read-only follow camera v0.1

The previous "车流近景" preset was a fixed roadside camera roughly 34 metres from the junction. In the real browser, moving cars occupied too few pixels to judge their modelling; the name promised a close-up the page did not deliver. This pass supersedes that fixed-camera behaviour.

## What changed

- The original Blender sedan and SUV now have body-colour, tapered front/rear bumper skins rather than full-width dark cuboids. A separate visible lower intake, unbranded registration plates, and layered projector/matrix lamp bezels retain depth at the front. The exporter still produces editable `.blend`, interchange `.glb`, and browser runtime `.json` from one source script.
- "车辆跟拍" selects a stable in-view vehicle from the existing controller snapshot, preferring sedan, then SUV, then bus. It keeps the target while that vehicle is within the junction view and smoothly follows its actual position. Mouse drag orbits the followed vehicle; the wheel controls observation distance. No camera data feeds back into traffic, SceneState, action validation, preview, confirmation, or undo.
- If no vehicle is in the observation region, the camera falls back to the junction. Vehicle selection ignores non-finite coordinates, preserving a usable camera even with malformed presentation data.
- A real 24-vehicle browser check exposed an unrelated safety defect: the existing undo compensator counted only buses and could not undo a mixed SUV/bus append without removing the wrong IDs. Server-owned undo plans now target the exact appended IDs, still pass Schema → Semantic → detached preview → confirmation → apply, and cannot use this ID field from ordinary/public actions. More complex fleet rewrites that cannot be represented exactly remain rejected rather than silently restoring an incorrect snapshot.

## Verification and limits

The regression checks require the two passenger-vehicle exports to have front intakes and registration plates in front of the body nose, plus distinct lamp bezels. A pure JavaScript test checks stable selection, priority, distance bounds, malformed coordinates, and non-mutation of the input list. Full Python/Node suites and public browser evidence are recorded in `progress.md` for the release.

The browser close-up is an inspectable real-time game-style prototype, not a scanned or licensed vehicle, a GT/Forza asset, or a physically simulated suspension/tyre model. The extra bumper and lamp geometry raises the vehicle triangle count and must remain inside the initial 25 MB asset budget. The local 1920×1080 browser viewport showed the 24-vehicle scene with the new close-up; a single observed 45 FPS sample is not a 30 FPS/60 FPS guarantee or a timed soak. The app canvas occupied only part of that viewport.

## Wheel-arch and observation-angle refinement

The sedan and SUV now each have four Blender-authored, non-rotating wheel-arch flares swept around the actual cut wheel openings. The sweep tracks the body section's varying shoulder width rather than placing a constant-width torus beside it. Sedan arches use body paint; SUV arches use restrained dark cladding. Their near edge remains at least 0.05 m beyond the tyre radius. The geometry is exported in the same `.blend`, `.glb`, and batched browser `.json` source pipeline, with a regression check for both axles/sides and a lightweight triangle bound.

The original follow-camera azimuth put a foreground signal head directly across much of the vehicle view. Its new three-quarter azimuth and higher elevation cleared that gantry in one sampled local browser scene. A later observation still found foreground signal heads at other vehicle positions, so occlusion is **not solved**. A manual orbit in the local browser produced a useful lower seat-inspection angle, but a robust future camera would need collision/occlusion-aware positioning. The camera is read-only and cannot change traffic decisions. Browser screenshots and audit renders are local evidence in `output/playwright/` and `.playwright-cli/`; neither proves universal visibility or photorealism.
