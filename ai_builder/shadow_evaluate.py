import json
import os
import re
import sys
import time
from pathlib import Path
from collections import Counter
from typing import Any, Dict

from ai_builder.real_llm_adapter import build_shadow_adapter
from ai_builder.scene import EventLog, SceneAction, SceneState, Validator
from ai_builder.real_llm_shadow import OpenAIRealLLMAdapter, shadow_case

ERROR_CATEGORIES = ("CONFIG_ERROR", "API_ERROR", "TIMEOUT", "MODEL_REFUSAL", "INVALID_JSON", "SCHEMA_FAILURE", "SEMANTIC_FAILURE", "ACTION_TYPE_MISMATCH", "PARAMETER_MISMATCH", "UNSUPPORTED_INTENT")


def _sanitize(value: Any) -> str:
    text = str(value or "")
    text = re.sub(r"Bearer\s+\S+", "Bearer [REDACTED]", text, flags=re.I)
    text = re.sub(r"(?:sk|api)[-_][A-Za-z0-9_-]{12,}", "[REDACTED]", text, flags=re.I)
    return text[:500]


def load_shadow_cases(limit: int):
    path = Path(__file__).parent / "eval" / "real_llm_shadow_v01.jsonl"
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    for index, row in enumerate(rows, 1): row.setdefault("id", f"shadow-{index:02d}")
    return rows[:limit]


def _limit():
    raw = os.getenv("AI_BUILDER_LLM_MAX_CASES", "3")
    try: value = int(raw)
    except ValueError: raise ValueError("AI_BUILDER_LLM_MAX_CASES must be a positive integer")
    if value <= 0: raise ValueError("AI_BUILDER_LLM_MAX_CASES must be greater than zero")
    return value


def run_cli(dry_run=None):
    if os.getenv("AI_BUILDER_ENABLE_REAL_LLM", "0") != "1":
        print("Real LLM evaluation disabled."); return 0
    try: limit = _limit()
    except ValueError as error: print(f"Configuration error: {error}"); return 2
    cases = load_shadow_cases(limit)
    if dry_run is None: dry_run = os.getenv("AI_BUILDER_LLM_DRY_RUN", "0") == "1"
    if dry_run:
        print("Dry run: no API calls will be made.")
        print("Cases: " + ", ".join(row["id"] for row in cases)); return 0
    adapter = OpenAIRealLLMAdapter()
    results=[]
    for row in cases:
        started=time.perf_counter()
        result=shadow_case(adapter,row["command"],SceneState())
        result.update({"case_id":row["id"],"execution_allowed":False,"error_message_sanitized":_sanitize(result.get("error_category"))})
        result["latency_ms"]=round((time.perf_counter()-started)*1000,2)
        results.append(result)
    artifacts=Path(__file__).parents[1]/"artifacts"; artifacts.mkdir(exist_ok=True)
    (artifacts/"real-llm-shadow-v0.1-cases.jsonl").write_text("\n".join(json.dumps(x,ensure_ascii=False) for x in results)+"\n",encoding="utf-8")
    total=len(results); success=[x for x in results if x.get("candidate_generated")]
    def rate(key, rows=results): return sum(bool(x.get(key)) for x in rows)/len(rows) if rows else 0
    errors={key:sum(x.get("error_category")==key for x in results) for key in ERROR_CATEGORIES}
    schema_rows=[x for x in results if x.get("candidate_generated")]; semantic_rows=[x for x in schema_rows if x.get("schema_valid")]
    metrics={"total_cases":total,"completed_cases":len(results),"api_attempt_count":total,"api_success_count":len(success),"candidate_generated_count":len(success),"api_success_rate":len(success)/total if total else 0,"schema_valid_rate":sum(x.get("schema_valid",False) for x in schema_rows)/len(schema_rows) if schema_rows else None,"semantic_valid_rate":sum(x.get("semantic_valid",False) for x in semantic_rows)/len(semantic_rows) if semantic_rows else None,"action_type_match_rate":rate("action_type_match",success),"parameter_match_rate":rate("parameters_match",success),"overall_match_rate":rate("overall_match",success),"unsupported_rejection_rate":sum(x.get("error_category")=="UNSUPPORTED_INTENT" for x in results)/total if total else 0,"average_latency_ms":sum(x.get("latency_ms",0) for x in results)/total if total else 0,"min_latency_ms":min((x.get("latency_ms",0) for x in results),default=0),"max_latency_ms":max((x.get("latency_ms",0) for x in results),default=0),"error_counts":errors}
    summary={"metrics":metrics,"execution_allowed":False,"model":adapter.model,"cases":results}
    (artifacts/"real-llm-shadow-v0.1-summary.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding="utf-8")
    report=Path(__file__).parents[1]/"docs"/"real-llm-shadow-results-v0.1.md"
    report.write_text("# Real LLM Shadow Results v0.1\n\nReal LLM execution remains disabled.\n\n```json\n"+json.dumps(metrics,ensure_ascii=False,indent=2)+"\n```\n",encoding="utf-8")
    print(json.dumps(metrics,ensure_ascii=False,indent=2)); return 0


def evaluate() -> Dict[str, Any]:
    cases = json.loads((Path(__file__).with_name("evaluation_cases.json")).read_text(encoding="utf-8"))
    adapter = build_shadow_adapter()
    counts = {"json_ok": 0, "action_ok": 0, "valid_accepted": 0, "invalid_rejected": 0, "false_rejection": 0, "unsafe_acceptance": 0, "extra_fields": 0, "state_changes": 0}
    expected_fields = {"protocol_version", "action_id", "action_type", "parameters", "source", "metadata"}
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
    if os.getenv("AI_BUILDER_ENABLE_REAL_LLM", "0") == "1":
        raise SystemExit(run_cli())
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
