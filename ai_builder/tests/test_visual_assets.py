"""Art assets must remain read-only presentation inputs, not domain state."""
import json
import math
import re
import struct
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from unittest.mock import patch

from ai_builder.runtime_info import source_fingerprint
from ai_builder.scene import EventLog, SceneState
from ai_builder.server import SceneHandler, STATIC_DIR


class VisualAssetTests(unittest.TestCase):
    def setUp(self):
        class Handler(SceneHandler):
            state = SceneState()
            event_log = EventLog()
        self.handler = Handler
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = Thread(target=lambda: self.server.serve_forever(poll_interval=.01), daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def get(self, path):
        connection = HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        try:
            connection.request("GET", path)
            response = connection.getresponse()
            return response.status, response.getheader("Content-Type"), response.read()
        finally:
            connection.close()

    def test_blender_model_has_finite_material_batched_triangles(self):
        status, mime, body = self.get("/assets/models/city-bus-v1.json")
        self.assertEqual(status, 200)
        self.assertIn("application/json", mime)
        model = json.loads(body)
        self.assertEqual(model["format"], "transit-mesh-v1")
        self.assertIn("Blender", model["generator"])
        self.assertEqual(model["units"], "metres")
        triangles = 0
        for batch in model["batches"].values():
            self.assertEqual(len(batch["positions"]), len(batch["normals"]))
            self.assertEqual(len(batch["positions"]) % 9, 0)
            self.assertTrue(all(math.isfinite(x) for x in batch["positions"] + batch["normals"]))
            self.assertTrue(0 <= batch["roughness"] <= 1)
            self.assertTrue(0 <= batch["metalness"] <= 1)
            triangles += len(batch["positions"]) // 9
        self.assertGreater(triangles, 1000)
        self.assertLess(triangles, 30000)

    def test_bus_is_metre_scale_and_y_up(self):
        model = json.loads(self.get("/assets/models/city-bus-v1.json")[2])
        extent = [model["bounds"]["max"][i] - model["bounds"]["min"][i] for i in range(3)]
        self.assertTrue(9 < extent[0] < 11)
        self.assertTrue(3 < extent[1] < 4)
        self.assertTrue(2 < extent[2] < 3.5)
        self.assertGreaterEqual(model["bounds"]["min"][1], -.05)

    def test_three_final_vehicle_models_have_runtime_animation_parts(self):
        for vehicle_type in ("sedan", "suv", "bus"):
            with self.subTest(vehicle_type=vehicle_type):
                status, _, body = self.get(f"/assets/models/city-{vehicle_type}-v1.json")
                self.assertEqual(status, 200)
                model = json.loads(body)
                self.assertEqual(model["vehicle_type"], vehicle_type)
                self.assertIn("original", model["design"])
                self.assertEqual(len(model["wheel_centers"]), 4)
                components = {batch.get("component") for batch in model["batches"].values()}
                self.assertIn("wheel", components)
                self.assertIn("brake_lamp", components)
                self.assertGreater(model["dimensions"]["length"], 4)
                self.assertLess(model["dimensions"]["length"], 10)

    def test_passenger_models_have_game_ready_surface_and_braking_components(self):
        generator = (Path(__file__).resolve().parents[2] / "tools" / "art" / "build_city_vehicles.py").read_text(encoding="utf-8")
        self.assertIn("Coat Weight", generator)
        self.assertIn("tire_tread", generator)
        self.assertIn("brake_caliper", generator)
        self.assertIn("door_gap", generator)
        for vehicle_type in ("sedan", "suv"):
            with self.subTest(vehicle_type=vehicle_type):
                model = json.loads(self.get(f"/assets/models/city-{vehicle_type}-v1.json")[2])
                components = {batch.get("component") for batch in model["batches"].values()}
                self.assertIn("tire_tread", components)
                self.assertIn("brake_caliper", components)
                self.assertIn("door_gap", components)

    def test_vehicle_runtime_has_dynamics_cues_bound_to_traffic_state(self):
        scene3d = (STATIC_DIR / "scene3d.js").read_text(encoding="utf-8")
        urban_world = (STATIC_DIR / "urban-world.js").read_text(encoding="utf-8")
        self.assertIn("wheelSpin", scene3d)
        self.assertIn("steeringAngle", scene3d)
        self.assertIn("bodyDynamics", scene3d)
        self.assertIn("brakeLamps", urban_world)
        self.assertIn("wheelPivots", urban_world)

    def test_final_vehicle_models_export_blender_corner_normals(self):
        generator = (Path(__file__).resolve().parents[2] / "tools" / "art" / "build_city_vehicles.py").read_text(encoding="utf-8")
        bus_generator = (Path(__file__).resolve().parents[2] / "tools" / "art" / "build_city_bus.py").read_text(encoding="utf-8")
        self.assertIn("geo.corner_normals[loop_index].vector", generator)
        self.assertIn("geo.corner_normals[loop_index].vector", bus_generator)
        self.assertIn("polygon.use_smooth = True", generator)
        self.assertIn("count = len(smooth_sections)", generator)
        self.assertIn("faces.append((a + j, b + j, b + next_j, a + next_j))", generator)

        for vehicle_type in ("sedan", "suv", "bus"):
            with self.subTest(vehicle_type=vehicle_type):
                model = json.loads(self.get(f"/assets/models/city-{vehicle_type}-v1.json")[2])
                curved_body_batches = [
                    batch for batch in model["batches"].values()
                    if batch.get("component") == "body"
                    and len({tuple(round(value, 2) for value in batch["normals"][i:i + 3])
                             for i in range(0, len(batch["normals"]), 3)}) >= 100
                ]
                self.assertTrue(curved_body_batches, "the Blender export should retain detailed corner normals")

    def test_glb_export_is_complete_gltf_2(self):
        status, mime, body = self.get("/assets/models/city-bus-v1.glb")
        self.assertEqual(status, 200)
        self.assertEqual(mime, "model/gltf-binary")
        self.assertEqual(struct.unpack("<4sII", body[:12]), (b"glTF", 2, len(body)))

    def test_generated_textures_are_served_as_png(self):
        for name in ("asphalt", "limestone"):
            with self.subTest(name=name):
                status, mime, body = self.get(f"/assets/textures/{name}-ai-v1.png?v=test")
                self.assertEqual((status, mime), (200, "image/png"))
                self.assertTrue(body.startswith(b"\x89PNG\r\n\x1a\n"))
                width, height = struct.unpack(">II", body[16:24])
                self.assertGreaterEqual(min(width, height), 1024)

    def test_asset_downloads_do_not_change_state_or_event_log(self):
        before = self.handler.state.snapshot()
        for path in ("urban-world.js", "models/city-bus-v1.json", "textures/asphalt-ai-v1.png"):
            self.assertEqual(self.get("/assets/" + path)[0], 200)
        self.assertEqual(self.handler.state.snapshot(), before)
        self.assertEqual(self.handler.event_log.events, [])

    def test_art_source_and_traversal_are_not_public_routes(self):
        for path in ("/assets/models/city-bus-v1.blend", "/assets/../scene.py", "/assets/models/missing.json"):
            self.assertEqual(self.get(path)[0], 404)

    def test_texture_changes_change_runtime_fingerprint(self):
        with patch.object(Path, "read_bytes", return_value=b"same"):
            baseline = source_fingerprint()
        def contents(path):
            return b"different" if path.name == "asphalt-ai-v1.png" else b"same"
        with patch.object(Path, "read_bytes", contents):
            self.assertNotEqual(source_fingerprint(), baseline)

    def test_city_and_reflector_modules_have_explicit_javascript_mime(self):
        for path in ("/assets/urban-world.js", "/assets/traffic-controller.mjs", "/assets/weather-view.js", "/assets/vendor/Reflector.js"):
            status, mime, body = self.get(path)
            self.assertEqual(status, 200)
            self.assertIn("text/javascript", mime)
            self.assertNotIn(b"from 'three';", body)

    def test_runtime_art_payload_stays_below_ten_megabytes(self):
        files = [STATIC_DIR / "models/city-bus-v1.json", *sorted((STATIC_DIR / "textures").glob("*-ai-v1.png"))]
        self.assertLess(sum(path.stat().st_size for path in files), 10_000_000)

    def test_all_browser_vehicle_payloads_fit_initial_asset_budget(self):
        files = [*(STATIC_DIR / "models" / f"city-{kind}-v1.json" for kind in ("sedan", "suv", "bus")),
                 *sorted((STATIC_DIR / "textures").glob("*-ai-v1.png"))]
        self.assertLess(sum(path.stat().st_size for path in files), 25_000_000)

    def test_signal_state_has_non_color_visual_and_text_cues(self):
        scene3d = (STATIC_DIR / "scene3d.js").read_text(encoding="utf-8")
        app = (STATIC_DIR / "app.js").read_text(encoding="utf-8")
        page = (STATIC_DIR / "index.html").read_text(encoding="utf-8")
        self.assertIn("STOP", scene3d)
        self.assertIn("GO", scene3d)
        self.assertIn("signalState", app)
        self.assertIn('aria-live="polite"', page)

    def test_fog_keeps_the_near_intersection_visible(self):
        source = (STATIC_DIR / "weather-view.js").read_text(encoding="utf-8")
        match = re.search(r"fog:\s*\[0x[0-9a-f]+,\s*(\d+),\s*(\d+)", source)
        self.assertIsNotNone(match)
        near, far = map(int, match.groups())
        self.assertGreaterEqual(near, 35, "fog should not wash out the junction around the default camera")
        self.assertGreaterEqual(far, 160, "the fog should fade distant blocks without hiding the road")
        self.assertGreater(far - near, 100)

    def test_snow_weather_toggles_surface_accumulation_and_falling_flakes(self):
        world = (STATIC_DIR / "urban-world.js").read_text(encoding="utf-8")
        weather = (STATIC_DIR / "weather-view.js").read_text(encoding="utf-8")
        self.assertIn("world.snowSurfaces = []", world)
        self.assertIn("snowCover(", world)
        self.assertIn("snow.visible = this.weather === \"snow\"", weather)
        self.assertIn("surface.visible = this.weather === \"snow\"", weather)


if __name__ == "__main__":
    unittest.main()
