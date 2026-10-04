// Playwright CLI run-code input: signal, stop and safe rejection.
async (page) => {
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => {
    const text = m.text();
    const expectedRejection = text.includes("Failed to load resource") && text.includes("422");
    if (["warning", "error"].includes(m.type()) && !expectedRejection) errors.push(m.type() + ": " + text);
  });
  async function waitIdle() { await page.waitForFunction(() => !document.querySelector("#submit-command").disabled); }
  async function plan(command, screenshot) {
    await waitIdle();
    await page.locator("#prompt").fill(command);
    const response = page.waitForResponse(r => r.url().endsWith("/plan/preview") && r.request().method() === "POST");
    await page.getByRole("button", {name: "生成并预演", exact: true}).click();
    const result = await (await response).json();
    if (result.status !== "preview_ready") throw new Error(command + " preview failed");
    if (screenshot) await page.screenshot({path: screenshot});
    return result;
  }
  async function confirm(screenshot) {
    const response = page.waitForResponse(r => r.url().endsWith("/plan/execute") && r.request().method() === "POST");
    await page.getByRole("button", {name: "确认执行全部动作", exact: true}).click();
    const result = await (await response).json();
    if (result.status !== "accepted" || result.event?.validation_stage !== "execution") throw new Error("confirmation failed");
    if (screenshot) await page.screenshot({path: screenshot});
    return result;
  }
  const redPreview = await plan("把信号灯改成红色", "output/playwright/judge-demo-03-red-preview.png");
  if (redPreview.projected_scene.traffic_light !== "红灯") throw new Error("red preview is wrong");
  const red = await confirm("output/playwright/judge-demo-04-red-light.png");
  if (red.state_after.traffic_light !== "红灯") throw new Error("red state is wrong");
  await page.waitForTimeout(1800);

  const stopPreview = await plan("让公交车停下", "output/playwright/judge-demo-05-stop-preview.png");
  if (stopPreview.projected_scene.bus_running !== false) throw new Error("stop preview is wrong");
  const stopped = await confirm("output/playwright/judge-demo-06-stopped.png");
  if (stopped.state_after.bus_running !== false) throw new Error("stop state is wrong");

  await waitIdle();
  await page.locator("#prompt").fill("让天气下陨石");
  const rejectResponse = page.waitForResponse(r => r.url().endsWith("/plan/preview") && r.request().method() === "POST");
  await page.getByRole("button", {name: "生成并预演", exact: true}).click();
  const rejected = await (await rejectResponse).json();
  if (rejected.status !== "rejected" || !rejected.event?.rejected_reason) throw new Error("rejection has no reason");
  if (JSON.stringify(rejected.state_before) !== JSON.stringify(rejected.state_after)) throw new Error("rejection mutated state");
  await page.screenshot({path: "output/playwright/judge-demo-07-safe-rejection.png"});
  if (errors.length) throw new Error(errors.join("; "));
  return {phase: 2, passed: true, rejected_reason: rejected.event.rejected_reason, state_unchanged: true, console_errors: 0};
}
