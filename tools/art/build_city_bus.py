"""Run with Blender --background --python tools/art/build_city_bus.py.

Authors an original low-floor electric bus; exports .blend, GLB and a compact
material-batched triangle format consumed without an extra browser loader.
No application state or commands are read or modified.
"""
import json
import math
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "ai_builder" / "static" / "models"
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

def material(name, color, metallic=0, roughness=.4, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    n = m.node_tree.nodes.get("Principled BSDF")
    n.inputs["Base Color"].default_value = (*color, 1)
    n.inputs["Metallic"].default_value = metallic
    n.inputs["Roughness"].default_value = roughness
    n.inputs["Emission Color"].default_value = (*color, 1)
    n.inputs["Emission Strength"].default_value = emission
    return m

paint = material("Pearl ivory enamel", (.81,.84,.79), .32,.25)
teal = material("Petrol green enamel", (.018,.22,.23), .4,.24)
glass = material("Smoked blue glazing", (.028,.075,.10), .58,.14)
rubber = material("Tire rubber", (.012,.017,.019), 0,.84)
metal = material("Brushed aluminium", (.43,.48,.50), .82,.25)
black = material("Black trim", (.023,.028,.029), .15,.46)
amber = material("Amber destination LED", (1,.49,.075), .1,.3,2.8)
white = material("Headlight LED", (1,.91,.72), .1,.2,4)
red = material("Tail light LED", (.8,.017,.01), .1,.2,3)

# Author directly in Blender Z-up: length X, width Y, height Z.
def cube(name, loc, size, mat, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj=bpy.context.object; obj.name=name; obj.dimensions=size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod=obj.modifiers.new("Manufactured edge radius", "BEVEL")
        mod.width=bevel; mod.segments=3
        bpy.context.view_layer.objects.active=obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj

cube("Low floor body", (0,0,1.15), (9.4,2.48,1.28), paint,.18)
cube("Continuous window band", (-.04,0,2.18), (9.28,2.42,1.17), glass,.16)
cube("Roof shell", (-.06,0,2.87), (9.32,2.47,.24), paint,.12)
cube("Lower green skirt", (0,0,.72), (9.36,2.50,.34), teal,.09)
cube("Roof battery pod", (-1.2,0,3.09), (3.5,1.75,.28), paint,.1)
cube("HVAC pod", (1.65,0,3.10), (1.5,1.7,.3), metal,.09)
for x in [-1.9,-.8]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.47,depth=.035,location=(x,0,3.25))
    bpy.context.object.data.materials.append(black)
    for y in [-.24,0,.24]: cube("Cooling grille", (x,y,3.275),(.72,.03,.018),metal)

for side in [-1,1]:
    y=side*1.239
    cube("Shoulder trim", (0,y,1.64),(8.9,.035,.07),metal,.01)
    for x in [-4.25,-3.05,-1.75,-.45,.85,2.15,3.42,4.23]:
        cube("Window mullion", (x,y,2.19),(.07,.045,1.08),black,.012)
    cube("Side route display", (2.45,side*1.262,2.51),(1.5,.035,.25),black,.02)
    for x in [1.87,2.02,2.17,2.32,2.47,2.62,2.77,2.92]:
        cube("Route LED segment",(x,side*1.285,2.51),(.07,.016,.12),amber)
    # Lower service-panel seams and handles.
    for x in [-3.5,-2.6,-1.7,-.8,.1,.95]:
        cube("Panel seam", (x,y*1.011,1.18),(.012,.018,.62),black)
        cube("Service handle", (x+.24,y*1.018,1.40),(.15,.027,.033),metal)
    cube("Bumper",(4.68,0,.84),(.14,2.33,.24),black,.06)
    for axle in [-2.9,2.85]:
        # Horizontal axles along Blender Y.
        bpy.ops.mesh.primitive_cylinder_add(vertices=40,radius=.55,depth=.28,location=(axle,side*1.18,.57),rotation=(math.pi/2,0,0))
        tire=bpy.context.object; tire.name="Road wheel"; tire.data.materials.append(rubber)
        for p in tire.data.polygons: p.use_smooth=True
        bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.31,depth=.30,location=(axle,side*1.23,.57),rotation=(math.pi/2,0,0))
        bpy.context.object.data.materials.append(metal)
        for angle in range(0,360,60):
            a=math.radians(angle)
            cube("Wheel lug",(axle+math.cos(a)*.19,side*1.39,.57+math.sin(a)*.19),(.055,.025,.055),black,.01)
    # Projecting mirrors and marker lights.
    cube("Mirror arm",(4.05,side*1.41,2.42),(.12,.42,.10),black,.025)
    cube("Mirror",(4.10,side*1.66,2.29),(.22,.17,.42),black,.045)
    for x in [-4,-1.4,1.5,4]: cube("Side marker",(x,side*1.266,.85),(.15,.025,.06),amber,.01)

# Front windows, LED destination panel, wipers and lower lamps.
cube("Destination panel",(4.635,0,2.58),(.13,1.98,.3),black,.035)
for y in [-.80,-.66,-.52,-.38,-.24,-.10,.04,.18,.32,.46,.60,.74]:
    cube("Front display LED",(4.71,y,2.58),(.025,.065,.13),amber)
for y in [-.56,.56]:
    w=cube("Windscreen wiper",(4.667,y,2.0),(.025,.035,.53),black,.008)
    w.rotation_euler.x=.32
    cube("Headlight surround",(4.71,y*1.45,1.13),(.08,.38,.22),black,.045)
    cube("Headlight",(4.757,y*1.45,1.14),(.027,.26,.105),white,.025)
    cube("Rear light",(-4.70,y*1.65,1.44),(.035,.13,.45),red,.028)
cube("Front badge",(4.735,0,1.42),(.035,.36,.08),metal,.01)
cube("Number plate",(4.76,0,.77),(.022,.48,.13),teal,.01)
for y in [-.7,-.45,-.2,.05,.3,.55]: cube("Rear grille",(-4.705,y,1.85),(.025,.055,.46),black)

# Two passenger doors on the curb side with a split line and handles.
for x in [3.4,-.8]:
    cube("Passenger door",(x,-1.27,1.71),(1.04,.04,2.04),black,.055)
    for dx in [-.255,.255]:
        cube("Door glass",(x+dx,-1.295,1.87),(.42,.02,1.44),glass,.025)
        cube("Door yellow safety strip",(x+dx,-1.31,.83),(.42,.015,.045),amber)
    cube("Door threshold",(x,-1.30,.63),(1.08,.06,.06),metal)

bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"city-bus-v1.blend"))
bpy.ops.export_scene.gltf(filepath=str(OUT/"city-bus-v1.glb"),export_format="GLB",export_yup=True)

# Apply transforms and aggregate by material. Convert Z-up to Three Y-up.
batches={}
deps=bpy.context.evaluated_depsgraph_get()
for obj in bpy.context.scene.objects:
    if obj.type != "MESH": continue
    evaluated=obj.evaluated_get(deps); geo=evaluated.to_mesh(); geo.calc_loop_triangles()
    matrix=obj.matrix_world; normal_matrix=matrix.to_3x3().inverted().transposed()
    for tri in geo.loop_triangles:
        mat=obj.data.materials[tri.material_index]
        batch=batches.setdefault(mat.name,{"positions":[],"normals":[]})
        for vi in tri.vertices:
            v=matrix @ geo.vertices[vi].co
            n=normal_matrix @ tri.normal; n.normalize()
            batch["positions"].extend(round(a,5) for a in (v.x,v.z,-v.y))
            batch["normals"].extend(round(a,5) for a in (n.x,n.z,-n.y))
    evaluated.to_mesh_clear()
for name,batch in batches.items():
    mat=bpy.data.materials[name]; node=mat.node_tree.nodes.get("Principled BSDF")
    batch["color"]=list(mat.diffuse_color[:3])
    batch["roughness"]=node.inputs["Roughness"].default_value
    batch["metalness"]=node.inputs["Metallic"].default_value
    batch["emission"]=node.inputs["Emission Strength"].default_value
payload={"format":"transit-mesh-v1","generator":"Blender "+bpy.app.version_string,"units":"metres","batches":batches}
(OUT/"city-bus-v1.json").write_text(json.dumps(payload,separators=(",",":")),encoding="utf-8")
print("BUS_EXPORT",json.dumps({"batches":len(batches),"triangles":sum(len(b["positions"])//9 for b in batches.values()),"bytes":(OUT/"city-bus-v1.json").stat().st_size}))
