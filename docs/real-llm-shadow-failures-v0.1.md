# Real LLM Shadow Failures v0.1

本报告由 `python -m ai_builder.shadow_evaluate` 自动生成。当前无 API Key 时使用离线 Fake Adapter。

## 失败分类统计

| 分类 | 数量 |
|---|---:|
| `invalid_json` | 0 |
| `missing_field` | 0 |
| `unknown_action_type` | 10 |
| `invalid_parameter` | 0 |
| `unsupported_expression` | 0 |
| `other` | 1 |

## 失败案例

| case_id | command | expected_status | validator_result | rejected_reason | expected_action_type | actual_action_type |
|---|---|---|---|---|---|---|
| valid-11 | 让公交车继续行驶 | accepted | rejected | no bus exists | move_bus | move_bus |
| unknown-01 | 增加一架飞机 | rejected | rejected | unknown action_type | unknown | unknown |
| unknown-02 | 让出租车停下 | rejected | rejected | unknown action_type | unknown | unknown |
| unknown-03 | 让道路变成河流 | rejected | rejected | unknown action_type | unknown | unknown |
| unknown-04 | 打开天气系统 | rejected | rejected | unknown action_type | unknown | unknown |
| unknown-05 | 删除一架飞机 | rejected | rejected | unknown action_type | unknown | unknown |
| ambiguous-01 | 弄一下交通 | rejected | rejected | unknown action_type | unknown | unknown |
| ambiguous-02 | 增加公交车并变红 | rejected | rejected | unknown action_type | unknown | unknown |
| ambiguous-03 | 设置为蓝色 | rejected | rejected | unknown action_type | unknown | unknown |
| ambiguous-04 | 公交车快一点然后变红灯 | rejected | rejected | unknown action_type | unknown | unknown |
| ambiguous-05 |  | rejected | rejected | missing required field | unknown | unknown |
