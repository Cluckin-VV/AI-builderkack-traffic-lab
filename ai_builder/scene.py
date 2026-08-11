"""The single local implementation of the Scene pipeline concepts."""

import hashlib
import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class SceneState:
    buses: int = 0
    traffic_light: str = "绿灯"
    bus_running: bool = True

    def snapshot(self) -> Dict[str, Any]:
        return {"buses": self.buses, "traffic_light": self.traffic_light}

    def apply(self, action: "SceneAction", validation: Optional["ValidationResult"] = None) -> None:
        if validation is None or validation.status != "accepted" or validation.action_id != action.action_id:
            raise ValueError("SceneState 只能接受经过 Validator 的 SceneAction")
        if action.action_type == "add_bus":
            self.buses += 1
            self.bus_running = True
        elif action.action_type == "remove_bus":
            self.buses -= 1
            if self.buses == 0:
                self.bus_running = True
        elif action.action_type == "set_traffic_light":
            self.traffic_light = action.parameters["color"]
        elif action.action_type == "stop_bus":
            self.bus_running = False
        elif action.action_type == "move_bus":
            self.bus_running = True
        else:
            raise ValueError("未知 action_type")


@dataclass(frozen=True, init=False)
class SceneAction:
    version: str
    action_type: str
    target: str
    parameters: Dict[str, Any]
    source_command: str
    action_id: str

    def __init__(self, action_type: str, target: Any = "road", parameters: Optional[Dict[str, Any]] = None,
                 source_command: str = "", action_id: str = "", version: str = "0.1") -> None:
        # Compatibility: the v0 prototype used SceneAction(name, parameters).
        if isinstance(target, dict) and parameters is None:
            parameters, target = target, "road"
        parameters = {} if parameters is None else dict(parameters)
        if not action_id:
            raw = json.dumps([version, action_type, target, parameters, source_command], ensure_ascii=False, sort_keys=True)
            action_id = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
        object.__setattr__(self, "version", version)
        object.__setattr__(self, "action_type", action_type)
        object.__setattr__(self, "target", target)
        object.__setattr__(self, "parameters", parameters)
        object.__setattr__(self, "source_command", source_command)
        object.__setattr__(self, "action_id", action_id)

    @property
    def name(self) -> str:
        return self.action_type

    def to_dict(self) -> Dict[str, Any]:
        return {"version": self.version, "action_type": self.action_type, "target": self.target,
                "parameters": dict(self.parameters), "source_command": self.source_command, "action_id": self.action_id}

    def as_dict(self) -> Dict[str, Any]:
        return self.to_dict()

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, sort_keys=True)

    @classmethod
    def from_json(cls, value: str) -> "SceneAction":
        data = json.loads(value)
        return cls(**data)


class SceneCompiler:
    _COMMANDS = {
        "增加一辆公交车": ("add_bus", "road", {}), "场景里来一辆公交车": ("add_bus", "road", {}), "放一辆公交车到道路上": ("add_bus", "road", {}),
        "删除一辆公交车": ("remove_bus", "road", {}), "移除一辆公交车": ("remove_bus", "road", {}), "删除公交车": ("remove_bus", "road", {}),
        "把信号灯变成红灯": ("set_traffic_light", "traffic_light", {"color": "红灯"}), "红灯": ("set_traffic_light", "traffic_light", {"color": "红灯"}), "设置为红色": ("set_traffic_light", "traffic_light", {"color": "红灯"}),
        "把信号灯变成绿灯": ("set_traffic_light", "traffic_light", {"color": "绿灯"}), "绿灯": ("set_traffic_light", "traffic_light", {"color": "绿灯"}), "设置为绿色": ("set_traffic_light", "traffic_light", {"color": "绿灯"}),
        "让公交车停下": ("stop_bus", "bus", {}), "公交车停止": ("stop_bus", "bus", {}), "让公交车停住": ("stop_bus", "bus", {}),
        "让公交车前进": ("move_bus", "bus", {}), "公交车继续行驶": ("move_bus", "bus", {}), "让公交车继续前进": ("move_bus", "bus", {}),
        "让公交车继续行驶": ("move_bus", "bus", {}),
        "把信号灯改成红色": ("set_traffic_light", "traffic_light", {"color": "红灯"}),
        "把红灯变回绿色": ("set_traffic_light", "traffic_light", {"color": "绿灯"}),
    }

    def compile(self, command: str) -> Optional[SceneAction]:
        spec = self._COMMANDS.get(command)
        return None if spec is None else SceneAction(*spec, source_command=command)


@dataclass(frozen=True)
class ValidationResult:
    status: str
    reason: str
    action_id: str = ""

    def as_dict(self) -> Dict[str, str]:
        return {"status": self.status, "reason": self.reason, "action_id": self.action_id}


class Validator:
    _ALLOWED = {"add_bus", "remove_bus", "set_traffic_light", "stop_bus", "move_bus"}
    _TARGETS = {"add_bus": "road", "remove_bus": "road", "set_traffic_light": "traffic_light", "stop_bus": "bus", "move_bus": "bus"}
    _PARAMETERS = {"add_bus": set(), "remove_bus": set(), "stop_bus": set(), "move_bus": set(), "set_traffic_light": {"color"}}
    _COLORS = {"红灯", "黄灯", "绿灯"}

    def validate(self, action: Optional[SceneAction], state: SceneState) -> ValidationResult:
        if action is None:
            return ValidationResult("rejected", "unknown command")
        if action.version != "0.1": return ValidationResult("rejected", "unsupported version", action.action_id)
        if not all((action.action_type, action.target, action.source_command, action.action_id)): return ValidationResult("rejected", "missing required field", action.action_id)
        if action.action_type not in self._ALLOWED: return ValidationResult("rejected", "unknown action_type", action.action_id)
        if action.target != self._TARGETS[action.action_type]: return ValidationResult("rejected", "unknown target", action.action_id)
        if set(action.parameters) != self._PARAMETERS[action.action_type]: return ValidationResult("rejected", "unknown parameters", action.action_id)
        if action.action_type == "set_traffic_light" and (not isinstance(action.parameters["color"], str) or action.parameters["color"] not in self._COLORS): return ValidationResult("rejected", "illegal color", action.action_id)
        if action.action_type in {"remove_bus", "stop_bus", "move_bus"} and state.buses == 0: return ValidationResult("rejected", "no bus exists", action.action_id)
        return ValidationResult("accepted", "valid", action.action_id)


class Renderer:
    def render_data(self, state: SceneState) -> Dict[str, Any]:
        return {"projection": "perspective", "road": {"lanes": 2, "length": 100}, "bus_count": state.buses, "bus_running": state.bus_running, "traffic_light": state.traffic_light}

    def render(self, state: SceneState) -> str:
        return f"公交车：{state.buses}；信号灯：{state.traffic_light}"


class EventLog:
    def __init__(self) -> None: self.events: List[Dict[str, Any]] = []
    def append(self, event: Dict[str, Any]) -> None: self.events.append(event)


def render_command(command: str, state: SceneState, event_log: EventLog) -> Dict[str, Any]:
    compiler, validator, renderer = SceneCompiler(), Validator(), Renderer()
    source_command = command
    before = state.snapshot()
    action = compiler.compile(command)
    if action is not None:
        source_command = action.source_command
    validation = validator.validate(action, state)
    if action and validation.status == "accepted": state.apply(action, validation)
    after = state.snapshot()
    legacy_action = {"name": action.action_type, "parameters": dict(action.parameters)} if action else None
    event = {"action_id": action.action_id if action else "", "source_command": source_command,
             "action": legacy_action, "action_protocol": action.to_dict() if action else None,
             "validation_result": validation.as_dict(), "state_before": before, "state_after": after,
             "rejected_reason": None if validation.status == "accepted" else validation.reason,
             "command": source_command, "validation": {"status": validation.status, "reason": validation.reason},
             "state_change": {"before": before, "after": after}}
    event_log.append(event)
    return {"status": validation.status, "rendered": renderer.render(state), "scene": {**renderer.render_data(state), **state.snapshot()}, "event": event}
