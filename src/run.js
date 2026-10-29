export const drawCounty = queue => queue.shift() ?? null;
export const collisionHull = hull => hull.map(p=>({x:p.x*.9,y:p.y*.9}));

// Migrate older endless-bag saves while preserving every distinct placed county.
export function restoreRun(saved, allIds) {
  if(!saved || ![1,2].includes(saved.version) || !Array.isArray(saved.pieces))return null;
  const valid=new Set(allIds),used=new Set();
  const pieces=[];
  for(const piece of saved.pieces){
    if(!Array.isArray(piece.ids)||!Number.isFinite(piece.x)||!Number.isFinite(piece.y))return null;
    const ids=piece.ids.filter(id=>{if(!valid.has(id)||used.has(id))return false;used.add(id);return true});
    if(ids.length)pieces.push({...piece,ids,angle:Number.isFinite(piece.angle)?piece.angle:0});
  }
  const queue=[saved.current,saved.next,...(Array.isArray(saved.bag)?saved.bag:[]),...allIds].filter(id=>{
    if(!valid.has(id)||used.has(id))return false;used.add(id);return true;
  });
  const current=drawCounty(queue),next=drawCounty(queue);
  return {...saved,version:2,pieces,current,next,bag:queue,dropNumber:pieces.reduce((n,p)=>n+p.ids.length,0),pendingAngle:saved.pendingAngle||0};
}
