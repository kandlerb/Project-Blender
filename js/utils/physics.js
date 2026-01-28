/**
 * Physics constants for movement and collision
 */
export const PHYSICS = Object.freeze({
  GRAVITY: 2400,              // pixels/sec²
  TERMINAL_VELOCITY: 1800,    // max fall speed pixels/sec

  PLAYER: Object.freeze({
    WALK_SPEED: 300,          // pixels/sec
    RUN_SPEED: 600,           // pixels/sec
    JUMP_FORCE: 900,          // initial jump velocity
    AIR_CONTROL: 0.8,         // multiplier for air movement
    COYOTE_TIME: 100,         // ms grace period after leaving ground
    JUMP_BUFFER: 150,         // ms to buffer jump input
  }),
});
