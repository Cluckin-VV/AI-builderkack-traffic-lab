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
function snowCover(parent, x, z, width, depth, y, mat) {
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
  surface.rotation.x = -Math.PI / 2;
  surface.position.set(x, y, z);
  surface.receiveShadow = true;
  surface.renderOrder = 1;
  surface.userData.weatherSurface = true;
  parent.add(surface);
  return surface;
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
    uniforms: { top: { value: new THREE.Color(0x769bbd) }, bottom: { value: new THREE.Color(0xf5d8bd) },
      time: { value: 0 }, clouds: { value: .28 }, sunDirection: { value: new THREE.Vector3(-35, 38, 25).normalize() },
      sunColor: { value: new THREE.Color(0xffddae) }, sunStrength: { value: 1 } },
    vertexShader: "varying vec3 vWorld; void main(){vWorld=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: `uniform vec3 top,bottom,sunDirection,sunColor;
      uniform float time,clouds,sunStrength;varying vec3 vWorld;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<4;i++){n+=a*noise(p);p=p*2.03+17.;a*=.5;}return n;}
      void main(){vec3 dir=normalize(vWorld);float h=dir.y;
        vec3 c=mix(bottom,top,smoothstep(-.05,.75,h));
        float glow=pow(max(dot(dir,sunDirection),0.),48.);
        float disc=smoothstep(.9995,.99985,dot(dir,sunDirection));
        c+=sunColor*(glow*.38+disc*2.)*sunStrength;
        vec2 p=dir.xz/(max(h,0.)+.27)*2.7+vec2(time*.003,time*.001);
        float n=fbm(p);float coverage=smoothstep(.72-clouds*.48,.87-clouds*.45,n);
        coverage*=smoothstep(-.01,.14,h);
        vec3 cloudLight=mix(vec3(.79,.84,.88),vec3(.35,.41,.47),clouds*.65);
        cloudLight+=vec3(.12)*smoothstep(.36,.67,n);
        c=mix(c,cloudLight,coverage*.91);gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  scene.add(sky);
  const hemisphere = new THREE.HemisphereLight(0xd4e4fa, 0x696660, 1.05);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xffd3a0, 3.1);
  sun.position.set(-35, 38, 25); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -65, right: 65, top: 55, bottom: -55, far: 150 });
  sun.shadow.normalBias = .025; sun.shadow.bias = -.00012; scene.add(sun);
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
  world.refreshEnvironment = () => {
    const generator = new THREE.PMREMGenerator(renderer);
    const next = generator.fromScene(environment, .025, .1, 300);
    const previous = world.environmentTarget;
    world.environmentTarget = next; scene.environment = next.texture;
    previous.dispose(); generator.dispose();
  };
  pmrem.dispose();
}

export function createCity(world, parent = world.scene, definition = {}) {
  const scene = parent;
  const junction = definition.junction ?? {};
  const roadWidth = definition.road?.width ?? 30;
  const roadHalf = roadWidth / 2;
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
  const road = new THREE.Mesh(new THREE.PlaneGeometry(160, roadWidth), asphalt);
  road.rotation.x = -Math.PI/2; road.position.y = .2; road.receiveShadow = true; scene.add(road);
  const crossRoad = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, 160), asphalt);
  crossRoad.rotation.x = -Math.PI/2; crossRoad.position.y = .202; crossRoad.receiveShadow = true; scene.add(crossRoad);
  world.roadMaterial = asphalt;
  const wetMain = createWetRoad(scene, 160, roadWidth);
  world.wetRoads = [wetMain, createWetRoad(scene, roadWidth, 160, wetMain)];
  world.wetRoads.forEach(surface => { surface.visible = false; });
  const marking = material(0xf3eee0,.65);
  const sidewalk = roadHalf + 4.5;
  const snowMaterial = new THREE.MeshStandardMaterial({ color: 0xe4ebeb, roughness: 1, transparent: true, opacity: .72, depthWrite: false });
  world.snowSurfaces = [];
  for (const side of [-1,1]) {
    block(scene,-45,.18,side*sidewalk,70,.34,6.5,pavement,false);
    block(scene,45,.18,side*sidewalk,70,.34,6.5,pavement,false);
    block(scene,side*sidewalk,.18,-45,6.5,.34,70,pavement,false);
    block(scene,side*sidewalk,.18,45,6.5,.34,70,pavement,false);
    world.snowSurfaces.push(
      snowCover(scene,-45,side*sidewalk,70,6.5,.362,snowMaterial),
      snowCover(scene,45,side*sidewalk,70,6.5,.362,snowMaterial),
      snowCover(scene,side*sidewalk,-45,6.5,70,.362,snowMaterial),
      snowCover(scene,side*sidewalk,45,6.5,70,.362,snowMaterial),
    );
  }
  const arrows = [];
  const addArrow = (approach, movement, along, lateral) => {
    const a = junction.approaches?.[approach] ?? { forward: [1,0], right: [0,-1] };
    let direction = a.forward;
    if (movement === 'left') direction = [-a.right[0], -a.right[1]];
    if (movement === 'right') direction = a.right;
    const side = [direction[1], -direction[0]];
    const center = [a.forward[0]*along + a.right[0]*lateral, a.forward[1]*along + a.right[1]*lateral];
    const shape = [[-1,-.2],[.1,-.2],[.1,-.65],[1,0],[.1,.65],[.1,.2],[-1,.2]];
    const positions = shape.flatMap(([f,l]) => [center[0] + direction[0]*f + side[0]*l, .235, center[1] + direction[1]*f + side[1]*l]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setIndex([0,1,5, 0,5,6, 1,2,3, 1,3,4, 1,4,5]); geometry.computeVertexNormals();
    const paint = new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xf3eee0,side:THREE.DoubleSide}));
    paint.renderOrder=2; scene.add(paint); arrows.push(paint);
  };
  // Shared cross-section: three exclusive approach lanes, a two-stage zebra,
  // a real upstream stop bar, and a painted movement guide for each lane.
  const laneWidth = junction.lane_width ?? 3.5;
  const stopS = Math.abs(junction.stop_line_s ?? -20.5);
  const crosswalkS = Math.abs(junction.crosswalk_s ?? -17.5);
  for(const side of [-1,1]) {
    block(scene,side*stopS,.235,0,.34,.026,roadWidth-1.4,marking,false);
    block(scene,0,.235,side*stopS,roadWidth-1.4,.026,.34,marking,false);
    for(let offset=-roadHalf+1.2;offset<roadHalf-1;offset+=1.15) {
      block(scene,side*crosswalkS,.235,offset,3.1,.026,.56,marking,false);
      block(scene,offset,.235,side*crosswalkS,.56,.026,3.1,marking,false);
    }
    for(let along=-78;along<78;along+=7) if(Math.abs(along)>stopS+2) {
      for(const edge of [-roadHalf+.25,roadHalf-.25]) {
        block(scene,along,.214,edge,3.1,.016,.12,marking,false);
        block(scene,edge,.214,along,.12,.016,3.1,marking,false);
      }
    }
    for(const offset of [laneWidth,laneWidth*2,laneWidth*3]) {
      for(let along=-78;along<78;along+=9) if(Math.abs(along)>stopS+3) {
        block(scene,along,.214,side*offset,4.2,.016,.10,marking,false);
        block(scene,side*offset,.214,along,.10,.016,4.2,marking,false);
      }
    }
    const median=material(0xe7c952,.65);
    for(const offset of [.55,1.05]) {
      block(scene,0,.216,side*offset,160,.016,.10,median,false);
      block(scene,side*offset,.216,0,.10,.016,160,median,false);
    }
  }
  for(const approach of ['W','E','S','N']) {
    const a=junction.approaches?.[approach] ?? {forward:[1,0],right:[0,-1]};
    for(const [movement,key] of [['left','left'],['straight','straight'],['right','right']])
      addArrow(approach,movement,-stopS-5,junction.lane_offsets?.[key] ?? laneWidth);
  }
  // Road furniture stays outside the defined vehicle swept envelope.
  for (const x of [-19,25]) cylinder(scene,x,.222,roadHalf+2,.46,.018,steel);
  for(let along=-65;along<70;along+=14) if(Math.abs(along)>24) for(const side of [-1,1]) {
    cylinder(scene,along,.88,side*(roadHalf+4.2),.08,1.05,steel);
    cylinder(scene,side*(roadHalf+4.2),.88,along,.08,1.05,steel);
  }

  const busStop = new THREE.Group(); busStop.position.set(-30,0,-roadHalf-4.5); scene.add(busStop);
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
  for(let along=-63;along<70;along+=18) if(Math.abs(along)>24) for(const side of [-1,1]) {
    for(const orientation of ['horizontal','vertical']) {
      const x=orientation==='horizontal'?along:side*(roadHalf+5.1);
      const z=orientation==='horizontal'?side*(roadHalf+5.1):along;
      cylinder(scene,x,3.8,z,.085,7,steel);
      const armX=orientation==='horizontal'?side*.8:0;
      const armZ=orientation==='vertical'?side*.8:0;
      block(scene,x+armX,7.24,z+armZ,.12,.10,1.7,steel);
      block(scene,x+armX*1.8,7.16,z+armZ*1.8,.48,.11,.95,steel);
      block(scene,x+armX*1.8,7.08,z+armZ*1.8,.35,.035,.7,material(0xffe4b6,.4,0,3),false);
      if(Math.abs(along)<30 && orientation==='horizontal') {
        const l=new THREE.PointLight(0xffdcaa,14,20,2);
        l.position.set(x+armX*1.8,6.8,z+armZ*1.8);scene.add(l);
        (world.streetLights ??= []).push(l);
      }
    }
  }
  createBuildings(scene, world);
  createPlanting(scene);
}

export function createBusStopDistrict(world, parent, definition) {
  const station = definition.station;
  const steel = material(0x254941, .35, .6);
  const stone = material(0xbcbcaf, .88);
  const paint = material(0xf5eee0, .7);
  const warm = material(0xffd8a4, .4, 0, 1.8);
  world.groundMaterial = material(0x848b7d);
  block(parent, 0, -.2, 0, 320, .3, 240, world.groundMaterial);
  const texture = new THREE.TextureLoader().load('/assets/textures/asphalt-ai-v1.png' + revision);
  texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(40, 4); texture.anisotropy = Math.min(8, world.renderer.capabilities.getMaxAnisotropy());
  world.roadMaterial = new THREE.MeshStandardMaterial({color:0x7b858d,map:texture,bumpMap:texture,bumpScale:.018,roughness:.42,metalness:.1});
  const road = new THREE.Mesh(new THREE.PlaneGeometry(definition.road.length, 17), world.roadMaterial);
  road.rotation.x = -Math.PI/2; road.position.y=.2; road.receiveShadow=true; parent.add(road);
  world.wetRoads = [createWetRoad(parent, definition.road.length, 17)];
  world.wetRoads[0].visible=false;
  const snowMaterial = new THREE.MeshStandardMaterial({color:0xe4ebeb,roughness:1,transparent:true,opacity:.72,depthWrite:false});
  world.snowSurfaces = [-1,1].map(side => snowCover(parent,0,side*12,definition.road.length,7,.387,snowMaterial));
  for(const side of [-1,1]) {
    block(parent,0,.20,side*12,definition.road.length,.35,7,stone,false);
    for(let x=-118;x<120;x+=3) block(parent,x,.385,side*12,.025,.015,6.5,material(0x92988f),false);
    for(let x=-118;x<120;x+=2) block(parent,x,.37,side*8.65,1.97,.35,.25,stone,false);
    for(let x=-116;x<118;x+=8) if(Math.abs(x)>14) block(parent,x,.222,side*4.2,3.6,.018,.12,paint,false);
    block(parent,0,.222,side*7.95,definition.road.length,.018,.12,paint,false);
    block(parent,0,.223,side*.13,definition.road.length,.018,.1,material(0xe4bd56),false);
    const x=side*station.stop_s, z=side*station.platform_z;
    const shelter=new THREE.Group(); shelter.position.set(x,0,z);
    if(side<0) shelter.rotation.y=Math.PI;
    parent.add(shelter);
    const glass=new THREE.MeshPhysicalMaterial({color:0xadc9cd,roughness:.12,metalness:.12,transparent:true,opacity:.32,side:THREE.DoubleSide});
    block(shelter,0,.39,0,25,.20,5.4,stone);
    for(const xx of [-10,-5,0,5,10]) {
      cylinder(shelter,xx,2.05,1.5,.10,3.4,steel);
      block(shelter,xx+2.45,2.1,1.5,4.7,2.8,.06,glass,false);
      block(shelter,xx,3.7,0,.14,.12,4.5,steel);
    }
    block(shelter,0,3.9,0,26,.20,5.3,steel);
    block(shelter,0,3.77,-1.8,24,.04,.16,warm,false);
    for(let xx=-11;xx<12;xx+=2.4) block(shelter,xx,4.02,0,2.1,.035,3.6,material(0x234550,.23,.6),false);
    for(const xx of [-7,2]) {
      block(shelter,xx,.93,.3,5.6,.12,.65,material(0x957656));
      block(shelter,xx,1.35,.65,5.6,.7,.10,material(0x957656));
      for(const leg of [-2.2,2.2]) block(shelter,xx+leg,.7,.3,.09,.65,.7,steel);
    }
    const destination=label(shelter,side>0?'CENTRAL  /  EASTBOUND':'CENTRAL  /  WESTBOUND',0,4.35,-2.65,19,'#b9ffdf','#153a34');
    destination.rotation.y=Math.PI;
    const display=label(shelter,'31   NEXUS   /   EVERY 4s',-5,2.8,-.3,7.8,'#aeffdf','#0b2524');
    display.rotation.y=Math.PI;
    block(shelter,9,1.35,-.7,1.4,2.2,.85,steel);
    const ticket=label(shelter,'TICKETS',9,2,-1.15,1.2,'#fff1cf'); ticket.rotation.y=Math.PI;
    for(let xx=-11;xx<12;xx+=.48) for(const zz of [-2.2,-1.9,-1.6])
      cylinder(shelter,xx,.51,zz,.055,.025,material(0xd4b84f));
    const bay=block(parent,x,.224,side*station.bay_z,29,.018,3.9,material(0x507b64,.7));
    for(const xx of [x-14.5,x+14.5]) block(parent,xx,.24,side*station.bay_z,.16,.024,3.9,paint,false);
    const floorLabel=label(parent,'BUS  /  31',x,.25,side*station.bay_z,9,'#fff2c8','#507b64');
    floorLabel.rotation.x=-Math.PI/2;
    // Keep 12-metre bus swept envelopes clear of furniture.
    for(let xx=-94;xx<=96;xx+=19) {
      cylinder(parent,xx,3.4,side*14.8,.09,6.1,steel);
      block(parent,xx,6.5,side*14.8,.7,.14,1.1,warm,false);
    }
  }
  // A signalled pedestrian crossing, not a fictitious north-south traffic road.
  for(const x of [-11,11]) for(let z=-7.5;z<8;z+=1.25)
    block(parent,x,.24,z,3.3,.03,.65,paint,false);
  for(const side of [-1,1]) block(parent,side*7.9,.24,0,.24,.03,7,paint,false);
  const concourse=new THREE.Group(); concourse.position.set(0,0,-29); parent.add(concourse);
  block(concourse,0,4,0,30,8,12,material(0xc4c3b7,.85));
  block(concourse,0,3.8,6.1,27,5.5,.14,material(0x33595e,.18,.6));
  for(let x=-12;x<=12;x+=3) block(concourse,x,3.8,6.24,.12,5.8,.15,steel);
  block(concourse,0,7.9,7,32,.24,3.6,steel);
  label(concourse,'CENTRAL EXCHANGE  /  TRANSITLAB',0,9,6.4,27,'#dcffe9','#193d34');
  createBuildings(parent, world);
  createPlanting(parent);
}

function createWetRoad(scene, width, depth, sharedReflection = null) {
  const shader = {
    name: "RainFilm",
    uniforms: THREE.UniformsUtils.clone(Reflector.ReflectorShader.uniforms),
    vertexShader: `uniform mat4 textureMatrix; varying vec4 projected; varying vec2 surface; varying vec3 worldPosition;
      void main(){ surface=position.xy;worldPosition=(modelMatrix*vec4(position,1.)).xyz;projected=textureMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float wetness,time; varying vec4 projected; varying vec2 surface; varying vec3 worldPosition;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){ vec2 uv=projected.xy/projected.w;
        float wet=.55+.45*noise(surface*vec2(.12,.19));
        vec3 viewDirection=normalize(cameraPosition-worldPosition);
        float fresnel=pow(1.-abs(viewDirection.y),5.);
        vec2 ripple=vec2(sin(surface.x*8.+time*2.),cos(surface.y*7.-time*3.))*.0003;
        uv+=ripple;vec2 d=vec2(.0015,.0025);vec3 reflection=texture2D(tDiffuse,uv).rgb*.4;
        reflection+=(texture2D(tDiffuse,uv+d).rgb+texture2D(tDiffuse,uv-d).rgb)*.3;
        // Water is weakly reflective head-on and stronger at grazing angles.
        // Never turn the bird's-eye asphalt into bright camouflage puddles.
        gl_FragColor=vec4(reflection,wet*(.025+.32*fresnel)*wetness);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  };
  shader.uniforms.wetness = {value:0}; shader.uniforms.time = {value:0};
  const film=new Reflector(new THREE.PlaneGeometry(width,depth),{
    textureWidth:768,textureHeight:512,clipBias:.003,multisample:0,shader,
  });
  film.rotation.x=-Math.PI/2;film.position.y=.208;
  film.material.transparent=true;film.material.depthWrite=false;film.renderOrder=1;
  film.userData.weatherSurface=true;
  const renderReflection=film.onBeforeRender;
  film.onBeforeRender=function(renderer,scene,camera){
    // Two perpendicular wet films share a plane. Hide both during reflection
    // to avoid recursive captures and doubled reflection rendering.
    const surfaces=[];
    scene.traverse(object=>{if(object.userData.weatherSurface&&object!==film&&object.visible){surfaces.push(object);object.visible=false;}});
    try{renderReflection.call(this,renderer,scene,camera);}
    finally{for(const object of surfaces)object.visible=true;}
  };
  if(sharedReflection) {
    // Both road arms have the same horizontal transform: one capture supplies
    // both masks without changing the camera, resolution, or reflected scene.
    film.getRenderTarget().dispose();
    film.material.uniforms.tDiffuse=sharedReflection.material.uniforms.tDiffuse;
    film.material.uniforms.textureMatrix=sharedReflection.material.uniforms.textureMatrix;
    film.onBeforeRender=()=>{};
    film.renderOrder=2;
  }
  scene.add(film);
  return film;
}

function createBuildings(scene, world) {
  const cladding=new THREE.TextureLoader().load("/assets/textures/limestone-ai-v1.png" + revision);
  cladding.colorSpace=THREE.SRGBColorSpace;cladding.wrapS=cladding.wrapT=THREE.RepeatWrapping;
  cladding.repeat.set(5,7);cladding.anisotropy=4;
  const frame=material(0x555d61,.4,.5), stone=material(0xbcb4a3,.83);
  const glass=material(0x42627a,.18,.65);
  // Per-district material: changing a hidden layout never affects the active one.
  const lit=material(0xefce96,.5,.05,.55).clone();
  world.architecturalLights = [lit];
  const roofSnow = new THREE.MeshStandardMaterial({color:0xe4ebeb,roughness:1,transparent:true,opacity:0,depthWrite:false});
  const specs=[[-49,-32,17,22,15],[-29,-32,15,29,15],[29,-32,15,24,15],[49,-32,17,33,16],[-49,32,17,21,15],[-29,32,15,27,15],[29,32,15,23,15],[49,32,17,30,16]];
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
    // Storefront depth and door handles; small geometry shares batched materials.
    const brass=material(0xa99364,.33,.68), interior=material(0x51483e,.94);
    for(let xx=-w/2+2;xx<w/2-1;xx+=3) {
      block(group,xx,.58,front+direction*.19,2.5,.14,.5,stone,false);
      block(group,xx,1.18,front+direction*.20,1.2,.65,.05,interior,false);
      block(group,xx+.8,1.72,front+direction*.25,.055,.45,.08,brass,false);
    }
    block(group,0,3.88,front+direction*.93,w-.4,.055,.055,lit,false);
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
    for(const side of [-1,1])for(let y=5.5;y<h-1;y+=3.2)for(let zz=-d/2+2;zz<d/2-1;zz+=3.2) {
      block(group,side*(w/2+.07),y,zz,.12,2.05,2.1,glass,false);
      block(group,side*(w/2+.16),y,zz,.05,2.05,.055,frame,false);
      block(group,side*(w/2+.16),y-1.08,zz,.36,.09,2.25,stone,false);
    }
    // Architectural differences are geometric, rather than eight differently coloured boxes.
    if(index===6 || index===1) {
      for(const xx of [-w*.35,0,w*.35]) {
        block(group,xx,h*.54,front+direction*.38,.22,h*.84,.60,frame,false);
      }
      for(let y=7;y<h-2;y+=3.2) {
        block(group,0,y,front+direction*.42,w+.3,.16,.8,stone,false);
      }
    }
    if(index===5 || index===0) {
      for(let y=8;y<h-2;y+=6.4) {
        block(group,0,y-1.05,front+direction*.65,w-1,.22,1.65,stone);
        for(let xx=-w/2+1;xx<w/2;xx+=.8)
          block(group,xx,y-.6,front+direction*1.45,.035,.70,.035,frame,false);
      }
    }
    for(const side of [-1,1])block(group,side*(w/2-.14),h+.2,0,.25,.55,d,stone);
    for(const side of [-1,1])block(group,0,h+.2,side*(d/2-.14),w,.55,.25,stone);
    block(group,-w*.19,h+.65,0,3.5,1.2,2.6,material(0x939b9a));
    for(let j=0;j<7;j++)block(group,-w*.19-1.4+j*.45,h+1.27,0,.13,.025,2.1,frame,false);
    cylinder(group,w*.26,h+1.2,-1,.11,2.5,frame);
    block(group,w*.23,h+.35,d*.20,3.2,.7,2.6,frame);
    for(let j=0;j<6;j++)block(group,w*.23-1.2+j*.48,h+.72,d*.20,.10,.055,2.2,stone,false);
    world.snowSurfaces.push(snowCover(group,0,0,w-.6,d-.6,h+.035,roofSnow));
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
  const treeCenters=[];
  for(let along=-66;along<72;along+=13)if(Math.abs(along)>22)for(const side of [-1,1]) {
    treeCenters.push([along,side*19.5],[side*19.5,along]);
  }
  for(const [x,z] of treeCenters) {
    cylinder(scene,x,2.15,z,.14,3.8,bark);
    block(scene,x,.43,z,2.2,.26,2.2,material(0x575e53));
    for(let i=0;i<7;i++) {
      const branch=cylinder(scene,x,3.05,z,.06,2.1,bark);
      branch.rotation.z=Math.sin(i*2.4)*.65;branch.rotation.x=Math.cos(i*2.4)*.65;
    }
    // Larger leaf sprays fill the crown with fewer instances (not a solid sphere).
    for(let i=0;i<260;i++) {
      const angle=random()*Math.PI*2,u=random()*2-1,r=Math.cbrt(random())*1.9;
      positions.push([x+Math.sqrt(1-u*u)*Math.cos(angle)*r,4.15+u*r*.94,
        z+Math.sqrt(1-u*u)*Math.sin(angle)*r,.42+random()*.35,random()*6.28,random()*6.28]);
    }
  }
  const canopy=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),leaves,positions.length);
  const dummy=new THREE.Object3D();
  positions.forEach(([x,y,z,s,rx,ry],i)=>{
    dummy.position.set(x,y,z);dummy.scale.setScalar(s);dummy.rotation.set(rx,ry,rx*.3);dummy.updateMatrix();
    canopy.setMatrixAt(i,dummy.matrix);
    canopy.setColorAt(i,new THREE.Color().setHSL(.18+random()*.07,.10+random()*.12,.69+random()*.16));
  });
  canopy.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:texture,alphaTest:.4,side:THREE.DoubleSide});
  canopy.castShadow=true;canopy.receiveShadow=true;scene.add(canopy);
}

// Batch only immutable city geometry. Buses and traffic-signal materials stay independent.
export function batchStaticCity(scene) {
  scene.updateMatrixWorld(true);
  const groups=new Map(), originals=[];
  scene.traverse(obj=>{
    if(!obj.isMesh||obj.isInstancedMesh||obj.userData.weatherSurface||!obj.material.isMeshStandardMaterial)return;
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

async function loadVehicleAsset(type) {
  const response=await fetch(`/assets/models/city-${type}-v1.json` + revision);
  if(!response.ok)throw new Error(`${type} asset: HTTP ${response.status}`);
  const asset=await response.json();
  if(asset.format!=="transit-mesh-v1")throw new Error(`Unsupported ${type} asset`);
  const group=new THREE.Group(); group.name=`Blender ${type}`;
  group.userData.design=asset.design;
  group.userData.wheelRadius=asset.wheel_radius ?? ({sedan:.345,suv:.405,bus:.55}[type]);
  const lowestWheel=Object.values(asset.wheel_centers ?? {}).reduce((minimum,center)=>Math.min(minimum,center[1]-group.userData.wheelRadius),Infinity);
  group.userData.groundOffset=.22-(Number.isFinite(lowestWheel)?lowestWheel:(asset.bounds?.min?.[1] ?? 0));
  const wheelPivots=new Map();
  const brakeLamps=[];
  const headLamps=[];
  for(const [name,b] of Object.entries(asset.batches)) {
    const geo=new THREE.BufferGeometry();
    geo.setAttribute("position",new THREE.Float32BufferAttribute(b.positions,3));
    geo.setAttribute("normal",new THREE.Float32BufferAttribute(b.normals,3));geo.computeBoundingSphere();
    const color=new THREE.Color().setRGB(...b.color);
    const isGlass=b.component === "glass";
    const mat=new THREE.MeshPhysicalMaterial({color,roughness:b.roughness,metalness:b.metalness,
      clearcoat:b.clearcoat ?? (b.component === "body" ? .55 : 0),
      clearcoatRoughness:b.clearcoat_roughness ?? .2,
      // Balanced uses reflection glass; real transmission requires a costly extra scene pass.
      transmission:0,thickness:isGlass ? .025 : 0,
      transparent:false,side:isGlass ? THREE.DoubleSide : THREE.FrontSide,
      emissive:b.emission?color:0,emissiveIntensity:b.emission,envMapIntensity:1});
    const m=new THREE.Mesh(geo,mat);m.name=name;m.userData.component=b.component ?? "body";m.castShadow=true;m.receiveShadow=true;
    if(m.userData.component === "brake_lamp") brakeLamps.push(m);
    if(m.userData.component === "headlamp") headLamps.push(m);
    if(b.wheel_id) {
      let pivot=wheelPivots.get(b.wheel_id);
      if(!pivot) {
        pivot=new THREE.Group();pivot.name=`wheel-pivot-${b.wheel_id}`;pivot.userData.vehicleWheelId=b.wheel_id;
        const center=asset.wheel_centers?.[b.wheel_id] ?? [0,0,0];pivot.position.set(...center);
        pivot.userData.wheelRadius=group.userData.wheelRadius;
        wheelPivots.set(b.wheel_id,pivot);group.add(pivot);
      }
      pivot.add(m);
    } else group.add(m);
  }
  group.userData.wheelPivots=wheelPivots;
  group.userData.brakeLamps=brakeLamps;
  group.userData.headLamps=headLamps;
  return group;
}

export function loadBusAsset() { return loadVehicleAsset('bus'); }
export async function loadVehicleAssets() {
  const [sedan,suv,bus]=await Promise.all(['sedan','suv','bus'].map(loadVehicleAsset));
  return {sedan,suv,bus};
}
