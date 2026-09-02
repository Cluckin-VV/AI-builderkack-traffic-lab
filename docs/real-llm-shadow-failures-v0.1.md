# Real LLM Shadow Failures v0.1

本报告由 `python -m ai_builder.shadow_evaluate` 自动生成。当前无 API Key 时使用离线 Fake Adapter。

## 失败分类统计

| 分类 | 数量 |
|---|---:|
| `invalid_json` | 0 |
| `missing_field` | 0 |
| `unknown_action_type` | 23 |
| `invalid_parameter` | 0 |
| `unsupported_expression` | 0 |
| `other` | 0 |

## 失败案例

| case_id | command | expected_status | validator_result | rejected_reason | expected_action_type | actual_action_type |
|---|---|---|---|---|---|---|
| valid-01 | 增加一辆公交车 | accepted | rejected | SceneAction.__init__() got an unexpected keyword argument 'protocol_version' | add_bus |  |
| valid-02 | 场景里来一辆公交车 | accepted | rejected | SceneAction.__init__() got an unexpected keyword argument 'protocol_version' | add_bus |  |
| valid-03 | 放一辆公交车到道路上 | accepted | rejected | SceneAction.__init__() got an unexpected keyword argument 'protocol_version' | add_bus |  |
| valid-04 | 把信号灯变成红灯 | accepted | rejected | SceneAction.__init__() got an unexpected keyword argument 'protocol_version' | set_traffic_light |  |
| valid-05 | 红灯 | accepted | rejected | SceneAction.__init__() got an unexpected keyword argument 'protocol_version' | set_traffic_light |  |
| valid-06 | 设置为红色 | accepted | rejected | SceneAction.__init__() got an unexpected keyword argument 'protocol_version' | set_traffic_light |  |
| valid-07 | 把信号灯变成绿灯 | accepted | rejected | SceneAction.__init__() got an unexpected keyword argument 'protocol_version' | set_traffic_light |  |
| valid-08 | 绿灯 | accepted | rejected | SceneAction.__init__() got an unexpected keyword argument 'protocol_version' | set_traffic_light |  |
| valid-09 | 设置为绿色 | accepted | rejected | SceneAction.__init__() got an unexpected keyword argument 'protocol_version' | set_traffic_light |  |
| valid-10 | 增加一辆公交车 | accepted | rejected | SceneAction.__init__() got an unexpected keyword argument 'protocol_version' | add_bus |  |
| valid-11 | 让公交车继续行驶 | accepted | rejected | SceneAction.__init__() got an unexpected keyword argument 'protocol_version' | move_bus |  |
| valid-12 | 把信号灯改成红色 | accepted | rejected | SceneAction.__init__() got an unexpected keyword argument 'protocol_version' | set_traffic_light |  |
| valid-13 | 把红灯变回绿色 | accepted | rejected | SceneAction.__init__() got an unexpected keyword argument 'protocol_version' | set_traffic_light |  |
| unknown-01 | 增加一架飞机 | rejected | rejected | SceneAction.__init__() got an unexpected keyword argument 'protocol_version' | unknown |  |
| unknown-02 | 让出租车停下 | rejected | rejected | SceneAction.__init__() got an unexpected keyword argument 'protocol_version' | unknown |  |
| unknown-03 | 让道路变成河流 | rejected | rejected | SceneAction.__init__() got an unexpected keyword argument 'protocol_version' | unknown |  |
| unknown-04 | 打开天气系统 | rejected | rejected | SceneAction.__init__() got an unexpected keyword argument 'protocol_version' | unknown |  |
| unknown-05 | 删除一架飞机 | rejected | rejected | SceneAction.__init__() got an unexpected keyword argument 'protocol_version' | unknown |  |
| ambiguous-01 | 弄一下交通 | rejected | rejected | SceneAction.__init__() got an unexpected keyword argument 'protocol_version' | unknown |  |
| ambiguous-02 | 增加公交车并变红 | rejected | rejected | SceneAction.__init__() got an unexpected keyword argument 'protocol_version' | unknown |  |
| ambiguous-03 | 设置为蓝色 | rejected | rejected | SceneAction.__init__() got an unexpected keyword argument 'protocol_version' | unknown |  |
| ambiguous-04 | 公交车快一点然后变红灯 | rejected | rejected | SceneAction.__init__() got an unexpected keyword argument 'protocol_version' | unknown |  |
| ambiguous-05 |  | rejected | rejected | SceneAction.__init__() got an unexpected keyword argument 'protocol_version' | unknown |  |
