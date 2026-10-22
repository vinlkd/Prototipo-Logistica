import {getLayout} from './kinematics.js';

export const RAW_PILE_X=Object.freeze([-2.8,-4.55,2.8,4.55]);
const ordinal=id=>{const match=/^UT-(\d+)$/.exec(id??'');return match?Math.max(1,Number(match[1])):1;};
const pileFor=id=>(ordinal(id)-1)%RAW_PILE_X.length;
const remainingIds=cell=>Array.isArray(cell.stockIds)?cell.stockIds:Array.from({length:Math.max(0,cell.queue??0)},(_,i)=>`UT-${ordinal(cell.unit?.id)+i+(cell.unit?1:0)}`);

export function getRawStock(cell,product='saucepan'){
  const productId=typeof product==='string'?product:product.id;
  const active=cell.unit?.id;
  // Snapshots provide the exact remaining IDs. The fallback only serves small
  // standalone pose previews that omit stockIds; engine snapshots always include it.
  const ids=remainingIds(cell);
  const counts=[0,0,0,0];for(const id of ids)counts[pileFor(id)]++;
  const pile=pileFor(active??ids[0]??cell.lastUnitId);
  return {pile,pickupX:RAW_PILE_X[pile],pickupZ:-3.6+getLayout(productId).package.centerZ,
    planeY:.8545+counts[pile]*.026+.0125,counts};
}

// The empty collector prepares the next pickup while the current disk travels
// on the forks. Remove that future active disk virtually to find its top plane.
export function getNextRawPickup(cell,product='saucepan'){
  const ids=remainingIds(cell),next=ids[0];
  return getRawStock({unit:{id:next??cell.unit?.id??cell.lastUnitId??'UT-001'},
    stockIds:next?ids.slice(1):[],queue:Math.max(0,ids.length-1)},product);
}
