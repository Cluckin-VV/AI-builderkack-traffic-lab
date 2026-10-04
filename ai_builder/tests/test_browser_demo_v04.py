import json
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from threading import Thread

from ai_builder.model_adapter import FakeModelAdapter
from ai_builder.runtime_info import get_runtime_identity
from ai_builder.scene import EventLog, SceneState
from ai_builder.server import SceneHandler


class BrowserDemoV04Tests(unittest.TestCase):
    def setUp(self):
        SceneHandler.state = SceneState()
        SceneHandler.event_log = EventLog()
        SceneHandler.adapter = FakeModelAdapter()
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), SceneHandler)
        self.thread = Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()

    def get(self, path):
        connection = HTTPConnection("127.0.0.1", self.server.server_port)
        connection.request("GET", path)
        response = connection.getresponse()
        body = response.read()
        return response, body

    def test_page_is_webgl_world_builder(self):
        response, body = self.get("/")
        page = body.decode("utf-8")
        self.assertEqual(response.status, 200)
        self.assertIn("LIVE WEBGL WORLD", page)
        self.assertIn("/assets/app.js", page)
        self.assertIn("/assets/app.css?v=", page)
        self.assertIn("SceneAction v0.3", page)
        self.assertNotIn("getContext('2d')", page)
        self.assertIn("NEXUS CROSSING", page)
        self.assertIn("让天气下暴雪", page)
        self.assertIn("让天气下陨石", page)

    def test_static_assets_have_explicit_content_types(self):
        expected = {
            "/assets/app.css": "text/css",
            "/assets/app.js": "text/javascript",
            "/assets/scene3d.js": "text/javascript",
            "/assets/traffic-controller.mjs": "text/javascript",
            "/assets/weather-view.js": "text/javascript",
            "/assets/atmosphere-profile.mjs": "text/javascript",
            "/assets/road-markings.mjs": "text/javascript",
        }
        for path, content_type in expected.items():
            with self.subTest(path=path):
                response, body = self.get(path)
                self.assertEqual(response.status, 200)
                self.assertIn(content_type, response.getheader("Content-Type"))
                self.assertTrue(body)

    def test_state_endpoint_hydrates_renderer_without_mutation(self):
        before = SceneHandler.state.snapshot()
        response, body = self.get("/api/state")
        payload = json.loads(body)
        self.assertEqual(response.status, 200)
        self.assertEqual(payload["scene"]["bus_count"], 0)
        self.assertTrue(payload["scene"]["bus_running"])
        self.assertEqual(payload["scene"]["projection"], "perspective")
        self.assertEqual(payload["scene"]["road"]["layout"], "crossroads")
        self.assertEqual(payload["scene"]["weather"], "clear")
        self.assertEqual(SceneHandler.state.snapshot(), before)

    def test_runtime_version_is_consistent_between_health_and_page(self):
        _, health_body = self.get("/health")
        _, page_body = self.get("/")
        health = json.loads(health_body)
        page = page_body.decode("utf-8")
        self.assertEqual(health["app_version"], "0.8.0")
        self.assertEqual(health["scene_action_version"], "0.3")
        self.assertIn(f"App v{health['app_version']}", page)
        self.assertIn(f"Build <b>{health['source_fingerprint']}</b>", page)

    def test_page_responses_include_security_headers(self):
        response, _ = self.get("/")
        self.assertEqual(response.getheader("X-Content-Type-Options"), "nosniff")
        self.assertEqual(response.getheader("X-Frame-Options"), "DENY")
        self.assertIn("cdn.jsdelivr.net", response.getheader("Content-Security-Policy"))

    def test_desktop_stage_is_bounded_and_tablet_uses_two_columns(self):
        _, body = self.get("/assets/app.css")
        source = body.decode("utf-8")
        self.assertIn("height: calc(100vh - 108px);", source)
        self.assertIn("overflow-y: auto;", source)
        self.assertIn("height: 100%;", source)
        self.assertIn("max-width: 1500px", source)
        self.assertIn("grid-template-columns: 280px minmax(500px, 1fr);", source)
        self.assertIn("height: auto;", source)

    def test_browser_javascript_uses_command_endpoint_not_direct_state_write(self):
        _, body = self.get("/assets/app.js")
        source = body.decode("utf-8")
        self.assertIn('fetch("/command"', source)
        self.assertIn("/assets/scene3d.js?v=", source)
        self.assertIn("/assets/scene-editor.mjs?v=", source)
        self.assertNotIn("state.apply", source)

    def test_editor_module_uses_fingerprint_and_unversioned_assets_revalidate(self):
        fingerprint = get_runtime_identity().source_fingerprint
        response, body = self.get(f"/assets/scene-editor.mjs?v={fingerprint}")
        self.assertEqual(response.status, 200)
        self.assertIn("immutable", response.getheader("Cache-Control"))
        self.assertIn("counts.sedan", body.decode("utf-8"))
        unversioned, _ = self.get("/assets/scene-editor.mjs")
        self.assertEqual(unversioned.getheader("Cache-Control"), "no-cache")

    def test_manual_signal_copy_matches_safe_green_yellow_and_red_behavior(self):
        _, body = self.get("/assets/app.js")
        source = body.decode("utf-8")
        self.assertIn("仅东西直行与右转放行", source)
        self.assertIn("全向黄灯警示 · 停止线停车 / 路口内清空", source)
        self.assertIn("全红 · 所有车辆停车", source)
        self.assertIn('allCaution ? "CAUTION_ALL"', source)

    def test_fingerprinted_static_asset_url_is_served(self):
        _, page_body = self.get("/")
        page = page_body.decode("utf-8")
        marker = '/assets/app.css?v='
        start = page.index(marker)
        url = page[start:page.index('"', start)]
        response, body = self.get(url)
        self.assertEqual(response.status, 200)
        self.assertIn("text/css", response.getheader("Content-Type"))
        self.assertTrue(body)

    def test_threejs_dependency_is_version_pinned(self):
        _, body = self.get("/assets/scene3d.js")
        source = body.decode("utf-8")
        self.assertIn("three@0.180.0", source)
        self.assertNotIn("three@latest", source)

    def test_renderer_delegates_motion_rules_to_traffic_controller(self):
        _, body = self.get("/assets/scene3d.js")
        source = body.decode("utf-8")
        self.assertIn("TrafficController", source)
        self.assertIn("traffic.advance", source)
        self.assertNotIn("userData.phase +=", source)

    def test_traffic_controller_is_browser_local_and_has_no_server_write(self):
        _, body = self.get("/assets/traffic-controller.mjs")
        source = body.decode("utf-8")
        self.assertIn("red_light", source)
        self.assertIn("manual_stop", source)
        self.assertNotIn("fetch(", source)
        self.assertNotIn("state.apply", source)


if __name__ == "__main__":
    unittest.main()
