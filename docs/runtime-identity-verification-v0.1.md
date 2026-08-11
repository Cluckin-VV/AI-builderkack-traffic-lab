# Runtime Identity Verification v0.1

Runtime Identity 用于确认浏览器连接的服务进程是否来自当前源码。

## 验证方式

启动服务后访问：

```text
http://127.0.0.1:8000/health
```

响应包含：

```json
{
  "app_version": "0.3.0",
  "command_protocol_version": "0.3",
  "scene_action_version": "0.1",
  "started_at": "2026-08-11T00:00:00+00:00",
  "source_fingerprint": "示例指纹",
  "git_commit": "uncommitted"
}
```

`started_at` 和 `source_fingerprint` 应与页面身份栏及用户请求的 Event Log 对应。指纹由 `scene.py`、`server.py`、`model_adapter.py` 内容计算，只显示 SHA-256 前 12 位，不包含本地绝对路径。

## 验证结果

- `/health`：自动测试覆盖必填字段和格式；
- 页面：显示 App、Command Protocol、SceneAction、Source Fingerprint、Started At；
- Event Log：每次 HTTP 用户请求记录 `runtime_fingerprint`；
- 旧进程识别：比较浏览器页面、`/health` 与 Event Log 的指纹；不一致即说明连接的不是同一运行实例/源码。

## 尚未验证

- 未在真实浏览器 DevTools 中完成跨旧进程与新进程的人工截图比对；
- `git_commit` 在未提交仓库中只会返回 `uncommitted` 或 `unavailable`，不能作为源码版本的唯一依据。
