"""The single local implementation of the Scene pipeline concepts."""

import hashlib
import json
from copy import deepcopy
from pathlib import Path
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

SCENE_ACTION_PROTOCOL_VERSION = "0.3"
SCENE_ACTION_TYPES = {"add_bus", "remove_bus", "set_traffic_light", "stop_bus", "move_bus", "set_weather", "set_scene_layout"}
SCENE_ACTION_TYPES_V03 = SCENE_ACTION_TYPES | {"add_vehicle", "remove_vehicle", "set_signal_mode"}
SCENE_LAYOUTS = json.loads((Path(__file__).resolve().parent / "scene_layouts.json").read_text(encoding="utf-8"))
MAX_BUSES = 12
MAX_VEHICLES = 24
VEHICLE_TYPES = {"sedan", "suv", "bus"}
VEHICLE_ROUTES = [(approach, movement) for approach in ("W", "E", "S", "N")
                  for movement in ("straight", "left", "right")]


def _route_for_vehicle(vehicles: List[Dict[str, str]]) -> Dict[str, str]:
    occupancy = {(approach, movement): 0 for approach, movement in VEHICLE_ROUTES}
    for vehicle in vehicles:
        route = (vehicle.get("approach"), vehicle.get("movement"))
        if route in occupancy:
            occupancy[route] += 1
    approach, movement = min(VEHICLE_ROUTES, key=lambda route: occupancy[route])
    return {"approach": approach, "movement": movement}


@dataclass(frozen=True)
class ValidationError:
    code: str
    message: str
    field: str = ""

    def as_dict(self) -> Dict[str, str]:
        return {"code": self.code, "message": self.message, "field": self.field}


def validate_scene_action_schema(payload: Any) -> List[ValidationError]:
    """Validate the v0.2/v0.3 envelope only; no SceneState is read or changed."""
    if not isinstance(payload, dict):
        return [ValidationError("INVALID_TYPE", "SceneAction must be an object")]
    errors: List[ValidationError] = []
    required = {"protocol_version", "action_id", "action_type", "parameters"}
    for field in sorted(required - set(payload)):
        errors.append(ValidationError("MISSING_FIELD", f"Missing field: {field}", field))
    for field in sorted(set(payload) - required - {"source", "metadata"}):
        errors.append(ValidationError("UNKNOWN_FIELD", f"Unknown field: {field}", field))
    protocol_version = payload.get("protocol_version")
    if protocol_version not in {"0.2", "0.3"}:
        errors.append(ValidationError("UNSUPPORTED_PROTOCOL_VERSION", "Only protocols 0.2 and 0.3 are supported", "protocol_version"))
    if "action_id" in payload and (not isinstance(payload["action_id"], str) or not payload["action_id"]):
        errors.append(ValidationError("INVALID_TYPE", "action_id must be a non-empty string", "action_id"))
    allowed_types = SCENE_ACTION_TYPES_V03 if protocol_version == "0.3" else SCENE_ACTION_TYPES
    if "action_type" in payload and payload["action_type"] not in allowed_types:
        errors.append(ValidationError("UNKNOWN_ACTION_TYPE", "Unsupported action type", "action_type"))
    if "parameters" in payload and not isinstance(payload["parameters"], dict):
        errors.append(ValidationError("INVALID_TYPE", "parameters must be an object", "parameters"))
    if "metadata" in payload and not isinstance(payload["metadata"], dict):
        errors.append(ValidationError("INVALID_TYPE", "metadata must be an object", "metadata"))
    if isinstance(payload.get("metadata"), dict) and "confidence" in payload["metadata"]:
        value = payload["metadata"]["confidence"]
        if not isinstance(value, (int, float)) or not 0 <= value <= 1:
            errors.append(ValidationError("INVALID_PARAMETER", "confidence must be between 0 and 1", "metadata.confidence"))
    action_type = payload.get("action_type")
    wanted = (
        {"color"} if action_type == "set_traffic_light" else
        {"weather"} if action_type == "set_weather" else
        {"layout"} if action_type == "set_scene_layout" else
        {"vehicle_type"} if action_type in {"add_vehicle", "remove_vehicle"} else
        {"mode"} if action_type == "set_signal_mode" else set()
    )
    if isinstance(payload.get("parameters"), dict):
        for field in sorted(set(payload["parameters"]) - wanted):
            errors.append(ValidationError("UNKNOWN_FIELD", "Unknown parameter", f"parameters.{field}"))
        for field in sorted(wanted - set(payload["parameters"])):
            errors.append(ValidationError("MISSING_FIELD", "Missing parameter", f"parameters.{field}"))
        if "color" in payload["parameters"] and payload.get("action_type") == "set_traffic_light" and payload["parameters"]["color"] not in {"红灯", "黄灯", "绿灯"}:
            errors.append(ValidationError("INVALID_ENUM", "Unsupported traffic light color", "parameters.color"))
    if payload.get("action_type") == "set_weather" and isinstance(payload.get("parameters"), dict):
        value = payload["parameters"].get("weather")
        if not isinstance(value, str) or value not in {"clear", "rain", "snow", "fog"}:
            errors.append(ValidationError("INVALID_ENUM", "Unsupported weather", "parameters.weather"))
    if payload.get("action_type") == "set_scene_layout" and isinstance(payload.get("parameters"), dict):
        value = payload["parameters"].get("layout")
        if not isinstance(value, str) or value not in SCENE_LAYOUTS:
            errors.append(ValidationError("INVALID_ENUM", "Unsupported scene layout", "parameters.layout"))
    if payload.get("action_type") in {"add_vehicle", "remove_vehicle"} and isinstance(payload.get("parameters"), dict):
        value = payload["parameters"].get("vehicle_type")
        if not isinstance(value, str) or value not in VEHICLE_TYPES:
            errors.append(ValidationError("INVALID_ENUM", "Unsupported vehicle type", "parameters.vehicle_type"))
    if action_type == "set_signal_mode" and isinstance(payload.get("parameters"), dict):
        value = payload["parameters"].get("mode")
        if not isinstance(value, str) or value not in {"automatic", "manual"}:
            errors.append(ValidationError("INVALID_ENUM", "Unsupported signal mode", "parameters.mode"))
    return errors


def validate_scene_action_semantics(action: "SceneAction", state: "SceneState") -> List[ValidationError]:
    """Validate whether an otherwise well-shaped action can execute now."""
    if action.action_type == "add_bus" and state.buses >= MAX_BUSES:
        return [ValidationError("SEMANTIC_CAPACITY_REACHED", f"The scene supports at most {MAX_BUSES} buses", "target")]
    if action.action_type in {"remove_bus", "stop_bus", "move_bus"} and state.buses == 0:
        return [ValidationError("SEMANTIC_TARGET_NOT_FOUND", "No bus exists in the scene", "target")]
    if action.action_type == "stop_bus" and state.bus_running is False:
        return [ValidationError("SEMANTIC_INVALID_STATE_TRANSITION", "Bus is already stopped", "action_type")]
    if action.action_type == "add_vehicle" and len(state.vehicles) >= MAX_VEHICLES:
        return [ValidationError("SEMANTIC_CAPACITY_REACHED", f"The scene supports at most {MAX_VEHICLES} vehicles", "target")]
    if action.action_type == "remove_vehicle" and not any(vehicle["type"] == action.parameters["vehicle_type"] for vehicle in state.vehicles):
        return [ValidationError("SEMANTIC_TARGET_NOT_FOUND", "No matching vehicle exists in the scene", "target")]
    return []


@dataclass
class SceneState:
    buses: int = 0
    traffic_light: str = "绿灯"
    bus_running: bool = True
    weather: str = "clear"
    scene_layout: str = "crossroads"
    vehicles: List[Dict[str, str]] = field(default_factory=list)
    signal_mode: str = "automatic"

    @classmethod
    def demo(cls) -> "SceneState":
        types = (["sedan"] * 6 + ["suv"] * 4 + ["bus"] * 2)
        vehicles = []
        for index, vehicle_type in enumerate(types):
            approach, movement = VEHICLE_ROUTES[index]
            vehicles.append({"id": f"{vehicle_type}-{index+1}", "type": vehicle_type,
                             "approach": approach, "movement": movement})
        return cls(buses=2, vehicles=vehicles, signal_mode="automatic")

    def snapshot(self) -> Dict[str, Any]:
        result = {"buses": self.buses, "traffic_light": self.traffic_light, "bus_running": self.bus_running, "weather": self.weather}
        # Preserve the published four-field default snapshot; omission means crossroads.
        if self.scene_layout != "crossroads":
            result["scene_layout"] = self.scene_layout
        if self.vehicles:
            result["vehicles"] = deepcopy(self.vehicles)
            result["signal_mode"] = self.signal_mode
        elif self.signal_mode != "automatic":
            result["signal_mode"] = self.signal_mode
        return result

    def apply(self, action: "SceneAction", validation: Optional["ValidationResult"] = None) -> None:
        if validation is None or validation.status != "accepted" or validation.action_id != action.action_id:
            raise ValueError("SceneState 只能接受经过 Validator 的 SceneAction")
        if action.action_type == "add_bus":
            if self.buses >= MAX_BUSES:
                raise ValueError(f"公交车容量上限为 {MAX_BUSES}")
            self.buses += 1
            if self.vehicles:
                serial = 1
                existing = {vehicle["id"] for vehicle in self.vehicles}
                while f"bus-{serial}" in existing:
                    serial += 1
                self.vehicles.append({"id": f"bus-{serial}", "type": "bus", **_route_for_vehicle(self.vehicles)})
        elif action.action_type == "remove_bus":
            self.buses -= 1
            if self.vehicles:
                index = next((index for index, vehicle in enumerate(self.vehicles) if vehicle["type"] == "bus"), None)
                if index is not None:
                    self.vehicles.pop(index)
                self.buses = sum(vehicle["type"] == "bus" for vehicle in self.vehicles)
            if self.buses == 0:
                self.bus_running = True
        elif action.action_type == "set_traffic_light":
            self.traffic_light = action.parameters["color"]
            self.signal_mode = "manual"
        elif action.action_type == "set_signal_mode":
            self.signal_mode = action.parameters["mode"]
            if self.signal_mode == "automatic":
                # traffic_light is the legacy manual-color field; canonicalize it
                # when returning to the independent automatic phase controller.
                self.traffic_light = "绿灯"
        elif action.action_type == "stop_bus":
            self.bus_running = False
        elif action.action_type == "move_bus":
            self.bus_running = True
        elif action.action_type == "set_weather":
            self.weather = action.parameters["weather"]
        elif action.action_type == "set_scene_layout":
            self.scene_layout = action.parameters["layout"]
        elif action.action_type == "add_vehicle":
            if len(self.vehicles) >= MAX_VEHICLES:
                raise ValueError(f"车辆容量上限为 {MAX_VEHICLES}")
            vehicle_type = action.parameters["vehicle_type"]
            if not self.vehicles and self.buses:
                for index in range(self.buses):
                    route = VEHICLE_ROUTES[index % len(VEHICLE_ROUTES)]
                    self.vehicles.append({"id": f"legacy-bus-{index+1}", "type": "bus",
                                          "approach": route[0], "movement": route[1]})
            serial = 1
            existing = {vehicle["id"] for vehicle in self.vehicles}
            while f"{vehicle_type}-{serial}" in existing:
                serial += 1
            route = _route_for_vehicle(self.vehicles)
            self.vehicles.append({"id": f"{vehicle_type}-{serial}", "type": vehicle_type, **route})
            self.buses = sum(vehicle["type"] == "bus" for vehicle in self.vehicles)
        elif action.action_type == "remove_vehicle":
            vehicle_type = action.parameters["vehicle_type"]
            index = next(index for index, vehicle in enumerate(self.vehicles) if vehicle["type"] == vehicle_type)
            self.vehicles.pop(index)
            self.buses = sum(vehicle["type"] == "bus" for vehicle in self.vehicles)
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
        "创建公交站情境": ("set_scene_layout", "scene", {"layout": "bus_stop"}),
        "创建公交站场景": ("set_scene_layout", "scene", {"layout": "bus_stop"}),
        "恢复十字路口": ("set_scene_layout", "scene", {"layout": "crossroads"}),
        **{text: ("set_weather", "scene", {"weather": weather}) for weather, expressions in {
            "clear": ("晴天", "切换晴天", "恢复晴天", "clear weather"),
            "rain": ("下雨", "让天气下雨", "切换雨天", "make it rain"),
            "snow": ("下雪", "让天气下雪", "让天气下暴雪", "切换雪天", "make it snow"),
            "fog": ("起雾", "让天气起雾", "切换雾天", "make it foggy"),
        }.items() for text in expressions},
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
        spec = self._COMMANDS.get(command.strip().lower().rstrip("。.!！"))
        return None if spec is None else SceneAction(*spec, source_command=command)


@dataclass(frozen=True)
class ValidationResult:
    status: str
    reason: str
    action_id: str = ""

    def as_dict(self) -> Dict[str, str]:
        return {"status": self.status, "reason": self.reason, "action_id": self.action_id}


class Validator:
    _ALLOWED = SCENE_ACTION_TYPES
    _TARGETS = {"add_bus": "road", "remove_bus": "road", "set_traffic_light": "traffic_light", "stop_bus": "bus", "move_bus": "bus", "set_weather": "scene", "set_scene_layout": "scene"}
    _PARAMETERS = {"add_bus": set(), "remove_bus": set(), "stop_bus": set(), "move_bus": set(), "set_traffic_light": {"color"}, "set_weather": {"weather"}, "set_scene_layout": {"layout"}}
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
        if action.action_type == "add_bus" and state.buses >= MAX_BUSES: return ValidationResult("rejected", "bus capacity reached", action.action_id)
        if action.action_type in {"remove_bus", "stop_bus", "move_bus"} and state.buses == 0: return ValidationResult("rejected", "no bus exists", action.action_id)
        if action.action_type == "set_weather" and (not isinstance(action.parameters["weather"], str) or action.parameters["weather"] not in {"clear", "rain", "snow", "fog"}): return ValidationResult("rejected", "illegal weather", action.action_id)
        if action.action_type == "set_scene_layout" and (not isinstance(action.parameters["layout"], str) or action.parameters["layout"] not in SCENE_LAYOUTS): return ValidationResult("rejected", "illegal layout", action.action_id)
        return ValidationResult("accepted", "valid", action.action_id)


class Renderer:
    def render_data(self, state: SceneState) -> Dict[str, Any]:
        layout = deepcopy(SCENE_LAYOUTS[state.scene_layout])
        result = {"projection": "perspective", "road": layout["road"], "bus_count": state.buses, "bus_running": state.bus_running, "traffic_light": state.traffic_light, "signal_mode": state.signal_mode, "scene_layout": state.scene_layout, "layout_data": layout}
        vehicles = deepcopy(state.vehicles)
        if not vehicles and state.buses:
            vehicles = [{"id": f"legacy-bus-{index+1}", "type": "bus"} for index in range(min(state.buses, MAX_BUSES))]
        if vehicles:
            result.update({"vehicles": vehicles, "vehicle_count": len(vehicles)})
        return result

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
