import {getRawStock,getNextRawPickup} from './raw-stock.js';
import {getProduct} from './products.js';
import {CONVEYOR_TOP,CLEARANCE,getLayout,smooth} from './kinematics.js';
const clamp=v=>Math.max(0,Math.min(1,v));
export function getPresentation(cell,productId=cell.unit?.product??'saucepan'){
 const product=getProduct(productId),layout=getLayout(productId),rawStock=getRawStock(cell,productId);
 const step=cell.stage?.id??'idle',t=clamp(cell.stage?.progress??0),s=smooth(t),material=cell.unit?.material??'';
 const isBox=/box/.test(material)||['finished','shipping'].includes(cell.id);
 let form=/pot|box/.test(material)?1:0,head=0,fixation=0,eject=0,lift=0,z=0,forkZ=0,forkLift=0,support=CONVEYOR_TOP;
 let polish=/polished|approved|boxed|picked|shipped/.test(material)?1:0;
 if(cell.id==='production'){
  fixation=step==='clamp'?s:['down','draw','up'].includes(step)?1:step==='eject'?1-s:0;
  if(step==='draw')form=s;
  const depression=product.height+.18;
  if(['draw','up'].includes(step))support-=depression*form;
  if(step==='eject'){support-=depression*(1-s);eject=s;}
  if(step==='down')head=s;if(step==='draw')head=1;if(step==='up')head=1-s;
 }
 if(cell.id==='finished'&&cell.phase==='processing'){
  const travel=-3.6;
  if(step==='raise')lift=1.64*s;
  if(step==='store'){z=travel*smooth(t/.4);lift=1.64-.04*smooth((t-.4)/.15);forkZ=t<.55?z:travel*(1-smooth((t-.55)/.45));forkLift=lift;}
  if(step==='retrieve'){forkZ=t<.6?travel*smooth(t/.45):travel*(1-smooth((t-.6)/.4));lift=1.6+.04*smooth((t-.45)/.15);z=t<.6?travel:forkZ;forkLift=t<.45?1.6:lift;}
  if(step==='lower')lift=1.64*(1-s);
  if(!['store','retrieve'].includes(step)){forkZ=z;forkLift=lift;}
  support+=lift;
 }
 // After magnetic loading, empty forks approach the shelf before taking load.
 if(cell.id==='raw'&&['feeding','processing'].includes(cell.phase)){
  z=-3.6;lift=1.6;
  if(step==='raise'){forkLift=1.6*smooth(t/.6);forkZ=-3.6*smooth((t-.6)/.4);}
  if(step==='retrieve'){lift=1.6+.04*smooth(t/.25);z=-3.6*(1-smooth((t-.25)/.75));forkZ=z;forkLift=lift;}
  if(step==='lower'){z=0;lift=1.64*(1-s);forkZ=0;forkLift=lift;}
  support+=lift;
 }
 if(cell.id==='finishing')fixation=step==='clamp'?s:['polish','handles'].includes(step)?1:step==='release'?1-s:0;
 if(cell.id==='finishing'&&step==='polish')polish=s;
 if(cell.id==='finishing'&&['handles','release'].includes(step))polish=1;
 const polishAngle=cell.id==='finishing'?(step==='polish'?4*Math.PI*s:['handles','release'].includes(step)?4*Math.PI:0):0;
 const polishContact=cell.id==='finishing'&&step==='polish'?smooth(t/.2)*(1-smooth((t-.8)/.2)):0;
 const inspectionProbe=cell.id==='quality'?(step==='scan'?s:step==='check'?1-s:0):0;
 const packing=cell.id==='packing';
 const walls=packing?(step==='carton'?s:['protect','close','label','transfer'].includes(step)?1:0):0;
 const flaps=packing?(step==='close'?s:['label','transfer'].includes(step)?1:0):0;
 const tape=packing?(step==='label'?s:step==='transfer'?1:0):0;
 const foam=packing?(step==='protect'?s:['close','label','transfer'].includes(step)?1:0):0;
 let x=cell.phase==='feeding'?-4.35+4.35*smooth(cell.progress/.5):cell.phase==='unloading'?cell.progress<.9?3.48*smooth((cell.progress-.5)/.4):3.48+.87*smooth((cell.progress-.9)/.1):0;
 if(cell.id==='raw'&&cell.phase==='feeding'){
  const pickupZ=rawStock.pickupZ;
  const pilePlane=rawStock.planeY;
  const highSupport=CONVEYOR_TOP+1.6+.35;
  support=pilePlane-CLEARANCE+(highSupport-(pilePlane-CLEARANCE))*smooth((t-.15)/.2);
  if(t>=.8)support=highSupport-.35*smooth((t-.8)/.2);
  x=rawStock.pickupX*(1-smooth((t-.35)/.3));
  z=pickupZ+(-3.6-pickupZ)*smooth((t-.65)/.15);
  lift=support-CONVEYOR_TOP;
 }
 if(cell.id==='shipping'&&cell.phase==='unloading'&&cell.progress>=.9){const u=(cell.progress-.9)/.1,tier=Math.floor(cell.done/4)%3,slot=3-cell.done%4;support+=tier*(layout.package.height+.08)*smooth(u/.25);x=3.48+(6.65+slot*(layout.package.width+.14)-3.48)*smooth((u-.25)/.75);}
 support+=packing?.035:0;
 const y=support+CLEARANCE-(.21-.39*form);
 let loaderX=null,loaderY=null,loaderZ=null,loaderCaught=false,loaderReleasing=false;
 if(cell.id==='raw'){
  const nextPickup=getNextRawPickup(cell,productId),homeZ=nextPickup.pickupZ,shelfPlane=CONVEYOR_TOP+1.6+CLEARANCE;
  loaderX=nextPickup.pickupX;loaderZ=homeZ;loaderY=nextPickup.planeY+.25;
  if(cell.phase==='feeding'){
   loaderX=x;loaderZ=z;loaderY=y+.21+.25*(1-smooth(t/.15));
   loaderCaught=t>=.15&&t<1;loaderReleasing=t>=.98;
  }else if(cell.phase==='processing'&&step==='locate'){
   loaderX=nextPickup.pickupX*smooth((t-.5)/.5);loaderZ=-3.6+(homeZ+3.6)*smooth((t-.5)/.5);
   loaderY=shelfPlane+.35*smooth(t/.5);loaderReleasing=t<.12;
  }else if(cell.phase==='processing'&&step==='raise'){
   loaderY=shelfPlane+.35+(nextPickup.planeY+.25-shelfPlane-.35)*s;
  }
 }
 const punchBottom=CONVEYOR_TOP+CLEARANCE+(support-CONVEYOR_TOP)*head;
 const headY=3.3+(punchBottom+1.15-3.3)*head;
 const retractY=CONVEYOR_TOP+layout.package.height+layout.package.depth/2+.92;const packingHeadY=step==='label'?retractY-(retractY-(CONVEYOR_TOP+layout.package.height+.12))*Math.sin(Math.PI*t):retractY;
 return {step,t,form,head,headY,packingHeadY,fixation,eject,lift,polish,polishAngle,polishContact,inspectionProbe,walls,flaps,tape,foam,isBox,x,y,z,support,forkZ,forkLift,loaderX,loaderY,loaderZ,loaderCaught,loaderReleasing,layout};
}
