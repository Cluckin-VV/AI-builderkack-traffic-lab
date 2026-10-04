// Own local demo UI: 24-car rain stress test, then restore the 12-car default.
async (page) => {
  const configure = async (sedan, suv, bus, weather) => {
    await page.getByRole('spinbutton', {name: '小轿车 / 跑车', exact: true}).fill(String(sedan));
    await page.getByRole('spinbutton', {name: 'SUV', exact: true}).fill(String(suv));
    await page.getByRole('spinbutton', {name: '公交车', exact: true}).fill(String(bus));
    await page.getByRole('combobox', {name: '天气', exact: true}).selectOption({label: weather});
    await page.getByRole('button', {name: '生成配置预演', exact: true}).click();
    await page.getByRole('button', {name: '确认执行全部动作', exact: true}).click();
    await page.waitForFunction(count => document.querySelector('#state-buses').textContent === String(count),sedan+suv+bus);
    await page.waitForFunction(() => document.querySelector('#scene-root').dataset.atmosphereTransition === 'settled');
  };
  // Domain policy permits at most six expanded actions per atomic plan.
  // Change weather separately, then add six vehicles in each confirmed batch.
  await page.getByRole('button', {name: '雨天', exact: true}).click();
  await page.getByRole('button', {name: '确认执行全部动作', exact: true}).click();
  await configure(9, 6, 3, '雨');
  await configure(12, 8, 4, '雨');
  await page.getByRole('button', {name: '街景视角', exact: true}).click();
  const results = [];
  for (const quality of ['balanced', 'low']) {
    await page.getByRole('combobox', {name: '画质', exact: true}).selectOption(quality);
    const timing = await page.evaluate(async () => {
      const frames = [], start = performance.now(); let last = start;
      await new Promise(resolve => {
        function sample(now) {
          frames.push(now - last); last = now;
          if (now - start >= 8000) resolve(); else requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
      const sorted = [...frames].sort((a, b) => a - b);
      return {samples: frames.length, durationMs: last - start,
        averageMs: frames.reduce((a,b) => a+b,0)/frames.length,
        p95Ms: sorted[Math.floor(sorted.length*.95)],
        over250ms: frames.filter(ms => ms>250).length,
        stats: JSON.parse(document.querySelector('#scene-root').dataset.renderStats)};
    });
    results.push({quality, ...timing});
    await page.screenshot({path: `output/playwright/atmosphere-rain-24-${quality}.png`, scale: 'css'});
  }
  await page.getByRole('combobox', {name: '画质', exact: true}).selectOption('balanced');
  await page.getByRole('button', {name: '暮色', exact: true}).click();
  await page.screenshot({path: 'output/playwright/atmosphere-rain-blue-street.png', scale: 'css'});
  await configure(9, 6, 3, '雨');
  await configure(6, 4, 2, '雨');
  await page.getByRole('button', {name: '晴天', exact: true}).click();
  await page.getByRole('button', {name: '确认执行全部动作', exact: true}).click();
  await page.waitForFunction(() => document.querySelector('#scene-root').dataset.atmosphereTransition === 'settled');
  await page.getByRole('button', {name: '金色时刻', exact: true}).click();
  await page.screenshot({path: 'output/playwright/atmosphere-clear-golden-street.png', scale: 'css'});
  await page.getByRole('button', {name: '自然日光', exact: true}).click();
  await page.getByRole('button', {name: '斜俯视', exact: true}).click();
  return results;
}
