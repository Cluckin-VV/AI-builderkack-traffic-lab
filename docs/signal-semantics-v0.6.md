# Signal Semantics v0.6

## 目的

修复一个会误导用户的路口行为：此前，用户把信号灯设为红灯时，浏览器控制器会把另一条方向切成绿灯。对于只有一个用户可见 `traffic_light` 字段的协议，这会让“红灯”看起来仍然允许公交通过。

## 当前唯一规则

| 场景布局 | 用户状态 | 画面信号 | 公交行为 |
| --- | --- | --- | --- |
| 十字路口 | `红灯` | EW 红、NS 红 | 所有方向在停止线前等待 |
| 十字路口 | `绿灯` | EW 绿、NS 红 | EW 放行，NS 在停止线前等待 |
| 双向公交站 | `红灯` | 站台信号红 | 站前停车 |
| 双向公交站 | `绿灯` | 站台信号绿 | 站台进出方向放行；停靠逻辑仍由控制器处理 |

这不是把红灯理解成“切换到另一个方向”，而是把它定义成安全关闭状态。`SceneState`、`SceneAction`、`Validator` 和 `EventLog` 的职责没有改变；规则只在浏览器本地 `TrafficController` 对已验证状态的解释层实现。

## 证据

- `ai_builder/static/traffic-controller.mjs`：红灯和黄灯的 requested phase 为 `null`，绿灯只请求 `EW`。
- `tools/test-traffic-controller.mjs`：`red command keeps every approach stopped`、`green command releases only the EW approach`。
- `ai_builder/static/app.js`：遥测明确显示 `全红 · 公交停车`、`EW 绿 · NS 红`、`红灯停车` 或 `绿灯放行`，不再使用“东西红灯时南北放行”的歧义文案。
- `ai_builder/static/scene3d.js`：每个 3D 信号面额外显示方向和 `GO` / `STOP` 状态牌，避免依赖红绿颜色辨认。

## 设计依据

- [W3C WCAG 2.2 — Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color)：颜色不能是传达状态的唯一视觉手段；本原型用文字状态和方向标签补充颜色。
- [FHWA MUTCD 11th Edition, Section 4A.03](https://mutcd.fhwa.dot.gov/pdfs/11th_Edition/mutcd11theditionhl.pdf)：稳态红灯表示车辆应在停止线前停车并保持停止，直到获得通行信号。本原型采用了这一核心语义，但不宣称完整交通法规合规。

## 验收方式

1. 在十字路口加入至少一辆公交。
2. 预演并确认 `把信号灯改成红色`。
3. 观察四个信号灯均为红色，遥测显示“全红 · 公交停车”，公交停在停止线前。
4. 预演并确认 `把红灯变回绿色`。
5. 观察 EW 方向变绿、NS 方向仍为红色；只有 EW 方向恢复行驶。

服务端不因上述视觉验证而获得额外状态写入路径，未知指令仍按原规则 rejected 且状态不变。
