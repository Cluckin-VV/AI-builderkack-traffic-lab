"""Art assets must remain read-only presentation inputs, not domain state."""
import json
import math
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
        positions = [v for b in model["batches"].values() for v in b["positions"]]
        extent = [max(positions[i::3]) - min(positions[i::3]) for i in range(3)]
        self.assertTrue(9 < extent[0] < 11)
        self.assertTrue(3 < extent[1] < 4)
        self.assertTrue(2 < extent[2] < 3.5)
        self.assertGreaterEqual(min(positions[1::3]), -.05)

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


if __name__ == "__main__":
    unittest.main()
