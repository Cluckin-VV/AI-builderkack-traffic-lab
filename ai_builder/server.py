import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict

from ai_builder.model_adapter import FakeModelAdapter, ModelAdapter, run_model_command
from ai_builder.runtime_info import get_runtime_identity
from ai_builder.scene import EventLog, SceneState


PAGE = """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI Builder 最小交通场景</title>
  <style>
    :root { color-scheme: light; font-family: system-ui, sans-serif; }
    body { max-width: 900px; margin: 0 auto; padding: 28px; color: #17324d; background: #eef4f7; }
    h1 { margin-bottom: 8px; } .hint { color: #587080; }
    .runtime { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; font-size: 12px; color: #587080; }
    .runtime span { padding: 5px 8px; border: 1px solid #aac0ca; border-radius: 999px; background: #f7fbfc; }
    form { display: flex; gap: 10px; margin: 20px 0; } input { flex: 1; padding: 12px; border: 1px solid #aac0ca; border-radius: 8px; font-size: 16px; }
    button { padding: 10px 14px; border: 0; border-radius: 8px; background: #176b87; color: white; cursor: pointer; }
    canvas { width: 100%; max-width: 840px; height: 330px; display: block; background: #b9d9a7; border-radius: 14px; box-shadow: 0 4px 18px #17324d22; }
    #status { min-height: 24px; margin: 14px 0; font-weight: 700; } pre { background: #17324d; color: #eff9ff; padding: 16px; border-radius: 8px; overflow: auto; }
  </style>
</head>
<body>
  <h1>AI Builder · 最小交通场景</h1>
  <div class="runtime" aria-label="运行身份">
    <span>App v0.3.0</span>
    <span>Command Protocol v0.3</span>
    <span>SceneAction v0.1</span>
    <span>Source Fingerprint: {{source_fingerprint}}</span>
    <span>Started At: {{started_at}}</span>
  </div>
  <p class="hint">输入固定指令，观察 SceneState 的确定性变化。</p>
  <form id="command-form">
    <input id="command" aria-label="场景指令" placeholder="例如：增加一辆公交车" autocomplete="off">
    <button type="submit">执行指令</button>
  </form>
  <div id="status" role="status" aria-live="polite">ready</div>
  <canvas id="scene" width="840" height="420" aria-label="3D交通场景"></canvas>
  <h2>最近一次 Event Log</h2>
  <pre id="event">尚未执行指令</pre>
  <script>
    const canvas = document.querySelector('#scene');
    const ctx = canvas.getContext('2d');
    const command = document.querySelector('#command');
    const status = document.querySelector('#status');
    const event = document.querySelector('#event');

    function draw(scene) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#8fbd79'; ctx.fillRect(0, 0, 840, 420);
      // Perspective road: distant edge is narrow, near edge is wide.
      ctx.fillStyle = '#3e4b55'; ctx.beginPath(); ctx.moveTo(320, 115); ctx.lineTo(520, 115); ctx.lineTo(820, 420); ctx.lineTo(20, 420); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#f5d36b'; ctx.lineWidth = 5; ctx.setLineDash([28, 20]);
      ctx.beginPath(); ctx.moveTo(420, 118); ctx.lineTo(420, 420); ctx.stroke(); ctx.setLineDash([]);
      // Signal pole and box with a perspective shadow.
      ctx.fillStyle = '#27343c'; ctx.fillRect(675, 78, 12, 205); ctx.fillRect(638, 50, 86, 78);
      ctx.fillStyle = scene.traffic_light === '红灯' ? '#dc3545' : '#31a354';
      ctx.beginPath(); ctx.arc(681, 89, 17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c7d1d5'; ctx.beginPath(); ctx.moveTo(688, 128); ctx.lineTo(715, 128); ctx.lineTo(730, 150); ctx.lineTo(704, 150); ctx.closePath(); ctx.fill();
      for (let i = 0; i < scene.buses; i++) {
        const x = 150 + i * 150; const y = 300 - i * 12;
        // Front, side, and roof form a small 3D bus.
        const busColor = scene.bus_running === false ? '#8c9295' : '#d58d18';
        ctx.fillStyle = busColor; ctx.fillRect(x, y, 110, 58);
        ctx.fillStyle = scene.bus_running === false ? '#aeb4b7' : '#f0ad28'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18, y - 16); ctx.lineTo(x + 128, y - 16); ctx.lineTo(x + 110, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#b66d18'; ctx.beginPath(); ctx.moveTo(x + 110, y); ctx.lineTo(x + 128, y - 16); ctx.lineTo(x + 128, y + 42); ctx.lineTo(x + 110, y + 58); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#18344a'; ctx.fillRect(x + 12, y + 12, 26, 18); ctx.fillRect(x + 48, y + 12, 26, 18);
        ctx.fillStyle = '#202c35'; ctx.beginPath(); ctx.arc(x + 22, y + 62, 10, 0, Math.PI * 2); ctx.arc(x + 88, y + 62, 10, 0, Math.PI * 2); ctx.fill();
      }
    }

    document.querySelector('#command-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const response = await fetch('/command', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({command: command.value}) });
      const result = await response.json();
      status.textContent = result.status;
      status.style.color = result.status === 'accepted' ? '#18794e' : '#b42318';
      draw(result.scene); event.textContent = JSON.stringify(result.event, null, 2);
    });
    draw({buses: 0, traffic_light: '绿灯', projection: 'perspective'});
  </script>
</body>
</html>"""


class SceneHandler(BaseHTTPRequestHandler):
    state = SceneState()
    event_log = EventLog()
    adapter: ModelAdapter = FakeModelAdapter()

    @staticmethod
    def page() -> str:
        identity = get_runtime_identity().as_dict()
        return PAGE.replace("{{source_fingerprint}}", identity["source_fingerprint"]).replace("{{started_at}}", identity["started_at"])

    def do_GET(self) -> None:
        if self.path == "/health":
            body = json.dumps(get_runtime_identity().as_dict(), ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path != "/":
            self.send_error(404)
            return
        body = self.page().encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        if self.path != "/command":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        try:
            payload: Dict[str, Any] = json.loads(self.rfile.read(length))
            result = run_model_command(self.adapter, str(payload.get("command", "")), self.state, self.event_log)
            result["event"]["runtime_fingerprint"] = get_runtime_identity().source_fingerprint
            body = json.dumps(result, ensure_ascii=False).encode("utf-8")
        except (ValueError, TypeError, json.JSONDecodeError):
            body = json.dumps({"status": "rejected", "scene": self.state.snapshot()}, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: Any) -> None:
        return


def run(host: str = "127.0.0.1", port: int = 8000) -> None:
    server = ThreadingHTTPServer((host, port), SceneHandler)
    print(f"AI Builder demo: http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
