// Regression for weather and undo previews becoming inaccessible in immersive view.
async (page) => {
  await page.bringToFront();
  const weather=()=>page.locator('#state-weather').textContent();
  const initial=await weather();
  const target=initial==='snow'?'晴天':'飘雪';
  if(!await page.evaluate(()=>document.body.classList.contains('immersive')))
    await page.getByRole('button',{name:'沉浸场景',exact:true}).click();
  await page.getByRole('button',{name:target,exact:true}).click();
  await page.getByRole('button',{name:'确认执行全部动作',exact:true}).waitFor({state:'visible'});
  if(await page.evaluate(()=>document.body.classList.contains('immersive')))throw Error('Preview stayed hidden');
  if(await weather()!==initial)throw Error('Preview changed live weather');
  await page.getByRole('button',{name:'沉浸场景',exact:true}).click();
  if(await page.evaluate(()=>document.body.classList.contains('immersive')))throw Error('Pending controls could be hidden');
  await page.getByRole('button',{name:'取消',exact:true}).click();
  if(await weather()!==initial)throw Error('Cancel changed live weather');
  await page.getByRole('button',{name:'沉浸场景',exact:true}).click();
  await page.getByRole('button',{name:target,exact:true}).click();
  await page.getByRole('button',{name:'确认执行全部动作',exact:true}).click();
  await page.waitForFunction(value=>document.querySelector('#state-weather').textContent!==value,initial);
  await page.getByRole('button',{name:'沉浸场景',exact:true}).click();
  await page.getByRole('button',{name:'撤销上次修改',exact:true}).click();
  await page.getByRole('button',{name:'确认执行全部动作',exact:true}).waitFor({state:'visible'});
  await page.getByRole('button',{name:'确认执行全部动作',exact:true}).click();
  await page.waitForFunction(value=>document.querySelector('#state-weather').textContent===value,initial);
  return {previewReachable:true,previewDidNotCommit:true,cancelPreservedWeather:true,undoRestoredWeather:true};
}
