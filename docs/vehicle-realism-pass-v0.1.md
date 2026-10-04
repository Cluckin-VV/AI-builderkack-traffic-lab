# TransitLab 车辆真实感升级 v0.1

日期：2026-09-24  
范围：只升级现有小轿车 `sedan` 与 SUV 资产及其浏览器表现；公交车、SceneAction v0.3、交通规则和自然语言协议未改义。

## 目标

把车辆从“能看见的占位模型”提升为更接近主流驾驶游戏的实时原型：轮廓更有层次，材质能区分车漆、玻璃、灯具和轮胎，车辆在加减速、转向和制动时有可解释的视觉反馈。

这里的“接近 GTS / 地平线”只指借鉴实时游戏常用的视觉语言和动态提示，不复制任何商业游戏或第三方车辆资产，也不宣称已经具备真实车辆物理引擎。

## Blender 资产改造

`tools/art/build_city_vehicles.py` 保持单一可复现生成入口，重新生成：

- `ai_builder/static/models/city-sedan-v1.{blend,glb,json}`
- `ai_builder/static/models/city-suv-v1.{blend,glb,json}`

本轮增加或修正：

- 车漆、灯具和金属轮毂的受控 clearcoat；
- 全景车顶玻璃与更明确的侧窗层次；
- 薄的车门缝和下部折线，避免车身像单一方块；
- 低轮廓轮胎肩部纹理环，避免夸张的越野刺状几何；
- 更小的制动卡钳组件；
- SUV 行李架安装脚，避免车顶附件漂浮；
- 保留独立车轮、车灯、玻璃和车身组件，供浏览器运行时挂接动画和状态。

同时保留低面数、材质复用和 JSON 运行时批次，以适合浏览器演示，不追求离线渲染级别的细分曲面。

可复现视觉审计：

```powershell
blender --background --python tools/art/render_vehicle_audit.py -- sedan
blender --background --python tools/art/render_vehicle_audit.py -- suv
```

审计输出：

- [sedan close-up](../output/playwright/vehicle-sedan-realism-audit.png)
- [SUV close-up](../output/playwright/vehicle-suv-realism-audit.png)

## 浏览器动态表现

`ai_builder/static/urban-world.js` 使用 `MeshPhysicalMaterial` 读取资产材质，并把车灯、车轮和制动灯组件挂到车辆实例上。

`ai_builder/static/scene3d.js` 将交通控制器快照映射为：

- `wheelSpin`：根据实际位移和轮胎半径累计车轮旋转；
- `steeringAngle`：根据车辆航向变化平滑驱动前轮转角；
- `brakeLamps`：车辆制动或在停止线前等待时点亮制动灯；
- `bodyDynamics.pitch / roll`：根据加速度与转向速率施加受限的车身俯仰和侧倾。

这些是渲染层的动态提示，真实位置、速度、停止线、相位和冲突规则仍由现有交通控制器决定。没有把视觉动画反向写入 `SceneState`，也没有绕过 `Schema → Semantic → apply`。

## 验证结果

### 自动化

- Python：`Ran 308 tests ... OK`；
- JavaScript：`34 tests passed`；
- 评测：合法指令 `19/19`，非法/歧义指令 `12/12` 拒绝；误拒 `0`、危险接受 `0`、状态误修改 `0`、Event Log 缺失 `0`；
- `python -m compileall -q ai_builder`：通过；
- `git diff --check`：无空白错误，仅保留现有换行格式提示。

### 浏览器

- 本地地址：[http://127.0.0.1:8032/](http://127.0.0.1:8032/)
- `/health`：

```json
{
  "app_version": "0.8.0",
  "command_protocol_version": "0.3",
  "scene_action_version": "0.3",
  "started_at": "2026-09-24T19:48:11.043934+08:00",
  "source_fingerprint": "e02bf892f819",
  "git_commit": "c62afae"
}
```

- 浏览器资产状态：`sedan / suv / bus = ready`；
- Playwright 控制台：`0 errors / 0 warnings`；
- 浏览器证据：[vehicle-realism-final-browser.png](../output/playwright/vehicle-realism-final-browser.png)。

## 明确边界

本轮没有实现真正的轮胎抓地力、悬挂求解、碰撞检测、动力总成、轮胎侧滑、损伤系统或物理引擎；也没有进行 10 分钟真实浏览器 soak、低端硬件 30 FPS 基准或公网部署验收。因此当前结论是“车辆真实感与动态表现达到更完整的浏览器原型级别”，不是 AAA 级物理模拟或获奖保证。

本轮未提交 Git commit、未 push、未部署公网，也没有修改第三方或付费服务配置。
