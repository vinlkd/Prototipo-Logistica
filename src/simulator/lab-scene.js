import * as THREE from 'three';
import {getPresentation} from './presentation.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

export function createLabScene(canvas,onSensorPick=()=>{}){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#3d5060');scene.fog=new THREE.Fog('#3d5060',32,70);
  const environment=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(environment,.04);
  scene.environment=env.texture;scene.environmentIntensity=.65;environment.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#cfdef0','#43525e',1.65));
  const sun=new THREE.DirectionalLight('#fff6e7',3);sun.position.set(-5,12,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:.1,far:35});sun.shadow.normalBias=.025;sun.shadow.bias=-.0003;scene.add(sun);
  const fill=new THREE.DirectionalLight('#d2e9ff',1);fill.position.set(8,6,-7);scene.add(fill);
  const camera=new THREE.PerspectiveCamera(43,1,.1,100);camera.position.set(9,6,10);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.08;controls.target.set(0,1.1,0);controls.minDistance=5;controls.maxDistance=30;controls.maxPolarAngle=Math.PI*.49;controls.update();
  const mat=(color,metalness=0,roughness=.7)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
  const m={blue:mat('#194c91',.25,.43),white:mat('#b2c2cf',.2,.48),steel:mat('#adbcc5',.82,.24),dark:mat('#273541',.45,.48),belt:mat('#343e43',.1,.85),yellow:mat('#dfb249',.25,.48),box:mat('#b38d5e',0,.9),tape:mat('#d8c2a1'),wood:mat('#9b774c'),glass:new THREE.MeshStandardMaterial({color:'#a7d1df',transparent:true,opacity:.17,roughness:.12,metalness:.2}),green:mat('#41816f')};
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),mat('#53616d',0,.98));ground.rotation.x=-Math.PI/2;ground.position.y=-.08;ground.receiveShadow=true;scene.add(ground);
  const grid=new THREE.GridHelper(40,40,'#637787','#5b6e7e');grid.position.y=-.065;grid.material.transparent=true;grid.material.opacity=.35;scene.add(grid);
  const modelCache=new Map();let selected=null,pointerStart=null;
  const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();
  function box(group,x,y,z,w,h,d,material=m.blue,rounded=false){const geometry=rounded?new RoundedBoxGeometry(w,h,d,2,.07):new THREE.BoxGeometry(w,h,d);const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;}
  function cyl(group,x,y,z,r,h,material=m.steel){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;}
  function bar(group,a,b,r,material=m.steel){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);const mesh=cyl(group,...av.clone().add(bv).multiplyScalar(.5).toArray(),r,delta.length(),material);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return mesh;}
  function carton(group,x,y,z,size=1){box(group,x,y,z,size,.68*size,.82*size,m.box);box(group,x,y+.345*size,z,.14*size,.014,.82*size,m.tape);box(group,x,y,z+.416*size,.3*size,.2*size,.012,m.white);}
  function pallet(group,x,z,loaded=true){for(const dx of [-.55,0,.55])box(group,x+dx,.12,z,.15,.24,1.3,m.wood);for(let dz=-.55;dz<.6;dz+=.28)box(group,x,.28,z+dz,1.6,.09,.2,m.wood);if(loaded)for(const dx of [-.38,.38])for(let y=0;y<2;y++)carton(group,x+dx,.6+y*.56,z,.7);}
  function rack(group,x,z,raw=false){for(const dx of [-1.9,1.9])for(const dz of [-.7,.7])box(group,x+dx,1.9,z+dz,.1,3.8,.1,m.blue);for(const y of [.35,1.6,2.85]){box(group,x,y,z,4,.12,1.6,m.yellow);for(const dx of [-1.25,0,1.25])if(raw){for(let j=0;j<5;j++)box(group,x+dx,y+.1+j*.05,z,.95,.025,1.1,m.steel);}else carton(group,x+dx,y+.45,z,1.05);}}
  function pot(group,morph=false){
    const profile=[[.001,-.18],[.08,-.18],[.2,-.18],[.3,-.17],[.34,-.13],[.365,-.06],[.395,.04],[.425,.13],[.455,.2],[.46,.21]];
    const flat=profile.map((point,i)=>new THREE.Vector2(.001+i/(profile.length-1)*.619,.21));
    const geometry=new THREE.LatheGeometry(flat,48),formed=new THREE.LatheGeometry(profile.map(point=>new THREE.Vector2(...point)),48);
    geometry.morphAttributes.position=[formed.attributes.position];geometry.morphAttributes.normal=[formed.attributes.normal];
    const metal=m.steel.clone();metal.side=THREE.DoubleSide;
    const bowl=new THREE.Mesh(geometry,metal);bowl.castShadow=true;bowl.receiveShadow=true;bowl.morphTargetInfluences[0]=morph?0:1;group.add(bowl);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.46,.009,8,48),metal);rim.rotation.x=Math.PI/2;rim.position.y=.21;group.add(rim);
    return {bowl,rim,metal};
  }
  function foldingBox(root){
    const group=new THREE.Group();root.add(group);box(group,0,.015,0,1.07,.035,.9,m.box);
    const walls=[],flaps=[];
    for(const side of [-1,1]){
      const front=new THREE.Group();front.position.set(0,.02,side*.45);group.add(front);box(front,0,.34,0,1.07,.68,.028,m.box);walls.push({object:front,axis:'x',open:side*Math.PI/2});
      const lateral=new THREE.Group();lateral.position.set(side*.535,.02,0);group.add(lateral);box(lateral,0,.34,0,.028,.68,.9,m.box);walls.push({object:lateral,axis:'z',open:-side*Math.PI/2});
      const flap=new THREE.Group();flap.position.set(0,.71,side*.45);group.add(flap);box(flap,0,0,-side*.225,1.07,.025,.45,m.box);flaps.push({object:flap,open:side*Math.PI/2});
    }
    const tape=box(group,0,.735,0,.13,.009,.92,m.tape),label=box(group,.27,.75,.06,.3,.01,.25,m.white);
    const foam=new THREE.Mesh(new THREE.TorusGeometry(.47,.045,8,40),m.white);foam.rotation.x=Math.PI/2;foam.position.y=.4;group.add(foam);
    return {group,walls,flaps,tape,label,foam};
  }
  function build(id){
    const root=new THREE.Group();root.name=id;scene.add(root);
    box(root,0,-.02,0,15.5,.08,10.5,mat('#435665',.05,.85));
    for(const x of [-7.4,7.4])box(root,x,.03,0,.07,.012,9.8,m.yellow);
    for(const z of [-4.9,4.9])box(root,0,.03,z,14.8,.012,.07,m.yellow);
    // Bancada transportadora comum: sensores e atuadores ficam claramente acessíveis.
    box(root,0,.93,0,10,.25,1.65,m.dark);box(root,0,1.08,0,9.8,.04,1.45,m.belt);
    for(let x=-4.8;x<4.9;x+=.3)bar(root,[x,1.12,-.7],[x,1.12,.7],.075);
    for(const x of [-4.4,-1.8,1.8,4.4])for(const z of [-.6,.6])box(root,x,.46,z,.12,.92,.12,m.steel);
    const sensors={};
    for(const [key,x]of [['entry',-3.9],['positioned',-.45],['exit',3.8]]){
      box(root,x,1.18,.95,.2,.36,.18,m.dark);bar(root,[x,.1,1],[x,1,1],.024,m.dark);
      const indicator=new THREE.Mesh(new THREE.SphereGeometry(.055,12,8),new THREE.MeshBasicMaterial({color:'#4b6473'}));indicator.position.set(x,1.23,1.055);indicator.userData.signal=key;root.add(indicator);sensors[key]=indicator;
    }
    const hmi=new THREE.Group();hmi.position.set(3,0,2.5);root.add(hmi);
    box(hmi,0,.8,0,.12,1.6,.12,m.steel);box(hmi,0,1.75,0,1.05,.75,.15,m.dark,true);box(hmi,0,1.76,.085,.86,.54,.02,new THREE.MeshBasicMaterial({color:'#193d52'}));
    for(let i=0;i<4;i++)box(hmi,-.26,1.88-i*.09,.1,.4+(i%2)*.15,.022,.008,new THREE.MeshBasicMaterial({color:i%2?'#75a9c2':'#5dbe9c'}));
    const emergencyButton=cyl(hmi,.32,1.29,.16,.07,.08,mat('#b7413e'));emergencyButton.rotation.x=Math.PI/2;
    const unformed=new THREE.Group();cyl(unformed,0,0,0,.5,.045,m.steel);
    const shaped=new THREE.Group();const bowl=pot(shaped,true);
    const packed=new THREE.Group();carton(packed,0,0,0,1.03);
    root.add(unformed,shaped,packed);
    let head=null,wheel=null,lift=null,scanner=null,pusher=null,guard=null,ram=null,platform=null;const clamps=[];
    if(id==='production'){
      box(root,0,.37,0,3.3,.74,2.8,m.blue,true);box(root,0,.87,0,2.4,.18,2.1,m.steel);
      const die=new THREE.Mesh(new THREE.TorusGeometry(.52,.055,12,48),m.steel);die.rotation.x=Math.PI/2;die.position.y=1.52;root.add(die);
      platform=cyl(root,0,1.13,0,.34,.045,m.steel);cyl(root,0,.97,0,.11,.3,m.dark);
      for(const side of [-1,1]){const clamp=box(root,side*.84,1.61,0,.48,.12,1.1,m.dark,true);clamps.push({object:clamp,side});bar(root,[side*.84,1.1,-.7],[side*.84,1.55,-.7],.05,m.steel);}
      for(const side of [-1,1]){box(root,side*1.45,2.5,0,.42,3.8,2.5,m.blue,true);cyl(root,side*1.05,2.6,0,.085,2.7,m.steel);}
      box(root,0,4.3,0,3.5,.55,2.9,m.blue,true);ram=cyl(root,0,3.7,0,.3,.8,m.steel);
      head=box(root,0,3.1,0,2.2,.4,1.8,m.yellow,true);cyl(head,0,-.7,0,.32,.9,m.steel);
      for(const x of [-1.8,1.8]){box(root,x,.8,1.75,.08,1.6,.08,m.yellow);box(root,x,1.6,1.75,.14,.15,.14,m.dark);}
      guard=box(root,0,2.5,1.45,2.45,2.5,.035,m.glass);
      rack(root,-4.4,-3.3,true);pallet(root,4.8,-3.5,false);
    }else if(id==='raw'||id==='finished'){
      rack(root,-3.4,-3.2,id==='raw');rack(root,2.3,-3.2,id==='raw');
      for(const x of [-.9,.9])box(root,x,2.1,-1,.14,4.2,.14,m.blue);
      box(root,0,4.15,-1,2.1,.2,.25,m.blue);lift=new THREE.Group();root.add(lift);box(lift,0,1.09,-.65,1.8,.15,1.6,m.yellow);
      pallet(root,-5,2.7);pallet(root,5,2.7);bar(root,[0,.1,-1],[0,4,-1],.045,m.dark);
    }else if(id==='packing'){
      for(const x of [-1.2,1.2])box(root,x,1.9,0,.22,2.5,2,m.blue,true);
      box(root,0,3.2,0,2.65,.25,2.15,m.blue,true);head=box(root,0,2.6,0,1.5,.3,1.5,m.yellow);
      const spool=cyl(root,0,3.6,0,.44,.35,m.tape);spool.rotation.x=Math.PI/2;
      box(root,-3.6,.9,-3,4,.15,1.8,m.white);for(let i=0;i<8;i++)box(root,-4,.99+i*.027,-3,1.5,.02,1.3,m.box);
      pallet(root,4.8,-3.4,false);pallet(root,2.8,-3.4,false);guard=box(root,0,2,1.1,2.2,1.8,.035,m.glass);
    }else if(id==='finishing'){
      box(root,0,1.4,-.4,2.6,.6,1.8,m.blue,true);
      wheel=new THREE.Group();wheel.position.set(.83,1.57,-.35);root.add(wheel);
      const abrasive=cyl(wheel,0,0,0,.65,.27,m.dark);abrasive.rotation.z=Math.PI/2;
      for(let i=0;i<6;i++){const spoke=box(wheel,.15,0,0,.02,1.1,.035,m.steel);spoke.rotation.x=i*Math.PI/6;}
      box(root,0,2.75,-.6,3,.18,2,m.steel);bar(root,[0,2.8,-1],[0,5.4,-1],.19);
      for(const x of [-4,4]){box(root,x,.85,-3,3.3,.15,1.6,m.white);for(const dx of [-1,0,1]){const p=new THREE.Group();pot(p);p.position.set(x+dx,1.15,-3);root.add(p);}}
    }else if(id==='quality'){
      for(const x of [-1,1])box(root,x,2,0,.15,2.5,2,m.white);
      box(root,0,3.2,0,2.2,.2,2,m.blue);scanner=box(root,0,1.55,0,1.4,.018,1.2,new THREE.MeshBasicMaterial({color:'#5dccb1',transparent:true,opacity:.35,depthWrite:false}));
      for(const x of [-4,4]){box(root,x,.85,-3,3,.16,1.8,m.white);box(root,x,1.5,-3.4,.8,.6,.12,m.dark);box(root,x,1.5,-3.33,.66,.46,.015,new THREE.MeshBasicMaterial({color:'#5fa6b2'}));}
    }else if(id==='receiving'||id==='shipping'){
      const shipping=id==='shipping',direction=shipping?1:-1,cx=direction*8;
      const trailer=new THREE.Group();trailer.position.set(cx,0,0);root.add(trailer);
      box(trailer,0,1.04,0,4.8,.2,2.4,m.dark);box(trailer,0,3.4,0,4.8,.15,2.4,m.white);
      box(trailer,0,2.2,-1.18,4.8,2.3,.08,m.white);
      for(const x of [-2.35,2.35])for(const z of [-1.18,1.18])box(trailer,x,2.25,z,.09,2.3,.09,m.white);
      box(trailer,direction*3.2,1.65,0,1.7,2.3,2.4,m.blue,true);box(trailer,direction*3.5,2,1.22,1.1,.65,.025,m.glass);
      for(const x of [-1.5,1.5,direction*3.2])for(const z of [-1.2,1.2]){const tire=cyl(trailer,x,.5,z,.43,.25,m.dark);tire.rotation.x=Math.PI/2;}
      box(root,direction*5.3,1.08,0,1.2,.12,1.65,m.steel);
      if(!shipping)for(const x of [-8.7,-7.5,-6.3]){for(let j=0;j<5;j++)cyl(root,x,1.2+j*.05,0,.48,.035,m.steel);}
      for(const x of [-5.5,5.5])pallet(root,x,2.8);
      box(root,0,.6,-1.5,2.4,1.2,1,m.blue);pusher=box(root,0,1.55,-1.2,1.2,.65,.15,m.yellow);
      for(const x of [-1.1,1.1])bar(root,[x,.8,-2],[x,1.5,-.8],.055,m.steel);
    }
    // Torres de sinalização e proteções visuais dão leitura ao estado da máquina.
    const tower=new THREE.Group();tower.position.set(1.9,2.8,-1.1);root.add(tower);
    cyl(tower,0,0,0,.035,.8,m.steel);
    const lamps={};for(const [i,key,color]of [[0,'red','#b54d48'],[1,'amber','#bd9b4d'],[2,'green','#4d8e76']])lamps[key]=cyl(tower,0,.55-i*.2,0,.1,.16,new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.05}));
    const packingBox=foldingBox(root);
    const inputSamples=[],outputSamples=[];
    for(let i=0;i<8;i++){
      const incoming=new THREE.Group();incoming.position.set(-4.3,1.17+i*.035,-.05);root.add(incoming);
      cyl(incoming,0,0,0,.58,.025,m.steel);inputSamples.push(incoming);
      const outgoing=new THREE.Group();
      if(id==='packing'){carton(outgoing,0,0,0,.72);outgoing.position.set(4.4+Math.floor(i/4)*.8,.61+(Math.floor(i/2)%2)*.5,-3.6+(i%2)*.65);}
      else{outgoing.position.set(4.8,.54+i*.12,-3.5);pot(outgoing);}
      root.add(outgoing);outputSamples.push(outgoing);
    }
    const loaded=new THREE.Group();root.add(loaded);const loadedBoxes=[];
    for(let i=0;i<12;i++){const c=new THREE.Group();carton(c,0,0,0,.78);c.position.set(6.5+Math.floor(i/4)*.86,1.5+(Math.floor(i/2)%2)*.56,(i%2-.5)*.9);loaded.add(c);loadedBoxes.push(c);}
    const model={id,root,head,wheel,lift,scanner,pusher,guard,ram,platform,clamps,sensors,unformed,shaped,packed,bowl,packingBox,inputSamples,outputSamples,loaded,loadedBoxes,lamps,operatingTime:0};modelCache.set(id,model);return model;
  }
  function select(id){if(selected)selected.root.visible=false;selected=modelCache.get(id)??build(id);selected.root.visible=true;setView('iso');}
  function setView(view){const dock=['receiving','shipping'].includes(selected?.id);const positions={iso:dock?[12,8,15]:[8.5,6,10],front:[0,3.6,dock?20:14],top:[.01,dock?22:16,.01],rear:[-10,6,-10]};camera.position.set(...(positions[view]??positions.iso));controls.target.set(0,1.35,0);if(view==='iso'&&!dock&&camera.aspect>1.9)camera.position.sub(controls.target).multiplyScalar(.7).add(controls.target);controls.update();}
  function resize(){const r=canvas.parentElement.getBoundingClientRect();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(canvas.parentElement);resize();
  canvas.addEventListener('pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY};});
  canvas.addEventListener('pointerup',e=>{
    if(!selected||!pointerStart||Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>5)return;
    const r=canvas.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(mouse,camera);
    const hit=raycaster.intersectObjects(Object.values(selected.sensors),false)[0];if(hit)onSensorPick(hit.object.userData.signal);
  });
  function update(cell,dt,running,emergency,scope='bench'){
    if(!selected||!cell)return;
    const model=selected,p=getPresentation(cell),moving=cell.outputs.work;
    if(moving)model.operatingTime+=dt;
    model.unformed.visible=false;
    model.shaped.visible=cell.part&&!p.isBox;
    model.packed.visible=cell.part&&p.isBox&&cell.id!=='packing';
    const rawHeight=cell.id==='production'&&cell.phase==='processing'?.95+.4*p.fixation: .95;
    const y=(p.form>0?1.35:rawHeight)+p.eject+p.lift;
    model.shaped.position.set(p.x,y,p.z);model.packed.position.set(p.x,1.52+p.lift,p.z);
    model.bowl.bowl.morphTargetInfluences[0]=p.form;
    model.bowl.rim.scale.setScalar((.62+(.46-.62)*p.form)/.46);
    model.bowl.metal.roughness=.65-p.polish*.47;model.bowl.metal.color.set(p.polish>.5?'#c7d3dc':'#8b9daa');
    model.shaped.rotation.y=cell.id==='finishing'&&p.step==='polish'?model.operatingTime*2:0;
    if(model.head)model.head.position.y=(cell.id==='production'?3.1:2.6)-p.head*(cell.id==='production'?.8:.8);
    if(model.ram){const end=model.head.position.y+.25;model.ram.position.y=(4.1+end)/2;model.ram.scale.y=(4.1-end)/.8;}
    if(model.platform)model.platform.position.y=cell.phase==='processing'?p.form>0?1.53-.39*p.form+p.eject:1.13+.4*p.fixation:1.14+p.eject;
    for(const clamp of model.clamps){clamp.object.position.x=clamp.side*(.84-p.fixation*.16);}
    if(model.wheel&&cell.outputs.work&&p.step==='polish')model.wheel.rotation.x=model.operatingTime*17;
    if(model.lift)model.lift.position.y=p.lift;
    if(model.scanner){model.scanner.visible=cell.outputs.work&&p.step==='scan';model.scanner.position.z=-.6+p.t*1.2;}
    if(model.pusher)model.pusher.position.z=-1.2+(cell.phase==='processing'?Math.sin(p.t*Math.PI)*.4:0);
    if(model.guard)model.guard.position.y=cell.guard?cell.id==='production'?2.5:2:4.6;
    const carton=model.packingBox;carton.group.visible=cell.id==='packing'&&cell.part&&cell.phase!=='feeding';carton.group.position.set(p.x,1.17,p.z);
    for(const wall of carton.walls)wall.object.rotation[wall.axis]=wall.open*(1-p.walls);
    for(const flap of carton.flaps){flap.object.visible=p.walls>.99;flap.object.rotation.x=flap.open*(1-p.flaps);}
    carton.tape.visible=p.tape>0;carton.tape.scale.z=Math.max(.001,p.tape);carton.label.visible=p.tape>.7;carton.foam.visible=!!p.foam;
    for(let i=0;i<8;i++){model.inputSamples[i].visible=['receiving','raw','production'].includes(cell.id)&&i<cell.queue;model.outputSamples[i].visible=scope==='bench'&&['production','packing'].includes(cell.id)&&i<cell.done;}
    model.loaded.visible=cell.id==='shipping';for(let i=0;i<model.loadedBoxes.length;i++)model.loadedBoxes[i].visible=i<cell.done;
    for(const [key,indicator]of Object.entries(model.sensors))indicator.material.color.set(cell.inputs[key]?'#62e4bd':'#364b60');
    const states={red:emergency||!cell.guard||cell.fault,amber:!running,green:running&&!cell.fault&&cell.guard};
    for(const [key,lamp]of Object.entries(model.lamps))lamp.material.emissiveIntensity=states[key]?1.7:.04;
  }
  return {select,setView,update,hotspots(){return [[-4.2,1.6,0],[0,4.5,0],[4.4,1.6,0]].map(p=>{const v=new THREE.Vector3(...p).project(camera);return {x:(v.x+1)*50,y:(1-v.y)*50,visible:v.z<1};});},render(){controls.update();renderer.render(scene,camera);},zoom(factor){camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();},dispose(){observer.disconnect();controls.dispose();renderer.dispose();env.texture.dispose();},get camera(){return camera;}};
}
