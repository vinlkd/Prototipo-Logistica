const clamp=value=>Math.max(0,Math.min(1,value));
export function getPresentation(cell){
  const step=cell.stage?.id??'idle',t=clamp(cell.stage?.progress??0),material=cell.unit?.material??'';
  const isBox=/box/.test(material)||['finished','shipping'].includes(cell.id);
  let form=/pot|box/.test(material)?1:0,head=0,fixation=0,eject=0,lift=0,polish=/polished|approved|boxed|picked|shipped/.test(material)?1:0;
  if(cell.id==='production'){
    if(step==='clamp')fixation=t;
    if(['down','draw','up'].includes(step))fixation=1;
    if(step==='down')head=t*.5;
    if(step==='draw'){head=.5+.5*t;form=t;}
    if(step==='up')head=1-t;
    if(step==='eject'){fixation=1-t;eject=t*.42;}
    if(cell.phase==='unloading')eject=.42*(1-clamp((cell.progress-.5)/.12));
  }
  if(['raw','finished'].includes(cell.id)){if(step==='raise')lift=t*1.7;if(step==='lower')lift=(1-t)*1.7;}
  if(cell.id==='finishing'&&step==='polish')polish=t;
  const packing=cell.id==='packing';
  const walls=packing?(step==='carton'?t:['protect','close','label','transfer'].includes(step)?1:0):0;
  const flaps=packing?(step==='close'?t:['label','transfer'].includes(step)?1:0):0;
  const tape=packing?(step==='label'?t:step==='transfer'?1:0):0;
  const foam=packing&&(step==='protect'?t:['close','label','transfer'].includes(step)?1:0);
  if(packing)head=step==='close'?Math.sin(t*Math.PI)*.65:step==='label'?Math.sin(t*Math.PI)*.8:0;
  let x=-4.35+cell.progress*8.7,z=0;
  if(cell.id==='shipping'&&cell.phase==='unloading'&&cell.progress>.9)x=3.48+(cell.progress-.9)/.1*3;
  if(['raw','finished'].includes(cell.id)&&cell.phase==='processing')z=-.55*Math.min(1,lift*3);
  return {step,t,form,head,fixation,eject,lift,polish,walls,flaps,tape,foam,isBox,x,z};
}
