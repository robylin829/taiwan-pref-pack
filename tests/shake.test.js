import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import {joltBodies} from '../src/shake.js';

test('shaking wakes a settled body and visibly moves it, even after repeated use', () => {
  const engine = Matter.Engine.create({enableSleeping:true});
  const floor = Matter.Bodies.rectangle(200,520,400,40,{isStatic:true});
  const body = Matter.Bodies.rectangle(180,475,45,45);
  Matter.Composite.add(engine.world,[floor,body]);
  for(let i=0;i<180;i++) Matter.Engine.update(engine,1000/60);
  assert.ok(body.isSleeping,'fixture should be asleep like settled game pieces');
  for(let repeat=0;repeat<6;repeat++) {
    Matter.Sleeping.set(body,true);
    const before={...body.position};
    joltBodies(Matter,[body,floor],repeat%2?-1:1,()=>.5);
    assert.equal(body.isSleeping,false);
    for(let step=0;step<8;step++) Matter.Engine.update(engine,1000/60);
    assert.ok(Math.abs(body.position.x-before.x)>20,'the piece must actually move horizontally');
    assert.ok(body.position.y<before.y-15,'the piece must lift off its resting position');
    assert.equal(floor.position.y,520,'static walls must not be kicked');
  }
});
