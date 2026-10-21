import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation} from '../src/simulator/simulation.js';
import {PRODUCTS} from '../src/simulator/products.js';
test('chosen cookware model belongs to each unit and survives the whole logistics line',()=>{
 for(const product of PRODUCTS){
  const s=createSimulation(1,{product:product.id});s.setSpeed(4);s.start();
  for(let i=0;i<3000&&!s.snapshot.done;i++)s.step(.1);
  assert.equal(s.snapshot.completedUnits[0].product,product.id);
  assert.ok(s.snapshot.completedUnits[0].history.some(h=>h.step==='handles'));
 }
});
test('changing cookware prepares a clean batch instead of altering a part mid-process',()=>{
 const s=createSimulation(2,{scope:'bench',environment:'production'});s.start();s.step(.3);
 assert.equal(s.setProduct('casserole'),true);const state=s.snapshot;
 assert.equal(state.running,false);assert.equal(state.cells[2].part,false);assert.equal(state.cells[2].queue,2);
 assert.equal(state.product,'casserole');assert.equal(s.setProduct('unknown'),false);
});
