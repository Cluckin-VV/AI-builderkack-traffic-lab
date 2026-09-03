import unittest
from pathlib import Path

from ai_builder.server import resolve_bind_address


ROOT = Path(__file__).resolve().parents[2]


class DeploymentConfigTests(unittest.TestCase):
    def test_local_bind_address_remains_loopback(self):
        self.assertEqual(resolve_bind_address({}), ("127.0.0.1", 8000))

    def test_render_port_uses_public_bind_address(self):
        self.assertEqual(resolve_bind_address({"PORT": "10000"}), ("0.0.0.0", 10000))

    def test_explicit_host_and_port_override_defaults(self):
        self.assertEqual(
            resolve_bind_address({"AI_BUILDER_HOST": "127.0.0.2", "AI_BUILDER_PORT": "9000"}),
            ("127.0.0.2", 9000),
        )

    def test_invalid_port_is_rejected(self):
        for value in ("not-a-port", "0", "65536"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                resolve_bind_address({"PORT": value})

    def test_render_blueprint_uses_guarded_standard_library_server(self):
        blueprint = (ROOT / "render.yaml").read_text(encoding="utf-8")
        self.assertIn("runtime: python", blueprint)
        self.assertIn("startCommand: python -m ai_builder.server", blueprint)
        self.assertIn("healthCheckPath: /health", blueprint)
        self.assertIn('autoDeployTrigger: "off"', blueprint)
        self.assertNotIn("maxShutdownDelaySeconds", blueprint)
        self.assertNotIn("OPENAI_API_KEY", blueprint)

    def test_python_runtime_is_pinned(self):
        self.assertEqual((ROOT / ".python-version").read_text(encoding="utf-8").strip(), "3.13.5")


if __name__ == "__main__":
    unittest.main()
