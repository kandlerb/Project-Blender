import { State } from './StateMachine.js';
import { PHYSICS } from '../utils/physics.js';
import { ACTIONS } from './InputManager.js';

/**
 * Player state names - use these constants to avoid typos
 */
export const PLAYER_STATES = Object.freeze({
  IDLE: 'idle',
  RUN: 'run',
  JUMP: 'jump',
  FALL: 'fall',
  LAND: 'land',
});

/**
 * Base class for player states with common helpers
 */
class PlayerState extends State {
  get player() {
    return this.entity;
  }

  get input() {
    return this.player.scene.inputManager;
  }

  get sprite() {
    return this.player.sprite;
  }

  get body() {
    return this.player.sprite.body;
  }

  /**
   * Handle horizontal movement (common to most states)
   */
  handleHorizontalMovement(speedMultiplier = 1) {
    const horizontal = this.input.getHorizontalAxis();
    const speed = PHYSICS.PLAYER.RUN_SPEED * speedMultiplier;

    if (horizontal !== 0) {
      this.body.setVelocityX(horizontal * speed);
      this.sprite.setFlipX(horizontal < 0);
      return true;
    } else {
      this.body.setVelocityX(0);
      return false;
    }
  }

  /**
   * Check for jump input with buffering
   */
  checkJumpInput(time) {
    return this.input.justPressed(ACTIONS.JUMP) ||
           this.input.consumeBuffered(ACTIONS.JUMP, time, PHYSICS.PLAYER.JUMP_BUFFER);
  }

  /**
   * Execute jump
   */
  doJump() {
    this.body.setVelocityY(-PHYSICS.PLAYER.JUMP_FORCE);
  }
}

/**
 * Idle State - Standing still on ground
 */
export class IdleState extends PlayerState {
  constructor(stateMachine) {
    super(PLAYER_STATES.IDLE, stateMachine);
  }

  enter(prevState, params) {
    this.body.setVelocityX(0);
    // TODO: Play idle animation
  }

  update(time, delta) {
    // Fall if not on ground
    if (!this.body.onFloor()) {
      return PLAYER_STATES.FALL;
    }

    // Transition to run if moving
    if (this.input.getHorizontalAxis() !== 0) {
      return PLAYER_STATES.RUN;
    }

    // Jump
    if (this.checkJumpInput(time)) {
      this.doJump();
      return PLAYER_STATES.JUMP;
    }

    return null;
  }
}

/**
 * Run State - Moving on ground
 */
export class RunState extends PlayerState {
  constructor(stateMachine) {
    super(PLAYER_STATES.RUN, stateMachine);
  }

  enter(prevState, params) {
    // TODO: Play run animation
  }

  update(time, delta) {
    // Fall if not on ground
    if (!this.body.onFloor()) {
      // Store coyote time reference
      this.player.leftGroundTime = time;
      return PLAYER_STATES.FALL;
    }

    // Handle movement
    const isMoving = this.handleHorizontalMovement();

    // Return to idle if stopped
    if (!isMoving) {
      return PLAYER_STATES.IDLE;
    }

    // Jump
    if (this.checkJumpInput(time)) {
      this.doJump();
      return PLAYER_STATES.JUMP;
    }

    return null;
  }
}

/**
 * Jump State - Rising through the air
 */
export class JumpState extends PlayerState {
  constructor(stateMachine) {
    super(PLAYER_STATES.JUMP, stateMachine);
  }

  enter(prevState, params) {
    // Reset coyote time
    this.player.leftGroundTime = 0;
    // TODO: Play jump animation
  }

  update(time, delta) {
    // Air movement (reduced control)
    this.handleHorizontalMovement(PHYSICS.PLAYER.AIR_CONTROL);

    // Variable jump height - release early for short hop
    if (this.input.justReleased(ACTIONS.JUMP) && this.body.velocity.y < 0) {
      this.body.setVelocityY(this.body.velocity.y * 0.5);
    }

    // Transition to fall when velocity becomes positive (falling)
    if (this.body.velocity.y >= 0) {
      return PLAYER_STATES.FALL;
    }

    // Buffer jump input for when we land
    if (this.input.justPressed(ACTIONS.JUMP)) {
      this.input.bufferAction(ACTIONS.JUMP, time);
    }

    return null;
  }
}

/**
 * Fall State - Falling through the air
 */
export class FallState extends PlayerState {
  constructor(stateMachine) {
    super(PLAYER_STATES.FALL, stateMachine);
  }

  enter(prevState, params) {
    // TODO: Play fall animation
  }

  update(time, delta) {
    // Air movement
    this.handleHorizontalMovement(PHYSICS.PLAYER.AIR_CONTROL);

    // Coyote time jump (only if we didn't already jump)
    if (this.canCoyoteJump(time) && this.checkJumpInput(time)) {
      this.doJump();
      return PLAYER_STATES.JUMP;
    }

    // Buffer jump input for landing
    if (this.input.justPressed(ACTIONS.JUMP)) {
      this.input.bufferAction(ACTIONS.JUMP, time);
    }

    // Land when hitting ground
    if (this.body.onFloor()) {
      return PLAYER_STATES.LAND;
    }

    return null;
  }

  canCoyoteJump(time) {
    const leftGroundTime = this.player.leftGroundTime;
    if (!leftGroundTime) return false;
    return (time - leftGroundTime) <= PHYSICS.PLAYER.COYOTE_TIME;
  }
}

/**
 * Land State - Brief recovery when landing
 */
export class LandState extends PlayerState {
  constructor(stateMachine) {
    super(PLAYER_STATES.LAND, stateMachine);
    this.landDuration = 50; // ms, very brief
  }

  enter(prevState, params) {
    // TODO: Play land animation/effect
    // TODO: Screen shake for hard landings?
  }

  update(time, delta) {
    // Can still move during landing
    this.handleHorizontalMovement();

    // Check for buffered jump
    if (this.checkJumpInput(time)) {
      this.doJump();
      return PLAYER_STATES.JUMP;
    }

    // Brief landing recovery, then transition
    if (this.stateMachine.getStateTime() >= this.landDuration) {
      const isMoving = this.input.getHorizontalAxis() !== 0;
      return isMoving ? PLAYER_STATES.RUN : PLAYER_STATES.IDLE;
    }

    return null;
  }
}

/**
 * Factory function to create all player states
 * @param {StateMachine} stateMachine
 * @returns {State[]}
 */
export function createPlayerStates(stateMachine) {
  return [
    new IdleState(stateMachine),
    new RunState(stateMachine),
    new JumpState(stateMachine),
    new FallState(stateMachine),
    new LandState(stateMachine),
  ];
}
