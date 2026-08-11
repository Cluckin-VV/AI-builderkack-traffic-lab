# Real LLM Shadow Evaluation v0.1

本阶段只评测候选 SceneAction，不允许模型输出调用 `SceneState.apply`。未配置 API Key 时自动使用离线 Fake Adapter，避免测试和基线报告依赖网络。

## 配置

```powershell
$env:AI_BUILDER_LLM_MODE="shadow"
$env:AI_BUILDER_LLM_API_KEY="（仅在本机环境变量中配置，不要提交或发送）"
```

可选环境变量：`AI_BUILDER_LLM_ENDPOINT`、`AI_BUILDER_LLM_MODEL`。项目不读取 `.env`，也不保存密钥。

运行：

```powershell
python -m ai_builder.shadow_evaluate
```

## 影子管线

```text
RealLLMAdapter
→ JSON 解析
→ SceneAction
→ Validator
```

影子模式不会执行 `SceneState.apply`，不会改变浏览器场景；每条记录保存原始模型输出、验证结果和拒绝原因。原始输出中若包含敏感信息，应在外部日志系统中进一步脱敏；本地适配器不会记录 API Key。

## 离线基线结果

在未配置 API Key、使用 Fake Adapter fallback 时：

```text
JSON 可解析率：100%
SceneAction 合法率：50%
合法指令正确接受率：10/10（100%）
非法/歧义指令正确拒绝率：10/10（100%）
错误拒绝：0
危险接受：0
状态修改：0
协议外字段：0
```

评测不再把 20 条指令混合计算“总体合法率”。预期被拒绝的表达不是模型失败；例如 `unknown_action_type` 若对应预期非法指令，应标记为 safe rejection。真实模型运行后应以命令行实际输出更新本节，不应把离线 Fake 结果当作真实模型质量。
