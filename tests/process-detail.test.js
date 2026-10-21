import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,ENVIRONMENTS} from '../src/simulator/simulation.js';
import {getPresentation} from '../src/simulator/presentation.js';

test('a prensa posiciona, fixa, conforma, retorna e só então libera a mesma unidade',()=>{
  const sim=createSimulation(1,{scope:'bench',environment:'production'});sim.start();
  const order=[];let gradual=false;
  for(let i=0;i<800;i++){
    sim.step(.025);const c=sim.snapshot.cells[2],pose=getPresentation(c);
    if(c.stage&&order.at(-1)!==c.stage.id)order.push(c.stage.id);
    if(c.phase==='processing')assert.equal(c.outputs.motor,false);
    if(c.stage?.id==='down')assert.equal(pose.form,0);
    if(c.stage?.id==='draw'&&pose.form>.2&&pose.form<.8)gradual=true;
    if(c.stage?.id==='up')assert.equal(pose.form,1);
    if(sim.snapshot.done)break;
  }
  assert.deepEqual(order,['feed','clamp','down','draw','up','eject','handles','transfer']);assert.equal(gradual,true);
  assert.equal(sim.snapshot.completedUnits[0].id,'UT-001');assert.equal(sim.snapshot.completedUnits[0].material,'formed-pot');
});
test('a emergência preserva também a forma intermediária da peça',()=>{
  const sim=createSimulation(1,{scope:'bench',environment:'production'});sim.start();
  while(sim.snapshot.cells[2].stage?.id!=='draw')sim.step(.025);
  sim.step(.2);const before=getPresentation(sim.snapshot.cells[2]);sim.emergencyStop();
  for(let i=0;i<80;i++)sim.step(.05);
  const after=getPresentation(sim.snapshot.cells[2]);assert.equal(after.form,before.form);assert.equal(after.head,before.head);
  sim.acknowledge();sim.start();sim.step(.2);assert.ok(getPresentation(sim.snapshot.cells[2]).form>before.form);
});
test('cada panela conserva o identificador e todo o histórico até a expedição',()=>{
  const sim=createSimulation(2);sim.setSpeed(4);sim.start();
  for(let i=0;i<2000&&sim.snapshot.done<2;i++)sim.step(.05);
  const result=sim.snapshot;assert.equal(result.done,2);assert.deepEqual(result.completedUnits.map(u=>u.id),['UT-001','UT-002']);
  const expected=ENVIRONMENTS.flatMap(e=>e.recipe.map(s=>`${e.id}:${s.id}`));
  for(const unit of result.completedUnits){assert.equal(unit.material,'shipped-box');assert.deepEqual(unit.history.map(h=>`${h.environment}:${h.step}`),expected);}
});
test('a caixa levanta as laterais antes de fechar abas e aplicar a fita',()=>{
  const sim=createSimulation(1,{scope:'bench',environment:'packing'});sim.start();let folding=false,sealing=false;
  for(let i=0;i<800;i++){
    sim.step(.025);const c=sim.snapshot.cells[5],pose=getPresentation(c);
    if(c.stage?.id==='carton'){assert.equal(pose.flaps,0);assert.equal(pose.tape,0);if(pose.walls>.2&&pose.walls<.8)folding=true;}
    if(c.stage?.id==='close'){assert.equal(pose.walls,1);assert.equal(pose.tape,0);}
    if(c.stage?.id==='label'){assert.equal(pose.flaps,1);if(pose.tape>.2&&pose.tape<.8)sealing=true;}
    if(sim.snapshot.done)break;
  }
  assert.equal(folding,true);assert.equal(sealing,true);assert.equal(sim.snapshot.completedUnits[0].material,'boxed-pot');
});
