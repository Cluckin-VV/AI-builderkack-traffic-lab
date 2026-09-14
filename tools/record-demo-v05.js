// Playwright CLI run-code input. Records real public UI interactions, not a simulated video.
// Precondition: one demo-owned bus; clear weather; buses running; EW green.
// Start video-start separately; run this function; then video-stop even if an assertion fails.
async (page) => {
  const began = Date.now();
  const timeline = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (['warning', 'error'].includes(message.type())) errors.push(message.type() + ': ' + message.text());
  });
  const mark = (label, extra = {}) => timeline.push({seconds: (Date.now() - began) / 1000, label, ...extra});
  const hold = async seconds => page.waitForTimeout(seconds * 1000);
  async function submit(command, expected = 'accepted') {
    await page.waitForFunction(() => !document.querySelector('#submit-command').disabled);
    await page.locator('#prompt').fill('');
    await page.locator('#prompt').pressSequentially(command, {delay: 85});
    mark('command', {command});
    const pending = page.waitForResponse(response => response.url().endsWith('/command') && response.request().method() === 'POST');
    await page.getByRole('button', {name: '构建场景', exact: true}).click();
    const result = await (await pending).json();
    if (result.status !== expected) throw new Error(command + ': ' + result.status);
    const event = result.event;
    if (!event.runtime_fingerprint || !event.validation_stage) throw new Error('Incomplete Event Log');
    if (expected === 'rejected' && (JSON.stringify(event.state_before) !== JSON.stringify(event.state_after) || !event.rejected_reason)) throw new Error('Unsafe rejection');
    if (command === '增加一辆公交车' && event.state_after.buses !== event.state_before.buses + 1) throw new Error('Bus increment is not one');
    mark('result', {command, status: result.status, stage: event.validation_stage, before: event.state_before, after: event.state_after, reason: event.rejected_reason});
    await page.waitForFunction(() => !document.querySelector('#submit-command').disabled);
  }
  if (await page.locator('#bus-count').innerText() !== '1') throw new Error('Recording precondition changed; do not reset a shared scene automatically');
  mark('intro');
  await hold(6);
  for (let i = 0; i < 3; i++) { await submit('增加一辆公交车'); await hold(3); }
  mark('orbit');
  await page.getByRole('button', {name: '沉浸场景', exact: true}).click();
  await page.mouse.move(890, 580);
  await page.mouse.down();
  await page.mouse.move(980, 560, {steps: 55});
  await page.mouse.up();
  await hold(8);
  await page.getByRole('button', {name: '返回工作台', exact: true}).click();
  await page.getByRole('button', {name: '重置镜头', exact: true}).click();
  await submit('把信号灯改成红色');
  await hold(11);
  mark('phase', {text: await page.locator('#light-state').innerText()});
  await submit('让公交车停下');
  await hold(5);
  mark('manual_stop', {text: await page.locator('#motion-state').innerText()});
  await submit('让公交车继续行驶');
  await hold(7);
  await submit('让天气下雨');
  await hold(7);
  await submit('让天气下暴雪');
  await hold(8);
  await page.screenshot({path: 'output/playwright/public-v05-snow-four-buses.png'});
  await submit('让天气起雾');
  await hold(7);
  await submit('恢复晴天');
  await hold(4);
  await page.getByRole('button', {name: '暂停动画', exact: true}).click();
  await submit('让天气下陨石', 'rejected');
  await hold(5);
  await page.getByText('查看原始 Event Log', {exact: false}).click();
  await page.locator('#event-json').scrollIntoViewIfNeeded();
  mark('event_log');
  await hold(8);
  await page.getByText('查看原始 Event Log', {exact: false}).click();
  await page.getByRole('button', {name: '继续动画', exact: true}).click();
  await page.getByRole('button', {name: '沉浸场景', exact: true}).click();
  mark('closing');
  await hold(6);
  mark('end');
  if (errors.length) throw new Error(errors.join('; '));
  return {timeline, errors, public_url: page.url(), added_buses: 3};
}
