export function buildLiftSupport({root,box,cyl,m,layout}){
 const top=layout.conveyorTop,mastZ=1.95;
 box(root,0,.045,mastZ,2.1,.09,.36,m.blue);
 for(const x of [-.87,.87]){box(root,x,.035,mastZ,.32,.07,.48,m.steel);box(root,x,2.12,mastZ+.085,.045,4.2,.035,m.steel);}
 const crossbar=box(root,0,top-.105,mastZ,1.96,.18,.27,m.blue);
 const guides=[];
 for(const x of [-.15,.15])guides.push(box(root,x,top-.105,1,.1,.07,1,m.steel));
 const piston=cyl(root,-.7,.6,mastZ,.04,1,m.steel);
 return {crossbar,guides,piston,top,mastZ,layout};
}
export function updateLiftSupport(model,pose){
 const y=model.top+pose.forkLift-.105,end=pose.forkZ+model.layout.package.centerZ+model.layout.package.depth/2+.05;
 model.crossbar.position.y=y;
 for(const guide of model.guides){guide.position.y=y;guide.position.z=(model.mastZ+end)/2;guide.scale.z=model.mastZ-end;}
 model.piston.position.y=(.12+y)/2;model.piston.scale.y=y-.12;
}
