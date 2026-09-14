"""Runtime identity shared by health checks, the page, and Event Log."""

import hashlib
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict


APP_VERSION = "0.5.0"
COMMAND_PROTOCOL_VERSION = "0.3"
SCENE_ACTION_VERSION = "0.2"
_PROJECT_ROOT = Path(__file__).resolve().parent


def source_fingerprint() -> str:
    digest = hashlib.sha256()
    for name in (
        "scene.py",
        "server.py",
        "model_adapter.py",
        "static/index.html",
        "static/app.css",
        "static/app.js",
        "static/scene3d.js",
        "static/urban-world.js",
        "static/traffic-controller.mjs",
        "static/weather-view.js",
        "static/vendor/Reflector.js",
        "static/models/city-bus-v1.json",
        "static/textures/asphalt-ai-v1.png",
        "static/textures/limestone-ai-v1.png",
    ):
        path = _PROJECT_ROOT / name
        digest.update(name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()[:12]


def _git_commit() -> str:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=str(_PROJECT_ROOT.parent), capture_output=True, text=True, timeout=2,
        )
        value = result.stdout.strip()
        return value if result.returncode == 0 and value else "uncommitted"
    except (OSError, subprocess.SubprocessError):
        return "unavailable"


@dataclass(frozen=True)
class RuntimeIdentity:
    app_version: str
    command_protocol_version: str
    scene_action_version: str
    started_at: str
    source_fingerprint: str
    git_commit: str

    def as_dict(self) -> Dict[str, str]:
        return {
            "app_version": self.app_version,
            "command_protocol_version": self.command_protocol_version,
            "scene_action_version": self.scene_action_version,
            "started_at": self.started_at,
            "source_fingerprint": self.source_fingerprint,
            "git_commit": self.git_commit,
        }


_IDENTITY = RuntimeIdentity(
    app_version=APP_VERSION,
    command_protocol_version=COMMAND_PROTOCOL_VERSION,
    scene_action_version=SCENE_ACTION_VERSION,
    started_at=datetime.now(timezone.utc).isoformat(),
    source_fingerprint=source_fingerprint(),
    git_commit=_git_commit(),
)


def get_runtime_identity() -> RuntimeIdentity:
    return _IDENTITY
