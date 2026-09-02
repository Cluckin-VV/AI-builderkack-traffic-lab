const form = document.querySelector("#command-form");
const promptInput = document.querySelector("#prompt");
const submitButton = document.querySelector("#submit-command");
const characterCount = document.querySelector("#character-count");
const statusBox = document.querySelector("#command-status");
const statusText = document.querySelector("#status-text");
const resultBadge = document.querySelector("#result-badge");
const rawEvent = document.querySelector("#event-json");
const eventHistory = document.querySelector("#event-history");
const historyCount = document.querySelector("#history-count");
const pipeline = [...document.querySelectorAll("#pipeline li")];
const fallback = document.querySelector("#webgl-fallback");
const sceneRoot = document.querySelector("#scene-root");

const labels = {
  add_bus: "增加公交车",
  remove_bus: "删除公交车",
  set_traffic_light: "切换信号灯",
  stop_bus: "公交车停止",
  move_bus: "公交车继续行驶",
  unknown: "未知动作",
};

const reasons = {
  valid: "动作通过 Schema 与场景语义验证，已执行一次状态更新。",
  UNKNOWN_ACTION_TYPE: "当前动作协议不认识这条表达，场景保持不变。",
  SEMANTIC_TARGET_NOT_FOUND: "动作格式正确，但场景里没有可以操作的公交车。",
  SEMANTIC_INVALID_STATE_TRANSITION: "动作格式正确，但目标已经处于该状态。",
  INVALID_ENUM: "参数值不在协议允许范围内，场景保持不变。",
  INVALID_TYPE: "候选动作结构类型错误，场景保持不变。",
  "unknown action_type": "当前动作协议不认识这条表达，场景保持不变。",
  "missing required field": "候选动作缺少协议必填字段，场景保持不变。",
  "invalid JSON": "模型输出不是有效 JSON，场景保持不变。",
};

let world = null;
let lastScene = { buses: 0, bus_count: 0, bus_running: true, traffic_light: "绿灯" };
let visualPaused = false;
let eventCount = 0;

function setStatus(kind, message) {
  statusBox.className = `command-status is-${kind}`;
  statusText.textContent = message;
}

function setPipeline(stage = "ready", status = "ready") {
  const order = ["candidate", "schema", "semantic", "execution"];
  const stageIndex = order.indexOf(stage);
  for (const item of pipeline) {
    item.classList.remove("is-complete", "is-rejected", "is-skipped", "is-active");
    const index = order.indexOf(item.dataset.stage);
    if (stage === "working") {
      if (index === 0) item.classList.add("is-active");
      continue;
    }
    if (stage === "ready") continue;
    if (status === "accepted") {
      item.classList.add("is-complete");
    } else if (index < stageIndex) {
      item.classList.add("is-complete");
    } else if (index === stageIndex) {
      item.classList.add("is-rejected");
    } else {
      item.classList.add("is-skipped");
    }
  }
}

function setSceneState(scene) {
  lastScene = { ...lastScene, ...scene };
  const count = Number(lastScene.bus_count ?? lastScene.buses ?? 0);
  const running = lastScene.bus_running !== false;
  const motionLabel = count === 0 ? "等待车辆" : running ? "行驶中" : "已停止";

  document.querySelector("#bus-count").textContent = String(count);
  document.querySelector("#motion-state").textContent = motionLabel;
  document.querySelector("#light-state").textContent = lastScene.traffic_light ?? "绿灯";
  document.querySelector("#state-buses").textContent = String(count);
  document.querySelector("#state-running").textContent = count === 0 ? "—" : String(running);
  document.querySelector("#state-light").textContent = lastScene.traffic_light ?? "绿灯";
  world?.syncState(lastScene);
}

function explainEvent(event) {
  const reason = event?.validation_result?.reason ?? event?.rejected_reason ?? event?.error_code;
  if (reasons[reason]) return reasons[reason];
  if (event?.status === "accepted") return reasons.valid;
  return reason ? `动作被安全拒绝：${reason}` : "动作被安全拒绝，场景保持不变。";
}

function updateInspector(result) {
  const event = result.event;
  const accepted = result.status === "accepted";
  resultBadge.className = `result-badge ${accepted ? "accepted" : "rejected"}`;
  resultBadge.textContent = accepted ? "ACCEPTED" : "REJECTED";

  if (!event) {
    document.querySelector("#explanation").textContent = result.reason ?? "请求格式无效。";
    rawEvent.textContent = JSON.stringify(result, null, 2);
    return;
  }

  document.querySelector("#empty-action").hidden = true;
  document.querySelector("#action-details").hidden = false;
  document.querySelector("#action-type").textContent = event.action_type ?? "—";
  document.querySelector("#validation-stage").textContent = event.validation_stage ?? "—";
  document.querySelector("#action-id").textContent = event.action_id || "—";
  document.querySelector("#action-protocol").textContent = `v${event.protocol_version ?? "0.2"}`;
  document.querySelector("#explanation").textContent = explainEvent(event);
  rawEvent.textContent = JSON.stringify(event, null, 2);
  addHistory(event);
}

function addHistory(event) {
  const empty = eventHistory.querySelector(".history-empty");
  empty?.remove();
  eventCount += 1;
  historyCount.textContent = `${eventCount} EVENT${eventCount === 1 ? "" : "S"}`;

  const item = document.createElement("li");
  if (event.status !== "accepted") item.classList.add("rejected");
  const copy = document.createElement("div");
  const command = document.createElement("b");
  const detail = document.createElement("small");
  const time = document.createElement("time");
  command.textContent = event.command || "未命名指令";
  detail.textContent = `${labels[event.action_type] ?? event.action_type ?? "未生成动作"} · ${event.validation_stage ?? "schema"}`;
  time.textContent = new Date().toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" });
  copy.append(command, detail);
  item.append(copy, time);
  eventHistory.prepend(item);
  while (eventHistory.children.length > 6) eventHistory.lastElementChild.remove();
}

async function loadWorld() {
  try {
    const fingerprint = document.querySelector('meta[name="build-fingerprint"]')?.content ?? "dev";
    const { TransitWorld } = await import(`/assets/scene3d.js?v=${encodeURIComponent(fingerprint)}`);
    world = new TransitWorld(sceneRoot, () => {
      fallback.hidden = false;
    });
    world.syncState(lastScene);
  } catch (error) {
    console.error("WebGL scene module failed to load", error);
    fallback.hidden = false;
  }
}

async function hydrate() {
  try {
    const response = await fetch("/api/state", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`State request failed with ${response.status}`);
    const payload = await response.json();
    setSceneState(payload.scene);
    if (payload.last_event) {
      updateInspector({ status: payload.last_event.status ?? payload.last_event.validation_result?.status, event: payload.last_event });
      setPipeline(payload.last_event.validation_stage, payload.last_event.status);
    }
  } catch (error) {
    console.error("Initial scene state failed to load", error);
    setStatus("rejected", "无法读取服务端场景，请确认本地服务仍在运行");
  }
}

async function executeCommand(command) {
  setStatus("working", "正在生成候选 SceneAction…");
  setPipeline("working");
  submitButton.disabled = true;

  try {
    const response = await fetch("/command", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ command }),
    });
    const result = await response.json();
    if (!response.ok && response.status >= 500) throw new Error(`Command request failed with ${response.status}`);

    setSceneState(result.scene ?? lastScene);
    updateInspector(result);
    const stage = result.event?.validation_stage ?? "schema";
    setPipeline(stage, result.status);

    if (result.status === "accepted") {
      const action = result.event?.action_type;
      setStatus("accepted", `已执行：${labels[action] ?? action ?? "场景动作"}`);
    } else {
      setStatus("rejected", explainEvent(result.event));
    }
  } catch (error) {
    console.error("Command request failed", error);
    setStatus("rejected", "请求失败，场景未发生变化");
    setPipeline("candidate", "rejected");
  } finally {
    submitButton.disabled = false;
    promptInput.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const command = promptInput.value.trim();
  if (!command) {
    setStatus("rejected", "请先输入一条场景指令");
    promptInput.focus();
    return;
  }
  executeCommand(command);
});

promptInput.addEventListener("input", () => {
  characterCount.textContent = `${promptInput.value.length} / 240`;
});

promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    form.requestSubmit();
  }
});

for (const button of document.querySelectorAll("[data-command]")) {
  button.addEventListener("click", () => {
    promptInput.value = button.dataset.command;
    promptInput.dispatchEvent(new Event("input"));
    form.requestSubmit();
  });
}

document.querySelector("#reset-camera").addEventListener("click", () => {
  world?.resetCamera();
  setStatus("ready", "镜头已重置");
});

document.querySelector("#toggle-motion").addEventListener("click", (event) => {
  visualPaused = !visualPaused;
  world?.setPaused(visualPaused);
  event.currentTarget.setAttribute("aria-pressed", String(visualPaused));
  event.currentTarget.querySelector("span").textContent = visualPaused ? "继续动画" : "暂停动画";
  setStatus("ready", visualPaused ? "视觉动画已暂停，SceneState 未改变" : "视觉动画已继续");
});

setPipeline();
loadWorld();
hydrate();
