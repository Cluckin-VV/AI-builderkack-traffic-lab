# TransitLab v0.5 — final submission audit

检查时间：2026-09-16。范围：当前公开 AI Builder Hackathon 2026、仓库 `0594648`、部署 `038a9ef` / `4c6d083172e4`、已发布 `v0.5.0-rc.1` 视频。用户所说“CAC”未给出独立规则地址；本报告不声称符合另一项竞赛。

**结论：暂不提交（NO-GO），不是判定项目已被取消资格。** 用户已授权检查通过后提交；确定性容量缺陷已在本地修复并通过回归测试，但尚未提交、部署。规则/时间冲突及登录入口阻塞仍未解除。没有点击 Submit，没有扩大命令协议或重写历史。

## 1. 可复核的基本功能

- 上一轮完整测试：209 Python + 8 JavaScript 全过；31 条既定评测合法19/19、非法12/12。这些证明既定契约，不是陌生提示词理解率。
- 本轮本地经 `FakeModelAdapter → run_model_command` 独立检查：增加、删除、停止、继续、红灯、绿灯、雨、雪、雾、晴十条既有表达全部 accepted。每次初态为一辆车；已处于目标状态的继续/绿灯/晴天是合法无变化，不算漏执行。
- 本轮 `/health` 再查仍为 App0.5.0 / Command0.3 / SceneAction0.2 / `038a9ef` / `4c6d083172e4`。
- 公网交互、移动布局、拒绝状态和暂停画面保持不变、2:12 视频公开下载证据见 `public-deployment-v0.5.md` 与 `demo-video-capture-v0.5.md`。

## 2. 已修复但尚未部署：第13辆车容量契约

本轮只在内存中的独立实例复现，未用13辆车污染公开服务：

```text
13次“增加一辆公交车” → 13次accepted
SceneState.buses = 13
render_data.bus_count = 13
TrafficController.configure({buses:13}) → snapshot().vehicles.length = 12
```

位置：

- `ai_builder/scene.py::SceneState.apply` 增加车辆未限制数量；`validate_scene_action_semantics` 未拒绝超过可显示上限的增加。
- `ai_builder/static/traffic-controller.mjs::TrafficController.configure` 把数量截到12。
- `ai_builder/static/scene3d.js::Scene3DRenderer.setBusCount` 同样截到12（具体类名以文件定义为准）。

影响：原行为中，第13次成功响应不能兑现为新增可见车辆，违背“指令与画面一致”的验收目标。现已建立明确的12辆容量契约：第12辆接受，第13辆在语义验证阶段以 `SEMANTIC_CAPACITY_REACHED` 拒绝且状态不变，删除后可再次添加；`SceneState.apply` 也保护容量不变量。浏览器仿真和渲染共用前端 `MAX_BUSES`。新增5个Python单元测试、1个HTTP集成测试和1个JavaScript容量测试；完整结果为215个Python测试与9个JavaScript测试全部通过。此修复仍只在本地，公开部署尚未更新。

## 3. 获奖竞争力不是测试数量

额外探测的以下八条表达全部在 schema 阶段 rejected，原因 `unknown action_type`，完整状态均未改变：

| 表达 | 分类 |
| --- | --- |
| Add a bus | 已有动作的英文表达 |
| Stop the bus | 已有动作的英文表达 |
| Turn the traffic light red | 已有动作的英文表达 |
| 帮我把公交车停下来 | 已有动作的中文改述 |
| 道路上再来一辆公交 | 已有动作的中文改述 |
| 把信号灯调成红色 | 已有动作的中文改述 |
| 增加两辆公交车 | 尚不支持数量参数 |
| 创建一个雨夜十字路口 | 尚不支持自由布局/时间/组合场景生成 |

这是小规模有目的的诊断集，不是随机盲测，也不能外推真实总体成功率。陨石和组合动作另测两条均安全拒绝，符合当前契约。

证据：`scene.py::SceneCompiler._COMMANDS/compile` 使用固定表达查表；`model_adapter.py::FakeModelAdapter.generate_action` 直接调用该编译器。浏览器不是由真实LLM理解自由提示词，后者仍仅做shadow评测。

判断：交互式3D、交通逻辑和可解释验证链是已实现的优势；当前自然语言覆盖、英语交互与自由场景创作能力仍是明显短板，**没有依据声称已达获奖水准或保证名次**。不应在提交前临时绕过Validator接入LLM，也不应拿脚本成功率替代评委陌生输入的表现。

## 4. 官方要求与提交风险

来源：[主办方条款](https://www.victoriavr.com/hackathon/2026/terms)、[Kaggle Rules](https://www.kaggle.com/competitions/ai-builder-hackathon-2026/rules)、[Kaggle概览](https://www.kaggle.com/competitions/ai-builder-hackathon-2026)。Kaggle文字通过独立浏览器实际读取，不仅依赖搜索摘要。

| 检查 | 结论 |
| --- | --- |
| 浏览器3D与可运行逻辑 | 在声明的固定命令范围内具备；容量缺陷待修 |
| 公开代码、演示、短视频、介绍、类别 | 文件/链接已备齐，类别AI 3D Scene Generation；在线Writeup是否保存未核实 |
| 评审期间可用 | 目前可访问；免费实例曾503冷启动并重置状态，持续可用不能保证 |
| 自有提示词评审 | 官方条款9.4允许；上述表达覆盖问题有实际影响 |
| 赛前成果 | Kaggle明确写“Create only during the hackathon”；本仓库有8月11日、9月2日实现提交，素材说明记载9月7日生成。不能默认证明符合9月11日开始的建设期；应取得主办方对复用和披露范围的书面解释 |
| 时间/入口 | 官网条款仍列11月11日截止；Kaggle概览显示Close为“4 days ago”，不是可据此擅自推定的最终赛程。需主办方核实正确入口/截止时间 |
| 账号与资格 | 独立浏览器为Sign In状态，已登录浏览器桥接失败。完整报名、年龄及资格声明不能由程序推断 |
| 素材许可 | `THIRD_PARTY_NOTICES.md` 保留Three.js MIT、Blender创作和AI协助说明；AI工具/生成素材的具体提供方与适用条款仍应按官方7.4补全核对，不自动为用户作法律担保 |

当前Kaggle Writeups公开列表显示没有公开writeup；这不能证明用户没有私有草稿。GitHub MP4免登录下载已验证，但未登录编辑器不能核验其视频字段是否接受该托管形式。

## 5. 提交前最小门槛

1. 将已通过测试的车辆容量修复提交、部署，并核对公开状态/画面。
2. 请主办方确认赛前原型和素材的可用范围，以及Kaggle关闭状态与官网赛程冲突；如不允许，必须改为合规提交范围，不能改写提交日期或隐瞒历史。
3. 恢复可访问的已登录Kaggle会话，核对原草稿、视频字段和确认声明。
4. 将材料准确描述为受约束交通场景编辑器；是否以获奖为目标继续增强泛化应另行决策，不假称已经具备。

本轮结果保留为本地审计记录；**无最终提交确认号、无成功提交截图，也未向主办方发送邮件**。
