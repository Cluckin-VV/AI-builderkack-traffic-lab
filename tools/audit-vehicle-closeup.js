// Actual Three.js + production loader inspection, not a Blender still.
async (page) => {
  await page.bringToFront();
  await page.evaluate(async () => {
    const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js');
    const identity = await (await fetch('/health')).json();
    const art = await import('/assets/urban-world.js?v='+identity.source_fingerprint);
    const assets = await art.loadVehicleAssets();
    for (const [kind, model] of Object.entries(assets)) {
      let wheels = 0;
      model.traverse(pivot => {
        if (!pivot.userData.vehicleWheelId) return;
        wheels++;
        const spin = pivot.children.find(c => c.userData.vehicleWheelSpin);
        if (!spin) throw Error(kind+': missing independent spinning assembly');
        const caliper = pivot.children.find(c => c.userData.component === 'brake_caliper');
        model.updateMatrixWorld(true);
        const before = caliper?.matrixWorld.clone();
        spin.rotation.z = .83;
        model.updateMatrixWorld(true);
        if (before && !caliper.matrixWorld.equals(before)) throw Error(kind+': caliper rotates with tire');
        spin.rotation.z = 0;
      });
      if (wheels !== 4) throw Error(kind+': expected four wheel pivots');
    }
    const overlay = document.createElement('div');
    overlay.id = 'vehicle-audit';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#151d24';
    document.body.append(overlay);
    const renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    overlay.append(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.1,300);
    const world = {scene,renderer};art.createAtmosphere(world);
    world.sun.position.set(5,8,4);world.sun.intensity=2.5;
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshStandardMaterial({color:0x43494b,roughness:.8}));
    ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
    const label=document.createElement('div');label.style.cssText='position:absolute;top:24px;left:32px;color:white;font:20px sans-serif';overlay.append(label);
    window.vehicleAudit = {show(kind,rear=false){
      for(const model of Object.values(assets))scene.remove(model);
      const model=assets[kind];model.position.y=model.userData.groundOffset-.22;scene.add(model);
      const scale=kind==='bus'?2:1;
      camera.position.set((rear?-6:6)*scale,3.1*scale,6*scale);camera.lookAt(0,kind==='bus'?1.5:.8,0);
      label.textContent=`TransitLab · ${kind} · production browser asset · ${identity.source_fingerprint}`;
      renderer.render(scene,camera);
      return {triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls};
    },dispose(){
      const geometries=new Set(), materials=new Set();
      const collect=o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of [o.material].flat())materials.add(m);};
      scene.traverse(collect);
      for(const model of Object.values(assets))model.traverse(collect);
      for(const geometry of geometries)geometry.dispose();
      for(const material of materials)material.dispose();
      world.environmentTarget.dispose();renderer.dispose();overlay.remove();delete window.vehicleAudit;
    }};
  });
  const result = {};
  for(const kind of ['sedan','suv','bus']) {
    result[kind]=await page.evaluate(kind=>window.vehicleAudit.show(kind),kind);
    await page.screenshot({path:`output/playwright/vehicle-cabin-${kind}-browser.png`});
  }
  await page.evaluate(()=>window.vehicleAudit.show('sedan',true));
  await page.screenshot({path:'output/playwright/vehicle-cabin-sedan-rear-browser.png'});
  await page.evaluate(()=>window.vehicleAudit.dispose());
  return {wheelAssembliesVerified:true,models:result};
}
