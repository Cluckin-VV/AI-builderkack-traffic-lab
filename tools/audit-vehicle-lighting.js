async (page) => {
  await page.bringToFront();
  await page.waitForFunction(() => document.querySelector('#scene-root')?.dataset.busAsset === 'ready');
  // Fresh demo state already contains passenger vehicles. Avoid changing its
  // composition, so the lighting measurement exercises only presentation.
  const level=() => page.locator('#scene-root').getAttribute('data-vehicle-headlamp-intensity').then(Number);
  await page.waitForFunction(() => document.querySelector('#scene-root')?.dataset.vehicleHeadlampIntensity !== 'none');
  if((await page.locator('#scene-root').getAttribute('data-weather'))!=='clear') {
    await page.getByRole('button',{name:'晴天',exact:true}).click();
    await page.getByRole('button',{name:'确认执行全部动作',exact:true}).click();
  }
  await page.waitForFunction(() => Number(document.querySelector('#scene-root').dataset.vehicleHeadlampIntensity)<.2);
  const daylight=await level();
  if(daylight>.2)throw Error(`Daylight headlamps too bright: ${daylight}`);
  await page.getByRole('button',{name:'暮色',exact:true}).click();
  await page.waitForFunction(() => Number(document.querySelector('#scene-root').dataset.vehicleHeadlampIntensity)>1.15);
  const dusk=await level();
  await page.getByRole('button',{name:'自然日光',exact:true}).click();
  await page.waitForFunction(() => Number(document.querySelector('#scene-root').dataset.vehicleHeadlampIntensity)<.2);
  await page.getByRole('button',{name:'雨天',exact:true}).click();
  await page.getByRole('button',{name:'确认执行全部动作',exact:true}).click();
  await page.waitForFunction(() => Number(document.querySelector('#scene-root').dataset.vehicleHeadlampIntensity)>.95);
  const rain=await level();
  return {daylight,dusk,rain,vehicleCount:await page.locator('#state-buses').textContent()};
}
