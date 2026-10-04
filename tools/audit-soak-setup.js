async (page) => {
  await page.bringToFront();
  await page.waitForFunction(() => document.querySelector('#scene-root').dataset.busAsset==='ready');
  await page.getByRole('button',{name:'雨天',exact:true}).click();
  await page.getByRole('button',{name:'确认执行全部动作',exact:true}).click();
  for(const [sedan,suv,bus] of [[9,6,3],[12,8,4]]) {
    await page.getByRole('spinbutton',{name:'小轿车 / 跑车',exact:true}).fill(String(sedan));
    await page.getByRole('spinbutton',{name:'SUV',exact:true}).fill(String(suv));
    await page.getByRole('spinbutton',{name:'公交车',exact:true}).fill(String(bus));
    await page.getByRole('button',{name:'生成配置预演',exact:true}).click();
    await page.getByRole('button',{name:'确认执行全部动作',exact:true}).click();
    await page.waitForFunction(count => document.querySelector('#state-buses').textContent===String(count),sedan+suv+bus);
  }
  await page.getByRole('button',{name:'街景视角',exact:true}).click();
  await page.getByRole('button',{name:'沉浸场景',exact:true}).click();
  await page.setViewportSize({width:1968,height:1420});
  for(let attempt=0;attempt<4;attempt++) {
    await page.waitForFunction(() => {
      const c=document.querySelector('#scene-root canvas');
      return Math.abs(c.width-c.getBoundingClientRect().width*devicePixelRatio)<2;
    });
    const extent=await page.evaluate(() => {
      const c=document.querySelector('#scene-root canvas');return {w:c.width,h:c.height,vw:innerWidth,vh:innerHeight};
    });
    if(Math.abs(extent.w-1920)<=1 && Math.abs(extent.h-1080)<=1)break;
    await page.setViewportSize({width:Math.round(extent.vw+1920-extent.w),height:Math.round(extent.vh+1080-extent.h)});
  }
  await page.waitForFunction(() => document.querySelector('#scene-root').dataset.atmosphereTransition==='settled');
  await page.screenshot({path:'output/playwright/soak-rain-24-start.png',scale:'css'});
  return await page.evaluate(() => {
    const c=document.querySelector('#scene-root canvas');
    return {canvas:[c.width,c.height],viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,
      vehicles:document.querySelector('#state-buses').textContent,
      stats:JSON.parse(document.querySelector('#scene-root').dataset.renderStats)};
  });
}
