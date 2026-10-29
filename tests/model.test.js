import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import {counties} from '../src/counties.js';
import {regions,regionOf,completedRegions,canMerge,mergeScore,shuffledBag} from '../src/model.js';
test('22 real counties belong to exactly one of the five regions',()=>{
  const ids=regions.flatMap(r=>r.ids);
  assert.equal(ids.length,22);assert.equal(new Set(ids).size,22);
  assert.deepEqual([...ids].sort(),counties.map(c=>c.id).sort());
  for(const c of counties){assert.ok(c.points.length>=4);assert.ok(c.points.flat().every(Number.isFinite));assert.ok(regionOf(c.id))}
});
test('every mainland region can be completed through real geographic neighbors',()=>{
  for(const r of regions.filter(r=>r.id!=='islands')){
    let group=[r.ids[0]],remaining=r.ids.slice(1);
    while(remaining.length){const next=remaining.find(id=>canMerge(group,[id],counties));assert.ok(next,`${r.name} must remain connected`);group.push(next);remaining=remaining.filter(id=>id!==next)}
    assert.equal(completedRegions(group)[0].id,r.id);
  }
});
test('all adjacent counties can merge across regional boundaries; duplicates and distant counties cannot',()=>{
  assert.equal(canMerge(['63000'],['63000'],counties),false);
  assert.equal(canMerge(['63000'],['10018'],counties),false);
  assert.equal(canMerge(['10015'],['10002'],counties),true);
  assert.equal(canMerge(['10004'],['10005'],counties),true);
  assert.equal(canMerge(['10009'],['10010'],counties),true);
  assert.equal(canMerge(['63000'],['64000'],counties),false);
  assert.equal(canMerge(['65000','10004'],['10005'],counties),true);
  for(const c of counties)for(const neighbor of c.neighbors){
    assert.ok(canMerge([c.id],[neighbor],counties));
    assert.ok(canMerge([neighbor],[c.id],counties));
  }
  assert.equal(canMerge(['10015'],['10014'],counties),true);
  assert.equal(canMerge(['09020'],['09007'],counties),true);
});
test('five completed regions combine into Taiwan with 22 distinct counties',()=>{
  let group=regions[0].ids;
  for(const r of regions.slice(1)){assert.ok(canMerge(group,r.ids,counties));group=[...group,...r.ids]}
  assert.equal(group.length,22);assert.equal(completedRegions(group).length,5);assert.equal(mergeScore(group),1830);
  assert.equal(canMerge(group,regions[0].ids,counties),false);
});
test('a random bag guarantees every county once before repeats',()=>{
  for(let i=0;i<20;i++){const bag=shuffledBag();assert.equal(bag.length,22);assert.equal(new Set(bag).size,22);assert.deepEqual([...bag].sort(),counties.map(c=>c.id).sort())}
});
test('physics collision reports mergeable counties and bodies remain contained',()=>{
  const engine=Matter.Engine.create();
  const a=Matter.Bodies.rectangle(80,30,40,40),b=Matter.Bodies.rectangle(80,160,40,40);
  a.plugin.ids=['10015'];b.plugin.ids=['10014'];
  const floor=Matter.Bodies.rectangle(100,220,250,20,{isStatic:true});
  let validContact=false;
  Matter.Events.on(engine,'collisionStart',e=>{for(const pair of e.pairs){if(pair.bodyA.plugin.ids&&pair.bodyB.plugin.ids)validContact ||= canMerge(pair.bodyA.plugin.ids,pair.bodyB.plugin.ids,counties)}});
  Matter.Composite.add(engine.world,[a,b,floor]);
  for(let i=0;i<180;i++)Matter.Engine.update(engine,1000/60);
  assert.ok(validContact);assert.ok(a.position.y<220);assert.ok(b.position.y<220);
});
