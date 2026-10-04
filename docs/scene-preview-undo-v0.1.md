# Scene Preview + Undo v0.1

## 目的

这一轮把浏览器交互从“生成后直接提交”推进为可解释的两阶段工作流：

```text
自然语言或结构配置
→ DeterministicScenePlanner
→ ScenePlan v0.1
→ 每个 SceneAction v0.2 的 Schema 验证
→ 每个 SceneAction 的场景语义验证
→ detached SceneState 预演
→ projected 3D scene
→ 用户明确确认
→ 原子提交 live SceneState
→ Renderer + Event Log
```

撤销也遵循同一条受约束路径：

```text
最近一次已确认变化
→ 服务端 checkpoint
→ 生成补偿性 ScenePlan
→ Schema + Semantic 验证
→ projected 3D scene
→ 用户明确确认
→ 原子恢复 live SceneState
→ scene_plan_undo Event Log
```

## 实现边界

- `ai_builder/scene_plan.py::preview_scene_plan` 在深拷贝状态上模拟动作；预演不会写入 live `SceneState`。
- `ai_builder/scene_history.py::SceneHistory` 只保留服务端最近一组有状态变化的 checkpoint，默认最多 20 个。
- `SceneHistory.prepare_undo` 只允许撤销当前最新、且仍与 live snapshot 一致的 change id。
- 撤销不是直接恢复任意客户端提交的 JSON，而是由服务端根据 checkpoint 生成 `remove_bus`、`set_scene_layout`、`set_weather`、`set_traffic_light`、`stop_bus` 或 `move_bus` 等补偿动作，再走完整验证链。
- `ai_builder/server.py` 的 `/plan/preview`、`/plan/execute`、`/plan/cancel` 和 `/history/undo-preview` 都在同一把命令锁下检查状态；确认阶段会再次预演，防止 stale plan 提交。
- `ai_builder/static/app.js` 将 `projected_scene` 只同步到 Renderer，并显示“预演视图 · 尚未提交”；取消、拒绝或确认后恢复 live scene。
- Event Log 为计划执行记录 `scene_plan_execution`；撤销记录 `scene_plan_undo` 和 `undo_of`，同时保留 command、steps、state_before、state_after、validation_stage 和 runtime fingerprint。

## 用户可见行为

1. 输入 `创建公交站情境，然后增加两辆公交车并让天气下雪`，点击“生成并预演”。
2. 页面显示 4 个候选动作和目标 3D 公交站；左侧的 live SceneState 仍未改变。
3. 点击“确认执行全部动作”后，场景切换为 Central Exchange，显示两辆公交车和雪天，Event Log 增加一次 execution 事件。
4. 点击“撤销上次修改”，页面先显示撤销计划：删除两辆公交车、恢复十字路口、恢复晴天；此时仍只是投影。
5. 再次确认后，场景恢复为 Nexus Crossing、0 辆公交车、晴天，并记录一条带 `undo_of` 的 undo 事件。

## 短路与安全规则

- 预演失败、取消、未知指令、组合动作冲突和语义失败都不得改变 live state。
- 任何 live state 变化都会清除未确认的 pending plan，避免旧预演覆盖新状态。
- 只接受服务端返回的 `change_id`；客户端不能提交任意目标 state 作为撤销目标。
- 只能撤销最新一次仍有效的 checkpoint；有新变化后，旧 undo 会返回 `STALE_UNDO`。
- 撤销只恢复当前领域模型能表达的字段。无法由现有动作完整表示的变化会被拒绝，不进行部分恢复。
- 这是 bounded authored-template workflow，不是任意 3D 世界的通用版本控制或物理仿真。

## 验收证据

隔离本地服务 `127.0.0.1:8020` 上用 Playwright 操作真实页面完成：

- 预演截图：[preview-projector.png](../output/playwright/preview-projector.png)
- 确认后截图：[preview-confirmed.png](../output/playwright/preview-confirmed.png)
- 撤销预演截图：[undo-preview.png](../output/playwright/undo-preview.png)
- 控制台：0 errors，0 warnings。

Python 全套测试：`284 tests OK`。

JavaScript 场景/编辑器测试：`19 tests passed`。

本轮没有真实 LLM 请求、没有付费 API、没有数据库、没有部署或 GitHub push。
