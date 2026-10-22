const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

// Match the product's lathed body, excluding its handles and rolled rim.
function bodySurface(product, localY) {
  const r = product.rim, h = product.height;
  const profile = [[r*.72,-.17],[r*.8,-.12],[r*.86,-.06],[r*.91,h*.25],[r*.95,h*.62],[r*.99,h*.96],[r,h]];
  for (let i=1; i<profile.length; i++) {
    const [r0,y0] = profile[i-1], [r1,y1] = profile[i];
    if (localY <= y1 || i === profile.length-1) {
      const t = clamp((localY-y0)/(y1-y0));
      return {radius:r0+(r1-r0)*t, slope:(r1-r0)/(y1-y0)};
    }
  }
}

// Exact circle/segment envelope also clears profile corners (especially shallow pans).
function wheelEnvelope(product,centreY,radius){
 const r=product.rim,h=product.height;
 const pts=[[.001,-.18],[.08,-.18],[.2,-.18],[r*.72,-.17],[r*.8,-.12],[r*.86,-.06],[r*.91,h*.25],[r*.95,h*.62],[r*.99,h*.96],[r,h]];
 let bound=0;
 for(let i=1;i<pts.length;i++){
  const [r0,y0]=pts[i-1],[r1,y1]=pts[i];
  if(y1===y0)continue;
  const lo=Math.max(y0,centreY-radius),hi=Math.min(y1,centreY+radius);
  if(lo>hi)continue;
  const slope=(r1-r0)/(y1-y0),critical=centreY+slope*radius/Math.hypot(1,slope);
  for(const y of [lo,hi,Math.max(lo,Math.min(hi,critical))])bound=Math.max(bound,r0+slope*(y-y0)+Math.sqrt(Math.max(0,radius*radius-(y-centreY)**2)));
 }
 return bound+.002;
}

function makePanel(THREE, root, box, m, rear, title) {
  const owned = [];
  const canvas = globalThis.document?.createElement('canvas');
  let context = null, texture = null;
  if (canvas) {canvas.width=768; canvas.height=448; context=canvas.getContext('2d');}
  if (context) {texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace;}
  const material = new THREE.MeshBasicMaterial({color:texture?'#ffffff':'#153956', map:texture, toneMapped:false});
  owned.push(material);
  const group = new THREE.Group(); group.position.set(1.75,2.35,rear+.05); root.add(group);
  box(group,0,-1.175,-.05,.09,2.35,.09,m.steel);
  box(group,0,0,0,1.72,1.05,.12,m.dark);
  box(group,0,0,.067,1.58,.92,.014,material);
  const panel = {group, lines:[], texture, status:'idle', key:'', update(lines,status='idle') {
    const key = `${status}|${lines.join('|')}`;
    if (key===this.key) return;
    this.key=key; this.lines=[...lines]; this.status=status;
    if (!context) return;
    context.fillStyle='#123451'; context.fillRect(0,0,768,448);
    context.fillStyle='#e7490f'; context.fillRect(0,0,768,7);
    context.fillStyle='#b8d4e7'; context.font='500 24px Segoe UI, sans-serif'; context.fillText(title,30,48);
    lines.forEach((line,index) => {
      context.font=index===lines.length-1?'600 25px Segoe UI, sans-serif':'27px Segoe UI, sans-serif';
      context.fillStyle=index===lines.length-1?(status==='approved'?'#8be1b9':status==='working'?'#ffd79d':'#c4d3df'):'#f1f7fb';
      context.fillText(line,30,103+index*57,708);
    });
    texture.needsUpdate=true;
  }, dispose() {texture?.dispose(); for (const item of owned) item.dispose();}};
  return panel;
}

export function buildWorkstation({id,root,THREE,box,cyl,bar,m,product,layout}) {
  if (!['finishing','quality'].includes(id)) return null;
  const group=new THREE.Group(); group.name=`workstation-${id}`; root.add(group);
  const top=layout.conveyorTop, clearance=layout.clearance ?? .012, bottom=layout.potBottom ?? -.18;
  const origin=top+clearance-bottom;
  const footprint=layout.footprint;
  const rear=Math.max(1.25,footprint.maxZ+.45);
  const openX=Math.max(Math.abs(footprint.minX),Math.abs(footprint.maxX))+.25;
  const supportTop=top;
  const rotary=new THREE.Group();group.add(rotary);
  const cradle=cyl(rotary,0,supportTop-.009,0,.25,.018,m.steel);
  cyl(group,0,top-.065,0,.19,.1,m.steel);
  const gasket=new THREE.Mesh(new THREE.TorusGeometry(.21,.006,8,40),m.dark);gasket.rotation.x=Math.PI/2;gasket.position.y=top+.006;rotary.add(gasket);
  for(let i=0;i<3;i++){const mark=box(rotary,Math.cos(i*2*Math.PI/3)*.18,top+.002,Math.sin(i*2*Math.PI/3)*.18,.08,.004,.015,m.yellow);mark.rotation.y=-i*2*Math.PI/3;}
  cradle.name='Apoio do fundo';
  // The body rests on a thin fixture; structural hardware stays below the rollers
  // or behind the complete product footprint, leaving the travel corridor open.
  box(group,0,top-.15,0,1.5,.08,.72,m.steel);
  for (const side of [-1,1]) {
    box(group,side*.64,(top-.2)/2,rear,.11,top-.2,.11,m.blue);
    bar(group,[side*.64,top-.2,rear],[side*.64,top-.2,.25],.045,m.steel);
  }
  const jaws=[];
  const contactY=bottom+.055;
  const jawZ=Math.min(.19,product.rim*.4);
  const surface=bodySurface(product,contactY+.035);
  const jawContact=Math.sqrt(Math.max(.01,surface.radius**2-(jawZ-.045)**2))+.049;
  for (const side of [-1,1]) for (const z of [-jawZ,jawZ]) {
    const slide=new THREE.Group(); slide.position.set(side*openX,origin+contactY,z); group.add(slide);
    const pad=box(slide,0,0,0,.09,.07,.09,m.dark); pad.name='Garra de apoio';
    box(slide,side*.1,-.02,0,.18,.045,.055,m.steel);
    box(slide,0,-.08725,0,.055,.0895,.055,m.steel);
    if(id==='quality'&&side===-1)box(group,0,top-.1,z,2*openX+.2,.07,.09,m.steel);
    if(id==='finishing')slide.visible=false;
    jaws.push({slide,side,openX,closedX:jawContact});
  }
  const panel=makePanel(THREE,group,box,m,rear,id==='quality'?'Inspeção dimensional':'Acabamento superficial');
  const model={id,group,cradle,rotary,gasket,jaws,panel,rear,origin,bottom,product,layout,clock:0,owned:[],supportBounds:{rearMinZ:rear-.08,productMaxZ:footprint.maxZ},
    dispose() {panel.dispose(); for(const material of this.owned) material.dispose();}};

  if (id==='finishing') {
    const localY=(bottom+product.height)*.5;
    const contact=bodySurface(product,localY);
    const radius=Math.max(.025,Math.min(.12,(product.height-bottom)*.16));
    // Offset the wheel along the normal of the body's sloped wall, rather than
    // placing its centre on the surface (which would cut through the cookware).
    const norm=Math.hypot(1,contact.slope);
    const contactX=contact.radius+radius/norm;
    const centreY=localY-contact.slope*radius/norm;
    const retractedX=Math.max(openX+.32,contactX+.65);
    const tool=new THREE.Group(); group.add(tool);
    const wheel=new THREE.Group(); tool.add(wheel);
    const abrasiveMaterial=new THREE.MeshStandardMaterial({color:'#6d747c',roughness:.95,metalness:.1}); model.owned.push(abrasiveMaterial);
    const abrasive=cyl(wheel,0,0,0,radius,.14,abrasiveMaterial); abrasive.rotation.x=Math.PI/2;
    cyl(wheel,0,0,0,.025,.18,m.steel).rotation.x=Math.PI/2;
    for(let i=0;i<8;i++) {
      const marker=box(wheel,0,0,.077,radius*1.3,.009,.006,m.steel); marker.rotation.z=i*Math.PI/4;
    }
    const shroud=new THREE.Mesh(new THREE.TorusGeometry(radius+.025,.018,8,32,Math.PI),m.blue);
    shroud.rotation.z=-Math.PI/2; shroud.position.z=-.095; tool.add(shroud);
    box(tool,0,.08,-.23,.18,.2,.27,m.dark);
    const mastX=retractedX+.25;
    box(group,mastX,(origin+product.height+.6)/2,rear,.16,origin+product.height+.6,.16,m.blue);
    const bridgeY=origin+product.height+.5;
    bar(group,[mastX,bridgeY,rear],[mastX,bridgeY,0],.045,m.steel);
    bar(group,[contactX-.12,bridgeY,0],[mastX,bridgeY,0],.045,m.steel);
    const carriage=box(group,retractedX,bridgeY,-.07,.22,.14,.4,m.yellow);
    const link=bar(group,[retractedX,origin+centreY+.1,-.23],[retractedX,bridgeY,-.23],.035,m.steel);
    model.finishing={tool,wheel,carriage,link,radius,contactX,centreY,retractedX,bridgeY,linkLength:bridgeY-origin-centreY-.1,active:false};
  } else {
    const bridgeY=origin+product.height+.78;
    for(const side of [-1,1])box(group,side*(openX+.25),bridgeY/2,rear,.13,bridgeY,.13,m.blue);
    box(group,0,bridgeY,rear,2*(openX+.35),.14,.18,m.steel);
    // Cantilever guides pass above the tallest pot and its handles.
    for(const side of [-1,1])bar(group,[side*(product.rim+.11),bridgeY,rear],[side*(product.rim+.11),bridgeY,-.05],.03,m.steel);
    const carriage=new THREE.Group(); group.add(carriage);
    box(carriage,0,bridgeY,0,2*(product.rim+.23),.12,.2,m.yellow);
    const sideProbes=[];
    for(const side of [-1,1]) {
      const shaft=cyl(carriage,side*(product.rim+.06),bridgeY-.2,0,.018,.4,m.steel);
      const shoe=box(carriage,side*(product.rim+.03),bridgeY-.4,0,.06,.09,.08,m.dark);
      sideProbes.push({side,shaft,shoe});
    }
    const depth=cyl(carriage,0,bridgeY-.2,0,.012,.4,m.steel);
    const depthTip=new THREE.Mesh(new THREE.SphereGeometry(.02,12,8),m.steel); carriage.add(depthTip);
    const indicators=[];
    for(let i=0;i<3;i++) {
      const material=new THREE.MeshBasicMaterial({color:'#718395'}); model.owned.push(material);
      const sensor=new THREE.Mesh(new THREE.SphereGeometry(.045,16,10),material);
      sensor.position.set((i-1)*.16,bridgeY+.12,.12); sensor.userData.signal=['diameter','height','depth'][i]; carriage.add(sensor); indicators.push(sensor);
    }
    const nominalDiameter=Number.parseFloat(product.size)*10;
    const scale=nominalDiameter/(product.rim*2);
    model.quality={carriage,sideProbes,depth,depthTip,indicators,bridgeY,rear,extension:0,travel:0,
      nominal:{diameter:nominalDiameter,height:(product.height-bottom)*scale,depth:(product.height-bottom-.021)*scale}};
  }
  updateWorkstation(model,{pose:{step:'idle',t:0,x:-4,y:origin,z:0},cell:{part:false,phase:'idle',outputs:{}},dt:0,running:false,product,layout});
  return model;
}

export function updateWorkstation(model,{pose,cell,dt=0,running=false,product,layout}) {
  if (!model) return;
  const processing=!!cell.part && cell.phase==='processing';
  const step=pose.step ?? 'idle', t=clamp(pose.t);
  const origin=Number.isFinite(pose.y)?pose.y:model.origin;
  const bottom=layout?.potBottom ?? model.bottom;
  let fixation=0;
  if(processing) {
    if(model.id==='quality') {
      const probe=clamp(pose.inspectionProbe ?? (step==='scan'?clamp(t/.28):step==='check'?1:0));
      fixation=clamp(probe/.25);
    } else if(Number.isFinite(pose.fixation))fixation=clamp(pose.fixation);
    else fixation=step==='clamp'?t:step==='polish'?1:step==='release'?1-t:0;
  }
  for(const jaw of model.jaws) {
    jaw.slide.position.x=jaw.side*(jaw.openX+(jaw.closedX-jaw.openX)*fixation);
    jaw.slide.position.y=origin+bottom+.055;
  }
  const unit=cell.unit?.id ?? 'Sem unidade';
  if(model.id==='finishing') {
    const f=model.finishing;
    model.rotary.rotation.y=pose.polishAngle??0;
    const lowY=bottom+f.radius*2+.035,highY=product.height-.025;
    const localY=lowY+(highY-lowY)*(.5-.5*Math.cos(4*Math.PI*t));
    const surface=bodySurface(product,localY),norm=Math.hypot(1,surface.slope);
    f.centreY=localY-surface.slope*f.radius/norm;f.contactX=wheelEnvelope(product,f.centreY,f.radius);
    const fallback=step==='polish'?Math.min(clamp(t/.16),clamp((1-t)/.16)):0;
    const contact=processing&&step==='polish'?clamp(pose.polishContact ?? fallback):0;
    f.active=processing&&step==='polish'&&contact>.98;
    f.tool.position.set(f.retractedX+(f.contactX-f.retractedX)*contact,origin+f.centreY,pose.z ?? 0);
    f.carriage.position.x=f.tool.position.x;
    const low=origin+f.centreY+.1, high=f.bridgeY;
    f.link.position.set(f.tool.position.x,(low+high)/2,-.23);
    f.link.scale.y=Math.max(.01,(high-low)/f.linkLength);
    if(running&&cell.outputs?.work&&f.active)model.clock+=Math.max(0,Math.min(.1,dt));
    f.wheel.rotation.z=model.clock*24;
    const status=step==='polish'&&processing?'working':'idle';
    model.panel.update([product.name,unit,processing&&step==='polish'?`Polimento: ${Math.round(t*100)}%`:'Rebolo recolhido',
      f.active?'Pe�a girando � fixa��o pela base':contact>0?'Aproximação / afastamento':'Transporte livre'],status);
    return;
  }
  const q=model.quality;
  const fallback=step==='scan'?clamp(t/.28):step==='check'?1:0;
  const probe=processing?clamp(pose.inspectionProbe ?? fallback):0;
  q.travel=clamp(probe/.4); q.extension=clamp((probe-.4)/.6);
  q.carriage.position.z=q.rear*(1-q.travel);
  const safeTip=origin+product.height+.35;
  const sideTip=safeTip+(origin+product.height-.02-safeTip)*q.extension;
  const depthY=safeTip+(origin+bottom+.021-safeTip)*q.extension;
  for(const probe of q.sideProbes) {
    const top=q.bridgeY-.08, length=top-sideTip;
    probe.shaft.position.y=(top+sideTip)/2; probe.shaft.scale.y=length/.4;
    probe.shoe.position.y=sideTip;
  }
  const top=q.bridgeY-.08;
  q.depth.position.y=(top+depthY)/2; q.depth.scale.y=(top-depthY)/.4;
  q.depthTip.position.y=depthY;
  const measured=processing&&['check','approve'].includes(step)||cell.part&&cell.phase==='unloading';
  const approved=cell.part&&(step==='approve'||cell.phase==='unloading');
  const progress=processing&&step==='scan'?t:measured?1:0;
  for(let i=0;i<q.indicators.length;i++)q.indicators[i].material.color.set(progress>=(i+1)/3?'#34bf8d':'#718395');
  const diameter=measured?`${q.nominal.diameter.toFixed(1)} mm`:'—';
  const height=measured?`${q.nominal.height.toFixed(1)} mm`:'—';
  const status=approved?'approved':processing?'working':'idle';
  model.panel.update([product.name,`Diâmetro: ${diameter}`,`Altura: ${height}`,
    approved?'Conforme ao modelo didático':processing?`Leitura nominal: ${Math.round(progress*100)}%`:'Aguardando peça',
    'Referência didática · não metrologia real'],status);
}
