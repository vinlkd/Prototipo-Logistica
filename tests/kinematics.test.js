import test from 'node:test';
import assert from 'node:assert/strict';
import {PRODUCTS} from '../src/simulator/products.js';
import {getLayout,boundsForPose,overlaps,CONVEYOR_TOP,CLEARANCE,YAW} from '../src/simulator/kinematics.js';
import {getPresentation} from '../src/simulator/presentation.js';

const near=(a,b,message='')=>assert.ok(Math.abs(a-b)<1e-8,`${message}: ${a} versus ${b}`);
function cell(product,id,step,t,extra={}) {
  return {id,phase:'processing',progress:.5,done:0,unit:{id:'UT-001',product:product.id,material:id==='raw'?'checked-disc':id==='production'?'formed-pot':'boxed-pot'},stage:{id:step,progress:t},...extra};
}
const pose=(product,id,step,t,extra)=>getPresentation(cell(product,id,step,t,extra),product.id);

test('ângulo do produto mantém cabo perpendicular à direção do transporte',()=>near(YAW,Math.PI/2));

for(const product of PRODUCTS) {
  test(`${product.name}: embalagem inclui corpo e cabos com folga em todos os lados`,()=>{
    const l=getLayout(product.id),p=l.package,f=l.footprint;
    near(l.yaw,Math.PI/2);
    assert.ok(-p.width/2<=f.minX-.119);
    assert.ok(p.width/2>=f.maxX+.119);
    assert.ok(p.centerZ-p.depth/2<=f.minZ-.119);
    assert.ok(p.centerZ+p.depth/2>=f.maxZ+.119);
    assert.ok(p.height>=product.height-l.potBottom+.189);
    assert.ok(l.opening.minZ<p.centerZ-p.depth/2);
    assert.ok(l.opening.maxZ>p.centerZ+p.depth/2);
  });

  test(`${product.name}: disco e panela mantêm fundo na superfície de apoio durante a conformação`,()=>{
    for(const t of [0,.05,.25,.5,.75,.95,1]) {
      const p=pose(product,'production','draw',t,{unit:{product:product.id,material:'sorted-disc'}});
      near(p.y+.21-.39*p.form,p.support+CLEARANCE,'datum do fundo');
      near(boundsForPose(p,product.id).minY,p.support+CLEARANCE,'limite inferior');
      assert.ok(p.support<=CONVEYOR_TOP+1e-8);
    }
    const flat=pose(product,'production','down',1,{unit:{product:product.id,material:'sorted-disc'}});
    near(flat.form,0);near(flat.y+.21,CONVEYOR_TOP+CLEARANCE);
    const formed=pose(product,'production','handles',.5);
    near(formed.form,1);near(formed.y-.18,CONVEYOR_TOP+CLEARANCE);
  });

  test(`${product.name}: produção retorna punção e ejeta antes da montagem dos cabos`,()=>{
    for(const [a,b] of [['draw','up'],['up','eject'],['eject','handles']]) {
      const end=pose(product,'production',a,1),start=pose(product,'production',b,0);
      for(const key of ['x','y','z','support','headY'])near(end[key],start[key],`${a}/${b} ${key}`);
    }
  });

  for(const id of ['raw','finished'])test(`${product.name}: ${id} conserva posição e apoio nas fronteiras de armazenar e recuperar`,()=>{
    for(const [a,b] of [['raise','store'],['store','retrieve'],['retrieve','lower']]) {
      const end=pose(product,id,a,1),start=pose(product,id,b,0);
      for(const key of ['x','y','z','support','forkZ','forkLift'])near(end[key],start[key],`${id} ${a}/${b} ${key}`);
    }
    const onShelf=pose(product,id,'store',1),underPart=pose(product,id,'retrieve',.45);
    near(onShelf.z,-3.6);near(onShelf.lift,1.6);
    near(underPart.z,onShelf.z);near(underPart.lift,onShelf.lift);
    const p=pose(product,id,'lower',1);
    near(p.support,CONVEYOR_TOP);near(p.z,0);
  });

  test(`${product.name}: doze caixas usam três níveis e quatro posições sem sobreposição de carga ou trajetória`,()=>{
    const finals=[];
    for(let done=0;done<12;done++) {
      const end=pose(product,'shipping','transfer',1,{done,phase:'unloading',progress:1});
      const bounds=boundsForPose(end,product.id);
      for(const previous of finals)assert.equal(overlaps(bounds,previous),false,`caixa ${done} sobre caixa anterior`);
      for(let i=0;i<=100;i++) {
        const progress=.9+.1*i/100;
        const moving=pose(product,'shipping','transfer',i/100,{done,phase:'unloading',progress});
        for(const previous of finals)assert.equal(overlaps(boundsForPose(moving,product.id),previous,.000001),false,`trajeto caixa ${done}, amostra ${i}`);
      }
      finals.push(bounds);
    }
    assert.equal(new Set(finals.map(b=>b.minX.toFixed(6))).size,4);
    assert.equal(new Set(finals.map(b=>b.minY.toFixed(6))).size,3);
    const lastPose=pose(product,'shipping','transfer',0,{phase:'unloading',progress:.9,done:11});
    near(lastPose.x,3.48);near(lastPose.support,CONVEYOR_TOP);
  });

  test(`${product.name}: poses são determinísticas e não alteram o estado pausado`,()=>{
    for(const id of ['production','raw','finished','shipping','finishing','quality']) {
      const source=cell(product,id,id==='quality'?'check':id==='finishing'?'polish':id==='raw'||id==='finished'?'retrieve':'up',.53);
      const before=JSON.stringify(source),a=getPresentation(source,product.id),b=getPresentation(source,product.id);
      assert.deepEqual(a,b);assert.equal(JSON.stringify(source),before);
      for(const [key,value] of Object.entries(a))if(typeof value==='number')assert.ok(Number.isFinite(value),`${id}.${key}`);
    }
  });
}
