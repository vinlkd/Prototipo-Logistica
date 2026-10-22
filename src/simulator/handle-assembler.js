const clamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
const segment=(t,a,b)=>ease((t-a)/(b-a));
const mix=(a,b,t)=>a+(b-a)*t;

export function buildHandleAssembler({root,THREE,box,cyl,bar,m,product,layout,handles}) {
  handles.updateWorldMatrix(true,true);
  const inverse=new THREE.Matrix4().copy(handles.matrixWorld).invert(),local=new THREE.Box3();
  handles.traverse(object=>{
    if(!object.geometry)return;
    object.geometry.computeBoundingBox();
    local.union(object.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,object.matrixWorld)));
  });
  if(local.isEmpty())throw new Error('A montagem precisa da geometria real dos cabos.');
  const rotated=local.clone().applyMatrix4(new THREE.Matrix4().makeRotationY(layout.yaw));
  const group=new THREE.Group();group.name='Montagem de cabos';root.add(group);
  const pickupX=2.2,pickupZ=-3.6,seatTop=layout.conveyorTop;
  const supplyY=seatTop-local.min.y;
  const carrier=new THREE.Group();carrier.rotation.y=layout.yaw;group.add(carrier);
  carrier.add(handles);handles.position.set(0,0,0);handles.rotation.set(0,0,0);handles.scale.setScalar(1);handles.visible=true;
  // The actual handle bounding box sets the cradle: its lowest point touches
  // this surface, including the sloped grip and both casserole handles.
  const width=rotated.max.x-rotated.min.x+.2,depth=rotated.max.z-rotated.min.z+.2;
  const cx=pickupX+(rotated.min.x+rotated.max.x)/2,cz=pickupZ+(rotated.min.z+rotated.max.z)/2;
  const tray=box(group,cx,seatTop-.035,cz,width,.07,depth,m.steel);
  for(const side of [-1,1])for(const end of [-1,1])box(group,cx+side*(width/2-.06),(seatTop-.07)/2,cz+end*(depth/2-.06),.08,seatTop-.07,.08,m.blue);
  for(const side of [-1,1])box(group,cx+side*(width/2-.025),seatTop+.06,cz,.045,.12,depth,m.blue);
  // Rear mast and telescopic arm stay behind the press columns. The low tool
  // boom reaches the handles below the retracted punch, rather than through it.
  const mast=box(group,2.75,1.88,pickupZ,.14,3.76,.16,m.blue);
  const rail=box(group,1.35,3.82,pickupZ,3,.12,.16,m.steel);
  const saddle=box(group,pickupX,3.82,pickupZ,.22,.2,.24,m.yellow);
  const vertical=bar(group,[pickupX,1.5,pickupZ],[pickupX,3.82,pickupZ],.035,m.steel);
  const gripper=new THREE.Group();group.add(gripper);
  const contacts=product.handles==='long'?[{x:0,z:-product.rim-.61,y:product.height-.03,half:.095}]:[-1,1].map(side=>({x:0,z:side*(product.rim+.27),y:product.height-.04,half:.16}));
  const tools=[];
  for(const point of contacts){
    const tool=new THREE.Group();tool.position.set(point.x,point.y,point.z);gripper.add(tool);
    box(tool,0,.135,0,point.half*2+.15,.07,.18,m.yellow);
    const fingers=[];
    for(const side of [-1,1]){
      const finger=box(tool,side*(point.half+.0175),.035,0,.035,.14,.12,m.dark);
      fingers.push({finger,side});
    }
    const driver=cyl(tool,0,.17,.115,.035,.18,m.steel);
    const bit=cyl(tool,0,.045,.115,.009,.08,m.dark);
    const boom=box(group,pickupX,2,pickupZ,.08,.05,.1,m.steel);
    tools.push({tool,point,fingers,driver,bit,boom});
  }
  const model={group,carrier,gripper,handles,tools,localBounds:local,rotatedBounds:rotated,tray,mast,rail,saddle,vertical,pickupX,pickupZ,supplyY,seatTop,
    mounted:false,travelY:0,owned:[],dispose(){for(const material of this.owned)material.dispose();}};
  updateHandleAssembler(model,{pose:{step:'idle',t:0,x:0,y:layout.conveyorTop+layout.clearance-layout.potBottom,z:0},cell:{part:false,phase:'idle'},product,layout});
  return model;
}

export function updateHandleAssembler(model,{pose,cell,product,layout}){
  if(!model)return;
  const t=clamp(pose.t??0),active=cell.part&&cell.phase==='processing'&&pose.step==='handles';
  const leaving=cell.part&&(cell.phase==='unloading'||cell.phase==='processing'&&pose.step==='release');
  const target={x:pose.x??0,y:pose.y??layout.conveyorTop+layout.clearance-layout.potBottom,z:pose.z??0};
  // Real bounding-box clearance prevents low double handles scraping the rim.
  const travelY=Math.max(model.supplyY,target.y)+Math.max(.15,product.height+.04-model.localBounds.min.y);
  model.travelY=travelY;
  let x=model.pickupX,y=model.supplyY,z=model.pickupZ;
  let gx=x,gy=y+.12,gz=z,opening=.09,drive=0;
  if(active){
    y=mix(model.supplyY,travelY,segment(t,.1,.25));
    x=mix(model.pickupX,target.x,segment(t,.25,.42));
    z=mix(model.pickupZ,target.z,segment(t,.42,.65));
    if(t>=.65)y=mix(travelY,target.y,segment(t,.65,.75));
    gx=x;gy=y;gz=z;
    if(t<.1){gy=y+.12*(1-segment(t,0,.1));opening=.09*(1-segment(t,.025,.1));}
    else opening=0;
    drive=t>=.75&&t<=.88?Math.sin(Math.PI*clamp((t-.75)/.13)):0;
    if(t>=.88){
      opening=.09*segment(t,.88,.90);
      gz=mix(target.z,model.pickupZ,segment(t,.90,.96));
      if(t>=.96){gx=mix(target.x,model.pickupX,segment(t,.96,1));gy=mix(target.y,model.supplyY+.12,segment(t,.96,1));}
    }
  }else if(leaving){x=target.x;y=target.y;z=target.z;}
  model.mounted=!!(leaving||active&&t>=.88);
  model.carrier.position.set(x,y,z);model.carrier.scale.setScalar(1);model.handles.visible=true;model.handles.scale.setScalar(1);
  model.gripper.position.set(gx,gy,gz);
  model.saddle.position.x=gx;
  const lower=Math.min(gy+.25,3.7),upper=3.82;
  model.vertical.position.set(gx,(lower+upper)/2,model.pickupZ);model.vertical.scale.y=(upper-lower)/2.32;
  for(const {tool,point,fingers,driver,bit,boom} of model.tools){
    for(const {finger,side} of fingers)finger.position.x=side*(point.half+.0175+opening);
    driver.rotation.y=t*50;driver.position.y=.17+.06*(1-drive);bit.position.y=.045+.06*(1-drive);
    driver.visible=active&&t>=.75&&t<=.88;bit.visible=driver.visible;
    const start=model.pickupZ,end=gz+point.z;
    boom.position.set(gx,gy+point.y+.135,(start+end)/2);
    boom.scale.z=Math.max(.001,Math.abs(end-start)/.1);
  }
}
