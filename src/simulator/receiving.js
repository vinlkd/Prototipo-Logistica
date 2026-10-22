const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};

export function receivingState(cell,product){
 const step=cell.stage?.id??'idle',t=clamp(cell.stage?.progress??0),processing=cell.part&&cell.phase==='processing';
 const diameter=(parseInt(product.size,10)/100)*1.4;
 const nominalMass=Math.PI*(diameter/2)**2*.0008*7900;
 const identified=processing&&['check','release'].includes(step)||cell.phase==='unloading';
 const checked=processing&&step==='release'||cell.phase==='unloading';
 const gate=cell.phase==='feeding'?smooth(t/.3):processing?step==='release'?1-smooth(t):1:0;
 const reading=processing&&step==='identify'?smooth(t):identified?1:0;
 const weight=processing&&step==='check'?nominalMass*smooth(t/.8):checked?nominalMass:0;
 const title=processing?{identify:'Identificando o disco',check:'Pesando e conferindo',release:'Liberando a passagem'}[step]:cell.phase==='feeding'?'Posicionando na balança':cell.phase==='unloading'?'Material conferido · saída liberada':'Aguardando o próximo disco';
 const detail=processing?{identify:'O leitor óptico percorre o disco e registra sua identificação.',check:'A balança estabiliza a leitura e confere a massa nominal do material.',release:'A trava desce antes de a esteira encaminhar o disco ao estoque.'}[step]:cell.phase==='unloading'?'A conferência terminou; o disco já pode seguir para a armazenagem.':'O disco deve estar posicionado antes de iniciar a conferência.';
 return {step,t,processing,gate,reading,weight,nominalMass,identified,checked,title,detail,scanZ:-.53+1.06*smooth(t),ready:cell.phase==='unloading'||processing&&step==='release'&&t>.999};
}

export function buildReceiving({root,THREE,box,cyl,bar,m,layout}){
 const group=new THREE.Group();root.add(group);group.name='Conferência de recebimento';const owned=[];
 const material=(color)=>{const value=new THREE.MeshStandardMaterial({color,roughness:.45,metalness:.3});owned.push(value);return value;};
 const top=layout.conveyorTop;
 // Same support datum as the rollers: weighing never pushes the blank into the belt.
 const plate=box(group,0,top-.035,0,1.46,.07,1.46,m.steel);plate.name='Plataforma de pesagem';
 for(const x of [-.52,.52])for(const z of [-.52,.52]){cyl(group,x,top-.14,z,.07,.14,m.dark);box(group,x,(top-.24)/2,z,.09,top-.24,.09,m.blue);}
 for(const z of [-.91,.91])box(group,-.25,1.275,z,.08,2.55,.08,m.white);
 box(group,-.25,2.55,0,.18,.1,1.95,m.blue);
 const reader=new THREE.Group();group.add(reader);reader.position.set(-.25,1.84,0);
 box(reader,0,.04,0,.27,.16,.23,m.dark,true);box(reader,0,.37,0,.045,.62,.045,m.steel);box(reader,0,.7,0,.32,.15,.22,m.white);const lens=cyl(reader,0,-.052,0,.045,.025,material('#2c95c9'));
 const scanMaterial=new THREE.MeshBasicMaterial({color:'#09b9e7',transparent:true,opacity:.7,depthWrite:false});owned.push(scanMaterial);
 const scanLine=box(group,0,top+layout.clearance+.006,0,1.12,.008,.018,scanMaterial);
 const curtainMaterial=new THREE.MeshBasicMaterial({color:'#32b7df',transparent:true,opacity:.09,depthWrite:false,side:THREE.DoubleSide});owned.push(curtainMaterial);
 const curtain=box(group,-.25,1.52,0,.012,.59,1.06,curtainMaterial);
 const gate=new THREE.Group();group.add(gate);gate.position.x=.72;box(gate,0,0,0,.08,.1,1.46,m.yellow);
 for(const z of [-.8,.8]){box(group,.72,.91,z,.13,.56,.13,m.dark);box(group,.72,.4,z,.085,.8,.085,m.steel);box(gate,0,-.1,z,.05,.2,.05,m.steel);}
 const indicators={};for(const [i,key]of ['identify','check','release'].entries()){const led=cyl(group,1.35+i*.2,1.6,1.75,.055,.06,material('#5a6a7a'));led.rotation.x=Math.PI/2;indicators[key]=led;}
 // A real dial needle gives weighing visible motion without moving the support surface.
 bar(group,[1.5,0,1.7],[1.5,1.9,1.7],.035,m.steel);box(group,1.55,1.6,1.7,.7,.05,.1,m.dark);const dial=new THREE.Group();dial.position.set(1.5,1.9,1.7);group.add(dial);
 const face=cyl(dial,0,0,0,.2,.04,m.white);face.rotation.x=Math.PI/2;
 const needle=box(dial,0,.08,.028,.018,.16,.012,material('#e7490f'));needle.geometry.translate(0,-.08,0);needle.position.y=0;
 const canvas=globalThis.document?.createElement('canvas');let context=null,texture=null;
 if(canvas){canvas.width=768;canvas.height=448;context=canvas.getContext('2d');if(context){texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;}}
 const screenMaterial=new THREE.MeshBasicMaterial({color:texture?'#ffffff':'#153956',map:texture,toneMapped:false});owned.push(screenMaterial);
 const panelGroup=new THREE.Group();panelGroup.position.set(2.9,2.15,1.55);group.add(panelGroup);
 bar(panelGroup,[0,-2.15,0],[0,-.5,0],.045,m.steel);box(panelGroup,0,0,0,1.85,1.1,.12,m.dark,true);box(panelGroup,0,0,.068,1.73,.99,.014,screenMaterial);
 const panel={lines:[],key:'',texture,update(lines){const key=lines.join('|');if(key===this.key)return;this.lines=lines;this.key=key;if(!context)return;context.fillStyle='#123451';context.fillRect(0,0,768,448);context.fillStyle='#e7490f';context.fillRect(0,0,768,7);context.font='25px Segoe UI';context.fillStyle='#b9d3e8';context.fillText('Recebimento · conferência',28,48);lines.forEach((line,i)=>{context.font=i===0?'600 28px Segoe UI':'25px Segoe UI';context.fillStyle=i===3?'#8be1b9':'#f0f6fc';context.fillText(line,28,110+i*72,712);});texture.needsUpdate=true;}};
 return {group,plate,reader,lens,scanLine,curtain,gate,needle,indicators,panel,top,dispose(){texture?.dispose();for(const value of owned)value.dispose();}};
}

export function updateReceiving(model,{cell,product,layout,running}){
 const state=receivingState(cell,product),optical=state.processing&&state.step==='identify';
 model.reader.position.z=optical?state.scanZ:0;
 model.scanLine.position.z=state.scanZ;model.scanLine.visible=optical&&running&&cell.outputs.work;
 model.curtain.visible=model.scanLine.visible;
 // Raised stopper is in front of the disc edge; it fully retracts before transport resumes.
 model.gate.position.y=.99+.25*state.gate;
 model.needle.rotation.z=1.1-(state.weight/state.nominalMass)*2.2;
 for(const [key,led]of Object.entries(model.indicators)){
  const done=key==='identify'?state.identified:key==='check'?state.checked:state.ready;
  const active=state.processing&&state.step===key;
  led.material.color.set(done?'#29966f':active?'#e7a539':'#5a6a7a');
 }
 const weight=state.weight.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3});
 model.panel.update([state.title,cell.unit?.id??'Sem material na balança',state.weight>0?`Massa simulada: ${weight} kg`:`Leitura: ${Math.round(state.reading*100)}%`,state.ready?'Esteira liberada':state.checked?'Conferência OK':'Conferência em andamento']);
 return state;
}
