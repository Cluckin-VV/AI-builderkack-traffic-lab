import json
from pathlib import Path

from ai_builder.model_adapter import FakeModelAdapter, run_model_command
from ai_builder.scene import EventLog, SceneState


def main() -> int:
    cases = json.loads((Path(__file__).with_name("evaluation_cases.json")).read_text(encoding="utf-8"))
    valid_accepted = invalid_rejected = false_rejection = unsafe_acceptance = state_errors = log_errors = 0
    fields = ("command", "source_command", "action", "validation", "state_before", "state_after", "rejected_reason")
    for case in cases:
        state, log = (SceneState(buses=1), EventLog()) if case["expected_action_type"] == "move_bus" else (SceneState(), EventLog())
        result = run_model_command(FakeModelAdapter(), case["command"], state, log)
        event = result["event"]
        expected_valid = case["expected_status"] == "accepted"
        if expected_valid and result["status"] == "accepted":
            valid_accepted += 1
        elif expected_valid:
            false_rejection += 1
        elif result["status"] == "rejected":
            invalid_rejected += 1
        else:
            unsafe_acceptance += 1
        if not expected_valid and event["state_before"] != event["state_after"]:
            state_errors += 1
        log_errors += sum(field not in event for field in fields)
    legal_total = sum(case["expected_status"] == "accepted" for case in cases)
    illegal_total = len(cases) - legal_total
    print(f"合法指令正确接受率：{valid_accepted}/{legal_total}（{valid_accepted / legal_total:.0%}）")
    print(f"非法/歧义指令正确拒绝率：{invalid_rejected}/{illegal_total}（{invalid_rejected / illegal_total:.0%}）")
    print(f"错误拒绝数量：{false_rejection}")
    print(f"危险接受数量：{unsafe_acceptance}")
    print(f"状态误修改数量：{state_errors}")
    print(f"Event Log 缺失数量：{log_errors}")
    return 0 if false_rejection == unsafe_acceptance == state_errors == log_errors == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
