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
  // Combat states
  ATTACK_LIGHT_1: 'attack_light_1',
  ATTACK_LIGHT_2: 'attack_light_2',
  ATTACK_LIGHT_3: 'attack_light_3',
  ATTACK_HEAVY: 'attack_heavy',
  ATTACK_AIR: 'attack_air',
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

    // Light attack
    if (this.input.justPressed(ACTIONS.ATTACK_LIGHT)) {
      return PLAYER_STATES.ATTACK_LIGHT_1;
    }

    // Heavy attack
    if (this.input.justPressed(ACTIONS.ATTACK_HEAVY)) {
      return PLAYER_STATES.ATTACK_HEAVY;
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

    // Light attack
    if (this.input.justPressed(ACTIONS.ATTACK_LIGHT)) {
      return PLAYER_STATES.ATTACK_LIGHT_1;
    }

    // Heavy attack
    if (this.input.justPressed(ACTIONS.ATTACK_HEAVY)) {
      return PLAYER_STATES.ATTACK_HEAVY;
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

    // Air attack
    if (this.input.justPressed(ACTIONS.ATTACK_LIGHT) ||
        this.input.justPressed(ACTIONS.ATTACK_HEAVY)) {
      return PLAYER_STATES.ATTACK_AIR;
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

    // Air attack
    if (this.input.justPressed(ACTIONS.ATTACK_LIGHT) ||
        this.input.justPressed(ACTIONS.ATTACK_HEAVY)) {
      return PLAYER_STATES.ATTACK_AIR;
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
 * Base class for attack states
 */
class AttackState extends PlayerState {
  constructor(name, stateMachine, config) {
    super(name, stateMachine);

    // Attack timing (in ms)
    this.startupTime = config.startup || 50;
    this.activeTime = config.active || 100;
    this.recoveryTime = config.recovery || 150;
    this.totalDuration = this.startupTime + this.activeTime + this.recoveryTime;

    // Combo data
    this.nextComboState = config.nextCombo || null;
    this.comboWindowStart = this.startupTime + this.activeTime;
    this.comboWindowEnd = this.totalDuration - 30; // 30ms before end

    // Attack properties
    this.damage = config.damage || 10;
    this.knockback = config.knockback || { x: 300, y: -150 };
    this.hitstun = config.hitstun || 200;
    this.hitstop = config.hitstop || 50;
    this.canMoveWhileAttacking = config.canMove || false;
    this.movementMultiplier = config.moveMultiplier || 0.3;

    // State tracking
    this.hasHit = false;
    this.comboQueued = false;
  }

  enter(prevState, params) {
    this.hasHit = false;
    this.comboQueued = false;

    // Brief forward momentum on attack
    const facing = this.sprite.flipX ? -1 : 1;
    this.body.setVelocityX(facing * 100);

    // TODO: Play attack animation
    // TODO: Spawn hitbox during active frames
  }

  update(time, delta) {
    const stateTime = this.stateMachine.getStateTime();

    // Activate hitbox during active frames
    if (stateTime >= this.startupTime && stateTime < this.startupTime + this.activeTime) {
      if (!this.player.attackHitbox.active) {
        this.player.activateAttackHitbox({
          damage: this.damage,
          knockback: this.knockback,
          hitstun: this.hitstun,
          hitstop: this.hitstop,
        });
      }
    } else {
      // Deactivate outside active frames
      if (this.player.attackHitbox.active) {
        this.player.deactivateAttackHitbox();
      }
    }

    // Limited movement during attack (if allowed)
    if (this.canMoveWhileAttacking) {
      this.handleHorizontalMovement(this.movementMultiplier);
    } else {
      // Slow down horizontal movement during attack
      this.body.setVelocityX(this.body.velocity.x * 0.9);
    }

    // Check for combo input during combo window
    if (this.nextComboState &&
        stateTime >= this.comboWindowStart &&
        stateTime <= this.comboWindowEnd) {
      if (this.input.justPressed(ACTIONS.ATTACK_LIGHT)) {
        this.comboQueued = true;
      }
    }

    // Attack finished
    if (stateTime >= this.totalDuration) {
      // Execute queued combo
      if (this.comboQueued && this.nextComboState) {
        return this.nextComboState;
      }

      // Return to appropriate state
      if (!this.body.onFloor()) {
        return PLAYER_STATES.FALL;
      }
      return this.input.getHorizontalAxis() !== 0
        ? PLAYER_STATES.RUN
        : PLAYER_STATES.IDLE;
    }

    return null;
  }

  exit(nextState) {
    // Always deactivate hitbox when leaving attack state
    this.player.deactivateAttackHitbox();
  }

  /**
   * Attack states can be interrupted by dodge/flip
   */
  canBeInterrupted(nextStateName) {
    // Can always cancel into dodge (flip)
    if (nextStateName === PLAYER_STATES.FLIP) {
      return true;
    }
    // Can't be interrupted by most states during startup/active
    const stateTime = this.stateMachine.getStateTime();
    if (stateTime < this.comboWindowStart) {
      return false;
    }
    return true;
  }
}

/**
 * Light Attack 1 - First hit of combo
 */
export class AttackLight1State extends AttackState {
  constructor(stateMachine) {
    super(PLAYER_STATES.ATTACK_LIGHT_1, stateMachine, {
      startup: 40,
      active: 80,
      recovery: 120,
      damage: 10,
      nextCombo: PLAYER_STATES.ATTACK_LIGHT_2,
      knockback: { x: 200, y: -50 },
      hitstun: 150,
      hitstop: 40,
    });
  }
}

/**
 * Light Attack 2 - Second hit of combo
 */
export class AttackLight2State extends AttackState {
  constructor(stateMachine) {
    super(PLAYER_STATES.ATTACK_LIGHT_2, stateMachine, {
      startup: 30,
      active: 80,
      recovery: 120,
      damage: 12,
      nextCombo: PLAYER_STATES.ATTACK_LIGHT_3,
      knockback: { x: 250, y: -80 },
      hitstun: 180,
      hitstop: 50,
    });
  }
}

/**
 * Light Attack 3 - Finisher
 */
export class AttackLight3State extends AttackState {
  constructor(stateMachine) {
    super(PLAYER_STATES.ATTACK_LIGHT_3, stateMachine, {
      startup: 50,
      active: 100,
      recovery: 200,
      damage: 18,
      nextCombo: null, // Combo ends here
      knockback: { x: 400, y: -200 },
      hitstun: 300,
      hitstop: 80,
    });
  }
}

/**
 * Heavy Attack - Slower, more damage
 */
export class AttackHeavyState extends AttackState {
  constructor(stateMachine) {
    super(PLAYER_STATES.ATTACK_HEAVY, stateMachine, {
      startup: 150,
      active: 120,
      recovery: 250,
      damage: 35,
      nextCombo: null,
      knockback: { x: 500, y: -250 },
      hitstun: 400,
      hitstop: 100,
    });
  }
}

/**
 * Air Attack - Attack while airborne
 */
export class AttackAirState extends AttackState {
  constructor(stateMachine) {
    super(PLAYER_STATES.ATTACK_AIR, stateMachine, {
      startup: 50,
      active: 150,
      recovery: 100,
      damage: 15,
      canMove: true,
      moveMultiplier: 0.5,
      knockback: { x: 250, y: -100 },
      hitstun: 200,
      hitstop: 50,
    });
  }

  update(time, delta) {
    // Land cancels air attack
    if (this.body.onFloor()) {
      return PLAYER_STATES.LAND;
    }

    return super.update(time, delta);
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
    // Combat
    new AttackLight1State(stateMachine),
    new AttackLight2State(stateMachine),
    new AttackLight3State(stateMachine),
    new AttackHeavyState(stateMachine),
    new AttackAirState(stateMachine),
  ];
}
