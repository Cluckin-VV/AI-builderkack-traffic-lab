# AI Builder 最小本地原型

这是一个只使用 Python 标准库的确定性本地原型。六个核心概念各有一个定义，均位于 `scene.py`：`SceneState`、`SceneAction`、`SceneCompiler`、`Validator`、`Renderer`、`EventLog`。

## 3D 场景预览

![3D交通场景预览](../docs/3d-scene-preview.svg)

页面使用 Canvas 的最小透视绘制：道路为梯形透视面，公交车由正面、侧面和车顶组成，信号灯由灯箱、立柱和灯色组成。它是视觉演示，不是完整交通仿真。

## Runtime Identity v0.1

服务启动后可访问：

```text
http://127.0.0.1:8000/health
```

返回当前运行身份：

```json
{
  "app_version": "0.3.0",
  "command_protocol_version": "0.3",
  "scene_action_version": "0.1",
  "started_at": "...",
  "source_fingerprint": "前12位SHA-256",
  "git_commit": "uncommitted"
}
```

页面顶部也会显示 App v0.3.0、Command Protocol v0.3、SceneAction v0.1、Source Fingerprint 和 Started At。每条 HTTP Event Log 会记录 `runtime_fingerprint`。核对页面、`/health` 和 Event Log 的指纹，可以判断浏览器是否连接到当前源码启动的服务。

## 运行

在仓库根目录执行：

```powershell
python -m ai_builder.main "增加一辆公交车"
```

运行测试：

```powershell
python -m unittest discover -s ai_builder/tests -v
```

启动浏览器演示：

```powershell
python -m ai_builder.server
```

然后打开 [http://127.0.0.1:8000](http://127.0.0.1:8000)。输入两个固定指令后点击“执行指令”，Canvas 中会显示公交车数量或信号灯颜色变化，页面下方会显示最近一次 Event Log。

## 浏览器交互验收

1. 启动 `python -m ai_builder.server`，浏览器打开 `http://127.0.0.1:8000`。
2. 输入“增加一辆公交车”：应显示 `accepted`，画面出现一辆公交车，Event Log 的 `state_change.after.buses` 为 `1`。
3. 输入“把信号灯变成红灯”：应显示 `accepted`，信号灯变红，Event Log 的 `state_change.after.traffic_light` 为 `红灯`。
4. 输入“增加一架飞机”：应显示 `rejected`，画面公交车数量和信号灯颜色保持不变，Event Log 的 before/after 相同。
5. 检查浏览器开发者工具 Console：不应有错误或警告。
6. 截取浏览器页面截图，确认道路、公交车和信号灯均可见；可与 `docs/3d-scene-preview.svg` 对照。

测试中还包含一个标准库 HTTP 端到端测试，覆盖浏览器使用的 `/command` 接口。

## 执行链

```text
User Command
→ SceneCompiler.compile
→ Candidate SceneAction
→ Validator.validate
→ SceneState.apply（仅 accepted）
→ Renderer.render
→ EventLog.append
```

## 当前支持的命令协议

每个别名都会先由 `SceneCompiler` 生成 `SceneAction`，再由 `Validator` 验证；编译器不修改状态。

- 增加公交车：`增加一辆公交车`、`场景里来一辆公交车`、`放一辆公交车到道路上`
- 删除公交车：`删除一辆公交车`、`移除一辆公交车`、`删除公交车`
- 信号灯变红：`把信号灯变成红灯`、`红灯`、`设置为红色`
- 信号灯变绿：`把信号灯变成绿灯`、`绿灯`、`设置为绿色`
- 公交车停止：`让公交车停下`、`公交车停止`、`让公交车停住`
- 公交车前进：`让公交车前进`、`公交车继续行驶`、`让公交车继续前进`
- 公交车前进：`让公交车继续行驶`
- 信号灯变红：`把信号灯改成红色`
- 信号灯变绿：`把红灯变回绿色`

## 明确不支持的表达

- 空指令、模糊表达（如“弄一下交通”）；
- 同时包含两个动作的表达（如“增加公交车并变红”）；
- 不存在的对象（如“让出租车停下”）；
- 非法信号灯颜色（如“设置为蓝色”）；
- 没有公交车时要求公交车停止、前进或删除。

这些输入均返回 `rejected`，且不修改 `SceneState`。

## SceneAction Protocol v0.1

Compiler 输出的正式动作结构如下；`SceneState.apply` 必须收到对应的 accepted `ValidationResult` 才能更新状态。

```json
{
  "version": "0.1",
  "action_type": "set_traffic_light",
  "target": "traffic_light",
  "parameters": {"color": "红灯"},
  "source_command": "把信号灯变成红灯",
  "action_id": "412def63e81d93d4"
}
```

允许的 `action_type`：`add_bus`、`remove_bus`、`set_traffic_light`、`stop_bus`、`move_bus`。
Validator 会拒绝缺失字段、未知动作/参数/目标、错误参数类型、非法颜色和不支持的版本。Event Log 同时保存 `action_id`、原始命令、协议动作、验证结果、前后状态和拒绝原因，因此动作可以从 JSON 恢复并确定性重放。

## Mock LLM Adapter v0.1

`ai_builder/model_adapter.py` 提供离线 `ModelAdapter` 接口和 `FakeModelAdapter`。它只模拟模型输出，不调用模型、网络、API 或密钥。

```text
User Command
→ FakeModelAdapter.generate_action
→ JSON 序列化/反序列化
→ SceneAction
→ Validator
→ SceneState.apply
→ Renderer / EventLog
```

LLM 无权直接写状态。任何模型输出，即使是合法 JSON，也必须先恢复为 `SceneAction` 并通过 `Validator`；非法 JSON、缺字段、未知动作、非法参数和组合动作都会被拒绝，状态保持不变，Event Log 保存具体 `rejected_reason`。

浏览器 HTTP 演示使用依赖注入的 `FakeModelAdapter`，完整链路为：

```text
浏览器输入
→ server.py 注入的 ModelAdapter
→ FakeModelAdapter.generate_action
→ JSON 解析
→ SceneAction
→ Validator
→ SceneState.apply
→ Renderer
→ Event Log
```

`server.py` 不直接调用 `SceneCompiler`；未来可以在同一注入边界替换为 `RealLLMAdapter`。当前仍不接入真实模型、网络、API、数据库或新框架。

## Real LLM Shadow Evaluation

影子评测使用环境变量配置，不把 API Key 写入代码或提交 `.env`：

```powershell
$env:AI_BUILDER_LLM_MODE="shadow"
$env:AI_BUILDER_LLM_API_KEY="你的本机密钥"
python -m ai_builder.shadow_evaluate
```

未配置 API Key 时会自动使用离线 Fake Adapter；影子模式只执行 `JSON → SceneAction → Validator`，不会调用 `SceneState.apply`，因此真实模型无权直接改变浏览器场景。

运行 Mock Adapter 测试：

```powershell
python -m unittest discover -s ai_builder/tests -v
```

未知指令会生成 `rejected` 结果和事件日志，但不会调用状态更新。非法动作同样会被 Validator 拒绝。

## 已知限制

- 仅支持命令协议中列出的中文表达，不能自然语言泛化。
- 状态只存在于当前进程内，不持久化。
- Event Log 只保存在内存中，不提供查询服务。
- 没有 HTTP、数据库、Redis、LangGraph、RAG 或真实 LLM 接入。
- `Renderer` 只格式化已有状态，不负责判断指令或修改状态。
- 浏览器 Canvas 是页面展示层；Python `Renderer` 将 `SceneState` 转为透视场景数据和可读文本，命令解析及业务判断仍在领域链中。
- 3D 只是 Canvas 的确定性绘制效果，不包含摄像机、碰撞、路径规划或物理模拟。
- “公交车停止/前进”目前只改变 `bus_running` 状态并改变显示颜色，不模拟位置移动。
