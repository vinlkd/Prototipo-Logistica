import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PRODUCTS} from '../src/simulator/products.js';
import {buildWorkstation,updateWorkstation} from '../src/simulator/workstations.js';

function fixture(id,product) {
  const root=new THREE.Group(),owned=[];
  const m=Object.fromEntries(['blue','steel','dark','yellow'].map(name=>[name,new THREE.MeshStandardMaterial({color:'#567890'})]));
  const box=(group,x,y,z,w,h,d,material=m.blue)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);group.add(mesh);return mesh;};
  const cyl=(group,x,y,z,r,h,material=m.steel)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24),material);mesh.position.set(x,y,z);group.add(mesh);return mesh;};
  const bar=(group,a,b,r,material=m.steel)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);const mesh=cyl(group,...av.clone().add(bv).multiplyScalar(.5).toArray(),r,delta.length(),material);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return mesh;};
  const layout={conveyorTop:1.195,clearance:.012,yaw:Math.PI/2,potBottom:-.18,
    footprint:{minX:-product.rim,maxX:product.rim,minZ:-(product.rim+(product.handles==='long'?.97:.32)),maxZ:product.rim+(product.handles==='double'?.32:0)},
    package:{width:2*product.rim+.2,depth:2*product.rim+1.2,height:product.height+.4,centerZ:0}};
  const model=buildWorkstation({id,root,THREE,box,cyl,bar,m,product,layout});
  const origin=layout.conveyorTop+layout.clearance-layout.potBottom;
  return {model,root,product,layout,origin,update(pose,cell={},extra={}) {
    updateWorkstation(model,{pose:{step:'polish',t:.5,x:0,z:0,y:origin,...pose},cell:{part:true,phase:'processing',unit:{id:'UT-001'},outputs:{work:true},...cell},dt:.05,running:true,product,layout,...extra});
    root.updateMatrixWorld(true);
  },dispose(){model?.dispose();root.traverse(o=>o.geometry?.dispose());for(const material of Object.values(m))material.dispose();}};
}

test('não constrói estações para outros ambientes',()=>{
  assert.equal(buildWorkstation({id:'production'}),null);
  assert.equal(buildWorkstation({id:'packing'}),null);
});

for(const product of PRODUCTS) {
  test(`${product.name}: apoio alinhado ao fundo, garras recolhidas e suportes fora do corredor`,()=>{
    for(const id of ['finishing','quality']) {
      const f=fixture(id,product);
      try {
        assert.ok(f.model.supportBounds.rearMinZ>f.layout.footprint.maxZ);
        const seatTop=f.model.cradle.position.y+.009;
        assert.ok(Math.abs(seatTop-f.layout.conveyorTop)<1e-9);
        assert.ok(Math.abs(f.origin+f.layout.potBottom-seatTop-f.layout.clearance)<1e-9);
        f.update({step:'feed',t:.4},{phase:'feeding'});
        for(const jaw of f.model.jaws)assert.ok(Math.abs(jaw.slide.position.x)-.045>f.layout.footprint.maxX);
      } finally {f.dispose();}
    }
  });

  test(`${product.name}: rebolo faz contato tangente e recolhe antes da transferência`,()=>{
    const f=fixture('finishing',product);
    try {
      f.update({step:'polish',t:.5,polishContact:1,fixation:1});
      const tool=f.model.finishing;
      assert.equal(tool.active,true);
      assert.ok(Math.abs(tool.tool.position.x-tool.contactX)<1e-9);
      assert.ok(tool.tool.position.y-tool.radius>f.origin+f.layout.potBottom);
      for(const jaw of f.model.jaws)assert.ok(Math.abs(Math.abs(jaw.slide.position.x)-jaw.closedX)<1e-9);
      const wheelAngle=tool.wheel.rotation.z;
      f.update({step:'polish',t:.5,polishContact:1},{},{running:false});
      assert.equal(tool.wheel.rotation.z,wheelAngle);
      f.update({step:'transfer',t:.3,polishContact:1,fixation:1},{phase:'unloading'});
      assert.equal(tool.active,false);
      assert.ok(tool.tool.position.x-tool.radius>f.layout.footprint.maxX);
      for(const jaw of f.model.jaws)assert.equal(Math.abs(jaw.slide.position.x),jaw.openX);
    } finally {f.dispose();}
  });

  test(`${product.name}: sondas só descem depois de entrar por cima e recolhem antes da saída`,()=>{
    const f=fixture('quality',product);
    try {
      for(const amount of [0,.1,.25,.39,.4,.6,1,.7,.3,0]) {
        f.update({step:'scan',t:.5,inspectionProbe:amount});
        const q=f.model.quality;
        if(q.travel<1) {
          assert.equal(q.extension,0);
          assert.ok(q.depthTip.position.y>f.origin+product.height+.3);
        }
        if(q.extension>0)assert.equal(q.carriage.position.z,0);
        assert.ok(q.depthTip.position.y>=f.origin+f.layout.potBottom+.017);
      }
      f.update({step:'check',t:.5,inspectionProbe:1});
      assert.ok(f.model.panel.lines.some(line=>line.includes(`${Number.parseFloat(product.size)*10}.0 mm`)));
      assert.ok(f.model.panel.lines.at(-1).includes('didática'));
      f.update({step:'approve',t:.5,inspectionProbe:0});
      assert.equal(f.model.panel.status,'approved');
      f.update({step:'transfer',t:.1,inspectionProbe:1},{phase:'unloading'});
      assert.equal(f.model.quality.extension,0);
      assert.equal(f.model.quality.travel,0);
    } finally {f.dispose();}
  });
}
