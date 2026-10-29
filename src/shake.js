// Sleeping bodies must be woken before applying any velocity.
export function joltBodies(Matter, bodies, direction, random = Math.random) {
  for (const body of bodies) {
    if (body.isStatic) continue;
    Matter.Sleeping.set(body, false);
    Matter.Body.setVelocity(body, {
      x: direction * (5 + random() * 4),
      y: -(5 + random() * 3)
    });
    Matter.Body.setAngularVelocity(body, direction * (0.035 + random() * 0.065));
  }
}
