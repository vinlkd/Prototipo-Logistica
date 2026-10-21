import {getProduct} from './products.js';
export const CONVEYOR_TOP=1.195, CLEARANCE=.012, POT_BOTTOM=-.18, YAW=Math.PI/2;
export const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function getLayout(id){
 const product=getProduct(id),r=product.rim;
 const footprint={minX:-r-.02,maxX:r+.02,minZ:product.handles==='long'?-r-1.01:-r-.33,maxZ:product.handles==='long'?r+.02:r+.33};
 const packageSize={width:footprint.maxX-footprint.minX+.24,depth:footprint.maxZ-footprint.minZ+.24,height:Math.max(.5,product.height+.18+.19),centerZ:(footprint.minZ+footprint.maxZ)/2};
 return {conveyorTop:CONVEYOR_TOP,clearance:CLEARANCE,potBottom:POT_BOTTOM,yaw:YAW,footprint,package:packageSize,opening:{halfWidth:packageSize.width/2+.34,minZ:packageSize.centerZ-packageSize.depth/2-.35,maxZ:packageSize.centerZ+packageSize.depth/2+.35,height:CONVEYOR_TOP+packageSize.height+.65}};
}
export function boundsForPose(pose,productId){
 const layout=getLayout(productId),pkg=layout.package;
 if(pose.isBox)return {minX:pose.x-pkg.width/2,maxX:pose.x+pkg.width/2,minY:pose.support+CLEARANCE,maxY:pose.support+CLEARANCE+pkg.height,minZ:pose.z+pkg.centerZ-pkg.depth/2,maxZ:pose.z+pkg.centerZ+pkg.depth/2};
 const f=pose.form,fp=f>.99?layout.footprint:{minX:-.62,maxX:.62,minZ:-.62,maxZ:.62};
 return {minX:pose.x+fp.minX,maxX:pose.x+fp.maxX,minY:pose.y+.21-.39*f,maxY:pose.y+.21+(getProduct(productId).height-.21)*f,minZ:pose.z+fp.minZ,maxZ:pose.z+fp.maxZ};
}
export function overlaps(a,b,margin=0){return a.minX<b.maxX-margin&&a.maxX>b.minX+margin&&a.minY<b.maxY-margin&&a.maxY>b.minY+margin&&a.minZ<b.maxZ-margin&&a.maxZ>b.minZ+margin;}
export function sweptBounds(a,b){return Object.fromEntries(['X','Y','Z'].flatMap(axis=>[[`min${axis}`,Math.min(a[`min${axis}`],b[`min${axis}`])],[`max${axis}`,Math.max(a[`max${axis}`],b[`max${axis}`])]]));}
