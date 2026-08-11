"""Offline model-output boundary for the SceneAction protocol."""

import json
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

from ai_builder.scene import EventLog, Renderer, SceneAction, SceneCompiler, SceneState, ValidationResult, Validator


class ModelAdapter(ABC):
    @abstractmethod
    def generate_action(self, command: str) -> dict:
        """Return a candidate SceneAction-shaped object; never mutate state."""
        raise NotImplementedError


class FakeModelAdapter(ModelAdapter):
    def __init__(self, mode: str = "valid", raw_output: Optional[str] = None) -> None:
        self.mode = mode
        self.raw_output = raw_output

    def generate_action(self, command: str) -> dict:
        if self.raw_output is not None:
            return self.raw_output  # type: ignore[return-value]  # deliberate malformed-output test hook
        if self.mode == "invalid_json":
            return "{not valid json"  # type: ignore[return-value]
        if self.mode == "missing_field":
            return {"version": "0.1", "action_type": "add_bus"}
        if self.mode == "unknown_action":
            return {"version": "0.1", "action_type": "teleport", "target": "road", "parameters": {}, "source_command": command, "action_id": "fake-unknown"}
        if self.mode == "illegal_color":
            return {"version": "0.1", "action_type": "set_traffic_light", "target": "traffic_light", "parameters": {"color": "蓝灯"}, "source_command": command, "action_id": "fake-color"}
        if self.mode == "combined_action":
            return {"version": "0.1", "action_type": "add_bus_and_set_light", "target": "scene", "parameters": {"color": "红灯"}, "source_command": command, "action_id": "fake-combined"}
        compiled = SceneCompiler().compile(command)
        if compiled is not None:
            return compiled.to_dict()
        return {"version": "0.1", "action_type": "unknown", "target": "scene", "parameters": {}, "source_command": command, "action_id": "fake-unknown-command"}


def _event(command: str, action: Optional[SceneAction], validation: ValidationResult, before: Dict[str, Any], after: Dict[str, Any], rejected_reason: Optional[str], raw: Any) -> Dict[str, Any]:
    return {
        "action_id": action.action_id if action else "",
        "source_command": command,
        "action": action.to_dict() if action else raw,
        "action_protocol": action.to_dict() if action else (raw if isinstance(raw, dict) else None),
        "validation_result": validation.as_dict(),
        "state_before": before,
        "state_after": after,
        "rejected_reason": rejected_reason,
        "command": command,
        "validation": {"status": validation.status, "reason": validation.reason},
        "state_change": {"before": before, "after": after},
    }


def run_model_command(adapter: ModelAdapter, command: str, state: SceneState, event_log: EventLog) -> Dict[str, Any]:
    """Execute model output through JSON -> SceneAction -> Validator -> State."""
    renderer = Renderer()
    before = state.snapshot()
    raw = adapter.generate_action(command)
    action: Optional[SceneAction] = None
    validation: ValidationResult
    action_json = raw if isinstance(raw, str) else json.dumps(raw, ensure_ascii=False, sort_keys=True)
    try:
        payload = json.loads(action_json)
        if not isinstance(payload, dict):
            raise ValueError("not object")
        action = SceneAction(**payload)
        validation = Validator().validate(action, state)
    except (json.JSONDecodeError, TypeError, ValueError, KeyError):
        validation = ValidationResult("rejected", "invalid JSON" if isinstance(raw, str) else "missing required field")
    if action is not None and validation.status == "accepted":
        state.apply(action, validation)
    after = state.snapshot()
    event = _event(command, action, validation, before, after, None if validation.status == "accepted" else validation.reason, raw)
    event_log.append(event)
    return {"status": validation.status, "state": state.snapshot(), "rendered": renderer.render(state), "scene": {**renderer.render_data(state), **state.snapshot()}, "event": event, "action_json": action_json}
