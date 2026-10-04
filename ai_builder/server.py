"""Standard-library HTTP host for the browser-native AI Builder demo."""

import json
import os
from html import escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from typing import Any, Dict, Mapping, Optional, Tuple
from urllib.parse import urlsplit
from uuid import uuid4

from ai_builder.model_adapter import FakeModelAdapter, ModelAdapter, run_model_command
from ai_builder.runtime_info import get_runtime_identity
from ai_builder.scene import EventLog, Renderer, SceneState
from ai_builder.scene_history import SceneHistory
from ai_builder.scene_plan import (
    DeterministicScenePlanner,
    PendingPlanStore,
    execute_pending_plan,
    preview_scene_plan,
)


STATIC_DIR = Path(__file__).resolve().parent / "static"
PAGE = (STATIC_DIR / "index.html").read_text(encoding="utf-8")
STATIC_FILES = {
    "/assets/scene-layouts.json": ("application/json", STATIC_DIR.parent / "scene_layouts.json"),
    "/assets/vendor/Reflector.js": ("text/javascript; charset=utf-8", STATIC_DIR / "vendor/Reflector.js"),
    "/assets/app.css": ("text/css; charset=utf-8", STATIC_DIR / "app.css"),
    "/assets/app.js": ("text/javascript; charset=utf-8", STATIC_DIR / "app.js"),
    "/assets/scene-editor.mjs": ("text/javascript; charset=utf-8", STATIC_DIR / "scene-editor.mjs"),
    "/assets/scene3d.js": ("text/javascript; charset=utf-8", STATIC_DIR / "scene3d.js"),
    "/assets/urban-world.js": ("text/javascript; charset=utf-8", STATIC_DIR / "urban-world.js"),
    "/assets/traffic-controller.mjs": ("text/javascript; charset=utf-8", STATIC_DIR / "traffic-controller.mjs"),
    "/assets/weather-view.js": ("text/javascript; charset=utf-8", STATIC_DIR / "weather-view.js"),
    "/assets/atmosphere-profile.mjs": ("text/javascript; charset=utf-8", STATIC_DIR / "atmosphere-profile.mjs"),
    "/assets/road-markings.mjs": ("text/javascript; charset=utf-8", STATIC_DIR / "road-markings.mjs"),
    "/assets/models/city-bus-v1.json": ("application/json", STATIC_DIR / "models/city-bus-v1.json"),
    "/assets/models/city-bus-v1.glb": ("model/gltf-binary", STATIC_DIR / "models/city-bus-v1.glb"),
    "/assets/models/city-sedan-v1.json": ("application/json", STATIC_DIR / "models/city-sedan-v1.json"),
    "/assets/models/city-sedan-v1.glb": ("model/gltf-binary", STATIC_DIR / "models/city-sedan-v1.glb"),
    "/assets/models/city-suv-v1.json": ("application/json", STATIC_DIR / "models/city-suv-v1.json"),
    "/assets/models/city-suv-v1.glb": ("model/gltf-binary", STATIC_DIR / "models/city-suv-v1.glb"),
    "/assets/textures/asphalt-ai-v1.png": ("image/png", STATIC_DIR / "textures/asphalt-ai-v1.png"),
    "/assets/textures/limestone-ai-v1.png": ("image/png", STATIC_DIR / "textures/limestone-ai-v1.png"),
}


class SceneHandler(BaseHTTPRequestHandler):
    """Expose the guarded model pipeline and read-only render state."""

    state = SceneState()
    event_log = EventLog()
    adapter: ModelAdapter = FakeModelAdapter()
    planner = DeterministicScenePlanner()
    plan_store = PendingPlanStore()
    history = SceneHistory()
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
            with self.command_lock:
                response = {"status": "ready", "scene": self.scene_payload(),
                            "last_event": self.event_log.events[-1] if self.event_log.events else None,
                            "runtime": get_runtime_identity().as_dict(), "undo": self.history.status(self.state)}
            self._send_json(response)
            return
        if request_path in STATIC_FILES:
            content_type, path = STATIC_FILES[request_path]
            cache = "public, max-age=31536000, immutable" if urlsplit(self.path).query else "no-cache"
            self._send_bytes(path.read_bytes(), content_type, cache=cache)
            return
        if request_path not in {"/", "/index.html"}:
            self.send_error(404)
            return
        self._send_bytes(self.page().encode("utf-8"), "text/html; charset=utf-8")

    def _preview_response(self, preview, plan=None, command=""):
        """Capture projected and live state under the caller's command lock."""
        projected = preview.get("projected_state", self.state.snapshot())
        response = {**preview, "scene": self.scene_payload(),
                    "projected_scene": {**Renderer().render_data(SceneState(**projected)), **projected},
                    "undo": self.history.status(self.state)}
        if plan is not None:
            response["plan"] = plan
            command = plan["source_command"]
        if preview["status"] == "rejected":
            event = {"event_type": "scene_plan_preview", "command": command, "source_command": command,
                     "status": "rejected", "validation_stage": preview.get("validation_stage", "candidate"),
                     "error_code": preview.get("error_code"),
                     "rejected_reason": preview.get("reason", preview.get("error_code")),
                     "state_before": self.state.snapshot(), "state_after": self.state.snapshot(),
                     "runtime_fingerprint": get_runtime_identity().source_fingerprint}
            self.event_log.append(event)
            response["event"] = event
        return response

    def do_POST(self) -> None:
        if self.path not in {"/command", "/plan/preview", "/plan/execute", "/plan/cancel", "/history/undo-preview"}:
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 0:
                raise ValueError("negative length")
            if length > 16_384:
                self._send_json({"status": "rejected", "reason": "request too large", "scene": self.scene_payload()}, 413)
                return
            payload: Dict[str, Any] = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                raise TypeError("request must be an object")
            command = payload.get("command", "")
            if self.path == "/command":
                if not isinstance(command, str):
                    raise TypeError("command must be text")
                with self.command_lock:
                    before = self.state.snapshot()
                    result = run_model_command(self.adapter, command.strip(), self.state, self.event_log)
                    result["event"]["runtime_fingerprint"] = get_runtime_identity().source_fingerprint
                    if result["status"] == "accepted":
                        self.plan_store.clear()
                        self.history.record(command, before, self.state.snapshot())
                    result["undo"] = self.history.status(self.state)
                self._send_json(result)
                return
            if self.path == "/plan/preview":
                if not isinstance(command, str):
                    raise TypeError("command must be text")
                candidate = self.planner.try_generate_plan(command.strip())
                with self.command_lock:
                    if candidate["status"] == "rejected":
                        response = self._preview_response(candidate, command=command)
                    else:
                        plan = candidate["plan"]
                        plan["plan_id"] = uuid4().hex  # Each confirmation belongs to one preview.
                        preview = preview_scene_plan(plan, self.state)
                        if preview["status"] == "preview_ready":
                            self.plan_store.put(plan, preview, self.state)
                        response = self._preview_response(preview, plan)
                self._send_json(response, 200 if response["status"] == "preview_ready" else 422)
                return
            if self.path == "/history/undo-preview":
                if set(payload) != {"change_id"} or not isinstance(payload["change_id"], str):
                    raise TypeError("only a saved change_id is accepted")
                with self.command_lock:
                    preview = self.history.prepare_undo(payload["change_id"], self.state, self.plan_store)
                    response = self._preview_response(preview, preview.get("plan"), command="撤销上一次修改")
                self._send_json(response, 200 if response["status"] == "preview_ready" else 409)
                return
            plan_id = payload.get("plan_id", "")
            if not isinstance(plan_id, str) or not plan_id:
                raise TypeError("plan_id must be text")
            if self.path == "/plan/cancel":
                with self.command_lock:
                    self.plan_store.pop(plan_id)
                self._send_json({"status": "cancelled", "plan_id": plan_id})
                return
            with self.command_lock:
                result = execute_pending_plan(plan_id, self.state, self.plan_store)
                if result["status"] == "accepted":
                    self.plan_store.clear()
                    if result.get("undo_of"):
                        self.history.finish_undo(result["undo_of"])
                    else:
                        self.history.record(result["source_command"], result["state_before"], result["state_after"])
                event = {
                    "event_type": "scene_plan_undo" if result.get("undo_of") else "scene_plan_execution",
                    "undo_of": result.get("undo_of"),
                    "plan_id": plan_id,
                    "action_id": plan_id,
                    "protocol_version": "0.3",
                    "command": result.get("source_command", "confirmed scene plan"),
                    "source_command": result.get("source_command", "confirmed scene plan"),
                    "action_type": "scene_plan",
                    "status": result["status"],
                    "validation_stage": result.get("validation_stage", "execution"),
                    "steps": result.get("steps", []),
                    "applied_action_count": result.get("applied_action_count", 0),
                    "state_before": result["state_before"],
                    "state_after": result["state_after"],
                    "error_code": result.get("error_code"),
                    "rejected_reason": result.get("error_code") if result["status"] == "rejected" else None,
                    "runtime_fingerprint": get_runtime_identity().source_fingerprint,
                }
                self.event_log.append(event)
                response = {**result, "scene": self.scene_payload(), "event": event, "undo": self.history.status(self.state)}
            self._send_json(response, 200 if result["status"] == "accepted" else 409)
        except (ValueError, TypeError, json.JSONDecodeError):
            self._send_json({
                "status": "rejected",
                "reason": "invalid request",
                "scene": self.scene_payload(),
                "event": None,
            }, 400)

    def log_message(self, format: str, *args: Any) -> None:
        return


def resolve_bind_address(environ: Optional[Mapping[str, str]] = None) -> Tuple[str, int]:
    """Resolve a local-safe address or Render's public ``0.0.0.0:$PORT`` contract."""
    values = os.environ if environ is None else environ
    render_port = values.get("PORT")
    raw_port = render_port or values.get("AI_BUILDER_PORT", "8000")
    try:
        port = int(raw_port)
    except (TypeError, ValueError) as error:
        raise ValueError("server port must be an integer between 1 and 65535") from error
    if not 1 <= port <= 65535:
        raise ValueError("server port must be an integer between 1 and 65535")
    host = values.get("AI_BUILDER_HOST") or ("0.0.0.0" if render_port else "127.0.0.1")
    return host, port


def run(host: str = "127.0.0.1", port: int = 8000) -> None:
    server = ThreadingHTTPServer((host, port), SceneHandler)
    print(f"AI Builder Traffic Lab: http://{host}:{port}")
    print(f"Runtime fingerprint: {get_runtime_identity().source_fingerprint}")
    try:
        server.serve_forever()
    finally:
        server.server_close()


def main() -> None:
    host, port = resolve_bind_address()
    if not SceneHandler.state.vehicles and SceneHandler.state.buses == 0:
        SceneHandler.state = SceneState.demo()
    try:
        run(host, port)
    except KeyboardInterrupt:
        print("\nAI Builder Traffic Lab stopped.")


if __name__ == "__main__":
    main()
