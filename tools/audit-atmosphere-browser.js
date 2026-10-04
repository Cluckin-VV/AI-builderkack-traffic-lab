// Run with playwright-cli run-code --filename=tools/audit-atmosphere-browser.js.
// Own local demo only; uses real UI confirmation, never bypasses the action pipeline.
async (page) => {
  await page.bringToFront();
  const results = [];
  for (const [name, button] of [['clear', null], ['rain', '雨天'], ['snow', '飘雪'], ['fog', '薄雾']]) {
    if (button) {
      await page.getByRole('button', {name: button, exact: true}).click();
      await page.getByRole('button', {name: '确认执行全部动作', exact: true}).click();
    }
    await page.getByRole('button', {name: '重置镜头', exact: true}).click();
    await page.waitForFunction(() => {
      const root = document.querySelector('#scene-root');
      return root.dataset.busAsset === 'ready' && root.dataset.atmosphereTransition === 'settled';
    });
    const timing = await page.evaluate(async () => {
      const frames = [], start = performance.now();
      let previous = start;
      await new Promise(resolve => {
        function sample(now) {
          frames.push(now - previous); previous = now;
          if (now - start >= 8000) resolve(); else requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
      const sorted = [...frames].sort((a, b) => a - b);
      return {
        samples: frames.length, durationMs: previous - start,
        averageMs: frames.reduce((a, b) => a + b, 0) / frames.length,
        p95Ms: sorted[Math.floor(sorted.length * .95)],
        over250ms: frames.filter(ms => ms > 250).length,
        stats: JSON.parse(document.querySelector('#scene-root').dataset.renderStats),
        preview: document.querySelector('#scene-root').dataset.preview,
        viewport: [innerWidth, innerHeight],
        canvas: [document.querySelector('#scene-root canvas').width, document.querySelector('#scene-root canvas').height],
      };
    });
    const path = `output/playwright/atmosphere-final-${name}-1080.png`;
    await page.screenshot({path, scale: 'css'});
    results.push({weather: name, screenshot: path, ...timing});
  }
  return results;
}
