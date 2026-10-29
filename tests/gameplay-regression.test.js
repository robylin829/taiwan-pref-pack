import test from 'node:test';
import assert from 'node:assert/strict';
import {counties} from '../src/counties.js';
import {regions} from '../src/model.js';
import {pieceScale,polygonArea,shakeablePieces} from '../src/geometry-scale.js';

const displayedArea=rings=>rings.reduce((sum,r)=>{
  const p=r[0];return sum+polygonArea(r.map(q=>[q[0]-p[0],q[1]-p[1]]));
},0)*pieceScale(rings)**2;
test('adding a county never shrinks the total displayed area, including completing a region',()=>{
  for(const region of regions){
    let rings=[],previous=0;
    for(const id of region.ids){
      const next=counties.find(c=>c.id===id).points;
      const single=displayedArea([next]);rings.push(next);
      const merged=displayedArea(rings);
      assert.ok(merged>=previous+single-.001,`${region.name} must retain both inputs' area`);
      previous=merged;
    }
  }
});
test('shaking excludes new falling pieces and includes settled pieces',()=>{
  const falling={born:0,enteredBox:false},fresh={born:900,enteredBox:true},settled={born:0,enteredBox:true};
  assert.deepEqual(shakeablePieces([falling,fresh,settled],1000),[settled]);
  assert.deepEqual(shakeablePieces([falling,fresh,settled],1600),[fresh,settled]);
});
