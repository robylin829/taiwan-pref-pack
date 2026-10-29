// Find an interior label anchor, preferring wide, roomy parts of each county.
export function countyLabelAnchors(polygons) {
  return polygons.map((ring, index) => {
    const xs = ring.map(p => p.x), ys = ring.map(p => p.y);
    const left = Math.min(...xs), right = Math.max(...xs);
    const top = Math.min(...ys), bottom = Math.max(...ys);
    let best = {x: (left + right) / 2, y: (top + bottom) / 2}, clearance = -1;
    for (let row = 1; row < 10; row++) for (let col = 1; col < 10; col++) {
      const x = left + (right - left) * col / 10, y = top + (bottom - top) * row / 10;
      let inside = false, distance = Infinity;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[j], b = ring[i];
        if ((a.y > y) !== (b.y > y) && x < (b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x) inside = !inside;
        const dx = b.x-a.x, dy = b.y-a.y;
        const t = Math.max(0, Math.min(1, ((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy || 1)));
        distance = Math.min(distance, Math.hypot(x-a.x-t*dx, y-a.y-t*dy));
      }
      if (inside && distance > clearance) { best = {x,y}; clearance = distance; }
    }
    const area = Math.abs(ring.reduce((sum,p,i) => {const q=ring[(i+1)%ring.length];return sum+p.x*q.y-q.x*p.y;},0))/2;
    return {...best,index,area,width:right-left,height:bottom-top};
  });
}

export function visibleCountyLabels(anchors, angle, measure, single = false) {
  const result = [], cos = Math.cos(angle), sin = Math.sin(angle);
  for (const anchor of [...anchors].sort((a,b) => b.area-a.area)) {
    const width = measure(anchor.index) + 6, height = 16;
    if (!single && (anchor.width < width * .7 || anchor.height < height)) continue;
    const label = {...anchor,x:anchor.x*cos-anchor.y*sin,y:anchor.x*sin+anchor.y*cos,width,height};
    if (result.some(other => Math.abs(other.x-label.x)<(other.width+width)/2+3 && Math.abs(other.y-label.y)<(other.height+height)/2+3)) continue;
    result.push(label);
  }
  return result;
}
