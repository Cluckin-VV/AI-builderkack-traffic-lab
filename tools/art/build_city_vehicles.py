"""Build the two original passenger-vehicle assets used by TransitLab.

The models borrow only broad real-time-game art principles (clear silhouette,
readable materials, restrained detail and distance-friendly shapes). They are
unbranded original designs, not replicas of a production vehicle or game asset.
Run with Blender --background --python tools/art/build_city_vehicles.py.
"""
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "ai_builder" / "static" / "models"
OUT.mkdir(parents=True, exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0


def mat(name, color, metal=0.0, rough=.38, emission=0.0, coat=0.0, coat_rough=.22):
    value = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    value.diffuse_color = (*color, 1)
    value.use_nodes = True
    node = value.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value = (*color, 1)
    node.inputs["Metallic"].default_value = metal
    node.inputs["Roughness"].default_value = rough
    node.inputs["Emission Color"].default_value = (*color, 1)
    node.inputs["Emission Strength"].default_value = emission
    # Blender 4.x renamed Clearcoat to Coat. Keep the source explicit so the
    # browser exporter can carry the same restrained automotive highlight.
    coat_socket = node.inputs.get("Coat Weight")
    coat_roughness_socket = node.inputs.get("Coat Roughness")
    if coat_socket is not None:
        coat_socket.default_value = coat
    if coat_roughness_socket is not None:
        coat_roughness_socket.default_value = coat_rough
    return value


def cube(name, loc, size, material, bevel=.04, component=None, wheel_id=None, rotation=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    if rotation:
        obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if component:
        obj["transit_component"] = component
    if wheel_id:
        obj["transit_wheel_id"] = wheel_id
    if bevel:
        mod = obj.modifiers.new("Automotive edge radius", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod = obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def profile(name, sections, material):
    vertices = []
    ring_size = 10
    smooth_sections = []
    for index in range(len(sections) - 1):
        previous = sections[max(index - 1, 0)]
        current = sections[index]
        following = sections[index + 1]
        after = sections[min(index + 2, len(sections) - 1)]
        for step in range(5):
            t = step / 5
            values = []
            for axis in range(4):
                p0, p1, p2, p3 = previous[axis], current[axis], following[axis], after[axis]
                value = .5 * ((2 * p1) + (-p0 + p2) * t
                    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                    + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
                values.append(max(min(p1, p2), min(max(p1, p2), value)))
            smooth_sections.append(tuple(values))
    smooth_sections.append(sections[-1])

    for x, half_width, bottom, top in smooth_sections:
        height = top - bottom
        # Chamfered automotive cross-section: narrower floor, rolled shoulders,
        # and a tapered glass/roof line instead of a stack of square prisms.
        outline = (
            (-.78, 0.0), (-.94, .10), (-1.0, .52), (-.94, .88), (-.79, 1.0),
            (.79, 1.0), (.94, .88), (1.0, .52), (.94, .10), (.78, 0.0),
        )
        vertices.extend((x, half_width * side, bottom + height * z) for side, z in outline)
    faces = []
    count = len(smooth_sections)
    faces.append(tuple(range(ring_size)))
    faces.append(tuple(reversed(range((count - 1) * ring_size, count * ring_size))))
    for i in range(count - 1):
        a, b = i * ring_size, (i + 1) * ring_size
        for j in range(ring_size):
            next_j = (j + 1) % ring_size
            # Advance along X first, then around the section. This winding
            # keeps the outward shell front-facing for Three.js backface culling.
            faces.append((a + j, b + j, b + next_j, a + next_j))
    mesh = bpy.data.meshes.new(name + " mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    for polygon in mesh.polygons[2:]:
        polygon.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bevel = obj.modifiers.new("Body edge softening", "BEVEL")
    bevel.width = .055
    bevel.segments = 3
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    weighted = obj.modifiers.new("Body weighted normals", "WEIGHTED_NORMAL")
    bpy.ops.object.modifier_apply(modifier=weighted.name)
    return obj


def panel(name, coords, material, component=None):
    mesh = bpy.data.meshes.new(name + " mesh")
    mesh.from_pydata(coords, [], [(0, 1, 2, 3)])
    mesh.materials.append(material)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if component:
        obj["transit_component"] = component
    return obj


def framed_window(name, corners, frame, seal, glass):
    """Coplanar glazing and inset rings: no solid cabin hiding the windscreen."""
    outer = [Vector(v) for v in corners]
    center = sum(outer, Vector()) / 4
    # Separate rings, not a dark quad behind a smaller floating pane.
    inner = [center + (v-center)*.91 for v in outer]
    pane = [center + (v-center)*.885 for v in outer]
    for i in range(4):
        j = (i+1) % 4
        panel(name + " painted frame", [outer[i], outer[j], inner[j], inner[i]], frame)
        panel(name + " rubber seal", [inner[i], inner[j], pane[j], pane[i]], seal)
    panel(name, pane, glass, "glass")


def cylinder(name, loc, radius, depth, material, component=None, wheel_id=None, vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth,
                                        location=loc, rotation=(math.pi / 2, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    for face in obj.data.polygons:
        face.use_smooth = True
    if component:
        obj["transit_component"] = component
    if wheel_id:
        obj["transit_wheel_id"] = wheel_id
    return obj


def torus(name, loc, major_radius, minor_radius, material, component=None, wheel_id=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=major_radius, minor_radius=minor_radius,
                                     major_segments=40, minor_segments=8,
                                     location=loc, rotation=(math.pi / 2, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    for face in obj.data.polygons:
        face.use_smooth = True
    if component:
        obj["transit_component"] = component
    if wheel_id:
        obj["transit_wheel_id"] = wheel_id
    return obj


def annular_wheel(name, loc, section, material, wheel_id):
    """Revolve a radial/axial section around the axle; leave the hub opening clear."""
    vertices, faces = [], []
    segments = 48
    for i in range(segments):
        angle = math.tau*i/segments
        vertices.extend((loc[0]+r*math.cos(angle), loc[1]+axial, loc[2]+r*math.sin(angle))
                        for r, axial in section)
    count = len(section)
    for i in range(segments):
        for j in range(count):
            faces.append((i*count+j, ((i+1)%segments)*count+j,
                          ((i+1)%segments)*count+(j+1)%count, i*count+(j+1)%count))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    # Recalculate outward normals on the closed annulus independently of profile winding.
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    for face in mesh.polygons:
        face.use_smooth = True
    obj["transit_component"] = "wheel"
    obj["transit_wheel_id"] = wheel_id
    return obj


def mark(obj, component):
    obj["transit_component"] = component
    return obj


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def build(kind, length, width, color, suv=False):
    clear_scene()
    paint = mat(kind + " deep metallic enamel", color, .24, .29, coat=.72, coat_rough=.16)
    secondary = mat(kind + " satin lower trim", (.025, .034, .039), .24, .34, coat=.22, coat_rough=.25)
    glass = mat("Tinted automotive glazing", (.06, .09, .12), .08, .13, coat=.48, coat_rough=.10)
    glass.node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value = .52
    glass.surface_render_method = 'DITHERED'
    upholstery = mat("Charcoal woven upholstery", (.09, .085, .075), 0, .88)
    rubber = mat("Road tire rubber", (.012, .016, .019), .02, .86)
    alloy = mat("Forged satin alloy", (.50, .57, .59), .82, .20, coat=.18, coat_rough=.16)
    rotor = mat("Ventilated brake rotor", (.19, .22, .23), .76, .30)
    caliper = mat("Performance brake caliper", (.72, .055, .022), .34, .27, coat=.35, coat_rough=.18)
    grille = mat("Graphite intake mesh", (.015, .020, .022), .34, .45)
    headlamp = mat("LED projector lens", (.87, .91, .82), .18, .18, .18, coat=.82, coat_rough=.10)
    mirror_glass = mat("Rear-facing mirror silver", (.62, .68, .72), 1.0, .08)
    brake_lamp = mat("Tail lamp red lens", (.48, .018, .026), .23, .25, .12, coat=.65, coat_rough=.12)
    amber = mat("Amber marker lens", (.92, .30, .035), .08, .25, .1, coat=.45, coat_rough=.16)
    plate = mat("Unbranded registration plate", (.69, .72, .68), .16, .28)

    half = length / 2
    tire_r = .405 if suv else .345
    wheel_z = .445 if suv else .405
    wheel_x = length * .305
    full_width = width
    body_height = 1.12 if suv else 1.00

    sections = [
        (-half, full_width * .40, .39, .73),
        (-half + .22, full_width * .48, .39, .91),
        (-length * .31, full_width * .50, .40, body_height * .90),
        (-.20, full_width * .48, .42, body_height),
        (length * .27, full_width * .50, .40, body_height * .98),
        (half - .22, full_width * .46, .39, .86),
        (half, full_width * .40, .40, .72),
    ]
    body = profile("Sculpted one-piece painted body", sections, paint)
    # Actual wheel openings, not a solid body hidden behind protruding tires.
    for x in (-wheel_x, wheel_x):
        cutter = cylinder("Temporary wheel opening", (x, 0, wheel_z), tire_r+.045,
                          width+1, rubber, vertices=64)
        modifier = body.modifiers.new("Wheel well clearance", "BOOLEAN")
        modifier.operation = 'DIFFERENCE'
        modifier.solver = 'EXACT'
        modifier.object = cutter
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
    cube("Front energy-absorbing bumper", (half - .10, 0, .48), (.20, width * .91, .25), secondary, .075)
    cube("Rear energy-absorbing bumper", (-half + .10, 0, .47), (.20, width * .91, .23), secondary, .07)
    cube("Full-width front lower intake", (half - .035, 0, .61), (.045, width * .57, .17), grille, .035)
    cube("Front splitter", (half - .19, 0, .365), (.38, width * .78, .055), secondary, .018)
    cube("Rear diffuser", (-half + .17, 0, .355), (.34, width * .72, .07), secondary, .025)
    for side in (-1, 1):
        cube("Sculpted side sill", (0, side * (width * .485), .44),
             (2*(wheel_x-tire_r-.06), .10, .17), secondary, .045)
        # Door shut lines are geometry, not painted-on texture, so they stay
        # legible under both the oblique and street cameras.
        for x in (-.58, .53):
            cube("Door shut line", (x, side * (width * .506), .74),
                 (.012, .010, .34), grille, .003, component="door_gap")
        cube("Lower door crease", (-.02, side * (width * .507), .63),
             (2*(wheel_x-tire_r-.06), .010, .014), secondary, .003, component="door_gap")

    roof_z = 1.74 if suv else 1.48
    cabin_bottom = 1.09 if suv else .96
    cabin_rear = -length * .34
    cabin_front = length * .23
    roof_rear = -length * .20
    roof_front = length * .055
    cabin_half_width = width * (.435 if suv else .405)
    roof_half_width = width * (.40 if suv else .365)
    # Upper cabin detail is real geometry behind tinted panes. The opaque body
    # hides the lower cabin; no expensive refractive render pass is required.
    floor_z = max(body_height, cabin_bottom)+.015
    cube("Dark cabin floor", ((cabin_front+cabin_rear)/2, 0, floor_z),
         (cabin_front-cabin_rear-.08, cabin_half_width*1.98, .025), secondary, .01,
         component="dashboard")
    for seat_x in (.03, -.77):
        for side in (-1, 1):
            seat_y = side * width * .23
            cube("Seat cushion", (seat_x, seat_y, floor_z+.065),
                 (.43, .40, .10), upholstery, .04, component="seat")
            cube("Seat back", (seat_x-.21, seat_y, floor_z+.18),
                 (.10, .39, .29), upholstery, .04, component="seat", rotation=(0,-.10,0))
            cube("Seat head restraint", (seat_x-.22, seat_y, floor_z+.335),
                 (.10, .20, .11), upholstery, .035, component="seat")
    cube("Dashboard upper pad", (cabin_front-.20, 0, cabin_bottom+.035),
         (.31, width*.69, .09), secondary, .035, component="dashboard")
    steering = torus("Steering rim", (cabin_front-.40, -width*.23, cabin_bottom+.16),
                     .115, .014, secondary, component="steering_wheel")
    steering.rotation_euler = (0, math.pi/2-.3, 0)
    cube("Steering center and spoke", (cabin_front-.40, -width*.23, cabin_bottom+.16),
         (.04, .21, .026), secondary, .008, component="steering_wheel")
    cube("Steering column", (cabin_front-.31, -width*.23, cabin_bottom+.12),
         (.23, .035, .04), secondary, .01, component="steering_wheel")
    # The roof, glass and pillars meet on the same four boundaries. Previously
    # a smoothed solid cabin protruded through these sloped glass quads.
    profile("Crowned painted roof", [
        (roof_rear, roof_half_width, roof_z-.065, roof_z-.02),
        ((roof_rear+roof_front)/2, roof_half_width, roof_z-.065, roof_z+.025),
        (roof_front, roof_half_width, roof_z-.065, roof_z-.02),
    ], paint)
    framed_window("Front windscreen", [
        (cabin_front, -cabin_half_width, cabin_bottom),
        (cabin_front, cabin_half_width, cabin_bottom),
        (roof_front, roof_half_width, roof_z-.04),
        (roof_front, -roof_half_width, roof_z-.04),
    ], paint, secondary, glass)
    framed_window("Rear windscreen", [
        (cabin_rear, cabin_half_width, cabin_bottom),
        (cabin_rear, -cabin_half_width, cabin_bottom),
        (roof_rear, -roof_half_width, roof_z-.04),
        (roof_rear, roof_half_width, roof_z-.04),
    ], paint, secondary, glass)

    for side in (-1, 1):
        y = side * cabin_half_width
        roof_y = side * roof_half_width
        mid = (cabin_rear + cabin_front) / 2
        for name, corners in (
            ("Front side glass", [(cabin_front,y,cabin_bottom), (mid,y,cabin_bottom),
                                  (mid,roof_y,roof_z-.04), (roof_front,roof_y,roof_z-.04)]),
            ("Rear side glass", [(mid,y,cabin_bottom), (cabin_rear,y,cabin_bottom),
                                 (roof_rear,roof_y,roof_z-.04), (mid,roof_y,roof_z-.04)]),
        ):
            # Mirroring changes winding; both body frames remain outward-facing.
            framed_window(name, list(reversed(corners)) if side < 0 else corners, paint, secondary, glass)
        for x in (-.35, .72):
            cube("Flush door handle", (x, side * (width * .50 + .025), .91 if not suv else 1.0),
                 (.20, .045, .045), alloy, .018)
        # Mirror stem and housing, mirrored independently at each A-pillar.
        mirror_x, mirror_z = cabin_front-.20, cabin_bottom+.10
        mirror_y = width*.50+.08
        foot_y = cabin_half_width-.02
        cube("Mirror stem", (mirror_x, side * (foot_y+mirror_y)/2, mirror_z),
             (.075, mirror_y-foot_y+.02, .055), secondary, .018)
        cube("Aerodynamic side mirror", (mirror_x, side * mirror_y, mirror_z+.025),
             (.27, .14, .17), paint, .065)
        cube("Rear-facing mirror inset", (mirror_x-.136, side * mirror_y, mirror_z+.025),
             (.009, .095, .11), secondary, .008)
        cube("Rear-facing mirror glass", (mirror_x-.142, side * mirror_y, mirror_z+.025),
             (.003, .080, .092), mirror_glass, .001, component="mirror_glass")
        cube("Mirror indicator", (mirror_x+.05, side * (mirror_y+.074), mirror_z+.025),
             (.13, .012, .028), amber, .01)
        if suv:
            cube("Matte SUV rocker cladding", (0, side * (width * .507), .43),
                 (2*(wheel_x-tire_r-.06), .035, .22), secondary, .055)
            cube("Raised roof rail", ((roof_rear + roof_front) / 2, side * width * .36, roof_z + .08),
                 (roof_front-roof_rear-.08, .045, .055), alloy, .02)
            for support_x in (roof_rear + .16, roof_front - .10):
                cube("Roof rail mounting foot", (support_x, side * width * .36, roof_z + .045),
                     (.065, .075, .09), secondary, .018)

    # Model exactly four wheel assemblies. The compact browser payload keeps
    # each wheel on a named pivot so it can rotate with distance travelled.
    for axle_name, x in (("front", wheel_x), ("rear", -wheel_x)):
        for side_name, side in (("left", -1), ("right", 1)):
            wheel_id = axle_name + "_" + side_name
            y = side * (width * .49)
            depth = .27 if suv else .235
            annular_wheel("Rounded tire " + wheel_id, (x,y,wheel_z), [
                (tire_r*.64, -depth*.5), (tire_r*.86, -depth*.5),
                (tire_r*.98, -depth*.36), (tire_r, -depth*.22),
                (tire_r, depth*.22), (tire_r*.98, depth*.36),
                (tire_r*.86, depth*.5), (tire_r*.64, depth*.5),
            ], rubber, wheel_id)
            annular_wheel("Open alloy rim " + wheel_id, (x,y,wheel_z), [
                (tire_r*.60,-depth*.43), (tire_r*.66,-depth*.43),
                (tire_r*.66,depth*.43), (tire_r*.60,depth*.43),
            ], alloy, wheel_id)
            cylinder("Ventilated brake disc " + wheel_id, (x, side * (width * .49 + .105), wheel_z),
                     tire_r * .43, .018, rotor, "wheel", wheel_id, 32)
            cylinder("Dark hub " + wheel_id, (x, side * (width * .49 + .15), wheel_z),
                     tire_r * .16, .045, secondary, "wheel", wheel_id, 24)
            for spoke in range(10):
                angle = math.tau * spoke / 10
                spoke_obj = cube("Ten-spoke alloy " + wheel_id,
                    (x + math.cos(angle) * tire_r * .36, side * (width * .49 + .153),
                     wheel_z + math.sin(angle) * tire_r * .36),
                    (tire_r * .44, .038, .055), alloy, .014,
                    component="wheel", wheel_id=wheel_id,
                    rotation=(0, -angle, 0))
            # A low-profile shoulder ring reads as tread in close-up without
            # turning either passenger vehicle into an off-road toy.
            torus("Tire shoulder tread " + wheel_id,
                  (x, side * (width * .49), wheel_z), tire_r * .955, .018,
                  rubber, component="tire_tread", wheel_id=wheel_id)
            # The caliper is deliberately a separate named component so the
            # browser can preserve a convincing wheel/brake reading.
            cube("Performance brake caliper " + wheel_id,
                 (x + tire_r * .18, side * (width * .49 + .113), wheel_z + tire_r * .31),
                 (.065, .026, .13), caliper, .014,
                 component="brake_caliper", wheel_id=wheel_id,
                 rotation=(0, .12, 0))

    # Headlamps, rear light bar, grille slats and plate are recognizable but
    # deliberately generic; brake lamps have a runtime-controlled emissive cue.
    for side in (-1, 1):
        cube("Projector headlamp housing", (half - .02, side * width * .25, .665),
             (.04, .38, .13), grille, .018)
        for offset in (-.083, .083):
            bezel = cylinder("Round projector bezel", (half+.003, side*width*.25+offset, .653),
                             .045, .014, alloy, vertices=24)
            bezel.rotation_euler = (0, math.pi/2, 0)
            lens = cylinder("Recessed projector lens", (half+.011, side*width*.25+offset, .653),
                            .033, .004, headlamp, "headlamp", vertices=24)
            lens.rotation_euler = (0, math.pi/2, 0)
        cube("Upper daytime running light", (half+.004, side*width*.25, .707),
             (.006, .29, .012), headlamp, .003, component="headlamp")
        cube("Tail lamp dark surround", (-half + .02, side * width * .27, .665),
             (.04, .34, .13), secondary, .018)
        cube("Adaptive brake light", (-half + .001, side * width * .27, .67),
             (.006, .28, .075), brake_lamp, .003, component="brake_lamp")
        cube("Front fender marker", (wheel_x + .35, side * (width * .505), .78),
             (.18, .024, .06), amber, .02)
    for y in (-.43, -.28, -.14, 0, .14, .28, .43):
        cube("Front grille vertical", (half - .05, y, .66), (.035, .025, .13), alloy, .008)
    cube("Unbranded front plate", (half - .03, 0, .47), (.025, .40, .105), plate, .012)
    cube("Unbranded rear plate", (-half + .03, 0, .47), (.025, .40, .105), plate, .012)

    # A subtle rear lip differs from the SUV's practical roof spoiler.
    if suv:
        cube("SUV rear roof spoiler", (roof_rear - .05, 0, roof_z-.01), (.25, width * .76, .065), paint, .025)
        cube("Rear utility lower guard", (-half + .08, 0, .40), (.14, width * .80, .11), alloy, .025)
    else:
        cube("Integrated rear deck lip", (-length * .34, 0, 1.005), (.34, width * .78, .075), paint, .032)

    filepath = OUT / f"city-{kind}-v1"
    bpy.ops.wm.save_as_mainfile(filepath=str(filepath.with_suffix(".blend")))
    bpy.ops.export_scene.gltf(filepath=str(filepath.with_suffix(".glb")), export_format="GLB", export_yup=True)

    batches = {}
    wheel_centers = {axle + "_" + side_name: [round(x,5), wheel_z, round(-side*width*.49,5)]
                     for axle, x in (("front",wheel_x),("rear",-wheel_x))
                     for side_name, side in (("left",-1),("right",1))}
    positions_all = []
    deps = bpy.context.evaluated_depsgraph_get()
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        component = obj.get("transit_component", "body")
        wheel_id = obj.get("transit_wheel_id")
        if wheel_id and wheel_id not in wheel_centers:
            wheel_centers[wheel_id] = [round(obj.location.x, 5), round(obj.location.z, 5), round(-obj.location.y, 5)]
        evaluated = obj.evaluated_get(deps)
        geo = evaluated.to_mesh()
        geo.calc_loop_triangles()
        matrix = obj.matrix_world
        normal_matrix = matrix.to_3x3().inverted().transposed()
        key = "|".join((obj.data.materials[0].name, component, wheel_id or ""))
        batch = batches.setdefault(key, {"positions": [], "normals": [], "component": component, "wheel_id": wheel_id})
        center = wheel_centers.get(wheel_id, [0, 0, 0]) if wheel_id else [0, 0, 0]
        for tri in geo.loop_triangles:
            material = obj.data.materials[tri.material_index]
            batch_key = "|".join((material.name, component, wheel_id or ""))
            batch = batches.setdefault(batch_key, {"positions": [], "normals": [], "component": component, "wheel_id": wheel_id})
            for loop_index, vi in zip(tri.loops, tri.vertices):
                v = matrix @ geo.vertices[vi].co
                n = normal_matrix @ geo.corner_normals[loop_index].vector
                n.normalize()
                point = (v.x - center[0], v.z - center[1], -v.y - center[2]) if wheel_id else (v.x, v.z, -v.y)
                batch["positions"].extend(round(a, 5) for a in point)
                batch["normals"].extend(round(a, 5) for a in (n.x, n.z, -n.y))
                positions_all.append((v.x, v.z, -v.y))
        evaluated.to_mesh_clear()

    for key, batch in batches.items():
        material_name = key.split("|", 1)[0]
        material = bpy.data.materials[material_name]
        node = material.node_tree.nodes.get("Principled BSDF")
        batch["color"] = list(material.diffuse_color[:3])
        batch["roughness"] = node.inputs["Roughness"].default_value
        batch["metalness"] = node.inputs["Metallic"].default_value
        batch["emission"] = node.inputs["Emission Strength"].default_value
        batch["opacity"] = node.inputs["Alpha"].default_value
        coat_socket = node.inputs.get("Coat Weight")
        coat_roughness_socket = node.inputs.get("Coat Roughness")
        batch["clearcoat"] = coat_socket.default_value if coat_socket is not None else 0.0
        batch["clearcoat_roughness"] = coat_roughness_socket.default_value if coat_roughness_socket is not None else 0.22

    minimum = [min(point[i] for point in positions_all) for i in range(3)]
    maximum = [max(point[i] for point in positions_all) for i in range(3)]
    payload = {
        "format": "transit-mesh-v1", "generator": "Blender " + bpy.app.version_string,
        "units": "metres", "vehicle_type": kind,
        "design": "original game-ready GT sport sedan" if not suv else "original game-ready urban SUV",
        "wheel_radius": tire_r,
        "body_dimensions": {"length": length, "height": round(maximum[1] - minimum[1], 3), "width": width},
        "overall_dimensions": {"length": round(maximum[0] - minimum[0], 3),
                               "height": round(maximum[1] - minimum[1], 3),
                               "width": round(maximum[2] - minimum[2], 3)},
        "dimensions": {"length": round(maximum[0] - minimum[0], 3),
                       "height": round(maximum[1] - minimum[1], 3),
                       "width": round(maximum[2] - minimum[2], 3)},
        "bounds": {"min": [round(x, 4) for x in minimum], "max": [round(x, 4) for x in maximum]},
        "wheel_centers": wheel_centers,
        "batches": batches,
    }
    filepath.with_suffix(".json").write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print("VEHICLE_EXPORT", json.dumps({"type": kind, "batches": len(batches),
        "triangles": sum(len(batch["positions"]) // 9 for batch in batches.values()),
        "json_bytes": filepath.with_suffix(".json").stat().st_size}))


build("sedan", 4.65, 1.82, (.055, .22, .39), suv=False)
build("suv", 4.95, 1.94, (.16, .31, .21), suv=True)
