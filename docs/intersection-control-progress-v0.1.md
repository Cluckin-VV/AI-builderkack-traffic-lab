# 十字路口与天气：本地实现进度

日期：2026-09-13；2026-09-14 发布候选复验。状态：已纳入 App v0.5.0 发布候选；尚未更新 Render，不是最终比赛提交。

## 本轮已验证

- `ai_builder/static/traffic-controller.mjs`：独立于 Three.js 的固定步长交通控制器；东西与南北互斥放行、1.5 秒最小全红清空阶段、停车线、同车道跟车、四条直行路线。
- 手动停止与红灯等待是不同状态。已进入路口的车辆可清空路口；若手动停在路口内，另一方向保持红灯，不强行放行。
- 晴、雨、雪、雾有不同的简化速度上限。这是演示规则，不是经过标定的道路交通或气象模型。
- 天气候选动作经过既有 schema → semantic → apply 链。原始输入保留在 Event Log。
- SceneState 快照包含 buses、traffic_light、bus_running、weather，避免漏掉运动意图或天气修改。
- 增加公交车不再隐式取消手动停止；改变信号灯也不取消手动停止。

## 验证命令与实际结果

```text
python -m unittest discover -s ai_builder/tests -q
Ran 209 tests / OK

node --test tools/test-traffic-controller.mjs
8 tests / 8 pass / 0 fail

python -m ai_builder.evaluate
合法指令正确接受率：19/19（100%）
非法/歧义指令正确拒绝率：12/12（100%）
错误拒绝：0；危险接受：0；状态误修改：0；Event Log 缺失：0
```

Python 新增 8 项测试（含多表达及错误类型子案例）。独立 JavaScript 新增 8 项测试，覆盖红灯停车、清空路口、手动停止、冲突互斥、雪天降速、重放、长期排队间距和快照隔离。

## 明确边界

服务器 SceneState 是经过验证的场景配置。TrafficController 是每个浏览器各自的本地 SimulationState，计算位置、信号阶段和停车原因；它不写服务器状态。Renderer 后续只读取其快照绘图。

`scene3d.js` 已导入控制器，并且只把它的只读坐标、原因和灯色映射到 Three.js 对象。四组信号灯、十字道路、停车线、四向公交路线、雨雪粒子、雾效、冬季光照和雨天湿路均已接入。页面已把暴雪列为天气动作，把陨石列为拒绝示例。

“让天气下暴雪”当前映射 snow，不表示支持独立暴雪强度。组合指令继续拒绝。没有新模型调用、付费资源、GitHub push 或 Render 部署。

## 浏览器验收证据

使用 Playwright CLI 在 Chromium、1600×1000 与 390×844 视口验证：

- 本地运行指纹 `4c6d083172e4`，App `0.5.0`、Command Protocol `0.3`、SceneAction `0.2`；
- 四辆公交车产生四个方向，EW 绿时页面显示 2 辆行驶、2 辆等待；
- 红灯切换期间捕获 `EW 红 · NS 红` 和“全红清空”，之后才进入 `EW 红 · NS 绿`；
- 手动停止后新增公交车仍显示两辆手动停止；继续行驶后恢复基于路权的行驶/等待；
- 雨、雾、雪、晴天均通过页面命令进入 execution；雾和雪有可辨识视觉效果；
- “让天气下陨石”被 schema 阶段拒绝，前后完整 SceneState 完全相同；
- 浏览器控制台 0 errors、0 warnings；移动视口未发现横向布局溢出。

截图：[四向路口](transitlab-crossroads-local.png)；[雪天场景](transitlab-snow-local.png)。

## 仍未验证与下一步

公开 Render 在 `/health` 显示 App `0.5.0` 前仍视为旧候选。当前只有直行路线，不含转弯、行人或专业交通仿真；交通 SimulationState 只存在于每个浏览器，服务器 Event Log 记录命令和配置变化，不记录每个动画 tick。下一步是公开部署与录屏级端到端验证；不能把视觉质量误当作模型泛化能力。
