"""ScenePlan shadow CLI. Default is offline reference replay, never a model score."""

import argparse
import json
import os
import time
import hashlib
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

from ai_builder.real_llm_plan import OpenAIScenePlanAdapter, evaluate_plan_candidate
from ai_builder.scene import SceneState

ROOT = Path(__file__).resolve().parents[1]
DATASET = Path(__file__).resolve().parent / "eval" / "scene_plan_shadow_v01.jsonl"


def load_cases(path=DATASET):
    cases = [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines() if line.strip()]
    if len({case["id"] for case in cases}) != len(cases):
        raise ValueError("duplicate case IDs")
    for case in cases:
        if case["expected_status"] not in {"accepted", "rejected"}:
            raise ValueError("invalid expected_status")
        if bool(case["expected_actions"]) != (case["expected_status"] == "accepted"):
            raise ValueError("expected actions conflict with expected status")
    return cases


def run_evaluation(cases, adapter=None, dry_run=True):
    rows = []
    aborted_reason = None
    for case in cases:
        state = SceneState(**case.get("initial_state", {}))
        before = state.snapshot()
        start = time.perf_counter()
        candidate = ({"plan_version": "0.1", "actions": case["expected_actions"]}
                     if dry_run else adapter.generate_scene_plan(case["command"]))
        latency = round((time.perf_counter() - start) * 1000, 2)
        row = evaluate_plan_candidate(case["command"], candidate, state, case["expected_actions"])
        # Independently measure the live snapshot even on all early rejection paths.
        row.update(case_id=case["id"], expected_status=case["expected_status"],
                   expected_actions=case["expected_actions"], latency_ms=latency,
                   state_after=state.snapshot(), state_mutation_count=int(before != state.snapshot()))
        usage = getattr(adapter, "last_usage", {}) if not dry_run else {}
        raw_output = getattr(adapter, "last_raw_output", None) if not dry_run else None
        row["token_usage"] = usage if isinstance(usage, dict) else {}
        row["raw_model_output"] = raw_output if isinstance(raw_output, str) else None
        rows.append(row)
        diagnostic = candidate.get("diagnostic", {}) if isinstance(candidate, dict) else {}
        if isinstance(diagnostic, dict) and diagnostic.get("openai_error_code") in {"credit_balance_exhausted", "insufficient_quota"}:
            aborted_reason = diagnostic["openai_error_code"]
            break
    return summarize_rows(cases, rows, adapter, dry_run, aborted_reason), rows


def summarize_rows(cases, rows, adapter=None, dry_run=False, aborted_reason=None):
    unavailable = {"API_ERROR", "CONFIG_ERROR", "TIMEOUT", "MALFORMED_RESPONSE"}
    measured = [row for row in rows if row["error_category"] not in unavailable]
    valid = [row for row in measured if row["expected_status"] == "accepted"]
    invalid = [row for row in measured if row["expected_status"] == "rejected"]
    count = len(rows)
    ratio = lambda n, d: n / d if d else None
    summary = {
        "measurement_mode": "dry_run_reference_replay" if dry_run else "model_shadow",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": None if dry_run else getattr(adapter, "model", "test_double"),
        "total_cases": len(cases), "completed_cases": count,
        "valid_cases": sum(case["expected_status"] == "accepted" for case in cases),
        "invalid_cases": sum(case["expected_status"] == "rejected" for case in cases),
        "measured_valid_cases": len(valid), "measured_invalid_cases": len(invalid),
        "unavailable_case_count": count - len(measured), "aborted_reason": aborted_reason,
        "api_call_count": 0 if dry_run else count,
        "api_success_count": 0 if dry_run else len(measured),
        "api_success_rate": None if dry_run else ratio(len(measured), count),
        "expected_valid_acceptance": ratio(sum(row["semantic_valid"] for row in valid), len(valid)),
        "expected_invalid_rejection": ratio(sum(row["safe_rejection"] for row in invalid), len(invalid)),
        "false_rejection": sum(not row["semantic_valid"] for row in valid),
        "unsafe_acceptance": sum(row["unsafe_acceptance"] for row in invalid),
        "overall_match_rate": ratio(sum(row["overall_match"] for row in valid), len(valid)),
        "action_sequence_match_rate": ratio(sum(row["action_sequence_match"] for row in valid), len(valid)),
        "parameter_match_rate": ratio(sum(row["parameter_match"] for row in valid), len(valid)),
        "valid_case_schema_rate": ratio(sum(row["schema_valid"] for row in valid), len(valid)),
        "state_mutation_count": sum(row["state_mutation_count"] for row in rows),
        "average_latency_ms": ratio(sum(row["latency_ms"] for row in rows), count),
        "error_counts": dict(Counter(row["error_category"] for row in rows if row["error_category"])),
        "token_usage": {name: sum(row["token_usage"].get(name, 0) for row in rows)
                        for name in ("input_tokens", "output_tokens", "total_tokens")},
        "token_usage_measured_cases": sum(bool(row["token_usage"]) for row in rows),
        "dataset_fingerprint": hashlib.sha256(json.dumps(cases, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:12],
    }
    return summary


def write_report(summary, rows, output_dir):
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    (output_dir / "cases.jsonl").write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n", encoding="utf-8")
    report = ["# ScenePlan Shadow Evaluation v0.1", "", "Mode: " + summary["measurement_mode"], "",
              "Offline reference replay proves evaluator plumbing only; it is NOT a real model capability score.",
              "Unsupported cases are scored separately. Provider/configuration errors are not safe rejections.", "",
              "API/config/network failures are excluded from model-quality denominators. Null means not measured, not zero accuracy.", "",
              "```json", json.dumps(summary, ensure_ascii=False, indent=2), "```", "",
              "| Case | Expected | Schema | Semantic | Match | Category | Reason |", "| --- | --- | --- | --- | --- | --- | --- |"]
    for row in rows:
        reason = str(row["rejected_reason"] or "").replace("|", "\\|").replace("\n", " ")
        report.append(f'| {row["case_id"]} | {row["expected_status"]} | {row["schema_valid"]} | {row["semantic_valid"]} | {row["overall_match"]} | {row["error_category"] or "—"} | {reason} |')
    (output_dir / "report.md").write_text("\n".join(report) + "\n", encoding="utf-8")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="explicit paid network opt-in; requires AI_BUILDER_ENABLE_REAL_LLM=1")
    parser.add_argument("--max-cases", type=int, default=3)
    parser.add_argument("--case-ids", nargs="+", help="explicit cases; e.g. valid-19 valid-03 reject-12")
    parser.add_argument("--reclassify-dir", type=Path, help="rescore saved cases without any API call; requires a different output directory")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "artifacts" / "scene-plan-shadow-v0.1")
    args = parser.parse_args(argv)
    if args.reclassify_dir:
        if args.live or args.reclassify_dir.resolve() == args.output_dir.resolve():
            parser.error("reclassification is offline and must preserve the original directory")
        old_summary = json.loads((args.reclassify_dir / "summary.json").read_text(encoding="utf-8"))
        rows = [json.loads(line) for line in (args.reclassify_dir / "cases.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
        by_id = {case["id"]: case for case in load_cases()}
        cases = [by_id[row["case_id"]] for row in rows]
        summary = summarize_rows(cases, rows, SimpleNamespace(model=old_summary.get("model")), dry_run=False)
        summary["reclassified_without_api_calls"] = True
        write_report(summary, rows, args.output_dir)
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0
    cases = load_cases()
    if not 1 <= args.max_cases <= len(cases):
        parser.error("--max-cases must be between 1 and dataset length")
    if args.case_ids:
        by_id = {case["id"]: case for case in cases}
        if len(set(args.case_ids)) != len(args.case_ids) or any(key not in by_id for key in args.case_ids):
            parser.error("case IDs must be known and unique")
        if len(args.case_ids) > args.max_cases:
            parser.error("requested cases exceed --max-cases")
        cases = [by_id[key] for key in args.case_ids]
    if args.live and (os.getenv("AI_BUILDER_ENABLE_REAL_LLM") != "1" or not os.getenv("OPENAI_API_KEY")):
        parser.error("live mode requires explicit enable and configured OPENAI_API_KEY")
    adapter = OpenAIScenePlanAdapter() if args.live else None
    summary, rows = run_evaluation(cases[:args.max_cases], adapter, dry_run=not args.live)
    write_report(summary, rows, args.output_dir)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return int(summary["state_mutation_count"] != 0 or summary["false_rejection"] != 0
               or summary["unsafe_acceptance"] != 0 or summary["unavailable_case_count"] != 0
               or summary["overall_match_rate"] not in {None, 1.0})


if __name__ == "__main__":
    raise SystemExit(main())
