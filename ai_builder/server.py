"""Standard-library HTTP host for the browser-native AI Builder demo."""

import json
from html import escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from typing import Any, Dict
from urllib.parse import urlsplit

from ai_builder.model_adapter import FakeModelAdapter, ModelAdapter, run_model_command
from ai_builder.runtime_info import get_runtime_identity
from ai_builder.scene import EventLog, Renderer, SceneState


STATIC_DIR = Path(__file__).resolve().parent / "static"
PAGE = (STATIC_DIR / "index.html").read_text(encoding="utf-8")
STATIC_FILES = {
    "/assets/app.css": ("text/css; charset=utf-8", STATIC_DIR / "app.css"),
    "/assets/app.js": ("text/javascript; charset=utf-8", STATIC_DIR / "app.js"),
    "/assets/scene3d.js": ("text/javascript; charset=utf-8", STATIC_DIR / "scene3d.js"),
}


class SceneHandler(BaseHTTPRequestHandler):
    """Expose the guarded model pipeline and read-only render state."""

    state = SceneState()
    event_log = EventLog()
    adapter: ModelAdapter = FakeModelAdapter()
    command_lock = Lock()

    @staticmethod
    def page() -> str:
        identity = get_runtime_identity().as_dict()
        page = PAGE
        for key, value in identity.items():
            page = page.replace("{{" + key + "}}", escape(value))
        return page

    @classmethod
    def scene_payload(cls) -> Dict[str, Any]:
        renderer = Renderer()
        return {**renderer.render_data(cls.state), **cls.state.snapshot()}

    def _send_bytes(self, body: bytes, content_type: str, status: int = 200, *, cache: str = "no-store") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache)
        self.end_headers()
        self.wfile.write(body)

    def _send_json(self, payload: Dict[str, Any], status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self._send_bytes(body, "application/json; charset=utf-8", status)

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; "
            "style-src 'self'; img-src 'self' data:; connect-src 'self'; "
            "font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        )
        super().end_headers()

    def do_GET(self) -> None:
        request_path = urlsplit(self.path).path
        if request_path == "/health":
            self._send_json(get_runtime_identity().as_dict())
            return
        if request_path == "/api/state":
            self._send_json({
                "status": "ready",
                "scene": self.scene_payload(),
                "last_event": self.event_log.events[-1] if self.event_log.events else None,
                "runtime": get_runtime_identity().as_dict(),
            })
            return
        if request_path in STATIC_FILES:
            content_type, path = STATIC_FILES[request_path]
            self._send_bytes(path.read_bytes(), content_type, cache="public, max-age=3600")
            return
        if request_path not in {"/", "/index.html"}:
            self.send_error(404)
            return
        self._send_bytes(self.page().encode("utf-8"), "text/html; charset=utf-8")

    def do_POST(self) -> None:
        if self.path != "/command":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        if length > 16_384:
            self._send_json({"status": "rejected", "reason": "request too large", "scene": self.scene_payload()}, 413)
            return
        try:
            payload: Dict[str, Any] = json.loads(self.rfile.read(length))
            command = payload.get("command", "")
            if not isinstance(command, str):
                raise TypeError("command must be text")
            with self.command_lock:
                result = run_model_command(self.adapter, command.strip(), self.state, self.event_log)
                result["event"]["runtime_fingerprint"] = get_runtime_identity().source_fingerprint
            self._send_json(result)
        except (ValueError, TypeError, json.JSONDecodeError):
            self._send_json({
                "status": "rejected",
                "reason": "invalid request",
                "scene": self.scene_payload(),
                "event": None,
            }, 400)

    def log_message(self, format: str, *args: Any) -> None:
        return


def run(host: str = "127.0.0.1", port: int = 8000) -> None:
    server = ThreadingHTTPServer((host, port), SceneHandler)
    print(f"AI Builder Traffic Lab: http://{host}:{port}")
    print(f"Runtime fingerprint: {get_runtime_identity().source_fingerprint}")
    server.serve_forever()


if __name__ == "__main__":
    run()
