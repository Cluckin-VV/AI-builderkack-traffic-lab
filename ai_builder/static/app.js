const buildFingerprint = document.querySelector('meta[name="build-fingerprint"]')?.content ?? "dev";
const { buildEditorCommand } = await import(`/assets/scene-editor.mjs?v=${encodeURIComponent(buildFingerprint)}`);

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
const planPreview = document.querySelector("#plan-preview");
const planSteps = document.querySelector("#plan-steps");
const planProjection = document.querySelector("#plan-projection");
const planStepCount = document.querySelector("#plan-step-count");
const confirmPlanButton = document.querySelector("#confirm-plan");
const cancelPlanButton = document.querySelector("#cancel-plan");
const editorForm = document.querySelector("#scene-editor-form");
const undoButton = document.querySelector("#undo-last");
const previewBadge = document.querySelector("#preview-badge");
const resumeAutoSignalButton = document.querySelector("#resume-auto-signal");

const labels = {
  add_bus: "增加公交车",
  remove_bus: "删除公交车",
  set_traffic_light: "切换信号灯",
  stop_bus: "公交车停止",
  move_bus: "公交车继续行驶",
  set_weather: "切换天气",
  set_scene_layout: "切换场景布局",
  add_vehicle: "增加车辆",
  remove_vehicle: "删除车辆",
  set_signal_mode: "恢复自动信号",
  scene_plan: "执行场景计划",
  unknown: "未知动作",
};

const reasons = {
  valid: "动作通过 Schema 与场景语义验证，已执行一次状态更新。",
  UNKNOWN_ACTION_TYPE: "当前动作协议不认识这条表达，场景保持不变。",
  SEMANTIC_TARGET_NOT_FOUND: "动作格式正确，但场景里没有可以操作的公交车。",
  SEMANTIC_INVALID_STATE_TRANSITION: "动作格式正确，但目标已经处于该状态。",
  SEMANTIC_CAPACITY_REACHED: "场景最多支持 12 辆公交车；本次动作已拒绝，场景保持不变。",
  INVALID_ENUM: "参数值不在协议允许范围内，场景保持不变。",
  INVALID_TYPE: "候选动作结构类型错误，场景保持不变。",
  "unknown action_type": "当前动作协议不认识这条表达，场景保持不变。",
  "missing required field": "候选动作缺少协议必填字段，场景保持不变。",
  "invalid JSON": "模型输出不是有效 JSON，场景保持不变。",
};

let world = null;
const weatherLabels = { clear: "晴", rain: "雨", snow: "雪", fog: "雾" };
const layoutLabels = { crossroads: "十字路口", bus_stop: "双向公交站" };
const phaseLabels = {
  EW_THROUGH: "东西直行与右转",
  EW_LEFT: "东西保护左转",
  NS_THROUGH: "南北直行与右转",
  NS_LEFT: "南北保护左转",
  BUS_CORRIDOR: "公交站双向通行",
  ALL_RED: "全红 · 路口清空",
  ALL_CAUTION: "全向黄灯 · 停止线停车 / 路口内清空",
};
let lastScene = { buses: 0, bus_count: 0, bus_running: true, traffic_light: "绿灯", weather: "clear", signal_mode: "automatic" };
let visualPaused = false;
let eventCount = 0;
let pendingPlanId = null;
let pendingUndoOf = null;

function updateUndoControl(undo) {
  const available = Boolean(undo?.available && undo?.change_id);
  undoButton.disabled = !available || Boolean(pendingPlanId);
  undoButton.dataset.changeId = available ? undo.change_id : "";
}

function restoreLiveScene() {
  previewBadge.hidden = true;
  sceneRoot.dataset.preview = "false";
  world?.syncState(lastScene);
}

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
    if (status === "preview") {
      if (index <= 2) item.classList.add("is-complete");
      else item.classList.add("is-active");
      continue;
    }
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
  const fleet = { sedan: 0, suv: 0, bus: 0 };
  if (Array.isArray(lastScene.vehicles)) {
    for (const vehicle of lastScene.vehicles) if (Object.hasOwn(fleet, vehicle.type)) fleet[vehicle.type] += 1;
  } else fleet.bus = Number(lastScene.bus_count ?? lastScene.buses ?? 0);
  const count = Object.values(fleet).reduce((total, value) => total + value, 0);
  const running = lastScene.bus_running !== false;
  const station = lastScene.scene_layout === "bus_stop";
  const light = lastScene.traffic_light ?? "绿灯";
  const signalMode = lastScene.signal_mode ?? "automatic";
  const motionLabel = count === 0 ? "等待车辆" : running ? "信号控制中" : "手动停止";

  document.querySelector("#bus-count").textContent = String(count);
  document.querySelector("#motion-state").textContent = motionLabel;
  document.querySelector("#weather-state").textContent = weatherLabels[lastScene.weather] ?? lastScene.weather;
  document.querySelector("#state-buses").textContent = String(count);
  document.querySelector("#state-fleet").textContent = `轿车 ${fleet.sedan} · SUV ${fleet.suv} · 公交 ${fleet.bus}`;
  document.querySelector("#state-signal-mode").textContent = lastScene.signal_mode ?? "automatic";
  const manualSignalDescription = light === "绿灯"
    ? "手动安全信号 · 仅东西直行与右转放行"
    : light === "黄灯"
      ? "手动警示模式 · 全向黄灯 · 停止线停车，路口内车辆清空"
      : "手动安全信号 · 全红 · 所有车辆停车";
  document.querySelector("#signal-mode-description").textContent = signalMode === "automatic"
    ? "自动分相 · 右侧通行"
    : manualSignalDescription;
  resumeAutoSignalButton.disabled = signalMode !== "manual" || Boolean(pendingPlanId);
  document.querySelector("#state-light").textContent = lastScene.traffic_phase ?? phaseLabels.EW_THROUGH;
  document.querySelector("#state-weather").textContent = lastScene.weather ?? "clear";
  document.querySelector("#editor-layout").value = lastScene.scene_layout ?? "crossroads";
  document.querySelector("#editor-sedans").value = String(fleet.sedan);
  document.querySelector("#editor-suvs").value = String(fleet.suv);
  document.querySelector("#editor-buses").value = String(fleet.bus);
  document.querySelector("#editor-weather").value = lastScene.weather ?? "clear";
  document.querySelector("#editor-light").value = light;
  document.querySelector("#viewport-title").textContent = station ? "CENTRAL EXCHANGE / 双向公交站" : "NEXUS CROSSING / AI 交通情景实验室";
  document.querySelector(".coordinate").textContent = station
    ? "站台信号：绿灯放行 · 红灯停车 · 停靠 4 秒"
    : "自动信号 · 黄灯过渡 · 全红清空 · 右侧通行";
  document.querySelector("#signal-label").textContent = station ? "站台信号" : "信号相位";
  document.querySelector("#light-state").textContent = station
    ? (light === "红灯" ? "红灯停车" : "绿灯放行")
    : "自动循环 · 准备中";
  sceneRoot.dataset.signalState = station
    ? (light === "红灯" ? "STOP_STATION" : "GO_STATION")
    : (light === "红灯" ? "STOP_ALL" : "GO_EW");
  world?.syncState(lastScene);
  restoreLiveScene();
}

function editorTarget() {
  return {
    scene_layout: document.querySelector("#editor-layout").value,
    sedan: Number(document.querySelector("#editor-sedans").value),
    suv: Number(document.querySelector("#editor-suvs").value),
    buses: Number(document.querySelector("#editor-buses").value),
    weather: document.querySelector("#editor-weather").value,
    traffic_light: document.querySelector("#editor-light").value,
  };
}

editorForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const command = buildEditorCommand(lastScene, editorTarget());
    if (!command) {
      setStatus("ready", "目标配置与当前场景一致，SceneState 未改变");
      return;
    }
    promptInput.value = command;
    promptInput.dispatchEvent(new Event("input"));
    previewPlan(command);
  } catch (error) {
    setStatus("rejected", `配置无效：${error.message}`);
  }
});

sceneRoot.addEventListener("traffic-frame", (event) => {
  const frame = event.detail;
  const counts = { moving: 0, red_light: 0, yellow_light: 0, manual_stop: 0, following: 0, braking: 0, station_dwell: 0 };
  for (const vehicle of frame.vehicles) {
    const reason = vehicle.reason ?? "moving";
    const category = reason.includes("red_light") ? "red_light"
      : reason.includes("yellow_light") ? "yellow_light"
        : reason.includes("following") ? "following"
          : reason === "manual_stop" ? "manual_stop"
            : reason === "station_dwell" ? "station_dwell"
              : reason === "braking_for_stop" ? "braking" : "moving";
    counts[category] += 1;
  }
  let actual = "等待车辆";
  if (frame.vehicles.length) {
    const waiting = counts.red_light + counts.yellow_light + counts.following + counts.braking;
    if (counts.manual_stop) actual = `${counts.manual_stop} 辆手动停止`;
    else if (counts.station_dwell) actual = `${counts.station_dwell} 辆站台停靠 · ${counts.moving} 辆行驶`;
    else if (counts.moving && waiting) actual = `${counts.moving} 行驶 · ${waiting} 等待`;
    else if (counts.moving) actual = `${counts.moving} 辆行驶`;
    else if (waiting) actual = `${waiting} 辆等红灯`;
  }
  const station = frame.lights.NS == null;
  const allRed = !station && frame.lights.EW === "红灯" && frame.lights.NS === "红灯";
  const allCaution = !station && frame.lights.EW === "黄灯" && frame.lights.NS === "黄灯";
  document.querySelector("#motion-state").textContent = allCaution ? `全向黄灯警示 · ${actual}` : frame.clearance ? `全红清空 · ${actual}` : actual;
  document.querySelector("#signal-label").textContent = station ? "站台信号" : "信号相位";
  document.querySelector("#light-state").textContent = station
    ? (frame.lights.EW === "绿灯" ? "绿灯放行" : "红灯停车")
    : allCaution ? "全向黄灯警示 · 停止线停车 / 路口内清空"
      : allRed ? "全红 · 路口清空"
      : `${phaseLabels[frame.phase] ?? frame.phase} · ${frame.stage === 'yellow' ? '黄灯清场' : frame.stage === 'all_red' ? '全红清空' : '放行'} · ${frame.remainingSeconds}s`;
  document.querySelector("#state-light").textContent = allCaution ? phaseLabels.ALL_CAUTION : allRed ? phaseLabels.ALL_RED : (phaseLabels[frame.phase] ?? frame.phase);
  sceneRoot.dataset.signalState = station
    ? (frame.lights.EW === "绿灯" ? "GO_STATION" : "STOP_STATION")
    : allCaution ? "CAUTION_ALL" : allRed ? "STOP_ALL" : frame.phase;
  sceneRoot.dataset.trafficPhase = frame.phase;
  sceneRoot.dataset.vehicleReasons = JSON.stringify(counts);
});

sceneRoot.addEventListener('render-frame', ({detail}) => {
  const output=document.querySelector('#render-performance');
  output.textContent=detail.measuring===false ? '后台 · 暂停测量' : `${detail.fps} FPS`;
  output.title=detail.measuring===false ? '窗口未聚焦，后台节流不计入前台性能。切回场景后重新采样。' : `原生实测 · p95 ${detail.p95Ms} ms · ${detail.slowFrames??0} 次 >250ms 卡顿 · ${detail.drawCalls} draw calls · ${detail.triangles.toLocaleString()} triangles`;
  const captions={clear:'日光下的城市',rain:'雨落街区 · 湿路微光',snow:'飘雪街区 · 冷光与暖灯',fog:'薄雾街区 · 远景消隐'};
  const clearCaption=sceneRoot.dataset.lightStyle==='golden'?'金色时刻 · 暖光街区':sceneRoot.dataset.lightStyle==='blue'?'蓝调暮色 · 城市灯火':captions.clear;
  document.querySelector('#atmosphere-caption').textContent=sceneRoot.dataset.weather==='clear'?clearCaption:(captions[sceneRoot.dataset.weather]??clearCaption);
});

for(const button of document.querySelectorAll('[data-light-style]')) {
  button.addEventListener('click',()=>{
    world?.setLightStyle(button.dataset.lightStyle);
    for(const other of document.querySelectorAll('[data-light-style]')) other.setAttribute('aria-pressed',String(other===button));
  });
}
document.querySelector('#render-quality').addEventListener('change',event=>world?.setQuality(event.target.value));

function explainEvent(event) {
  if (event?.event_type === "scene_plan_execution" && event?.status === "accepted") {
    return `${event.applied_action_count} 个动作已全部通过预演与验证，并以一个原子计划提交。`;
  }
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
  document.querySelector("#action-id").textContent = event.action_id || event.plan_id || "—";
  document.querySelector("#action-protocol").textContent = event.event_type?.startsWith("scene_plan") ? "ScenePlan v0.1" : `v${event.protocol_version ?? "0.2"}`;
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
    window.__lastUndo = payload.undo;
    updateUndoControl(payload.undo);
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
    window.__lastUndo = result.undo;
    updateUndoControl(result.undo);
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

function clearPlanPreview() {
  pendingPlanId = null;
  pendingUndoOf = null;
  planPreview.hidden = true;
  planSteps.replaceChildren();
  document.querySelector("#plan-preview-title").textContent = "执行前预览";
  restoreLiveScene();
  resumeAutoSignalButton.disabled = (lastScene.signal_mode ?? "automatic") !== "manual";
  updateUndoControl(window.__lastUndo);
}

function showPlanPreview(result) {
  pendingPlanId = result.plan.plan_id;
  pendingUndoOf = result.undo_of ?? null;
  document.querySelector("#plan-preview-title").textContent = pendingUndoOf ? "撤销预览" : "执行前预览";
  planSteps.replaceChildren();
  for (const step of result.steps) {
    const item = document.createElement("li");
    const number = document.createElement("b");
    const copy = document.createElement("span");
    const code = document.createElement("i");
    number.textContent = String(step.index + 1).padStart(2, "0");
    const parameter = step.parameters?.layout ?? step.parameters?.weather ?? step.parameters?.color;
    copy.textContent = `${labels[step.action_type] ?? step.action_type}${parameter ? `：${layoutLabels[parameter] ?? weatherLabels[parameter] ?? parameter}` : ""}`;
    code.textContent = step.action_type;
    item.append(number, copy, code);
    planSteps.append(item);
  }
  planStepCount.textContent = `${result.steps.length} STEP${result.steps.length === 1 ? "" : "S"}`;
  const projected = result.projected_scene;
  const vehicles = Array.isArray(projected.vehicles) ? projected.vehicles : [];
  const fleet = { sedan: 0, suv: 0, bus: 0 };
  for (const vehicle of vehicles) if (Object.hasOwn(fleet, vehicle.type)) fleet[vehicle.type] += 1;
  const total = vehicles.length || Number(projected.buses ?? projected.bus_count ?? 0);
  const signalMode = projected.signal_mode ?? "automatic";
  const signalSummary = signalMode === "automatic" ? "自动交通相位" : `手动安全信号 · ${projected.traffic_light ?? "红灯"}`;
  planProjection.textContent = `预演结果：${layoutLabels[projected.scene_layout ?? "crossroads"]} · ${total} 辆车（轿车 ${fleet.sedan} / SUV ${fleet.suv} / 公交 ${fleet.bus}）· ${weatherLabels[projected.weather] ?? projected.weather} · ${signalSummary}`;
  planPreview.hidden = false;
  previewBadge.hidden = false;
  sceneRoot.dataset.preview = "true";
  resumeAutoSignalButton.disabled = true;
  world?.syncState(result.projected_scene ?? projected);
  window.__lastUndo = result.undo;
  updateUndoControl(result.undo);
  confirmPlanButton.focus();
}

async function previewPlan(command) {
  clearPlanPreview();
  setStatus("working", "正在生成 ScenePlan 并进行原子预演…");
  setPipeline("working");
  submitButton.disabled = true;
  try {
    const response = await fetch("/plan/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ command }),
    });
    const result = await response.json();
    if (result.status !== "preview_ready") {
      setSceneState(result.scene ?? lastScene);
      updateUndoControl(result.undo);
      if (result.event) updateInspector(result);
      setPipeline(result.validation_stage ?? "candidate", "rejected");
      setStatus("rejected", result.reason ?? result.error_code ?? "无法生成安全计划");
      return;
    }
    showPlanPreview(result);
    setPipeline("semantic", "preview");
    setStatus("ready", "计划已通过完整预演；确认前 SceneState 保持不变");
  } catch (error) {
    console.error("Plan preview failed", error);
    setStatus("rejected", "计划预演失败，场景未发生变化");
    setPipeline("candidate", "rejected");
  } finally {
    submitButton.disabled = false;
  }
}

async function confirmPlan() {
  if (!pendingPlanId) return;
  const planId = pendingPlanId;
  confirmPlanButton.disabled = true;
  cancelPlanButton.disabled = true;
  // The response hydrates editor values. Do not let edits race that hydration.
  const editorInputs=[...editorForm.querySelectorAll('input,select,button[type="submit"]')];
  for(const input of editorInputs) input.disabled=true;
  editorForm.setAttribute('aria-busy','true');
  setStatus("working", "正在原子执行已确认的 ScenePlan…");
  try {
    const response = await fetch("/plan/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ plan_id: planId }),
    });
    const result = await response.json();
    setSceneState(result.scene ?? lastScene);
    updateInspector(result);
    window.__lastUndo = result.undo;
    updateUndoControl(result.undo);
    setPipeline(result.event?.validation_stage ?? "execution", result.status);
    if (result.status === "accepted") {
      setStatus("accepted", `已原子执行 ${result.applied_action_count} 个场景动作`);
      clearPlanPreview();
    } else {
      setStatus("rejected", result.error_code === "STALE_PLAN" ? "场景已变化，请重新生成计划" : "计划未执行，场景保持不变");
    }
  } catch (error) {
    console.error("Plan execution failed", error);
    setStatus("rejected", "计划执行请求失败，场景未发生变化");
  } finally {
    confirmPlanButton.disabled = false;
    cancelPlanButton.disabled = false;
    for(const input of editorInputs) input.disabled=false;
    editorForm.setAttribute('aria-busy','false');
  }
}

async function previewUndo() {
  const changeId = undoButton.dataset.changeId;
  if (!changeId) return;
  clearPlanPreview();
  setStatus("working", "正在生成撤销预演…");
  setPipeline("working");
  undoButton.disabled = true;
  try {
    const response = await fetch("/history/undo-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ change_id: changeId }),
    });
    const result = await response.json();
    if (result.status !== "preview_ready") {
      setSceneState(result.scene ?? lastScene);
      updateUndoControl(result.undo);
      setPipeline(result.validation_stage ?? "semantic", "rejected");
      setStatus("rejected", result.reason ?? "撤销预演失败，场景未发生变化");
      return;
    }
    showPlanPreview(result);
    setPipeline("semantic", "preview");
    setStatus("ready", "撤销已通过完整预演；确认前 SceneState 保持不变");
  } catch (error) {
    console.error("Undo preview failed", error);
    setStatus("rejected", "撤销预演失败，场景未发生变化");
    updateUndoControl(window.__lastUndo);
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
  previewPlan(command);
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

resumeAutoSignalButton.addEventListener("click", () => {
  if (resumeAutoSignalButton.disabled) return;
  const command = "恢复自动信号";
  promptInput.value = command;
  promptInput.dispatchEvent(new Event("input"));
  previewPlan(command);
});

confirmPlanButton.addEventListener("click", confirmPlan);
undoButton.addEventListener("click", previewUndo);
cancelPlanButton.addEventListener("click", () => {
  clearPlanPreview();
  setPipeline("ready");
  setStatus("ready", "计划已取消，SceneState 未改变");
  promptInput.focus();
});

document.querySelector("#immersive-view").addEventListener("click", (event) => {
  const active = document.body.classList.toggle("immersive");
  event.currentTarget.setAttribute("aria-pressed", String(active));
  event.currentTarget.textContent = active ? "返回工作台" : "沉浸场景";
});

document.querySelector("#camera-mode").addEventListener("click", (event) => {
  const street = event.currentTarget.getAttribute("aria-pressed") !== "true";
  world?.setCameraMode(street ? "street" : "bird");
  event.currentTarget.setAttribute("aria-pressed", String(street));
  event.currentTarget.textContent = street ? "斜俯视" : "街景视角";
  document.querySelector('#corner-camera').setAttribute('aria-pressed','false');
});

document.querySelector('#corner-camera').addEventListener('click', event => {
  const active=event.currentTarget.getAttribute('aria-pressed') !== 'true';
  world?.setCameraMode(active ? 'corner' : 'bird');
  event.currentTarget.setAttribute('aria-pressed',String(active));
  const streetButton=document.querySelector('#camera-mode');
  streetButton.setAttribute('aria-pressed','false');
  streetButton.textContent='街景视角';
});

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
