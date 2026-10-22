export function buildLiftSupport({root,box,cyl,m,layout}){
 const top=layout.conveyorTop,mastZ=1.95;
 const base=box(root,0,.095,mastZ,2.1,.05,.36,m.blue);base.name='Travessa sobre sapatas';
 const feet=[];
 for(const x of [-.87,.87]){const foot=box(root,x,.035,mastZ,.32,.07,.48,m.steel);foot.name='Sapata do elevador';feet.push(foot);box(root,x,2.17,mastZ+.085,.045,4.1,.035,m.steel);}
 const crossbar=box(root,0,top-.105,mastZ,1.96,.18,.27,m.blue);
 const guides=[];
 for(const x of [-.15,.15])guides.push(box(root,x,top-.105,1,.1,.07,1,m.steel));
 const housing=cyl(root,-.7,.385,mastZ,.07,.53,m.steel);housing.name='Corpo do atuador do elevador';
 const piston=cyl(root,-.7,.825,mastZ,.04,1,m.steel);
 return {base,feet,housing,crossbar,guides,piston,top,mastZ,layout};
}
export function updateLiftSupport(model,pose){
 const y=model.top+pose.forkLift-.105,end=pose.forkZ+model.layout.package.centerZ+model.layout.package.depth/2+.05;
 model.crossbar.position.y=y;
 for(const guide of model.guides){guide.position.y=y;guide.position.z=(model.mastZ+end)/2;guide.scale.z=model.mastZ-end;}
 const rodTop=y-.09;model.piston.position.y=(.65+rodTop)/2;model.piston.scale.y=Math.max(.001,rodTop-.65);
}
