# Neon Dodger

## Current State
New project. No existing code.

## Requested Changes (Diff)

### Add
- Full-screen 2D arcade game built on HTML5 Canvas using React + requestAnimationFrame game loop
- Pitch black background with a scrolling/moving neon grid effect
- Player: glowing blue square, controllable via arrow keys and touch (swipe/tap)
- Obstacles: circular red neon enemies that spawn at the top and fall downward at increasing speed over time
- Score counter displayed at the top of the screen, incrementing over time survived
- Collision detection between player and obstacles triggers:
  - Particle explosion effect (neon fragments bursting outward)
  - Game Over screen overlay
- Game Over screen: shows final score and a "Play Again" button that resets the game state
- Difficulty ramp: obstacle spawn rate and fall speed increase as score grows

### Modify
- None

### Remove
- None

## Implementation Plan
1. Set up React component with a full-screen `<canvas>` ref
2. Implement game loop via `requestAnimationFrame` with delta-time for frame-rate independence
3. Draw scrolling grid background (moving lines on black)
4. Implement player entity: position state, glow effect via `ctx.shadowBlur`, arrow key + touch event handlers
5. Implement obstacle spawner: random x positions, increasing speed/frequency tied to score
6. Collision detection: AABB circle-rect collision between player and each obstacle
7. Particle system: on collision, spawn N particles with random velocities, fade out over ~0.5s
8. HUD: render score text at top of canvas each frame
9. Game Over overlay: semi-transparent black panel with score and Play Again button
10. Reset function: clear all entities, reset score, restart loop
