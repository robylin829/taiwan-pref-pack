import test from 'node:test';
import assert from 'node:assert/strict';
import {counties} from '../src/counties.js';
import {regions} from '../src/model.js';
import {pieceScale,polygonArea,shakeablePieces} from '../src/geometry-scale.js';

const displayedArea=rings=>rings.reduce((sum,r)=>{
  const p=r[0];return sum+polygonArea(r.map(q=>[q[0]-p[0],q[1]-p[1]]));
},0)*pieceScale(rings)**2;
test('single counties are large, and merging compacts their combined displayed area',()=>{
  for(const region of regions){
    let rings=[],individualArea=0;
    for(const id of region.ids){
      const next=counties.find(c=>c.id===id).points;
      const single=displayedArea([next]);rings.push(next);
      individualArea+=single;
      const merged=displayedArea(rings);
      if(rings.length>1)assert.ok(Math.abs(merged/individualArea-.72**2)<.00001,`${region.name} should pack down after merging`);
      const xs=next.map(p=>p[0]),ys=next.map(p=>p[1]);
      const extent=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
      assert.ok(Math.abs(extent*pieceScale([next])-84)<.001);
    }
  }
});
test('shaking excludes new falling pieces and includes settled pieces',()=>{
  const falling={born:0,enteredBox:false},fresh={born:900,enteredBox:true},settled={born:0,enteredBox:true};
  assert.deepEqual(shakeablePieces([falling,fresh,settled],1000),[settled]);
  assert.deepEqual(shakeablePieces([falling,fresh,settled],1600),[fresh,settled]);
});
