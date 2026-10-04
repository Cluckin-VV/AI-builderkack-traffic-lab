// Real UI verification on the local demo only; no external fetch or private data.
async (page) => {
  await page.bringToFront();
  const initialUrl=page.url();
  const identity=await page.locator('.runtime-strip').textContent();
  const checkIdentity=async()=>{
    if(page.url()!==initialUrl || await page.locator('.runtime-strip').textContent()!==identity)
      throw Error('Runtime identity changed during audit; discard this run');
  };
  await page.waitForFunction(() => document.querySelector('#scene-root').dataset.busAsset === 'ready');
  const capture=async path => {
    await checkIdentity();
    await page.locator('.control-rail').hover();
    await page.mouse.wheel(0,-2000);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.screenshot({path,scale:'css'});
  };
  const state = () => page.evaluate(() => ['state-buses','state-fleet','state-weather','state-signal-mode']
    .map(id => document.getElementById(id).textContent));
  const baseline = await state();
  await page.getByRole('button',{name:'街角近景',exact:true}).click();
  await page.getByRole('button',{name:'暮色',exact:true}).click();
  if(JSON.stringify(await state()) !== JSON.stringify(baseline)) throw Error('Camera/light changed domain state');
  await capture('output/playwright/corner-dusk-detail.png');
  await page.getByRole('button',{name:'街景视角',exact:true}).click();
  await page.getByRole('button',{name:'雨天',exact:true}).click();
  await page.getByRole('button',{name:'确认执行全部动作',exact:true}).click();
  await page.waitForFunction(() => document.querySelector('#scene-root').dataset.atmosphereTransition === 'settled');
  await capture('output/playwright/corner-rain-street.png');
  await page.getByRole('button',{name:'飘雪',exact:true}).click();
  await page.getByRole('button',{name:'取消',exact:true}).click();
  if((await state())[2] !== 'rain') throw Error('Preview cancellation changed weather');
  await page.getByRole('button',{name:'飘雪',exact:true}).click();
  await page.getByRole('button',{name:'确认执行全部动作',exact:true}).click();
  await page.waitForFunction(() => document.querySelector('#scene-root').dataset.atmosphereTransition === 'settled');
  await page.getByRole('button',{name:'斜俯视',exact:true}).click();
  const snow = await page.evaluate(() => JSON.parse(document.querySelector('#scene-root').dataset.renderStats));
  if(snow.snowSurfaces.total !== 16 || snow.snowSurfaces.visible !== 16) throw Error('Roof/sidewalk snow missing');
  await capture('output/playwright/corner-snow-roofs.png');
  await page.getByRole('button',{name:'晴天',exact:true}).click();
  await page.getByRole('button',{name:'确认执行全部动作',exact:true}).click();
  await page.waitForFunction(() => document.querySelector('#scene-root').dataset.atmosphereTransition === 'settled');
  await page.getByRole('button',{name:'自然日光',exact:true}).click();
  await capture('output/playwright/corner-final-clear.png');
  await checkIdentity();
  return {unchangedCameraState:true,cancelPreservedWeather:true,snowSurfaces:snow.snowSurfaces,restored:await state()};
}
