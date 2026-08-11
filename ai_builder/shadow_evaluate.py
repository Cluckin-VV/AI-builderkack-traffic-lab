import json
from pathlib import Path
from collections import Counter
from typing import Any, Dict

from ai_builder.real_llm_adapter import build_shadow_adapter
from ai_builder.scene import EventLog, SceneAction, SceneState, Validator


def evaluate() -> Dict[str, Any]:
    cases = json.loads((Path(__file__).with_name("evaluation_cases.json")).read_text(encoding="utf-8"))
    adapter = build_shadow_adapter()
    counts = {"json_ok": 0, "action_ok": 0, "valid_accepted": 0, "invalid_rejected": 0, "false_rejection": 0, "unsafe_acceptance": 0, "extra_fields": 0, "state_changes": 0}
    expected_fields = {"version", "action_type", "target", "parameters", "source_command", "action_id"}
    records = []
    for case in cases:
        state, log = SceneState(), EventLog()
        before = state.snapshot()
        raw = ""
        action = None
        reason = None
        json_ok = False
        action_constructed = False
        actual_action_type = None
        failure_category = None
        try:
            output = adapter.generate_action(case["command"])
            raw = adapter.last_raw_output or (output if isinstance(output, str) else json.dumps(output, ensure_ascii=False))
            payload = json.loads(raw) if isinstance(raw, str) else output
            counts["json_ok"] += 1
            json_ok = True
            counts["extra_fields"] += len(set(payload) - expected_fields)
            action = SceneAction(**payload)
            action_constructed = True
            actual_action_type = action.action_type
            validation = Validator().validate(action, state)
            if validation.status == "accepted":
                counts["action_ok"] += 1
                if case["expected_status"] == "accepted": counts["valid_accepted"] += 1
                else: counts["unsafe_acceptance"] += 1
            else: reason = validation.reason
            if validation.status == "rejected":
                if case["expected_status"] == "rejected": counts["invalid_rejected"] += 1
                else: counts["false_rejection"] += 1
        except (json.JSONDecodeError, TypeError, ValueError, KeyError, RuntimeError) as error:
            reason = "invalid JSON" if isinstance(error, json.JSONDecodeError) else str(error)
            validation_status = "rejected"
        else:
            validation_status = validation.status
        after = state.snapshot()
        if after != before: counts["state_changes"] += 1
        if reason:
            if not json_ok: failure_category = "invalid_json"
            elif not action_constructed and "required field" in reason: failure_category = "missing_field"
            elif actual_action_type not in {"add_bus", "remove_bus", "set_traffic_light", "stop_bus", "move_bus"}: failure_category = "unknown_action_type"
            elif "color" in reason or "parameter" in reason: failure_category = "invalid_parameter"
            elif case["expected_status"] == "rejected": failure_category = "unsupported_expression"
            else: failure_category = "other"
        records.append({"case_id": case["id"], "command": case["command"], "expected_status": case["expected_status"], "json_parse_success": json_ok, "scene_action_constructed": action_constructed, "validator_result": validation_status, "rejected_reason": reason, "expected_action_type": case["expected_action_type"], "actual_action_type": actual_action_type, "failure_category": failure_category, "raw_model_output": raw})
    total = len(cases)
    failures = [record for record in records if record["failure_category"]]
    categories = Counter(record["failure_category"] for record in failures)
    report = Path(__file__).parents[1] / "docs" / "real-llm-shadow-failures-v0.1.md"
    lines = ["# Real LLM Shadow Failures v0.1", "", "本报告由 `python -m ai_builder.shadow_evaluate` 自动生成。当前无 API Key 时使用离线 Fake Adapter。", "", "## 失败分类统计", "", "| 分类 | 数量 |", "|---|---:|"]
    for category in ("invalid_json", "missing_field", "unknown_action_type", "invalid_parameter", "unsupported_expression", "other"):
        lines.append(f"| `{category}` | {categories.get(category, 0)} |")
    lines += ["", "## 失败案例", "", "| case_id | command | expected_status | validator_result | rejected_reason | expected_action_type | actual_action_type |", "|---|---|---|---|---|---|---|"]
    for record in failures:
        values = [record["case_id"], record["command"], record["expected_status"], record["validator_result"], record["rejected_reason"], record["expected_action_type"], record["actual_action_type"]]
        lines.append("| " + " | ".join(str(value or "") for value in values) + " |")
    report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    valid_total = sum(record["expected_status"] == "accepted" for record in records)
    invalid_total = total - valid_total
    return {"total": total, "json_parse_rate": counts["json_ok"] / total, "expected_valid_acceptance": counts["valid_accepted"] / valid_total, "expected_invalid_rejection": counts["invalid_rejected"] / invalid_total, "false_rejection": counts["false_rejection"], "unsafe_acceptance": counts["unsafe_acceptance"], "state_mutation_count": counts["state_changes"], "state_changes": counts["state_changes"], "extra_fields": counts["extra_fields"], "records": records, "failure_categories": dict(categories)}


if __name__ == "__main__":
    result = evaluate()
    print(f"JSON 可解析率：{result['json_parse_rate']:.0%}")
    print(f"合法指令正确接受率：{result['expected_valid_acceptance']:.0%}")
    print(f"非法/歧义指令正确拒绝率：{result['expected_invalid_rejection']:.0%}")
    print(f"错误拒绝：{result['false_rejection']}")
    print(f"危险接受：{result['unsafe_acceptance']}")
    print(f"状态修改：{result['state_mutation_count']}")
    print(f"协议外字段：{result['extra_fields']}")
    print("逐案例结果：")
    for record in result["records"]:
        print(json.dumps({key: record[key] for key in ("case_id", "command", "expected_status", "json_parse_success", "scene_action_constructed", "validator_result", "rejected_reason", "expected_action_type", "actual_action_type")}, ensure_ascii=False))
    print("失败分类：" + json.dumps(result["failure_categories"], ensure_ascii=False, sort_keys=True))
