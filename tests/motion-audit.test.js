import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSimulation} from '../src/simulator/simulation.js';
import {getPresentation} from '../src/simulator/presentation.js';
import {PRODUCTS} from '../src/simulator/products.js';
import {getRawStock,RAW_PILE_X} from '../src/simulator/raw-stock.js';

const scene=['lab-scene.js','lab-model.js'].map(file=>readFileSync(new URL(`../src/simulator/${file}`,import.meta.url),'utf8')).join('\n');
const workstation=readFileSync(new URL('../src/simulator/workstations.js',import.meta.url),'utf8');
const assemblyIntegrated=scene.includes('buildHandleAssembler(')&&scene.includes('updateHandleAssembler(')&&!scene.includes("Math.max(.001,p.t)");
const pilesIntegrated=scene.includes('getRawStock(')&&scene.includes('RAW_PILE_X')&&scene.includes('buildRawLoader(')&&scene.includes('updateRawLoader(');
const rotationIntegrated=/polishAngle/.test(scene)&&(/polishAngle/.test(workstation)||/rotation\.y\s*=.*polishAngle/.test(scene));

// Mandatory source wiring checks complement the runtime engine tests below;
// they do not replace browser/mesh collision verification.
test('scene integrates the real handle assembler instead of scaling handles',()=>assert.ok(assemblyIntegrated));
test('scene integrates magnetic loader and exact four-pile stock counts',()=>assert.ok(pilesIntegrated));
test('scene applies polishAngle to the cookware rotation',()=>assert.ok(rotationIntegrated));

for(const product of PRODUCTS)test(`${product.name}: live 12-unit engine preserves units and visits all four pile tops`,()=>{
 const sim=createSimulation(12,{product:product.id,scope:'line'});sim.setSpeed(4);sim.start();
 const picked=new Map();
 for(let i=0;i<18000&&sim.snapshot.running;i++){
  sim.step(.025);const s=sim.snapshot;
  const ids=s.cells.flatMap(c=>[...c.stockIds,...(c.unit?[c.unit.id]:[])]).concat(s.completedUnits.map(u=>u.id));
  assert.equal(ids.length,12);assert.equal(new Set(ids).size,12);
  const c=s.cells[1];
  if(c.phase==='feeding'&&c.stage.progress<.15){
   const p=getPresentation(c,product.id),r=getRawStock(c,product);
   assert.equal(p.x,RAW_PILE_X[r.pile]);assert.ok(Math.abs(p.y+.21-r.planeY)<1e-8);
   assert.equal(r.counts.reduce((n,x)=>n+x,0),c.queue);
   picked.set(c.unit.id,r.pile);
  }
 }
 assert.equal(sim.snapshot.done,12);assert.equal(picked.size,12);
 assert.deepEqual([...new Set(picked.values())].sort(),[0,1,2,3]);
 for(const unit of sim.snapshot.completedUnits){
  const raw=unit.history.filter(h=>h.environment==='raw').map(h=>h.step);
  assert.deepEqual(raw,['locate','raise','retrieve','lower']);
  assert.equal(unit.history.filter(h=>h.step==='handles').length,1);
  assert.equal(unit.history.find(h=>h.step==='handles').environment,'finishing');
 }
});

test('pause and emergency retain the magnetic pickup position and exact pile counts',()=>{
 for(const stage of ['feed','locate','raise','retrieve','lower']){
  const sim=createSimulation(8,{scope:'bench',environment:'raw'});sim.start();
  for(let i=0;i<2000;i++){sim.step(.025);if(sim.snapshot.cells[1].stage?.id===stage&&sim.snapshot.cells[1].stage.progress>.2)break;}
  assert.equal(sim.snapshot.cells[1].stage?.id,stage);
  const before=sim.snapshot.cells[1],p=getPresentation(before);
  sim.stop();for(let i=0;i<20;i++)sim.step(.05);
  assert.deepEqual(getPresentation(sim.snapshot.cells[1]),p);assert.deepEqual(sim.snapshot.cells[1].stockIds,before.stockIds);
  sim.emergencyStop();for(let i=0;i<20;i++)sim.step(.05);
  assert.deepEqual(getPresentation(sim.snapshot.cells[1]),p);
 }
});

test('polish pose completes two turns before handle assembly and pauses deterministically',()=>{
 const sim=createSimulation(1,{scope:'bench',environment:'finishing'});sim.start();let angle=0,assembly=false;
 for(let i=0;i<2000&&!sim.snapshot.done;i++){
  sim.step(.025);const c=sim.snapshot.cells[3],p=getPresentation(c);
  if(p.step==='polish'){assert.ok(p.polishAngle>=angle);angle=p.polishAngle;}
  if(p.step==='handles'){
   assembly=true;assert.equal(p.polishAngle,4*Math.PI);assert.equal(p.polishContact,0);assert.equal(p.fixation,1);
   sim.stop();const before=getPresentation(sim.snapshot.cells[3]);sim.step(.5);assert.deepEqual(getPresentation(sim.snapshot.cells[3]),before);sim.start();
  }
 }
 assert.equal(assembly,true);assert.equal(sim.snapshot.done,1);
});

test('raw lower/unload and finishing polish/handles boundaries keep the workpiece continuous',()=>{
 for(const product of PRODUCTS){
  const make=(id,step,t,phase='processing',progress=.5)=>getPresentation({id,phase,progress,queue:0,stockIds:[],unit:{id:'UT-001',product:product.id,material:id==='raw'?'sorted-disc':'polished-pot'},stage:{id:step,progress:t}},product.id);
  const rawEnd=make('raw','lower',1),unloading=make('raw','transfer',0,'unloading');
  for(const key of ['x','y','z','support','forkZ','forkLift'])assert.ok(Math.abs(rawEnd[key]-unloading[key])<1e-8,`${product.id} raw ${key}`);
  const polished=make('finishing','polish',1),mounting=make('finishing','handles',0);
  for(const key of ['x','y','z','support','polishAngle','fixation','polishContact'])assert.ok(Math.abs(polished[key]-mounting[key])<1e-8,`${product.id} finishing ${key}`);
 }
});

const loaderAudit=(()=>{
 const sim=createSimulation(8,{scope:'bench',environment:'raw'});const initial=getPresentation(sim.snapshot.cells[1]);sim.start();let previous=initial,max=0;
 for(let i=0;i<12000&&sim.snapshot.done<8;i++){
  sim.step(.025);const p=getPresentation(sim.snapshot.cells[1]);
  if(previous)max=Math.max(max,Math.hypot(p.loaderX-previous.loaderX,p.loaderY-previous.loaderY,p.loaderZ-previous.loaderZ));
  previous=p;
 }
 assert.equal(sim.snapshot.done,8);
 return max;
})();
test('empty magnetic loader repositions continuously between consecutive pile pickups',()=>assert.ok(loaderAudit<.2,`loader moved ${loaderAudit} units in one 25 ms tick`));
