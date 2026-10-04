# TransitLab Judge Demo v0.6

## 一句话

TransitLab 不是让模型直接“画一张图”，而是让用户用一句话提出交通场景变化，系统先生成可解释的 ScenePlan，在真实 3D 场景中预演，经过 Schema 与场景语义验证后，用户确认才提交；错误指令会被拒绝，最近一次变化可以通过同样的受约束动作链撤销。

## 评委演示顺序

总时长建议 90–120 秒。不要先讲代码，先让评委看到“说一句话，世界如何响应”。

| 时间 | 操作 | 评委应该看到 | 要讲的一句话 |
| --- | --- | --- | --- |
| 00:00–00:08 | 展示初始十字路口 | 可交互 WebGL 城市场景、信号灯、公交车控制区 | “这是一个浏览器内的交通世界，不是预录图片。” |
| 00:08–00:20 | 输入 `创建公交站情境，然后增加两辆公交车并让天气下雪` | 左侧出现 4-step ScenePlan；右侧显示目标公交站、两辆车、雪天 | “先预演，确认前 live SceneState 不变。” |
| 00:20–00:30 | 点击“确认执行全部动作” | 场景切换为 Central Exchange，公交车进入站台，Event Log 出现 execution | “四个动作原子提交，Renderer 只消费状态。” |
| 00:30–00:42 | 输入 `把信号灯改成红色` 并确认 | 十字路口四个受控灯全红；所有公交在停止线前等待 | “红灯不是贴颜色，而是明确关闭所有公交通行。” |
| 00:42–00:52 | 输入 `让公交车停下` 并确认 | 车辆停止，Inspector 显示 `bus_running=false` | “动作经过协议和语义验证后才改变状态。” |
| 00:52–01:02 | 输入 `让天气下陨石` | REJECTED，画面和 SceneState 不变，Event Log 给出原因 | “未知世界能力不会偷偷改变场景。” |
| 01:02–01:15 | 点击“撤销上次修改” | 先出现撤销计划，3D 场景预演为继续行驶；尚未提交 | “撤销不是客户端覆盖状态，而是服务端生成补偿动作。” |
| 01:15–01:25 | 确认撤销 | 车辆恢复行驶，Event Log 出现 `scene_plan_undo` 和 `undo_of` | “每次变化都可解释、可追踪。” |
| 01:25–01:38 | 输入 `把红灯变回绿色` 并确认 | EW 绿、NS 红；只有 EW 方向恢复运行，NS 方向继续等待 | “同一条链路同时支持创建、约束、拒绝和恢复。” |
| 01:38–01:50 | 展开 Event Log / 拖动镜头 | 3D 细节、动作 ID、验证阶段、状态前后快照 | “这是一个可审计的 AI-native 交互世界。” |

## 演示前准备

从仓库根目录执行：

```powershell
cd "D:\ai-builder-traffic-lab"
python -m unittest discover -s ai_builder/tests -q
node --test tools/test-scene-editor.mjs tools/test-bus-stop-controller.mjs tools/test-traffic-controller.mjs
```

如果需要生成一套全新的本地验收截图：

```powershell
cd "D:\ai-builder-traffic-lab"
.\tools\run-judge-demo-v06.ps1
```

脚本会在隔离的 `127.0.0.1:8021` 进程中启动服务，使用同一个真实浏览器会话分三个短阶段完整执行上表流程，输出 11 张截图到 `output/playwright/`，读取控制台并在结束时关闭浏览器和服务。分阶段是为了避开 Windows 对单条命令行长度的限制。它不会调用真实 LLM、网络模型、数据库或公共部署。

## 演示验收点

- 预演截图中必须出现 `预演视图 · 尚未提交`，且 projected 场景已经变化。
- 第一次确认后应为 `bus_stop`、2 辆公交车、`snow`。
- 红灯和停车动作都必须经过预演/确认，不能通过 Renderer 直接改画面。
- 陨石指令必须 `rejected`，且 `state_before == state_after`。
- 撤销必须先出现撤销预演，再通过确认；Event Log 必须包含 `scene_plan_undo` 与 `undo_of`。
- 最终状态应为两辆公交车、绿灯、雪天，且 Event Log 可展开。
- 除了已断言的 unsupported-intent HTTP `422` 网络提示外，控制台不得出现 JavaScript errors 或 warnings；脚本的三个阶段会分别检查这一点。

浏览器可能把用于显示安全拒绝的 HTTP `422` 作为一条网络 console message；验收脚本会把这一条已断言的业务拒绝与真正的 JavaScript error 分开统计，真正的页面异常仍会失败。

## 诚实边界

这条流程展示的是一个聚焦交通场景的、受约束的 ScenePlan builder。它不是任意自然语言生成任意 3D 世界，也不是现实交通预测系统；真实 LLM 仍处于 shadow-only，浏览器主路径使用确定性规划器。演示的竞争力来自“自然语言 → 可解释预演 → 安全确认/拒绝 → 可撤销 3D 世界”的完整交互，而不是把固定模板包装成通用 AGI。

## 当前证据

本轮本地浏览器验收应保留：

- `output/playwright/judge-demo-01-preview.png`
- `output/playwright/judge-demo-02-bus-stop-snow.png`
- `output/playwright/judge-demo-04-red-light.png`
- `output/playwright/judge-demo-07-safe-rejection.png`
- `output/playwright/judge-demo-08-undo-preview.png`
- `output/playwright/judge-demo-11-finale.png`

完整测试结果和版本边界继续以 README、`/health` 和 `progress.md` 为准。

2026-09-21 本地实跑结果：三个 Playwright 阶段均返回 `passed: true`；最终状态为 `buses=2`、`traffic_light=绿灯`、`bus_running=true`、`weather=snow`、`scene_layout=bus_stop`。阶段脚本报告 0 个真实 JavaScript/page errors；安全拒绝产生的 HTTP `422` 被单独识别为预期业务结果。Python `284 OK`，JavaScript `19 passed`。
