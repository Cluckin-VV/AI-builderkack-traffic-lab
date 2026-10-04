// Browser UI acceptance on an isolated local demo; no state injection.
async (page) => {
  await page.bringToFront();
  const url=page.url(), identity=await page.locator('.runtime-strip').textContent();
  const data=()=>page.locator('#scene-root').evaluate(el=>({...el.dataset}));
  if(await page.locator('#scene-root').getAttribute('data-camera-mode')!=='street')
    await page.getByRole('button',{name:'街景视角',exact:true}).click();
  await page.getByRole('button',{name:'暮色',exact:true}).click();
  await page.getByRole('button',{name:'雨天',exact:true}).click();
  await page.getByRole('button',{name:'确认执行全部动作',exact:true}).click();
  await page.waitForFunction(()=>{
    const d=document.querySelector('#scene-root').dataset;
    return d.atmosphereTransition==='settled' && d.lightingTransition==='settled' && +d.surfaceWetness>.95;
  });
  await page.screenshot({path:'output/playwright/rain-surface-dusk.png',scale:'css'});
  const rain=await data();
  await page.getByRole('button',{name:'晴天',exact:true}).click();
  await page.getByRole('button',{name:'取消',exact:true}).click();
  if((await data()).weather!=='rain')throw Error('Cancelled preview mutated weather');
  await page.getByRole('button',{name:'晴天',exact:true}).click();
  await page.getByRole('button',{name:'确认执行全部动作',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#scene-root').dataset.atmosphereTransition==='settled');
  const drying=await data();
  if(drying.weather!=='clear' || +drying.surfaceWetness<=.3 || +drying.surfaceWetness>=+rain.surfaceWetness)
    throw Error('Rain did not stop while the road retained moisture');
  await page.screenshot({path:'output/playwright/rain-surface-after-rain.png',scale:'css'});
  if(page.url()!==url || await page.locator('.runtime-strip').textContent()!==identity)throw Error('Runtime changed during audit');
  return {identity,rain:{wetness:rain.surfaceWetness,stats:rain.renderStats},drying:{weather:drying.weather,wetness:drying.surfaceWetness},cancelPreservedWeather:true};
}
