"""Atomic, preview-first plans composed from SceneAction Protocol v0.3 actions."""

from __future__ import annotations

import hashlib
import json
import re
from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from ai_builder.scene import (
    SceneAction,
    SceneState,
    ValidationResult,
    validate_scene_action_schema,
    validate_scene_action_semantics,
)


PLAN_VERSION = "0.1"
MAX_PLAN_ACTIONS = 6
_TARGETS = {
    "add_bus": "road",
    "remove_bus": "road",
    "set_traffic_light": "traffic_light",
    "stop_bus": "bus",
    "move_bus": "bus",
    "set_weather": "scene",
    "set_scene_layout": "scene",
    "add_vehicle": "road",
    "remove_vehicle": "road",
    "set_signal_mode": "signal_controller",
}
_NUMBERS = {"": 1, "一": 1, "两": 2, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6}


class UnsupportedIntent(ValueError):
    pass


def build_scene_plan(command: str, specs: List[tuple[str, Dict[str, Any]]], source: str = "scene_planner") -> Dict[str, Any]:
    """Attach local identities to semantic actions; never reads or writes state."""
    actions = [_action_payload(command, index, kind, deepcopy(parameters))
               for index, (kind, parameters) in enumerate(specs)]
    if source != "scene_planner":
        for action in actions:
            action["source"] = source
            action["metadata"] = {}  # No invented model confidence.
    digest = json.dumps([command, actions], ensure_ascii=False, sort_keys=True)
    return {"plan_version": PLAN_VERSION,
            "plan_id": hashlib.sha256(digest.encode("utf-8")).hexdigest()[:16],
            "source_command": command, "actions": actions}


def _action_payload(command: str, index: int, action_type: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
    seed = json.dumps([PLAN_VERSION, command, index, action_type, parameters], ensure_ascii=False, sort_keys=True)
    return {
        "protocol_version": "0.3" if action_type in {"add_vehicle", "remove_vehicle", "set_signal_mode"} else "0.2",
        "action_id": hashlib.sha256(seed.encode("utf-8")).hexdigest()[:16],
        "action_type": action_type,
        "parameters": parameters,
        "source": "scene_planner",
        "metadata": {"confidence": 1.0},
    }


class DeterministicScenePlanner:
    """Offline planner for the public demo; replaceable by an LLM adapter."""

    _SPLIT = re.compile(r"\s*(?:，|,|、|；|;|。|然后|并且|并)\s*")

    def _parse_clause(self, clause: str) -> List[tuple[str, Dict[str, Any]]]:
        text = clause.strip().lower().rstrip(".!！")
        if not text:
            return []
        vehicle_words = {"小轿车": "sedan", "轿车": "sedan", "suv": "suv", "公交车": "bus"}
        mixed = re.fullmatch(r"(?:请|帮我|请帮我)?(?:增加|添加|加入)([一二两三四五六\d]+)辆?(小轿车|轿车|suv|公交车)(?:和|及|、)([一二两三四五六\d]+)辆?(小轿车|轿车|suv|公交车)", text)
        if mixed:
            specs: List[tuple[str, Dict[str, Any]]] = []
            for raw, word in ((mixed.group(1), mixed.group(2)), (mixed.group(3), mixed.group(4))):
                count = int(raw) if raw.isdigit() else _NUMBERS.get(raw)
                if count is None or len(specs) + count > MAX_PLAN_ACTIONS:
                    raise UnsupportedIntent(f"一个计划最多包含 {MAX_PLAN_ACTIONS} 辆新增车辆")
                specs.extend(("add_vehicle", {"vehicle_type": vehicle_words[word]}) for _ in range(count))
            return specs
        vehicle = re.fullmatch(r"(?:请|帮我|请帮我)?(?:在)?(?:场景里|道路上|路上)?(?:再)?(增加|添加|加入|删除|移除)([一二两三四五六\d]*)辆?(小轿车|轿车|suv)", text)
        if vehicle:
            raw = vehicle.group(2)
            count = int(raw) if raw.isdigit() else _NUMBERS.get(raw)
            if count is None or not 1 <= count <= MAX_PLAN_ACTIONS:
                raise UnsupportedIntent("车辆数量必须在 1 到 6 之间")
            action_type = "remove_vehicle" if vehicle.group(1) in {"删除", "移除"} else "add_vehicle"
            return [(action_type, {"vehicle_type": vehicle_words[vehicle.group(3)]}) for _ in range(count)]
        if text in {"创建公交站情境", "创建公交站场景", "创建一个公交站", "搭建公交站场景"}:
            return [("set_scene_layout", {"layout": "bus_stop"})]
        if text in {"恢复十字路口", "创建十字路口情境", "切换到十字路口"}:
            return [("set_scene_layout", {"layout": "crossroads"})]
        if text in {"恢复自动信号", "启用自动信号", "切回自动信号", "恢复自动红绿灯"}:
            return [("set_signal_mode", {"mode": "automatic"})]

        weather = {
            "雪": "snow",
            "暴雪": "snow",
            "雨": "rain",
            "雾": "fog",
            "晴": "clear",
        }
        weather_shape = re.fullmatch(
            r"(?:请|帮我|请帮我)?(?:让|把)?(?:天气)?(?:切换到|切换|变成|改成|恢复|下|起)?(?:暴雪|雪|雨天|雨|雾天|雾|晴天)",
            text,
        )
        if weather_shape:
            for word in ("暴雪", "下雪", "下雨", "起雾", "晴天", "雪", "雨", "雾", "晴"):
                if word in text:
                    return [("set_weather", {"weather": weather[word.replace("下", "").replace("起", "").replace("天", "")]})]

        add = re.fullmatch(
            r"(?:请|帮我|请帮我)?(?:在)?(?:场景里|道路上|路上)?(?:再)?(?:增加|添加|来|放|加入)([一二两三四五六\d]*)辆?公交车?(?:到道路上)?",
            text,
        )
        if add:
            raw = add.group(1)
            count = int(raw) if raw.isdigit() else _NUMBERS.get(raw)
            if count is None or not 1 <= count <= MAX_PLAN_ACTIONS:
                raise UnsupportedIntent("公交车数量必须在 1 到 6 之间")
            return [("add_bus", {}) for _ in range(count)]

        remove = re.fullmatch(r"(?:请|帮我|请帮我)?(?:删除|移除)([一二两三四五六\d]*)辆?公交车?", text)
        if remove:
            raw = remove.group(1)
            count = int(raw) if raw.isdigit() else _NUMBERS.get(raw)
            if count is None or not 1 <= count <= MAX_PLAN_ACTIONS:
                raise UnsupportedIntent("公交车数量必须在 1 到 6 之间")
            return [("remove_bus", {}) for _ in range(count)]

        light_shape = re.fullmatch(
            r"(?:(?:请|帮我|请帮我)?(?:把|将)?(?:信号灯|红灯|黄灯|绿灯|灯)(?:变成|改成|设为|设置为|调成|变回)(?:红灯|红色|黄灯|黄色|绿灯|绿色)|(?:设置为)?(?:红灯|红色|黄灯|黄色|绿灯|绿色))",
            text,
        )
        if light_shape:
            if "红" in text and "绿" not in text:
                return [("set_traffic_light", {"color": "红灯"})]
            if "黄" in text:
                return [("set_traffic_light", {"color": "黄灯"})]
            if "绿" in text:
                return [("set_traffic_light", {"color": "绿灯"})]

        if re.fullmatch(r"(?:请|帮我|请帮我)?(?:把|让)?公交车(?:停下|停止|停住|停车|停下来)", text):
            return [("stop_bus", {})]
        if re.fullmatch(r"(?:请|帮我|请帮我)?(?:把|让)?公交车(?:继续行驶|继续前进|继续|前进|行驶|开动)", text):
            return [("move_bus", {})]
        raise UnsupportedIntent(f"无法理解计划片段：{clause}")

    def generate_plan(self, command: str) -> Dict[str, Any]:
        source = command.strip()
        if not source:
            raise UnsupportedIntent("指令不能为空")
        specs: List[tuple[str, Dict[str, Any]]] = []
        for clause in self._SPLIT.split(source):
            specs.extend(self._parse_clause(clause))
        if not specs:
            raise UnsupportedIntent("未生成场景动作")
        if len(specs) > MAX_PLAN_ACTIONS:
            raise UnsupportedIntent(f"一个计划最多包含 {MAX_PLAN_ACTIONS} 个动作")
        return build_scene_plan(source, specs)

    def try_generate_plan(self, command: str) -> Dict[str, Any]:
        try:
            return {"status": "candidate_ready", "plan": self.generate_plan(command)}
        except UnsupportedIntent as error:
            return {"status": "rejected", "error_code": "UNSUPPORTED_INTENT", "reason": str(error)}


def _make_action(payload: Dict[str, Any], command: str) -> SceneAction:
    return SceneAction(
        payload["action_type"],
        _TARGETS[payload["action_type"]],
        payload["parameters"],
        command,
        payload["action_id"],
        version="0.1",
    )


def preview_scene_plan(plan: Dict[str, Any], state: SceneState, *, max_actions: int = MAX_PLAN_ACTIONS) -> Dict[str, Any]:
    before = state.snapshot()
    required = {"plan_version", "plan_id", "source_command", "actions"}
    if set(plan) != required or plan.get("plan_version") != PLAN_VERSION:
        return {"status": "rejected", "validation_stage": "plan_schema", "error_code": "INVALID_PLAN", "state_before": before, "state_after": before}
    actions = plan.get("actions")
    if not isinstance(actions, list) or not 1 <= len(actions) <= max_actions:
        return {"status": "rejected", "validation_stage": "plan_schema", "error_code": "INVALID_PLAN_LENGTH", "state_before": before, "state_after": before}
    action_ids = [item.get("action_id") for item in actions if isinstance(item, dict)]
    if len(set(action_ids)) != len(actions):
        return {"status": "rejected", "validation_stage": "plan_schema", "error_code": "DUPLICATE_ACTION_ID", "state_before": before, "state_after": before}

    simulated = deepcopy(state)
    steps = []
    for index, payload in enumerate(actions):
        schema_errors = validate_scene_action_schema(payload) if isinstance(payload, dict) else []
        if not isinstance(payload, dict) or schema_errors:
            code = "INVALID_ACTION" if not schema_errors else schema_errors[0].code
            return {"status": "rejected", "validation_stage": "schema", "error_code": code, "failed_step": index, "steps": steps, "state_before": before, "state_after": before}
        action = _make_action(payload, plan["source_command"])
        semantic_errors = validate_scene_action_semantics(action, simulated)
        if semantic_errors:
            return {"status": "rejected", "validation_stage": "semantic", "error_code": semantic_errors[0].code, "failed_step": index, "steps": steps, "state_before": before, "state_after": before}
        validation = ValidationResult("accepted", "valid", action.action_id)
        simulated.apply(action, validation)
        steps.append({"index": index, "action_id": action.action_id, "action_type": action.action_type, "parameters": dict(action.parameters), "status": "valid"})
    return {"status": "preview_ready", "validation_stage": "preview", "plan_id": plan["plan_id"], "steps": steps, "state_before": before, "projected_state": simulated.snapshot(), "state_after": before}


@dataclass
class PendingPlanStore:
    max_plans: int = 128
    _plans: Dict[str, Dict[str, Any]] = field(default_factory=dict)

    def put(self, plan: Dict[str, Any], preview: Dict[str, Any], state: SceneState, *, undo_of: Optional[str] = None) -> None:
        if preview.get("status") != "preview_ready":
            raise ValueError("only valid previews may be stored")
        plan_id = plan["plan_id"]
        if plan_id not in self._plans and len(self._plans) >= self.max_plans:
            self._plans.pop(next(iter(self._plans)))
        self._plans[plan_id] = {"plan": deepcopy(plan), "state_before": state.snapshot(), "undo_of": undo_of}

    def clear(self) -> None:
        self._plans.clear()

    def pop(self, plan_id: str) -> Optional[Dict[str, Any]]:
        return self._plans.pop(plan_id, None)


def execute_pending_plan(plan_id: str, state: SceneState, store: PendingPlanStore) -> Dict[str, Any]:
    pending = store.pop(plan_id)
    before = state.snapshot()
    if pending is None:
        return {"status": "rejected", "error_code": "PLAN_NOT_FOUND", "state_before": before, "state_after": before}
    if pending["state_before"] != before:
        return {"status": "rejected", "error_code": "STALE_PLAN", "state_before": before, "state_after": before}
    preview = preview_scene_plan(pending["plan"], state, max_actions=MAX_PLAN_ACTIONS + (1 if pending.get("undo_of") else 0))
    if preview.get("status") != "preview_ready":
        return {**preview, "state_after": before}

    committed = deepcopy(state)
    for payload in pending["plan"]["actions"]:
        action = _make_action(payload, pending["plan"]["source_command"])
        committed.apply(action, ValidationResult("accepted", "valid", action.action_id))
    state.buses = committed.buses
    state.traffic_light = committed.traffic_light
    state.bus_running = committed.bus_running
    state.weather = committed.weather
    state.scene_layout = committed.scene_layout
    state.vehicles = deepcopy(committed.vehicles)
    state.signal_mode = committed.signal_mode
    return {
        "status": "accepted",
        "validation_stage": "execution",
        "plan_id": plan_id,
        "source_command": pending["plan"]["source_command"],
        "undo_of": pending.get("undo_of"),
        "steps": preview["steps"],
        "applied_action_count": len(preview["steps"]),
        "state_before": before,
        "state_after": state.snapshot(),
    }
