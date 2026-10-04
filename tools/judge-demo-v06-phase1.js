// Playwright CLI run-code input: build preview and confirmation.
async (page) => {
  const root = "http://127.0.0.1:8021";
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (["warning", "error"].includes(m.type())) errors.push(m.type() + ": " + m.text()); });
  await page.setViewportSize({width: 1600, height: 1000});
  await page.goto(root + "/");
  await page.locator("#scene-root[data-bus-asset=ready]").waitFor({timeout: 30000});
  const initial = await page.evaluate(async () => (await fetch("/api/state")).json());
  if (initial.scene.buses !== 0 || initial.scene.scene_layout !== "crossroads" || initial.scene.weather !== "clear") throw new Error("server is not fresh");

  const command = "创建公交站情境，然后增加两辆公交车并让天气下雪";
  await page.locator("#prompt").fill(command);
  const previewResponse = page.waitForResponse(r => r.url().endsWith("/plan/preview") && r.request().method() === "POST");
  await page.getByRole("button", {name: "生成并预演", exact: true}).click();
  const preview = await (await previewResponse).json();
  if (preview.status !== "preview_ready" || !preview.projected_scene || !preview.plan?.plan_id) throw new Error("build preview failed");
  const text = await page.locator("#plan-projection").innerText();
  if (!text.includes("双向公交站") || !text.includes("2 辆公交车") || !text.includes("雪")) throw new Error("projection is not explained");
  if (preview.scene.buses !== 0) throw new Error("preview changed live state");
  await page.screenshot({path: "output/playwright/judge-demo-01-preview.png"});

  const executeResponse = page.waitForResponse(r => r.url().endsWith("/plan/execute") && r.request().method() === "POST");
  await page.getByRole("button", {name: "确认执行全部动作", exact: true}).click();
  const executed = await (await executeResponse).json();
  if (executed.status !== "accepted" || executed.state_after.buses !== 2 || executed.state_after.scene_layout !== "bus_stop" || executed.state_after.weather !== "snow") throw new Error("build confirmation failed");
  if (executed.event?.validation_stage !== "execution" || !executed.event?.runtime_fingerprint) throw new Error("build Event Log incomplete");
  await page.screenshot({path: "output/playwright/judge-demo-02-bus-stop-snow.png"});
  if (errors.length) throw new Error(errors.join("; "));
  return {phase: 1, passed: true, runtime: initial.runtime?.source_fingerprint, state: executed.state_after, console_errors: 0};
}
