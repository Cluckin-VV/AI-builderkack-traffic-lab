import json
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from threading import Thread

from ai_builder.runtime_info import get_runtime_identity, source_fingerprint
from ai_builder.server import SceneHandler


class RuntimeIdentityTests(unittest.TestCase):
    def test_identity_has_required_fields(self):
        identity = get_runtime_identity()
        for field in ("app_version", "command_protocol_version", "scene_action_version", "started_at", "source_fingerprint", "git_commit"):
            self.assertTrue(getattr(identity, field))

    def test_fingerprint_is_stable_short_hex(self):
        first = source_fingerprint()
        second = source_fingerprint()
        self.assertEqual(first, second)
        self.assertRegex(first, r"^[0-9a-f]{8,12}$")

    def test_health_endpoint_returns_runtime_identity(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), SceneHandler)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            connection = HTTPConnection("127.0.0.1", server.server_port)
            connection.request("GET", "/health")
            response = connection.getresponse()
            payload = json.loads(response.read())
            self.assertEqual(response.status, 200)
            self.assertEqual(payload["source_fingerprint"], get_runtime_identity().source_fingerprint)
            self.assertEqual(payload["command_protocol_version"], "0.3")
        finally:
            server.shutdown()
            server.server_close()

    def test_page_contains_runtime_identity_labels(self):
        self.assertIn("App v0.3.0", SceneHandler.page())
        self.assertIn("Command Protocol v0.3", SceneHandler.page())
        self.assertIn("SceneAction v0.1", SceneHandler.page())
        self.assertIn("Source Fingerprint", SceneHandler.page())
        self.assertIn("Started At", SceneHandler.page())

    def test_event_log_contains_runtime_fingerprint(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), SceneHandler)
        SceneHandler.state = __import__("ai_builder.scene", fromlist=["SceneState"]).SceneState()
        SceneHandler.event_log = __import__("ai_builder.scene", fromlist=["EventLog"]).EventLog()
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            connection = HTTPConnection("127.0.0.1", server.server_port)
            body = json.dumps({"command": "增加一辆公交车"}, ensure_ascii=False).encode("utf-8")
            connection.request("POST", "/command", body, {"Content-Type": "application/json"})
            event = json.loads(connection.getresponse().read())["event"]
            self.assertEqual(event["runtime_fingerprint"], get_runtime_identity().source_fingerprint)
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    unittest.main()
