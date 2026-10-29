import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import {drawCounty,restoreRun,collisionHull} from '../src/run.js';
import {shuffledBag,regions} from '../src/model.js';
const allIds=regions.flatMap(r=>r.ids);
test('a run ends its supply after exactly 22 distinct drops and never refills',()=>{
  const bag=shuffledBag(),drawn=[];
  for(let i=0;i<22;i++)drawn.push(drawCounty(bag));
  assert.equal(new Set(drawn).size,22);
  for(let i=0;i<5;i++)assert.equal(drawCounty(bag),null);
});
test('last-county and exhausted saves resume without duplicating any county',()=>{
  for(const count of [0,1,20,21,22]){
    const saved={version:2,pieces:allIds.slice(0,count).map(id=>({ids:[id],x:190,y:400})),bag:allIds.slice(count+2),current:allIds[count]??null,next:allIds[count+1]??null};
    const run=restoreRun(saved,allIds);
    const remaining=[run.current,run.next,...run.bag].filter(Boolean);
    assert.deepEqual(remaining,allIds.slice(count));
    assert.equal(new Set([...run.pieces.flatMap(p=>p.ids),...remaining]).size,22);
  }
});
test('old endless saves migrate and remove both placed and queued duplicates',()=>{
  const run=restoreRun({version:1,pieces:[{ids:[allIds[0]],x:10,y:100},{ids:[allIds[0],allIds[1]],x:50,y:200}],current:allIds[0],next:allIds[2],bag:[allIds[2],allIds[1]]},allIds);
  const ids=[...run.pieces.flatMap(p=>p.ids),run.current,run.next,...run.bag].filter(Boolean);
  assert.equal(ids.length,22);assert.equal(new Set(ids).size,22);
});
test('collision footprint shrinks while retaining its center and stable physics',()=>{
  const hull=[{x:-40,y:-30},{x:40,y:-30},{x:40,y:30},{x:-40,y:30}];
  const inner=collisionHull(hull);
  assert.equal(Matter.Vertices.area(inner)/Matter.Vertices.area(hull),.81);
  assert.deepEqual(Matter.Vertices.centre(inner),{x:0,y:0});
  assert.equal(hull[0].x,-40);
});
