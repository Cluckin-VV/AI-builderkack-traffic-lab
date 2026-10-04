// Restore the isolated 24-car soak scene, then capture the actual workbench.
async (page) => {
  await page.bringToFront();
  await page.getByRole('button',{name:'返回工作台',exact:true}).click();
  await page.setViewportSize({width:1920,height:1080});
  for(const [sedan,suv,bus] of [[9,6,3],[6,4,2]]) {
    await page.getByRole('spinbutton',{name:'小轿车 / 跑车',exact:true}).fill(String(sedan));
    await page.getByRole('spinbutton',{name:'SUV',exact:true}).fill(String(suv));
    await page.getByRole('spinbutton',{name:'公交车',exact:true}).fill(String(bus));
    await page.getByRole('button',{name:'生成配置预演',exact:true}).click();
    await page.getByRole('button',{name:'确认执行全部动作',exact:true}).click();
    await page.waitForFunction(count=>document.querySelector('#state-buses').textContent===String(count),sedan+suv+bus);
  }
  await page.getByRole('button',{name:'斜俯视',exact:true}).click();
  await page.getByRole('button',{name:'自然日光',exact:true}).click();
  await page.screenshot({path:'output/playwright/final-rain-workbench.png',scale:'css'});
  await page.getByRole('button',{name:'晴天',exact:true}).click();
  await page.getByRole('button',{name:'确认执行全部动作',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#scene-root').dataset.atmosphereTransition==='settled');
  return {vehicles:await page.locator('#state-buses').textContent(),weather:await page.locator('#state-weather').textContent()};
}
