export function polygonArea(ring) {
  return Math.abs(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1]},0))/2;
}

// Merge by displayed area, rather than squeezing every shape into a fixed box.
// Center before measuring to avoid cancellation for geographic coordinates.
export function pieceScale(rings) {
  let targetArea=0, sourceArea=0;
  for(const ring of rings){
    const origin=ring[0],local=ring.map(p=>[p[0]-origin[0],p[1]-origin[1]]);
    const xs=local.map(p=>p[0]),ys=local.map(p=>p[1]);
    const extent=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
    const area=polygonArea(local);
    targetArea+=area*(62/extent)**2;
    sourceArea+=area;
  }
  return Math.sqrt(targetArea/sourceArea)*(rings.length>1?1.15:1);
}

export const shakeablePieces=(pieces,now)=>pieces.filter(p=>p.enteredBox&&now-p.born>=600);
