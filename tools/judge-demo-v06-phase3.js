// Playwright CLI run-code input: undo preview, undo confirmation and recovery.
async (page) => {
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (["warning", "error"].includes(m.type())) errors.push(m.type() + ": " + m.text()); });
  const undoResponse = page.waitForResponse(r => r.url().endsWith("/history/undo-preview") && r.request().method() === "POST");
  await page.getByRole("button", {name: "撤销上次修改", exact: true}).click();
  const undoPreview = await (await undoResponse).json();
  if (undoPreview.status !== "preview_ready" || !undoPreview.undo_of || undoPreview.projected_scene.bus_running !== true) throw new Error("undo preview failed");
  await page.screenshot({path: "output/playwright/judge-demo-08-undo-preview.png"});

  const undoExecuteResponse = page.waitForResponse(r => r.url().endsWith("/plan/execute") && r.request().method() === "POST");
  await page.getByRole("button", {name: "确认执行全部动作", exact: true}).click();
  const undone = await (await undoExecuteResponse).json();
  if (undone.status !== "accepted" || undone.state_after.bus_running !== true || undone.event?.event_type !== "scene_plan_undo") throw new Error("undo confirmation failed");
  if (undone.event.undo_of !== undoPreview.undo_of) throw new Error("undo link is incomplete");
  await page.screenshot({path: "output/playwright/judge-demo-09-undo-confirmed.png"});

  await page.locator("#prompt").fill("把红灯变回绿色");
  const previewResponse = page.waitForResponse(r => r.url().endsWith("/plan/preview") && r.request().method() === "POST");
  await page.getByRole("button", {name: "生成并预演", exact: true}).click();
  const preview = await (await previewResponse).json();
  if (preview.status !== "preview_ready" || preview.projected_scene.traffic_light !== "绿灯") throw new Error("green preview failed");
  await page.screenshot({path: "output/playwright/judge-demo-10-green-preview.png"});
  const executeResponse = page.waitForResponse(r => r.url().endsWith("/plan/execute") && r.request().method() === "POST");
  await page.getByRole("button", {name: "确认执行全部动作", exact: true}).click();
  const final = await (await executeResponse).json();
  if (final.status !== "accepted" || final.state_after.traffic_light !== "绿灯") throw new Error("final recovery failed");
  await page.getByText("查看原始 Event Log", {exact: false}).click();
  await page.locator("#event-json").scrollIntoViewIfNeeded();
  await page.screenshot({path: "output/playwright/judge-demo-11-finale.png"});
  if (errors.length) throw new Error(errors.join("; "));
  return {phase: 3, passed: true, final_state: final.state_after, event_type: final.event.event_type, console_errors: 0};
}
