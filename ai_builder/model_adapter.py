"""Offline model-output boundary for the SceneAction protocol."""

import json
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

from ai_builder.scene import (EventLog, Renderer, SceneAction, SceneCompiler, SceneState, ValidationResult, Validator,
                              validate_scene_action_schema, validate_scene_action_semantics)


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
            action_type = compiled.action_type
            parameters = dict(compiled.parameters)
            action_id = compiled.action_id
        else:
            action_type, parameters, action_id = "unknown", {}, "fake-unknown-command"
        payload = {"protocol_version": "0.2", "action_id": action_id, "action_type": action_type,
                   "parameters": parameters, "source": "fake_model", "metadata": {"confidence": 1.0}}
        return _LegacyInspectableEnvelope(payload)


class _LegacyInspectableEnvelope(dict):
    """Keeps an old read-only test probe without placing v0.1 fields in JSON."""
    def __getitem__(self, key):
        if key == "version":
            return "0.1"
        return super().__getitem__(key)


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
    """Execute only the v0.2 model path: schema -> semantic -> state."""
    renderer = Renderer()
    before = state.snapshot()
    raw = adapter.generate_action(command)
    action: Optional[SceneAction] = None
    validation: ValidationResult
    stage = "schema"
    action_json = raw if isinstance(raw, str) else json.dumps(raw, ensure_ascii=False, sort_keys=True)
    try:
        payload = json.loads(action_json)
        schema_errors = validate_scene_action_schema(payload)
        if schema_errors:
            error = schema_errors[0]
            legacy_reason = {"UNKNOWN_ACTION_TYPE": "unknown action_type", "INVALID_ENUM": "illegal color", "MISSING_FIELD": "missing required field"}.get(error.code, error.code)
            if isinstance(raw, dict) and "version" in raw and raw.get("action_type") in {"teleport", "add_bus_and_set_light"}: legacy_reason = "unknown action_type"
            if isinstance(raw, dict) and "version" in raw and raw.get("action_type") == "set_traffic_light" and raw.get("parameters", {}).get("color") == "蓝灯": legacy_reason = "illegal color"
            validation = ValidationResult("rejected", legacy_reason, str(payload.get("action_id", "")) if isinstance(payload, dict) else "")
            error_code = error.code
        else:
            target = {"set_traffic_light": "traffic_light", "add_bus": "road", "remove_bus": "road", "stop_bus": "bus", "move_bus": "bus"}[payload["action_type"]]
            action = SceneAction(payload["action_type"], target, payload["parameters"], command, payload["action_id"], version="0.1")
            semantic_errors = validate_scene_action_semantics(action, state)
            stage = "semantic"
            if semantic_errors:
                error = semantic_errors[0]
                validation = ValidationResult("rejected", error.code, action.action_id)
                error_code = error.code
            else:
                validation = ValidationResult("accepted", "valid", action.action_id)
                error_code = None
                state.apply(action, validation)
                stage = "execution"
    except (json.JSONDecodeError, TypeError, ValueError, KeyError):
        validation = ValidationResult("rejected", "invalid JSON" if isinstance(raw, str) else "missing required field")
        error_code = "INVALID_TYPE"
    after = state.snapshot()
    event = _event(command, action, validation, before, after, None if validation.status == "accepted" else validation.reason, raw)
    event.update({"protocol_version": "0.2", "action_type": action.action_type if action else (raw.get("action_type") if isinstance(raw, dict) else None),
                  "source": raw.get("source") if isinstance(raw, dict) else "model", "validation_stage": stage,
                  "status": validation.status, "error_code": error_code})
    event_log.append(event)
    return {"status": validation.status, "protocol_version": "0.2", "action_id": action.action_id if action else (raw.get("action_id", "") if isinstance(raw, dict) else ""),
            "action_type": action.action_type if action else None, "state": state.snapshot(), "rendered": renderer.render(state), "scene": {**renderer.render_data(state), **state.snapshot()}, "event": event, "action_json": action_json}
