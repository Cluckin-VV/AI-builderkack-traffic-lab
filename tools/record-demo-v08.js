// Playwright CLI run-code input for a real public v0.8 demo, not a simulation.
// Start video-start separately. Never reset a shared public scene automatically.
async (page) => {
  const started = Date.now();
  const timeline = [];
  const errors = [];
  const mark = (label, details = {}) => timeline.push({ seconds: Number(((Date.now() - started) / 1000).toFixed(2)), label, ...details });
  const hold = seconds => page.waitForTimeout(seconds * 1000);
  const readState = async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await page.evaluate(async () => (await (await fetch('/api/state', { cache: 'no-store' })).json()));
      } catch (error) {
        if (attempt === 2) throw error;
        await hold(2);
      }
    }
  };
  const vehicleCount = state => state.scene.vehicles.length;
  const weather = state => state.scene.weather;
  const responseFor = path => page.waitForResponse(response => new URL(response.url()).pathname === path && response.request().method() === 'POST');

  page.on('pageerror', error => errors.push({ type: 'pageerror', text: error.message }));
  page.on('console', message => {
    if (message.type() === 'error') errors.push({ type: 'console', text: message.text(), url: message.location().url });
  });
  const baseline = await readState();
  if (baseline.runtime?.source_fingerprint !== 'c5f00237fa53' || vehicleCount(baseline) !== 12 || weather(baseline) !== 'clear' || baseline.undo?.available) {
    throw new Error('Public scene/build differs from the verified baseline; do not mutate shared state');
  }
  if (await page.locator('canvas').count() < 1) throw new Error('WebGL canvas is absent');
  mark('intro', { fingerprint: baseline.runtime.source_fingerprint, vehicles: 12, weather: 'clear' });
  await hold(4);

  await page.locator('#prompt').fill('增加两辆SUV，切换雨天');
  const previewPending = responseFor('/plan/preview');
  await page.locator('#submit-command').click();
  const preview = await (await previewPending).json();
  if (preview.status !== 'preview_ready' || preview.steps.length !== 3 || preview.projected_scene.vehicles.length !== 14 || preview.projected_scene.weather !== 'rain') {
    throw new Error(`Unexpected plan preview: ${preview.status}`);
  }
  const afterPreview = await readState();
  if (vehicleCount(afterPreview) !== 12 || weather(afterPreview) !== 'clear') throw new Error('Preview mutated live state');
  mark('preview', { projectedVehicles: 14, projectedWeather: 'rain', liveVehicles: 12, liveWeather: 'clear' });
  await hold(7);

  const executePending = responseFor('/plan/execute');
  await page.locator('#confirm-plan').click();
  const executed = await (await executePending).json();
  if (executed.status !== 'accepted' || executed.applied_action_count !== 3) throw new Error(`Plan was not accepted: ${executed.status}`);
  const afterExecution = await readState();
  if (vehicleCount(afterExecution) !== 14 || weather(afterExecution) !== 'rain') throw new Error('Confirmed scene does not match preview');
  mark('confirmed', { vehicles: 14, weather: 'rain' });
  await hold(7);
  await page.locator('#traffic-camera').click();
  mark('vehicle_follow_camera');
  await hold(7);
  await page.locator('#reset-camera').click();

  const undoPending = responseFor('/history/undo-preview');
  await page.locator('#undo-last').click();
  const undoPreview = await (await undoPending).json();
  if (undoPreview.status !== 'preview_ready' || undoPreview.projected_scene.vehicles.length !== 12 || undoPreview.projected_scene.weather !== 'clear') {
    throw new Error(`Unexpected undo preview: ${undoPreview.status}`);
  }
  const afterUndoPreview = await readState();
  if (vehicleCount(afterUndoPreview) !== 14 || weather(afterUndoPreview) !== 'rain') throw new Error('Undo preview mutated live state');
  mark('undo_preview', { projectedVehicles: 12, projectedWeather: 'clear', liveVehicles: 14, liveWeather: 'rain' });
  await hold(6);

  const undoExecutePending = responseFor('/plan/execute');
  await page.locator('#confirm-plan').click();
  const undone = await (await undoExecutePending).json();
  if (undone.status !== 'accepted') throw new Error(`Undo was not accepted: ${undone.status}`);
  const restored = await readState();
  if (vehicleCount(restored) !== 12 || weather(restored) !== 'clear') throw new Error('Public scene was not restored');
  mark('undo_confirmed', { vehicles: 12, weather: 'clear' });
  await hold(5);

  await page.locator('#prompt').fill('让天气下陨石');
  const rejectionPending = responseFor('/plan/preview');
  await page.locator('#submit-command').click();
  const rejection = await (await rejectionPending).json();
  const finalState = await readState();
  if (rejection.status !== 'rejected' || vehicleCount(finalState) !== 12 || weather(finalState) !== 'clear') {
    throw new Error(`Unsafe rejection or scene drift: ${rejection.status}`);
  }
  mark('safe_rejection', { status: rejection.status, stage: rejection.validation_stage, reason: rejection.reason });
  await hold(6);
  await page.locator('#prompt').fill('');
  await page.locator('#reset-camera').click();
  mark('end');
  await hold(3);
  // Chromium reports an intentional HTTP 422 as a resource console error.
  // Classify it only after the rejected response and unchanged state were verified.
  const expectedHttpRejections = errors.filter(error => error.type === 'console'
    && error.text.includes('status of 422') && error.url?.endsWith('/plan/preview'));
  const unexpectedErrors = errors.filter(error => !expectedHttpRejections.includes(error));
  return { passed: unexpectedErrors.length === 0 && expectedHttpRejections.length <= 1,
    timeline, unexpectedErrors, expectedHttpRejections,
    restoredVehicleCount: 12, restoredWeather: 'clear', publicUrl: page.url() };
}
