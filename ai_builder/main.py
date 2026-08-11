import sys

from ai_builder.scene import EventLog, SceneState, render_command


def main() -> int:
    command = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else input("指令：")
    state = SceneState()
    event_log = EventLog()
    result = render_command(command, state, event_log)
    print(result["status"])
    print(result["rendered"])
    print(result["event"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
