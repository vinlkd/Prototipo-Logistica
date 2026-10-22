import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PRODUCTS} from '../src/simulator/products.js';
import {getLayout} from '../src/simulator/kinematics.js';
import {buildHandleAssembler,updateHandleAssembler} from '../src/simulator/handle-assembler.js';

function fixture(product){
 const root=new THREE.Group(),m=Object.fromEntries(['steel','blue','dark','yellow'].map(k=>[k,new THREE.MeshStandardMaterial()]));
 const box=(g,x,y,z,w,h,d,material)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);o.position.set(x,y,z);g.add(o);return o;};
 const cyl=(g,x,y,z,r,h,material=m.steel)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24),material);o.position.set(x,y,z);g.add(o);return o;};
 const bar=(g,a,b,r,material=m.steel)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av),o=cyl(g,...av.clone().add(bv).multiplyScalar(.5).toArray(),r,d.length(),material);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;};
 const handles=new THREE.Group(),r=product.rim,h=product.height;
 if(product.handles==='long'){
  box(handles,r+.13,h-.07,0,.28,.065,.13,m.steel);
  box(handles,r+.61,h-.03,0,.72,.12,.19,m.dark).rotation.z=.07;
 }else for(const side of [-1,1]){
  bar(handles,[side*r,h-.1,-.16],[side*(r+.27),h-.04,-.16],.045);
  bar(handles,[side*(r+.27),h-.04,-.16],[side*(r+.27),h-.04,.16],.05,m.dark);
  bar(handles,[side*(r+.27),h-.04,.16],[side*r,h-.1,.16],.045);
 }
 const layout=getLayout(product.id),y=layout.conveyorTop+layout.clearance-layout.potBottom;
 const model=buildHandleAssembler({root,THREE,box,cyl,bar,m,product,layout,handles});
 return{model,root,y,update(t,extra={}){updateHandleAssembler(model,{pose:{step:'handles',t,x:0,y,z:0,...extra.pose},cell:{part:true,phase:'processing',...extra.cell},product,layout});root.updateMatrixWorld(true);},dispose(){model.dispose();root.traverse(o=>o.geometry?.dispose());for(const material of Object.values(m))material.dispose();}};
}
for(const product of PRODUCTS){
 test(`${product.name}: cabo real repousa no alimentador e mantém escala integral`,()=>{
  const f=fixture(product);try{
   f.root.updateMatrixWorld(true);
   const b=new THREE.Box3().setFromObject(f.model.handles);
   assert.ok(Math.abs(b.min.y-f.model.seatTop)<1e-7);
   assert.equal(f.model.handles.parent,f.model.carrier);
   for(const t of [0,.1,.25,.42,.65,.75,.88,1]){f.update(t);assert.deepEqual(f.model.handles.scale.toArray(),[1,1,1]);}
  }finally{f.dispose();}
 });
 test(`${product.name}: trajeto é contínuo e só cruza colunas com X centralizado e cabo acima do aro`,()=>{
  const f=fixture(product);try{
   for(const boundary of [.1,.25,.42,.65,.75,.88,.90,.96]){
    f.update(boundary-1e-6);const a=f.model.carrier.position.clone(),ga=f.model.gripper.position.clone();
    f.update(boundary+1e-6);assert.ok(a.distanceTo(f.model.carrier.position)<.001);assert.ok(ga.distanceTo(f.model.gripper.position)<.001);
   }
   for(const t of [.43,.5,.6,.65]){
    f.update(t);assert.ok(Math.abs(f.model.carrier.position.x)<1e-9);
    assert.ok(new THREE.Box3().setFromObject(f.model.handles).min.y>=f.y+product.height+.039);
   }
   f.update(0);const home=f.model.carrier.position.clone();
   f.update(0,{pose:{step:'draw'}});assert.deepEqual(f.model.carrier.position.toArray(),home.toArray());
  }finally{f.dispose();}
 });
 test(`${product.name}: encaixe final e pausa preservam posição sem teleporte para saída`,()=>{
  const f=fixture(product);try{
   f.update(.8);const carrier=f.model.carrier.position.clone(),gripper=f.model.gripper.position.clone();
   f.update(.8);assert.deepEqual(f.model.carrier.position.toArray(),carrier.toArray());assert.deepEqual(f.model.gripper.position.toArray(),gripper.toArray());
   assert.equal(f.model.tools.every(t=>t.driver.visible),true);
   f.update(1);assert.equal(f.model.mounted,true);const end=f.model.carrier.position.clone(),g=f.model.gripper.position.clone();
   f.update(0,{cell:{phase:'unloading'},pose:{step:'transfer'}});assert.deepEqual(f.model.carrier.position.toArray(),end.toArray());assert.deepEqual(f.model.gripper.position.toArray(),g.toArray());
   assert.equal(f.model.tools.every(t=>!t.driver.visible),true);
  }finally{f.dispose();}
 });
}
