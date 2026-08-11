# Model Pipeline Baseline v0.1

评测入口：`ai_builder/evaluation_cases.json`  
执行方式：

```powershell
python -m unittest discover -s ai_builder/tests -v
```

## 评测集

共 23 条指令：

- 合法表达：13 条；
- 未知/不支持表达：5 条；
- 歧义、组合或非法表达：5 条。

每条案例包含 `id`、`command`、`expected_status`、`expected_action_type`、`expected_state_change` 和 `risk_level`。

## 当前基线结果

本地 FakeModelAdapter 基线：

```text
合法指令通过率：100%（13/13）
非法指令拒绝率：100%（10/10）
状态误修改数量：0
Event Log 缺失数量：0
```

评测通过同一条模型管线运行每条命令：

```text
FakeModelAdapter
→ JSON 解析
→ SceneAction
→ Validator
→ SceneState
→ Renderer / Event Log
```

非法或未知表达均要求 `state_before == state_after`，且 Event Log 必须包含命令、协议动作、验证结果、前后状态和拒绝原因。当前基线不包含真实 LLM，不代表真实模型的质量。
