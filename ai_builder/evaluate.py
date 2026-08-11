import json
from pathlib import Path

from ai_builder.model_adapter import FakeModelAdapter, run_model_command
from ai_builder.scene import EventLog, SceneState


def main() -> int:
    cases = json.loads((Path(__file__).with_name("evaluation_cases.json")).read_text(encoding="utf-8"))
    accepted = rejected = state_errors = log_errors = 0
    fields = ("command", "source_command", "action", "validation", "state_before", "state_after", "rejected_reason")
    for case in cases:
        state, log = (SceneState(buses=1), EventLog()) if case["expected_action_type"] == "move_bus" else (SceneState(), EventLog())
        result = run_model_command(FakeModelAdapter(), case["command"], state, log)
        event = result["event"]
        if result["status"] == "accepted":
            accepted += 1
        else:
            rejected += 1
            if event["state_before"] != event["state_after"]:
                state_errors += 1
        log_errors += sum(field not in event for field in fields)
    legal_total = sum(case["expected_status"] == "accepted" for case in cases)
    illegal_total = len(cases) - legal_total
    print(f"合法指令通过率：{accepted}/{legal_total}（{accepted / legal_total:.0%}）")
    print(f"非法指令拒绝率：{rejected}/{illegal_total}（{rejected / illegal_total:.0%}）")
    print(f"状态误修改数量：{state_errors}")
    print(f"Event Log 缺失数量：{log_errors}")
    return 0 if state_errors == 0 and log_errors == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
