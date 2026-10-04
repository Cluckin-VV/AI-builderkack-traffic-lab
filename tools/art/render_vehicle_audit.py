"""Render a repeatable close-up audit image for the two passenger assets.

Usage:
  blender --background --python tools/art/render_vehicle_audit.py -- sedan
  blender --background --python tools/art/render_vehicle_audit.py -- suv

This is an inspection tool only; it does not alter the browser asset format.
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / "ai_builder" / "static" / "models"
OUTPUT = ROOT / "output" / "playwright"


def look_at(camera, target):
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()


def material(name, color, metallic=0.0, roughness=.45):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*color, 1.0)
    value.use_nodes = True
    node = value.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value = (*color, 1.0)
    node.inputs["Metallic"].default_value = metallic
    node.inputs["Roughness"].default_value = roughness
    return value


def render(kind):
    filepath = MODELS / f"city-{kind}-v1.blend"
    bpy.ops.wm.open_mainfile(filepath=str(filepath))
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 680
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.filepath = str(OUTPUT / f"vehicle-{kind}-realism-audit.png")
    scene.world.color = (0.018, 0.024, 0.030)

    ground_material = material("Audit asphalt", (0.035, 0.045, 0.052), 0.05, .62)
    bpy.ops.mesh.primitive_plane_add(size=24, location=(0, 0, 0))
    ground = bpy.context.object
    ground.name = "Audit ground"
    ground.data.materials.append(ground_material)

    bpy.ops.object.light_add(type="AREA", location=(3.8, -4.6, 7.5))
    key = bpy.context.object
    key.data.energy = 1050
    key.data.shape = "DISK"
    key.data.size = 5.0
    look_at(key, (0, 0, .7))
    bpy.ops.object.light_add(type="AREA", location=(-4.0, 3.0, 4.0))
    fill = bpy.context.object
    fill.data.energy = 600
    fill.data.size = 4.0
    look_at(fill, (0, 0, .8))
    bpy.ops.object.light_add(type="AREA", location=(1.0, 5.0, 2.2))
    rim = bpy.context.object
    rim.data.energy = 420
    rim.data.size = 3.0
    look_at(rim, (0, 0, 1.0))

    bpy.ops.object.camera_add(location=(7.2, -7.0, 4.1))
    camera = bpy.context.object
    camera.data.lens = 54
    camera.data.sensor_width = 36
    look_at(camera, (0, 0, .86))
    scene.camera = camera

    bpy.ops.render.render(write_still=True)
    print("AUDIT_RENDER", kind, scene.render.filepath)


args = [arg for arg in sys.argv[sys.argv.index("--") + 1:] if arg] if "--" in sys.argv else []
render(args[0] if args and args[0] in {"sedan", "suv"} else "sedan")
