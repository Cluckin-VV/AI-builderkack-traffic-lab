// Run through the isolated Playwright CLI: playwright-cli -s=urban run-code <file contents>.
async (page) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({width: 1600, height: 1000});
  await page.goto("http://127.0.0.1:8011/");
  await page.locator("#scene-root[data-bus-asset=ready]").waitFor({timeout: 30000});
  const rows = [];
  let verificationPaused = false;
  const cases = [
    ["增加一辆公交车", "accepted"],
    ["让公交车停下", "accepted"],
    ["让公交车继续行驶", "accepted"],
    ["把信号灯改成红色", "accepted"],
    ["把红灯变回绿色", "accepted"],
    ["删除一辆公交车", "accepted"],
    ["让天气下暴雪", "accepted"],
    ["让天气下陨石", "rejected"],
    ["增加公交车并把灯改成绿色", "rejected"],
  ];
  async function canvasPixels() {
    // Capture in the render frame before WebGL discards the drawing buffer.
    // Locator screenshots include DOM status overlays, which intentionally change on rejection.
    return page.evaluate(() => new Promise(resolve => requestAnimationFrame(() =>
      resolve(document.querySelector("#scene-root canvas").toDataURL()))));
  }
  async function submit(command) {
    await page.waitForFunction(() => !document.querySelector("#submit-command").disabled);
    await page.locator("#prompt").fill(command);
    const response = page.waitForResponse(r => r.url().endsWith("/command") && r.request().method() === "POST");
    await page.getByRole("button", {name: "构建场景", exact: true}).click();
    return (await response).json();
  }
  for (const [command, expected] of cases) {
    await page.waitForFunction(() => !document.querySelector("#submit-command").disabled);
    if (expected === "rejected" && !verificationPaused) {
      await page.getByRole("button", {name: "暂停动画", exact: true}).click();
      verificationPaused = true;
    }
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const canvasBefore = expected === "rejected" ? await canvasPixels() : null;
    const result = await submit(command);
    if (result.status !== expected) throw new Error(command + ": " + result.status);
    const event = result.event;
    if (!event || !event.runtime_fingerprint || !event.validation_stage) throw new Error("Incomplete EventLog");
    if (expected === "rejected" && JSON.stringify(event.state_before) !== JSON.stringify(event.state_after)) {
      throw new Error("Rejected command mutated state");
    }
    if (expected === "rejected" && !event.rejected_reason) throw new Error("Missing rejected_reason");
    await page.waitForFunction(() => !document.querySelector("#submit-command").disabled);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (canvasBefore && (canvasBefore.length < 10000 || canvasBefore !== await canvasPixels())) {
      throw new Error("Rejected command changed the static canvas");
    }
    rows.push({command, status: result.status, stage: event.validation_stage, rejected_reason: event.rejected_reason});
  }
  if (verificationPaused) await page.getByRole("button", {name: "继续动画", exact: true}).click();
  // Capture an actual state-controlled Blender bus in the cinematic scene.
  await submit("增加一辆公交车");
  await submit("让公交车停下");
  await submit("把信号灯改成红色");
  await page.getByRole("button", {name: "沉浸场景", exact: true}).click();
  await page.mouse.move(800, 500);
  await page.mouse.wheel(0, -270);
  // Allow camera resize and scale-in animation before capture.
  await page.waitForTimeout(450);
  await page.screenshot({path: "docs/transitlab-city-art-v1.png"});
  await page.getByRole("button", {name: "返回工作台", exact: true}).click();
  await page.screenshot({path: "output/playwright/urban-workbench.png"});
  await page.setViewportSize({width: 390, height: 844});
  await page.screenshot({path: "output/playwright/urban-mobile.png", fullPage: true});
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await page.setViewportSize({width: 1600, height: 1000});
  await page.getByRole("button", {name: "沉浸场景", exact: true}).click();
  if (overflow) throw new Error("Mobile horizontal overflow");
  if (errors.length) throw new Error(errors.join("; "));
  return {cases: rows, bus_asset: "ready", rejected_canvas_identical: true, mobile_horizontal_overflow: overflow, page_errors: errors};
}
