import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
const { Reflector } = await import("/assets/vendor/Reflector.js" + new URL(import.meta.url).search);

// Presentation-only assets. No commands, validators or SceneState writes here.
const mats = new Map();
const revision = new URL(import.meta.url).search;
function material(color, roughness = .65, metalness = .05, glow = 0) {
  const key = `${color}/${roughness}/${metalness}/${glow}`;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({
    color, roughness, metalness, emissive: glow ? color : 0, emissiveIntensity: glow,
  }));
  return mats.get(key);
}
function block(parent, x, y, z, w, h, d, mat, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true;
  parent.add(m); return m;
}
function cylinder(parent, x, y, z, radius, height, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 12), mat);
  m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
}
function label(parent, text, x, y, z, width, color = "#ffe4b4", background = "#162a2c") {
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext("2d"); ctx.fillStyle = background; ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = color; ctx.font = "600 38px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 49, 478);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 96 / 512),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
  panel.position.set(x, y, z); parent.add(panel); return panel;
}

export function createAtmosphere(world) {
  const { scene, renderer } = world;
  scene.background = new THREE.Color(0xa7b6c5);
  scene.fog = new THREE.Fog(0xa7b6c5, 95, 260);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(240, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(0x769bbd) }, bottom: { value: new THREE.Color(0xf5d8bd) } },
    vertexShader: "varying vec3 vWorld; void main(){vWorld=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: "uniform vec3 top;uniform vec3 bottom;varying vec3 vWorld;void main(){float h=normalize(vWorld).y;vec3 c=mix(bottom,top,smoothstep(-.05,.7,h));gl_FragColor=vec4(c,1.0);}",
  }));
  scene.add(sky);
  const hemisphere = new THREE.HemisphereLight(0xd4e4fa, 0x696660, 1.05);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xffd3a0, 3.1);
  sun.position.set(-35, 38, 25); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -65, right: 65, top: 55, bottom: -55, far: 150 });
  sun.shadow.normalBias = .025; scene.add(sun);
  Object.assign(world, { sky, hemisphere, sun });
  // A low-cost static reflection environment for glass, enamel and damp asphalt.
  const environment = new THREE.Scene(); environment.background = new THREE.Color(0xc4d5e2);
  environment.add(sky.clone());
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    block(environment, Math.cos(angle)*45, 12, Math.sin(angle)*45, 13, 24+i%3*9, 12,
      new THREE.MeshBasicMaterial({ color: i%2 ? 0x374755 : 0x627181 }), false);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  world.environmentTarget = pmrem.fromScene(environment, .025, .1, 300);
  scene.environment = world.environmentTarget.texture; scene.environmentIntensity = .65;
  pmrem.dispose();
  for (const child of environment.children) if (child !== environment.children[0]) { child.geometry?.dispose(); child.material?.dispose(); }
}

export function createCity(world) {
  const scene = world.scene;
  const pavement = material(0xb2afa3, .91);
  const stone = material(0xcac5b9, .85);
  const steel = material(0x35464e, .35, .7);
  const dark = material(0x263439, .7);
  world.groundMaterial = material(0x848b7d);
  block(scene, 0, -.20, 0, 320, .3, 260, world.groundMaterial);
  const texture = new THREE.TextureLoader().load("/assets/textures/asphalt-ai-v1.png" + revision, undefined, undefined,
    () => world.container.dataset.textureStatus = "fallback");
  texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(30, 4); texture.anisotropy = Math.min(8, world.renderer.capabilities.getMaxAnisotropy());
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x7b858d, map: texture, bumpMap: texture,
    bumpScale: .018, roughness: .42, metalness: .10, envMapIntensity: .7 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(160, 17), asphalt);
  road.rotation.x = -Math.PI/2; road.position.y = .2; road.receiveShadow = true; scene.add(road);
  const crossRoad = new THREE.Mesh(new THREE.PlaneGeometry(17, 160), asphalt);
  crossRoad.rotation.x = -Math.PI/2; crossRoad.position.y = .202; crossRoad.receiveShadow = true; scene.add(crossRoad);
  world.roadMaterial = asphalt;
  world.wetRoads = [createWetRoad(scene, 160, 17), createWetRoad(scene, 17, 160)];
  world.wetRoads.forEach(surface => { surface.visible = false; });
  const marking = material(0xf3eee0,.65);
  for (const side of [-1,1]) {
    block(scene,-45,.18,side*11.8,70,.34,6.5,pavement,false);
    block(scene,45,.18,side*11.8,70,.34,6.5,pavement,false);
    for (let x=-78;x<80;x+=2) if(Math.abs(x)>10) block(scene,x,.34,side*8.65,1.96,.32,.30,stone,false);
    // Fine paving seams and drainage grates, with geometry kept above the road.
    for (let x=-78;x<80;x+=3) if(Math.abs(x)>10) block(scene,x,.358,side*11.7,.026,.014,5.5,material(0x98988e),false);
    for (let x=-66;x<70;x+=18) {
      block(scene,x,.375,side*8.98,.8,.035,.42,dark,false);
      for(let j=0;j<6;j++) block(scene,x-.32+j*.13,.398,side*8.98,.045,.016,.39,steel,false);
    }
    block(scene,-44,.213,side*7.95,72,.016,.11,marking,false);
    block(scene,44,.213,side*7.95,72,.016,.11,marking,false);
    for(let x=-76;x<78;x+=8) if(Math.abs(x)>12) block(scene,x,.213,side*4.2,3.6,.016,.12,marking,false);
  }
  for(const z of [-.13,.13]) for(const x of [-44,44]) block(scene,x,.216,z,72,.016,.10,material(0xe4bd56),false);
  // North-south lane, edge, stop-line and zebra markings. The center stays clear.
  for(const side of [-1,1]) {
    for(const z of [-44,44]) block(scene,side*7.95,.214,z,.11,.016,72,marking,false);
    for(let z=-76;z<78;z+=8) if(Math.abs(z)>12) block(scene,side*4.2,.214,z,.12,.016,3.6,marking,false);
  }
  for(const x of [-.13,.13]) for(const z of [-44,44]) block(scene,x,.216,z,.10,.016,72,material(0xe4bd56),false);
  for(const approach of [-1,1]) {
    for(let offset=-7.6;offset<8;offset+=1.25) {
      block(scene,approach*11,.22,offset,3.4,.022,.62,marking,false);
      block(scene,offset,.22,approach*11,.62,.022,3.4,marking,false);
    }
    block(scene,approach*7.9,.222,0,.24,.022,7,marking,false);
    block(scene,0,.222,approach*7.9,7,.022,.24,marking,false);
  }
  // Road furniture: manholes, tactile paving, bollards and bus stop.
  for (const x of [-19,25]) {
    const cover=cylinder(scene,x,.222,5.3,.46,.018,steel);
    for(let j=-2;j<=2;j++) block(scene,x+j*.14,.239,5.3,.028,.016,.65,dark,false);
  }
  for(let x=18.6;x<23.5;x+=.34) for(let z=9;z<9.9;z+=.25)
    cylinder(scene,x,.379,z,.035,.02,material(0xbfa365));
  for(let x=-65;x<70;x+=7) if(Math.abs(x)>14) for(const side of [-1,1]) cylinder(scene,x,.88,side*9.6,.08,1.05,steel);

  const busStop = new THREE.Group(); busStop.position.set(-30,0,-11.8); scene.add(busStop);
  const shelterGlass = new THREE.MeshPhysicalMaterial({ color:0xadc8cb,metalness:.15,roughness:.12,transparent:true,opacity:.38,side:THREE.DoubleSide });
  for(const x of [-3.5,3.5]) cylinder(busStop,x,1.75,0,.065,3.2,steel);
  block(busStop,0,3.4,0,8,.16,2.7,steel);
  block(busStop,0,1.8,-.95,7,.0+2.5,.035,shelterGlass,false);
  block(busStop,0,3.31,.9,6,.035,.12,material(0xffdab0,.4,0,2));
  block(busStop,0,.85,-.32,4.8,.13,.58,material(0x876d4c));
  for(const x of [-1.9,1.9]) block(busStop,x,.57,-.32,.09,.55,.5,steel);
  label(busStop,"NEXUS  /  CENTRAL",0,3.65,1.38,6.4);
  block(busStop,3.1,1.9,.18,1.0,2.4,.14,steel);
  label(busStop,"31  ELECTRIC",3.1,2.15,.27,.92,"#9ae5da");
  for(let j=0;j<6;j++) block(busStop,3.1,1.85-j*.17,.27,.7,.025,.018,material(0xdbe6da,.6,0,.3),false);

  // Street luminaires are emissive; only four close fixtures get actual lights.
  for(let x=-63;x<70;x+=18) if(Math.abs(x)>14) for(const side of [-1,1]) {
    const z=side*10.8;
    cylinder(scene,x,3.8,z,.085,7,steel);
    block(scene,x,7.24,z-side*.8,.12,.10,1.7,steel);
    block(scene,x,7.16,z-side*1.5,.48,.11,.95,steel);
    block(scene,x,7.08,z-side*1.5,.35,.035,.7,material(0xffe4b6,.4,0,3),false);
    if(Math.abs(x)<20) {const l=new THREE.PointLight(0xffdcaa,17,15,2);l.position.set(x,6.8,z-side*1.5);scene.add(l);}
  }
  createBuildings(scene);
  createPlanting(scene);
  // Decorative parked cars live outside the commanded bus lanes.
  for (const [x,z,c] of [[-34,-12,0x657b87],[-41,-12,0xc4beb3],[34,-12,0x443d39],[43,-12,0x52645c]]) {
    const car=new THREE.Group(); car.position.set(x,0,z);scene.add(car);
    block(car,0,.73,0,4.3,.75,1.85,material(c,.25,.45));
    block(car,-.15,1.30,0,2.25,.6,1.65,material(0x253b48,.18,.65));
    block(car,-.15,1.62,0,2.25,.06,1.64,material(c,.25,.45));
    for(const a of [-1.35,1.35])for(const s of [-.95,.95]) {
      const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.18,16),material(0x171b20,.85));
      wheel.rotation.x=Math.PI/2;wheel.position.set(a,.40,s);car.add(wheel);
    }
  }
}

function createWetRoad(scene, width, depth) {
  const shader = {
    name: "RainFilm",
    uniforms: THREE.UniformsUtils.clone(Reflector.ReflectorShader.uniforms),
    vertexShader: `uniform mat4 textureMatrix; varying vec4 projected; varying vec2 surface;
      void main(){ surface=position.xy;projected=textureMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D tDiffuse; varying vec4 projected; varying vec2 surface;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){ vec2 uv=projected.xy/projected.w;
        float wet=smoothstep(.37,.68,noise(surface*vec2(.23,.72)));
        vec2 d=vec2(.0015,.0025);vec3 reflection=texture2D(tDiffuse,uv).rgb*.4;
        reflection+=(texture2D(tDiffuse,uv+d).rgb+texture2D(tDiffuse,uv-d).rgb)*.3;
        gl_FragColor=vec4(reflection,wet*.48);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  };
  const film=new Reflector(new THREE.PlaneGeometry(width,depth),{
    textureWidth:768,textureHeight:512,clipBias:.003,multisample:0,shader,
  });
  film.rotation.x=-Math.PI/2;film.position.y=.208;
  film.material.transparent=true;film.material.depthWrite=false;film.renderOrder=1;
  scene.add(film);
  return film;
}

function createBuildings(scene) {
  const cladding=new THREE.TextureLoader().load("/assets/textures/limestone-ai-v1.png" + revision);
  cladding.colorSpace=THREE.SRGBColorSpace;cladding.wrapS=cladding.wrapT=THREE.RepeatWrapping;
  cladding.repeat.set(5,7);cladding.anisotropy=4;
  const frame=material(0x555d61,.4,.5), stone=material(0xbcb4a3,.83);
  const glass=material(0x42627a,.18,.65);
  const lit=material(0xefce96,.5,.05,.55);
  const specs=[[-58,-25,15,19,14],[-37,-26,17,27,15],[-21,-27,12,17,14],[21,-27,12,24,16],[39,-27,15,32,16],[58,-25,14,20,14],[-56,28,16,19,14],[53,30,18,24,15]];
  const names=["ATELIER  08","NORTH & CO.","COMMON GROUND","NEXUS  HOUSE","STUDIO 31","THE CORNER","CITY ARCHIVE","GALLERY"];
  specs.forEach(([x,z,w,h,d],index)=>{
    const group=new THREE.Group();group.position.set(x,0,z);scene.add(group);
    const facade=new THREE.MeshStandardMaterial({color:[0xe8e0d1,0xb1bfc5,0xd4bc9d,0xc8cbc5][index%4],
      map:cladding,bumpMap:cladding,bumpScale:.025,roughness:.78,metalness:.04});
    block(group,0,h/2,0,w,h,d,facade);
    const front=z<0?d/2+.06:-d/2-.06;
    const direction=z<0?1:-1;
    // Recessed storefront with projecting concrete canopy.
    block(group,0,2,front,w-.5,3.7,.16,glass,false);
    block(group,0,4.05,front+direction*.35,w+.6,.30,1.5,stone);
    for(let xx=-w/2+.4;xx<w/2;xx+=3) block(group,xx,2,front+direction*.16,.14,3.8,.3,frame);
    const sign=label(group,names[index],0,3.36,front+direction*.25,w*.73);
    if(direction<0)sign.rotation.y=Math.PI;
    for(let y=5.5;y<h-1;y+=3.2) {
      block(group,0,y-1.25,front,w+.12,.13,.35,stone,false);
      for(let xx=-w/2+1.4;xx<w/2-1;xx+=2.65) {
        const warm=(Math.floor(xx+y)+index*3)%5===0;
        block(group,xx,y,front+direction*.12,1.95,2.1,.12,warm?lit:glass,false);
        block(group,xx,y,front+direction*.23,.055,2.1,.05,frame,false);
        block(group,xx,y-1.08,front+direction*.24,2.12,.09,.40,stone,false);
        if(index%2===0)block(group,xx,y+.1,front+direction*.26,1.95,.05,.07,frame,false);
      }
    }
    // Side facade glazing prevents blank boxes when the camera orbits.
    for(const side of [-1,1])for(let y=5.5;y<h-1;y+=3.2)for(let zz=-d/2+2;zz<d/2-1;zz+=3.2)
      block(group,side*(w/2+.07),y,zz,.12,2.05,2.1,glass,false);
    for(const side of [-1,1])block(group,side*(w/2-.14),h+.2,0,.25,.55,d,stone);
    for(const side of [-1,1])block(group,0,h+.2,side*(d/2-.14),w,.55,.25,stone);
    block(group,-w*.19,h+.65,0,3.5,1.2,2.6,material(0x939b9a));
    for(let j=0;j<7;j++)block(group,-w*.19-1.4+j*.45,h+1.27,0,.13,.025,2.1,frame,false);
    cylinder(group,w*.26,h+1.2,-1,.11,2.5,frame);
    if(index===3) { const sign=label(group,"N E X U S",0,h+1.2,front,9,"#f9dc99"); }
  });
  // Skyline stays distant; no foreground geometry obscures the principal road.
  for(let i=0;i<18;i++) {
    const x=-130+i*15,h=25+(i*17)%43,z=-58-(i%3)*14;
    if(Math.abs(x)<18) continue;
    block(scene,x,h/2,z,10+i%4*2,h,11,material(i%2?0x8b969e:0x71838f,.5,.3));
    for(let y=4;y<h;y+=4)block(scene,x,y,z+5.6,10+i%4*2,.12,.08,material(0xaebcc4),false);
  }
}

function createPlanting(scene) {
  const bark=material(0x615039,.92);
  // Original leaf spray texture generated in-browser; alpha-tested, not solid polygon crowns.
  const canvas=document.createElement("canvas");canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext("2d");
  ctx.strokeStyle="#536b37";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(64,125);ctx.lineTo(64,10);ctx.stroke();
  for(let i=0;i<8;i++) {
    const side=i%2?1:-1,y=21+Math.floor(i/2)*24;
    ctx.save();ctx.translate(64+side*17,y);ctx.rotate(side*.65);
    const gradient=ctx.createLinearGradient(-14,0,14,0);gradient.addColorStop(0,"#658044");gradient.addColorStop(.6,"#a4b26a");gradient.addColorStop(1,"#536f36");
    ctx.fillStyle=gradient;ctx.beginPath();ctx.ellipse(0,0,14,23,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#bcc789";ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(0,-19);ctx.lineTo(0,19);ctx.stroke();ctx.restore();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const leaves=new THREE.MeshStandardMaterial({map:texture,alphaTest:.4,side:THREE.DoubleSide,roughness:.84});
  const positions=[];
  let seed=2026;
  const random=()=>{ seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296; };
  for(let x=-66;x<72;x+=13)if(Math.abs(x)>14)for(const side of [-1,1]) {
    const z=side*15.1;
    cylinder(scene,x,2.15,z,.14,3.8,bark);
    block(scene,x,.43,z,2.2,.26,2.2,material(0x575e53));
    for(let i=0;i<7;i++) {
      const branch=cylinder(scene,x,3.05,z,.06,2.1,bark);
      branch.rotation.z=Math.sin(i*2.4)*.65;branch.rotation.x=Math.cos(i*2.4)*.65;
    }
    for(let i=0;i<1000;i++) {
      const angle=random()*Math.PI*2,u=random()*2-1,r=Math.cbrt(random())*2;
      positions.push([x+Math.sqrt(1-u*u)*Math.cos(angle)*r,4.15+u*r*.94,
        z+Math.sqrt(1-u*u)*Math.sin(angle)*r,.15+random()*.28,random()*6.28,random()*6.28]);
    }
  }
  const canopy=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),leaves,positions.length);
  const dummy=new THREE.Object3D();
  positions.forEach(([x,y,z,s,rx,ry],i)=>{
    dummy.position.set(x,y,z);dummy.scale.setScalar(s);dummy.rotation.set(rx,ry,rx*.3);dummy.updateMatrix();
    canopy.setMatrixAt(i,dummy.matrix);
    canopy.setColorAt(i,new THREE.Color().setHSL(.18+random()*.07,.18+random()*.18,.48+random()*.25));
  });
  canopy.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:texture,alphaTest:.4,side:THREE.DoubleSide});
  canopy.castShadow=true;canopy.receiveShadow=true;scene.add(canopy);
}

// Batch only immutable city geometry. Buses and traffic-signal materials stay independent.
export function batchStaticCity(scene) {
  scene.updateMatrixWorld(true);
  const groups=new Map(), originals=[];
  scene.traverse(obj=>{
    if(!obj.isMesh||obj.isInstancedMesh||!obj.material.isMeshStandardMaterial)return;
    const key=obj.material.uuid+"/"+obj.castShadow+"/"+obj.receiveShadow;
    if(!groups.has(key))groups.set(key,{material:obj.material,cast:obj.castShadow,receive:obj.receiveShadow,geometries:[]});
    const geo=obj.geometry.index?obj.geometry.toNonIndexed():obj.geometry.clone();
    geo.applyMatrix4(obj.matrixWorld);groups.get(key).geometries.push(geo);originals.push(obj);
  });
  for(const batch of groups.values()) {
    const geo=new THREE.BufferGeometry();
    for(const attribute of ["position","normal","uv"]) {
      const sources=batch.geometries.map(g=>g.getAttribute(attribute));
      if(sources.some(a=>!a))continue;
      const array=new Float32Array(sources.reduce((n,a)=>n+a.array.length,0));let offset=0;
      for(const a of sources){array.set(a.array,offset);offset+=a.array.length;}
      geo.setAttribute(attribute,new THREE.BufferAttribute(array,sources[0].itemSize));
    }
    const m=new THREE.Mesh(geo,batch.material);m.castShadow=batch.cast;m.receiveShadow=batch.receive;scene.add(m);
    batch.geometries.forEach(g=>g.dispose());
  }
  originals.forEach(m=>{m.removeFromParent();m.geometry.dispose();});
}

export async function loadBusAsset() {
  const response=await fetch("/assets/models/city-bus-v1.json" + revision);
  if(!response.ok)throw new Error(`Bus asset: HTTP ${response.status}`);
  const asset=await response.json();
  if(asset.format!=="transit-mesh-v1")throw new Error("Unsupported bus asset");
  const group=new THREE.Group(); group.name="Blender electric city bus";
  for(const [name,b] of Object.entries(asset.batches)) {
    const geo=new THREE.BufferGeometry();
    geo.setAttribute("position",new THREE.Float32BufferAttribute(b.positions,3));
    geo.setAttribute("normal",new THREE.Float32BufferAttribute(b.normals,3));geo.computeBoundingSphere();
    const color=new THREE.Color().setRGB(...b.color);
    const mat=new THREE.MeshStandardMaterial({color,roughness:b.roughness,metalness:b.metalness,
      emissive:b.emission?color:0,emissiveIntensity:b.emission,envMapIntensity:1});
    const m=new THREE.Mesh(geo,mat);m.name=name;m.castShadow=true;m.receiveShadow=true;group.add(m);
  }
  return group;
}
