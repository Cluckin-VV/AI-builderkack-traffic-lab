// Run twenty times for 10 minutes of foreground RAF sampling, plus CLI gaps.
async (page) => {
  await page.bringToFront();
  return await page.evaluate(async () => {
    const frames=[],begin=performance.now();let last=begin;
    const context=() => {
      const root=document.querySelector('#scene-root'),canvas=root.querySelector('canvas');
      return {canvas:[canvas.width,canvas.height],vehicles:document.querySelector('#state-buses').textContent,
        weather:document.querySelector('#state-weather').textContent,camera:root.dataset.cameraMode,
        quality:document.querySelector('#render-quality').value,immersive:document.body.classList.contains('immersive')};
    };
    const initialContext=context();let interrupted=false;
    const initial=JSON.parse(document.querySelector('#scene-root').dataset.renderStats);
    await new Promise(done => {
      function step(now) {
        if(document.hidden || !document.hasFocus() || JSON.stringify(context())!==JSON.stringify(initialContext)) {
          interrupted=true;return done();
        }
        frames.push(now-last);last=now;
        if(now-begin>=30000) done();else requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
    const ordered=[...frames].sort((a,b)=>a-b);
    const elapsed=last-begin;
    if(interrupted || elapsed<30000) throw Error('Foreground/context soak interrupted; do not count this segment');
    return {elapsedMs:elapsed,frames:frames.length,averageMs:elapsed/frames.length,
      context:initialContext,finalContext:context(),
      p95Ms:ordered[Math.floor(ordered.length*.95)],over250ms:frames.filter(x=>x>250).length,
      before:{geometries:initial.geometries,textures:initial.textures},
      after:JSON.parse(document.querySelector('#scene-root').dataset.renderStats)};
  });
}
