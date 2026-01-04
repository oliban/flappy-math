export const CollisionResult = {
  NONE: 'none',
  GAP: 'gap',
  PIPE: 'pipe',
  PIPE_EDGE: 'pipe_edge' // Bird center in gap but edges hitting pipe
};

export function checkCollision(bird, pipe) {
  const birdRadius = bird.size / 2;
  const birdLeft = bird.x - birdRadius;
  const birdRight = bird.x + birdRadius;
  const birdTop = bird.y - birdRadius;
  const birdBottom = bird.y + birdRadius;

  const pipeLeft = pipe.x;
  const pipeRight = pipe.x + pipe.width;

  // Check if bird is horizontally within pipe
  if (birdRight < pipeLeft || birdLeft > pipeRight) {
    return { type: CollisionResult.NONE };
  }

  // Bird is within pipe x-range, check which gap (if any)
  for (const gap of pipe.gaps) {
    const gapTop = gap.y - gap.height / 2;
    const gapBottom = gap.y + gap.height / 2;

    // Check if bird center is within gap
    if (bird.y >= gapTop && bird.y <= gapBottom) {
      // Bird center is in gap, but check if edges hit pipe
      if (birdTop < gapTop || birdBottom > gapBottom) {
        // Bird edge is hitting pipe section above or below gap (vertical collision)
        return { type: CollisionResult.PIPE_EDGE };
      }
      // Bird fully within gap
      return { type: CollisionResult.GAP, answer: gap.answer };
    }
  }

  // Bird is in pipe x-range but not in any gap = head-on hit
  return { type: CollisionResult.PIPE };
}
