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
  // Movement abilities
  FLIP: 'flip',
  DIVE_KICK: 'dive_kick',
  // Spin attack
  SPIN_CHARGE: 'spin_charge',
  SPIN_ACTIVE: 'spin_active',
  SPIN_RELEASE: 'spin_release',
  // Blink
  BLINK: 'blink',
  // Grapple
  GRAPPLE_FIRE: 'grapple_fire',
  GRAPPLE_TRAVEL: 'grapple_travel',
  GRAPPLE_PULL: 'grapple_pull',
  // Wall mechanics
  WALL_SLIDE: 'wall_slide',
  // Weapon-specific states
  PARRY: 'parry',
  COUNTER_ATTACK: 'counter_attack',
  WEAPON_SWAP: 'weapon_swap',
  // Ultimate
  ULTIMATE: 'ultimate',
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
   * Set player invulnerability
   * @param {boolean} invulnerable
   */
  setInvulnerable(invulnerable) {
    this.player.isInvulnerable = invulnerable;

    // Visual feedback - slight transparency when invulnerable
    if (invulnerable) {
      this.sprite.setAlpha(0.7);
    } else {
      this.sprite.setAlpha(1);
    }
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

    // Maintain floor contact to prevent ground clipping
    this.body.setVelocityY(0);

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

    // Flip
    if (this.input.justPressed(ACTIONS.FLIP)) {
      return PLAYER_STATES.FLIP;
    }

    // Spin attack
    if (this.input.justPressed(ACTIONS.SPIN)) {
      return PLAYER_STATES.SPIN_CHARGE;
    }

    // Blink
    if (this.input.justPressed(ACTIONS.BLINK)) {
      return PLAYER_STATES.BLINK;
    }

    // Grapple
    if (this.input.justPressed(ACTIONS.GRAPPLE)) {
      return PLAYER_STATES.GRAPPLE_FIRE;
    }

    // Weapon swap
    if (this.input.justPressed(ACTIONS.WEAPON_NEXT)) {
      if (this.player.weaponManager?.cycleWeapon(1)) {
        return PLAYER_STATES.WEAPON_SWAP;
      }
    }
    if (this.input.justPressed(ACTIONS.WEAPON_PREV)) {
      if (this.player.weaponManager?.cycleWeapon(-1)) {
        return PLAYER_STATES.WEAPON_SWAP;
      }
    }

    // Ultimate attack
    if (this.input.justPressed(ACTIONS.ULTIMATE) && this.player.isUltimateReady()) {
      return PLAYER_STATES.ULTIMATE;
    }

    // Parry (weapon-specific - only if weapon has parry mechanic)
    const weapon = this.player.getCurrentWeapon();
    if (weapon?.mechanics?.parry && this.input.justPressed(ACTIONS.SPECIAL)) {
      return PLAYER_STATES.PARRY;
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

    // Maintain floor contact to prevent ground clipping
    this.body.setVelocityY(0);

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

    // Flip
    if (this.input.justPressed(ACTIONS.FLIP)) {
      return PLAYER_STATES.FLIP;
    }

    // Spin attack
    if (this.input.justPressed(ACTIONS.SPIN)) {
      return PLAYER_STATES.SPIN_CHARGE;
    }

    // Blink
    if (this.input.justPressed(ACTIONS.BLINK)) {
      return PLAYER_STATES.BLINK;
    }

    // Grapple
    if (this.input.justPressed(ACTIONS.GRAPPLE)) {
      return PLAYER_STATES.GRAPPLE_FIRE;
    }

    // Weapon swap
    if (this.input.justPressed(ACTIONS.WEAPON_NEXT)) {
      if (this.player.weaponManager?.cycleWeapon(1)) {
        return PLAYER_STATES.WEAPON_SWAP;
      }
    }
    if (this.input.justPressed(ACTIONS.WEAPON_PREV)) {
      if (this.player.weaponManager?.cycleWeapon(-1)) {
        return PLAYER_STATES.WEAPON_SWAP;
      }
    }

    // Ultimate attack
    if (this.input.justPressed(ACTIONS.ULTIMATE) && this.player.isUltimateReady()) {
      return PLAYER_STATES.ULTIMATE;
    }

    // Parry (weapon-specific - only if weapon has parry mechanic)
    const weapon = this.player.getCurrentWeapon();
    if (weapon?.mechanics?.parry && this.input.justPressed(ACTIONS.SPECIAL)) {
      return PLAYER_STATES.PARRY;
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
      // Check for wall slide opportunity
      const touchingLeftWall = this.body.blocked.left;
      const touchingRightWall = this.body.blocked.right;
      const inputH = this.input.getHorizontalAxis();

      if ((touchingLeftWall && inputH < 0) || (touchingRightWall && inputH > 0)) {
        return PLAYER_STATES.WALL_SLIDE;
      }

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

    // Flip
    if (this.input.justPressed(ACTIONS.FLIP)) {
      return PLAYER_STATES.FLIP;
    }

    // Spin attack (in air)
    if (this.input.justPressed(ACTIONS.SPIN)) {
      return PLAYER_STATES.SPIN_CHARGE;
    }

    // Blink
    if (this.input.justPressed(ACTIONS.BLINK)) {
      return PLAYER_STATES.BLINK;
    }

    // Grapple
    if (this.input.justPressed(ACTIONS.GRAPPLE)) {
      return PLAYER_STATES.GRAPPLE_FIRE;
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

    // Wall slide - check if pressing into a wall while falling
    const touchingLeftWall = this.body.blocked.left;
    const touchingRightWall = this.body.blocked.right;
    const inputH = this.input.getHorizontalAxis();

    // Must be falling (not rising) and pressing toward wall
    if (this.body.velocity.y > 0) {
      if ((touchingLeftWall && inputH < 0) || (touchingRightWall && inputH > 0)) {
        return PLAYER_STATES.WALL_SLIDE;
      }
    }

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

    // Flip
    if (this.input.justPressed(ACTIONS.FLIP)) {
      return PLAYER_STATES.FLIP;
    }

    // Spin attack (in air)
    if (this.input.justPressed(ACTIONS.SPIN)) {
      return PLAYER_STATES.SPIN_CHARGE;
    }

    // Blink
    if (this.input.justPressed(ACTIONS.BLINK)) {
      return PLAYER_STATES.BLINK;
    }

    // Grapple
    if (this.input.justPressed(ACTIONS.GRAPPLE)) {
      return PLAYER_STATES.GRAPPLE_FIRE;
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
    // Zero Y velocity on landing to prevent ground clipping
    this.body.setVelocityY(0);
    // TODO: Play land animation/effect
    // TODO: Screen shake for hard landings?
  }

  update(time, delta) {
    // Maintain floor contact to prevent ground clipping
    if (this.body.onFloor()) {
      this.body.setVelocityY(0);
    }

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
 * Base class for attack states - reads from weapon data
 */
class AttackState extends PlayerState {
  /**
   * @param {string} name - State name
   * @param {StateMachine} stateMachine
   * @param {string} attackType - 'light1', 'light2', 'light3', 'heavy', 'air'
   */
  constructor(name, stateMachine, attackType) {
    super(name, stateMachine);
    this.attackType = attackType;

    // These will be populated from weapon data in enter()
    this.attackData = null;
    this.startupTime = 100;
    this.activeTime = 100;
    this.recoveryTime = 150;
    this.totalDuration = 350;

    this.hitboxActivated = false;
  }

  enter(prevState, params) {
    this.hitboxActivated = false;

    // Get attack data from current weapon
    this.attackData = this.player.getAttackData(this.attackType);

    if (this.attackData) {
      this.startupTime = this.attackData.startupTime;
      this.activeTime = this.attackData.activeTime;
      this.recoveryTime = this.attackData.recoveryTime;
      this.totalDuration = this.startupTime + this.activeTime + this.recoveryTime;
    } else {
      // Fallback defaults if no weapon data
      console.warn(`No attack data for ${this.attackType}`);
      this.totalDuration = this.startupTime + this.activeTime + this.recoveryTime;
    }

    // Stop horizontal movement (slight momentum)
    this.body.setVelocityX(this.body.velocity.x * 0.3);
  }

  update(time, delta) {
    const stateTime = this.stateMachine.getStateTime();

    // Maintain floor contact to prevent ground clipping during attacks
    if (this.body.onFloor()) {
      this.body.setVelocityY(0);
    }

    // Movement ability cancels (after startup)
    if (stateTime > this.startupTime) {
      if (this.input.justPressed(ACTIONS.FLIP)) {
        return PLAYER_STATES.FLIP;
      }
      if (this.input.justPressed(ACTIONS.BLINK)) {
        return PLAYER_STATES.BLINK;
      }
    }

    // Phase: Startup
    if (stateTime < this.startupTime) {
      return null;
    }

    // Phase: Active - hitbox on
    if (stateTime < this.startupTime + this.activeTime) {
      if (!this.hitboxActivated && this.attackData) {
        this.hitboxActivated = true;
        this.player.activateAttackHitbox({
          damage: this.attackData.damage,
          knockback: this.attackData.knockback,
          hitstun: this.attackData.hitstun,
          hitstop: this.attackData.hitstop,
          width: this.attackData.hitbox.width,
          height: this.attackData.hitbox.height,
          offsetX: this.attackData.hitbox.offsetX,
          offsetY: this.attackData.hitbox.offsetY,
        });
      }
      return null;
    }

    // Phase: Recovery - hitbox off, can cancel
    if (this.hitboxActivated) {
      this.player.deactivateAttackHitbox();
      this.hitboxActivated = false;
    }

    // Check for combo input during cancel window
    const recoveryProgress = (stateTime - this.startupTime - this.activeTime) / this.recoveryTime;
    const cancelThreshold = this.attackData?.cancelWindow || 0.6;

    if (recoveryProgress < cancelThreshold) {
      const nextState = this.checkComboInput();
      if (nextState) return nextState;
    }

    // Attack complete
    if (stateTime >= this.totalDuration) {
      return this.getExitState();
    }

    return null;
  }

  /**
   * Check for combo follow-up input
   * @returns {string|null} Next state or null
   */
  checkComboInput() {
    // Override in subclasses
    return null;
  }

  /**
   * Determine exit state when attack completes
   * @returns {string}
   */
  getExitState() {
    if (this.body.onFloor()) {
      return this.input.getHorizontalAxis() !== 0
        ? PLAYER_STATES.RUN
        : PLAYER_STATES.IDLE;
    }
    return PLAYER_STATES.FALL;
  }

  exit(nextState) {
    this.player.deactivateAttackHitbox();
    this.hitboxActivated = false;
  }

  canBeInterrupted(nextStateName) {
    return nextStateName === PLAYER_STATES.FLIP ||
           nextStateName === PLAYER_STATES.BLINK ||
           nextStateName === PLAYER_STATES.HITSTUN;
  }
}

/**
 * Light Attack 1
 */
export class AttackLight1State extends AttackState {
  constructor(stateMachine) {
    super(PLAYER_STATES.ATTACK_LIGHT_1, stateMachine, 'light1');
  }

  checkComboInput() {
    if (this.input.justPressed(ACTIONS.ATTACK_LIGHT)) {
      return PLAYER_STATES.ATTACK_LIGHT_2;
    }
    if (this.input.justPressed(ACTIONS.ATTACK_HEAVY)) {
      return PLAYER_STATES.ATTACK_HEAVY;
    }
    return null;
  }
}

/**
 * Light Attack 2
 */
export class AttackLight2State extends AttackState {
  constructor(stateMachine) {
    super(PLAYER_STATES.ATTACK_LIGHT_2, stateMachine, 'light2');
  }

  checkComboInput() {
    if (this.input.justPressed(ACTIONS.ATTACK_LIGHT)) {
      return PLAYER_STATES.ATTACK_LIGHT_3;
    }
    if (this.input.justPressed(ACTIONS.ATTACK_HEAVY)) {
      return PLAYER_STATES.ATTACK_HEAVY;
    }
    return null;
  }
}

/**
 * Light Attack 3 (Finisher)
 */
export class AttackLight3State extends AttackState {
  constructor(stateMachine) {
    super(PLAYER_STATES.ATTACK_LIGHT_3, stateMachine, 'light3');
  }

  // No combo follow-ups from finisher
  checkComboInput() {
    return null;
  }
}

/**
 * Heavy Attack
 */
export class AttackHeavyState extends AttackState {
  constructor(stateMachine) {
    super(PLAYER_STATES.ATTACK_HEAVY, stateMachine, 'heavy');
  }

  checkComboInput() {
    return null;
  }
}

/**
 * Air Attack
 */
export class AttackAirState extends AttackState {
  constructor(stateMachine) {
    super(PLAYER_STATES.ATTACK_AIR, stateMachine, 'air');
  }

  update(time, delta) {
    // Air attack can land during animation
    if (this.body.onFloor()) {
      return PLAYER_STATES.LAND;
    }

    return super.update(time, delta);
  }

  checkComboInput() {
    return null;
  }

  getExitState() {
    return PLAYER_STATES.FALL;
  }
}

/**
 * Flip State - Acrobatic dodge with i-frames
 */
export class FlipState extends PlayerState {
  constructor(stateMachine) {
    super(PLAYER_STATES.FLIP, stateMachine);

    // Timing (in ms)
    this.flipDuration = 400;
    this.iFrameStart = 30; // i-frames start slightly after flip begins
    this.iFrameEnd = 280; // i-frames end before flip ends (recovery)
    this.perfectWindowStart = 170; // Perfect timing window (apex)
    this.perfectWindowEnd = 220;

    // Movement
    this.flipSpeed = 450; // Horizontal speed during flip
    this.flipHeight = 350; // Vertical impulse

    // State tracking
    this.flipDirection = 1;
    this.wasPerfectTiming = false;
    this.hasReleasedAttack = true;
  }

  enter(prevState, params) {
    // Determine flip direction (toward input or facing direction)
    const inputDir = this.input.getHorizontalAxis();
    this.flipDirection = inputDir !== 0 ? inputDir : (this.sprite.flipX ? -1 : 1);

    // Can flip in opposite direction of facing
    if (inputDir !== 0) {
      this.sprite.setFlipX(inputDir < 0);
    }

    // Apply flip velocity
    this.body.setVelocityX(this.flipDirection * this.flipSpeed);
    this.body.setVelocityY(-this.flipHeight);

    // Track if we came from attack (for attack buffering)
    this.hasReleasedAttack = !this.input.isDown(ACTIONS.ATTACK_LIGHT) &&
                             !this.input.isDown(ACTIONS.ATTACK_HEAVY);

    this.wasPerfectTiming = false;

    // TODO: Play flip animation
    // Temporary: rotate the sprite
    this.sprite.setRotation(0);
  }

  update(time, delta) {
    const stateTime = this.stateMachine.getStateTime();

    // I-frame management
    const inIFrames = stateTime >= this.iFrameStart && stateTime <= this.iFrameEnd;
    this.setInvulnerable(inIFrames);

    // Perfect timing check (for future mechanics)
    if (stateTime >= this.perfectWindowStart && stateTime <= this.perfectWindowEnd) {
      this.wasPerfectTiming = true;
    }

    // Visual rotation during flip
    const progress = stateTime / this.flipDuration;
    const rotation = this.flipDirection * progress * Math.PI * 2;
    this.sprite.setRotation(rotation);

    // Air control (reduced)
    const horizontal = this.input.getHorizontalAxis();
    if (horizontal !== 0) {
      const currentVelX = this.body.velocity.x;
      const adjustment = horizontal * 100; // Slight air adjustment
      this.body.setVelocityX(currentVelX + adjustment * (delta / 1000));
    }

    // Track attack release for buffering
    if (!this.input.isDown(ACTIONS.ATTACK_LIGHT) &&
        !this.input.isDown(ACTIONS.ATTACK_HEAVY)) {
      this.hasReleasedAttack = true;
    }

    // Dive kick - attack while descending
    if (this.hasReleasedAttack &&
        this.body.velocity.y > 0 &&
        (this.input.justPressed(ACTIONS.ATTACK_LIGHT) ||
         this.input.justPressed(ACTIONS.ATTACK_HEAVY))) {
      return PLAYER_STATES.DIVE_KICK;
    }

    // Land early cancels flip
    if (this.body.onFloor() && stateTime > 100) {
      return this.finishFlip();
    }

    // Flip complete
    if (stateTime >= this.flipDuration) {
      return this.finishFlip();
    }

    return null;
  }

  finishFlip() {
    // Determine next state based on situation
    if (this.body.onFloor()) {
      // Dust effect on land
      if (this.player.scene.effectsManager) {
        this.player.scene.effectsManager.dustPuff(
          this.sprite.x,
          this.sprite.y + 20,
          3
        );
      }

      const horizontal = this.input.getHorizontalAxis();
      return horizontal !== 0 ? PLAYER_STATES.RUN : PLAYER_STATES.IDLE;
    }
    return PLAYER_STATES.FALL;
  }

  exit(nextState) {
    this.setInvulnerable(false);
    this.sprite.setRotation(0);
  }

  canBeInterrupted(nextStateName) {
    // Flip can be interrupted by its natural exit states (idle, run, fall, land)
    // or by damage states (which bypass i-frames check)
    return nextStateName === PLAYER_STATES.IDLE ||
           nextStateName === PLAYER_STATES.RUN ||
           nextStateName === PLAYER_STATES.FALL ||
           nextStateName === PLAYER_STATES.LAND;
  }
}

/**
 * Dive Kick State - Downward attack from flip
 */
export class DiveKickState extends PlayerState {
  constructor(stateMachine) {
    super(PLAYER_STATES.DIVE_KICK, stateMachine);

    this.diveSpeed = 800; // Downward velocity
    this.horizontalSpeed = 200; // Forward momentum
    this.damage = 20;
    this.hasHit = false;
  }

  enter(prevState, params) {
    this.hasHit = false;

    // Dive downward with slight forward momentum
    const direction = this.sprite.flipX ? -1 : 1;
    this.body.setVelocityX(direction * this.horizontalSpeed);
    this.body.setVelocityY(this.diveSpeed);

    // Activate hitbox
    this.player.activateAttackHitbox({
      damage: this.damage,
      knockback: { x: 150, y: 200 }, // Spike enemies down
      hitstun: 300,
      hitstop: 60,
      width: 40,
      height: 50,
      offsetX: 0,
      offsetY: 15,
    });

    // TODO: Play dive kick animation
    // Temporary: angle the sprite
    const angle = this.sprite.flipX ? 45 : -45;
    this.sprite.setAngle(angle);
  }

  update(time, delta) {
    // Land cancels dive kick
    if (this.body.onFloor()) {
      // Impact effect
      if (this.player.scene.effectsManager) {
        this.player.scene.effectsManager.dustPuff(
          this.sprite.x,
          this.sprite.y + 20,
          6
        );
        this.player.scene.effectsManager.screenShake(4, 60);
      }

      return PLAYER_STATES.LAND;
    }

    // Can cancel into flip
    if (this.input.justPressed(ACTIONS.FLIP)) {
      return PLAYER_STATES.FLIP;
    }

    return null;
  }

  exit(nextState) {
    this.player.deactivateAttackHitbox();
    this.sprite.setAngle(0);
  }

  canBeInterrupted(nextStateName) {
    return nextStateName === PLAYER_STATES.FLIP ||
           nextStateName === PLAYER_STATES.LAND;
  }
}

/**
 * Spin Charge State - Wind up for spin attack
 */
export class SpinChargeState extends PlayerState {
  constructor(stateMachine) {
    super(PLAYER_STATES.SPIN_CHARGE, stateMachine);

    this.chargeTime = 300; // Time to fully charge
    this.minChargeTime = 100; // Minimum charge before can release
  }

  enter(prevState, params) {
    // Slow down horizontal movement
    this.body.setVelocityX(this.body.velocity.x * 0.3);

    // TODO: Play charge animation
    // Temporary: scale up slightly
    this.sprite.setScale(1.1);
  }

  update(time, delta) {
    const stateTime = this.stateMachine.getStateTime();
    const chargePercent = Math.min(1, stateTime / this.chargeTime);

    // Visual feedback for charge level
    const scale = 1 + (chargePercent * 0.2);
    this.sprite.setScale(scale);

    // Slight movement while charging
    this.handleHorizontalMovement(0.2);

    // Maintain floor contact to prevent ground clipping
    if (this.body.onFloor()) {
      this.body.setVelocityY(0);
    }

    // Released button - go to active spin if charged enough
    if (this.input.isUp(ACTIONS.SPIN)) {
      if (stateTime >= this.minChargeTime) {
        return PLAYER_STATES.SPIN_ACTIVE;
      } else {
        // Not charged enough - cancel
        return this.body.onFloor() ? PLAYER_STATES.IDLE : PLAYER_STATES.FALL;
      }
    }

    // Fully charged - auto transition to active
    if (stateTime >= this.chargeTime) {
      return PLAYER_STATES.SPIN_ACTIVE;
    }

    // Can cancel with flip
    if (this.input.justPressed(ACTIONS.FLIP)) {
      return PLAYER_STATES.FLIP;
    }

    return null;
  }

  exit(nextState) {
    // When resetting scale, adjust Y position to prevent ground clipping
    const currentScale = this.sprite.scaleY;
    if (currentScale > 1 && this.body.onFloor()) {
      const heightDiff = (this.sprite.height * currentScale - this.sprite.height) / 2;
      this.sprite.y -= heightDiff;
    }

    this.sprite.setScale(1);

    // Sync physics body position after scale change
    this.body.setVelocityY(0);
    this.body.reset(this.sprite.x, this.sprite.y);
  }

  canBeInterrupted(nextStateName) {
    return nextStateName === PLAYER_STATES.FLIP ||
           nextStateName === PLAYER_STATES.SPIN_ACTIVE ||
           nextStateName === PLAYER_STATES.IDLE ||
           nextStateName === PLAYER_STATES.FALL;
  }
}

/**
 * Spin Active State - Actively spinning with hitbox
 */
export class SpinActiveState extends PlayerState {
  constructor(stateMachine) {
    super(PLAYER_STATES.SPIN_ACTIVE, stateMachine);

    this.maxSpinDuration = 2000; // Max time can spin
    this.tickRate = 150; // MS between damage ticks
    this.spinSpeed = 200; // Movement speed while spinning

    this.lastTickTime = 0;
    this.totalRotation = 0;
  }

  enter(prevState, params) {
    this.lastTickTime = 0;
    this.totalRotation = 0;

    // Get spin attack data from weapon
    const spinData = this.player.getAttackData('spin');

    const damage = spinData?.damage || 5;
    const knockback = spinData?.knockback || { x: 100, y: -50 };
    const hitstun = spinData?.hitstun || 100;
    const hitstop = spinData?.hitstop || 20;
    const hitbox = spinData?.hitbox || { width: 80, height: 60, offsetX: 0, offsetY: 0 };

    // Activate spin hitbox (larger radius)
    this.player.activateAttackHitbox({
      damage,
      knockback,
      hitstun,
      hitstop,
      width: hitbox.width,
      height: hitbox.height,
      offsetX: hitbox.offsetX,
      offsetY: hitbox.offsetY,
    });
  }

  update(time, delta) {
    const stateTime = this.stateMachine.getStateTime();

    // Rotate sprite
    this.totalRotation += delta * 0.02; // Rotation speed
    this.sprite.setRotation(this.totalRotation);

    // Movement while spinning (reduced)
    const horizontal = this.input.getHorizontalAxis();
    if (horizontal !== 0) {
      this.body.setVelocityX(horizontal * this.spinSpeed);
      this.sprite.setFlipX(horizontal < 0);
    } else {
      this.body.setVelocityX(this.body.velocity.x * 0.9); // Slow down
    }

    // Maintain floor contact to prevent ground clipping
    if (this.body.onFloor()) {
      this.body.setVelocityY(0);
    }

    // Reset hitbox tracking periodically for multi-hit
    if (stateTime - this.lastTickTime >= this.tickRate) {
      this.lastTickTime = stateTime;
      this.player.attackHitbox.hasHit.clear();
    }

    // Release button to finish
    if (this.input.isUp(ACTIONS.SPIN)) {
      return PLAYER_STATES.SPIN_RELEASE;
    }

    // Max duration reached
    if (stateTime >= this.maxSpinDuration) {
      return PLAYER_STATES.SPIN_RELEASE;
    }

    // Can cancel with flip
    if (this.input.justPressed(ACTIONS.FLIP)) {
      return PLAYER_STATES.FLIP;
    }

    return null;
  }

  exit(nextState) {
    this.player.deactivateAttackHitbox();
    this.sprite.setRotation(0);
  }

  canBeInterrupted(nextStateName) {
    return nextStateName === PLAYER_STATES.FLIP ||
           nextStateName === PLAYER_STATES.SPIN_RELEASE ||
           nextStateName === PLAYER_STATES.IDLE ||
           nextStateName === PLAYER_STATES.FALL;
  }
}

/**
 * Spin Release State - Finisher with launch
 */
export class SpinReleaseState extends PlayerState {
  constructor(stateMachine) {
    super(PLAYER_STATES.SPIN_RELEASE, stateMachine);

    this.releaseDuration = 200;
  }

  enter(prevState, params) {
    // Calculate if perfect timing (released right after full charge)
    const spinTime = prevState ? this.stateMachine.stateTime : 0;
    const isPerfect = spinTime >= 300 && spinTime <= 500; // Sweet spot

    // Get spin release data from weapon (uses 'special' slot)
    const releaseData = this.player.getAttackData('special');

    const baseDamage = releaseData?.damage || 25;
    const finalDamage = isPerfect ? baseDamage * 1.5 : baseDamage;
    const knockback = releaseData?.knockback || { x: 400, y: -350 };
    const hitstun = releaseData?.hitstun || 400;
    const baseHitstop = releaseData?.hitstop || 80;
    const hitbox = releaseData?.hitbox || { width: 100, height: 80, offsetX: 0, offsetY: 0 };

    // Big launch hitbox
    this.player.activateAttackHitbox({
      damage: finalDamage,
      knockback,
      hitstun,
      hitstop: isPerfect ? baseHitstop * 1.25 : baseHitstop,
      width: hitbox.width,
      height: hitbox.height,
      offsetX: hitbox.offsetX,
      offsetY: hitbox.offsetY,
    });

    // Screen shake on release
    if (this.player.scene.effectsManager) {
      this.player.scene.effectsManager.screenShake(isPerfect ? 8 : 5, 100);
    }

    // Final rotation flourish
    this.sprite.setRotation(0);

    // Brief pause in movement - freeze both axes to prevent ground clipping
    this.body.setVelocityX(0);
    if (this.body.onFloor()) {
      this.body.setVelocityY(0);
    }

    // Set initial scale for release animation
    this.sprite.setScale(1.3);
  }

  update(time, delta) {
    const stateTime = this.stateMachine.getStateTime();

    // Quick release animation
    const progress = stateTime / this.releaseDuration;
    this.sprite.setScale(1 + (1 - progress) * 0.3); // Shrink back to normal

    // Maintain floor contact to prevent clipping through ground
    if (this.body.onFloor()) {
      this.body.setVelocityY(0);
    }

    if (stateTime >= this.releaseDuration) {
      if (this.body.onFloor()) {
        return this.input.getHorizontalAxis() !== 0
          ? PLAYER_STATES.RUN
          : PLAYER_STATES.IDLE;
      }
      return PLAYER_STATES.FALL;
    }

    return null;
  }

  exit(nextState) {
    this.player.deactivateAttackHitbox();

    // When resetting scale, adjust Y position to prevent ground clipping
    // The sprite origin is at center, so scaling down moves the bottom up
    // We need to move the sprite down to compensate and keep feet on ground
    const currentScale = this.sprite.scaleY;
    if (currentScale > 1 && this.body.onFloor()) {
      const heightDiff = (this.sprite.height * currentScale - this.sprite.height) / 2;
      this.sprite.y -= heightDiff;
    }

    this.sprite.setScale(1);

    // Zero velocity and sync physics body position after scale change
    this.body.setVelocityY(0);
    this.body.reset(this.sprite.x, this.sprite.y);
  }

  canBeInterrupted(nextStateName) {
    return nextStateName === PLAYER_STATES.FLIP ||
           nextStateName === PLAYER_STATES.RUN ||
           nextStateName === PLAYER_STATES.IDLE ||
           nextStateName === PLAYER_STATES.FALL;
  }
}

/**
 * Blink State - Short teleport with i-frames
 */
export class BlinkState extends PlayerState {
  constructor(stateMachine) {
    super(PLAYER_STATES.BLINK, stateMachine);

    this.blinkDuration = 100; // Total blink time (ms)
    this.blinkDistance = 200; // How far to teleport
    this.afterimageDuration = 300; // How long afterimage lasts

    this.startPosition = { x: 0, y: 0 };
    this.targetPosition = { x: 0, y: 0 };
    this.blinkDirection = { x: 1, y: 0 };
    this.afterimageSprite = null;
  }

  enter(prevState, params) {
    // Store start position
    this.startPosition.x = this.sprite.x;
    this.startPosition.y = this.sprite.y;

    // Determine blink direction from input (or facing direction)
    const inputH = this.input.getHorizontalAxis();
    const inputV = this.input.getVerticalAxis();

    if (inputH !== 0 || inputV !== 0) {
      // Normalize diagonal movement
      const magnitude = Math.sqrt(inputH * inputH + inputV * inputV);
      this.blinkDirection.x = inputH / magnitude;
      this.blinkDirection.y = inputV / magnitude;
    } else {
      // Blink in facing direction
      this.blinkDirection.x = this.sprite.flipX ? -1 : 1;
      this.blinkDirection.y = 0;
    }

    // Calculate target position
    this.targetPosition.x = this.startPosition.x + (this.blinkDirection.x * this.blinkDistance);
    this.targetPosition.y = this.startPosition.y + (this.blinkDirection.y * this.blinkDistance);

    // Create afterimage at start position
    this.createAfterimage();

    // Make player invulnerable
    this.setInvulnerable(true);

    // Disable physics body during blink (phase through everything)
    this.body.enable = false;

    // Make sprite semi-transparent during blink
    this.sprite.setAlpha(0.3);

    // Update facing direction if blinking horizontally
    if (this.blinkDirection.x !== 0) {
      this.sprite.setFlipX(this.blinkDirection.x < 0);
    }
  }

  update(time, delta) {
    const stateTime = this.stateMachine.getStateTime();
    const progress = Math.min(1, stateTime / this.blinkDuration);

    // Lerp position (or instant teleport at start)
    // Using instant teleport for snappy feel
    if (progress < 0.2) {
      // Brief startup at original position
    } else {
      // Teleport to target
      this.sprite.setPosition(this.targetPosition.x, this.targetPosition.y);
    }

    // Blink complete
    if (stateTime >= this.blinkDuration) {
      return this.finishBlink();
    }

    return null;
  }

  finishBlink() {
    // Re-enable physics
    this.body.enable = true;

    // Check if target position is valid (not inside wall)
    // If invalid, push player to nearest valid position
    this.validatePosition();

    // Sync physics body to sprite position
    this.body.reset(this.sprite.x, this.sprite.y);

    // Determine next state
    if (this.body.onFloor()) {
      const horizontal = this.input.getHorizontalAxis();
      return horizontal !== 0 ? PLAYER_STATES.RUN : PLAYER_STATES.IDLE;
    }
    return PLAYER_STATES.FALL;
  }

  validatePosition() {
    // Simple bounds check - keep player in world
    const bounds = this.player.scene.physics.world.bounds;
    const halfWidth = this.sprite.width / 2;
    const halfHeight = this.sprite.height / 2;

    let x = this.sprite.x;
    let y = this.sprite.y;

    // Clamp to world bounds
    x = Math.max(bounds.x + halfWidth, Math.min(bounds.right - halfWidth, x));
    y = Math.max(bounds.y + halfHeight, Math.min(bounds.bottom - halfHeight, y));

    this.sprite.setPosition(x, y);

    // TODO: More sophisticated collision check against tilemap
    // For now, the simple bounds check prevents going out of world
  }

  createAfterimage() {
    const scene = this.player.scene;

    // Create a copy of the player sprite as afterimage
    this.afterimageSprite = scene.add.sprite(
      this.startPosition.x,
      this.startPosition.y,
      this.sprite.texture.key
    );

    this.afterimageSprite.setFlipX(this.sprite.flipX);
    this.afterimageSprite.setAlpha(0.6);
    this.afterimageSprite.setTint(0x4488ff); // Blue tint
    this.afterimageSprite.setDepth(this.sprite.depth - 1);

    // Fade out afterimage
    scene.tweens.add({
      targets: this.afterimageSprite,
      alpha: 0,
      scale: 0.8,
      duration: this.afterimageDuration,
      ease: 'Power2',
      onComplete: () => {
        if (this.afterimageSprite) {
          this.afterimageSprite.destroy();
          this.afterimageSprite = null;
        }
      },
    });
  }

  exit(nextState) {
    this.setInvulnerable(false);
    this.sprite.setAlpha(1);
    this.body.enable = true;

    // Afterimage cleanup handled by tween
  }

  canBeInterrupted(nextStateName) {
    // Allow transitions to valid exit states (from finishBlink)
    // Block external interruptions during the blink
    return nextStateName === PLAYER_STATES.IDLE ||
           nextStateName === PLAYER_STATES.RUN ||
           nextStateName === PLAYER_STATES.FALL;
  }
}

/**
 * Grapple Fire State - Firing the hook
 */
export class GrappleFireState extends PlayerState {
  constructor(stateMachine) {
    super(PLAYER_STATES.GRAPPLE_FIRE, stateMachine);

    this.grappleRange = 400;
    this.grappleSpeed = 2000;     // Hook travel speed (faster for snappy feel)
    this.maxFireTime = 300;       // Max time before hook retracts

    this.hookPosition = { x: 0, y: 0 };
    this.hookDirection = { x: 1, y: 0 };
    this.hookGraphics = null;
    this.foundTarget = null;
    this.targetType = null;       // 'surface', 'enemy', or 'object'
    this.targetPoint = { x: 0, y: 0 }; // Exact hit point for surfaces
  }

  enter(prevState, params) {
    this.foundTarget = null;
    this.targetType = null;
    this.targetPoint = { x: 0, y: 0 };

    // Get grapple range from weapon (if modified)
    const weapon = this.player.getCurrentWeapon();
    const grappleMod = weapon?.getMovementMod('grapple');
    this.grappleRange = grappleMod?.range || 400;

    // Determine hook direction from input
    const inputH = this.input.getHorizontalAxis();
    const inputV = this.input.getVerticalAxis();

    if (inputH !== 0 || inputV !== 0) {
      const magnitude = Math.sqrt(inputH * inputH + inputV * inputV);
      this.hookDirection.x = inputH / magnitude;
      this.hookDirection.y = inputV / magnitude;
    } else {
      this.hookDirection.x = this.sprite.flipX ? -1 : 1;
      this.hookDirection.y = 0;
    }

    // Start hook at player position
    this.hookPosition.x = this.sprite.x;
    this.hookPosition.y = this.sprite.y;

    // Create hook visual
    this.hookGraphics = this.player.scene.add.graphics();
    this.hookGraphics.setDepth(this.sprite.depth - 1);

    // Update facing
    if (this.hookDirection.x !== 0) {
      this.sprite.setFlipX(this.hookDirection.x < 0);
    }

    // Slow player movement during fire
    this.body.setVelocityX(this.body.velocity.x * 0.5);
  }

  update(time, delta) {
    const stateTime = this.stateMachine.getStateTime();

    // Move hook outward
    const hookSpeed = this.grappleSpeed * (delta / 1000);
    const prevX = this.hookPosition.x;
    const prevY = this.hookPosition.y;

    this.hookPosition.x += this.hookDirection.x * hookSpeed;
    this.hookPosition.y += this.hookDirection.y * hookSpeed;

    // Draw hook and chain
    this.drawGrapple();

    // Check for targets (surface first, then entities)
    if (!this.foundTarget) {
      // Check surface collision first
      const surfaceHit = this.checkSurfaceCollision(prevX, prevY);
      if (surfaceHit) {
        this.foundTarget = 'surface';
        this.targetType = 'surface';
        this.targetPoint.x = surfaceHit.x;
        this.targetPoint.y = surfaceHit.y;
        return PLAYER_STATES.GRAPPLE_TRAVEL;
      }

      // Check entity collision
      this.checkEntityCollision();

      if (this.foundTarget) {
        if (this.targetType === 'enemy' || this.targetType === 'object') {
          return PLAYER_STATES.GRAPPLE_PULL;
        }
      }
    }

    // Check if hook traveled max range
    const dx = this.hookPosition.x - this.sprite.x;
    const dy = this.hookPosition.y - this.sprite.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance >= this.grappleRange || stateTime >= this.maxFireTime) {
      return this.cancelGrapple();
    }

    return null;
  }

  /**
   * Check if hook hit a surface (tilemap or platform)
   * Returns hit point or null
   */
  checkSurfaceCollision(prevX, prevY) {
    const scene = this.player.scene;

    // Method 1: Check against tilemap if it exists
    if (scene.groundLayer) {
      const tile = scene.groundLayer.getTileAtWorldXY(
        this.hookPosition.x,
        this.hookPosition.y
      );
      if (tile && tile.collides) {
        return { x: this.hookPosition.x, y: this.hookPosition.y };
      }
    }

    // Method 2: Check against platform/ground rectangles
    const platforms = [];

    // Collect ground and platforms
    if (scene.ground) platforms.push(scene.ground);
    if (scene.platforms) {
      scene.platforms.getChildren().forEach(p => platforms.push(p));
    }

    // Simple line-rectangle intersection check
    for (const platform of platforms) {
      if (!platform.body) continue;

      const bounds = platform.getBounds();

      // Check if hook point is inside platform bounds
      if (this.hookPosition.x >= bounds.left &&
          this.hookPosition.x <= bounds.right &&
          this.hookPosition.y >= bounds.top &&
          this.hookPosition.y <= bounds.bottom) {

        // Find the edge point (where hook should attach)
        const hitPoint = this.findEdgePoint(prevX, prevY, bounds);
        return hitPoint;
      }
    }

    // Method 3: Check world bounds
    const worldBounds = scene.physics.world.bounds;
    if (this.hookPosition.x <= worldBounds.left ||
        this.hookPosition.x >= worldBounds.right ||
        this.hookPosition.y <= worldBounds.top ||
        this.hookPosition.y >= worldBounds.bottom) {
      // Clamp to world edge
      return {
        x: Math.max(worldBounds.left, Math.min(worldBounds.right, this.hookPosition.x)),
        y: Math.max(worldBounds.top, Math.min(worldBounds.bottom, this.hookPosition.y)),
      };
    }

    return null;
  }

  /**
   * Find the edge point where hook enters a rectangle
   */
  findEdgePoint(fromX, fromY, bounds) {
    // Return the closest point on the rectangle edge to the previous hook position
    const clampedX = Math.max(bounds.left, Math.min(bounds.right, fromX));
    const clampedY = Math.max(bounds.top, Math.min(bounds.bottom, fromY));

    // If we were outside, the clamped point is on the edge
    if (fromX !== clampedX || fromY !== clampedY) {
      return { x: clampedX, y: clampedY };
    }

    // Otherwise find nearest edge
    const distLeft = Math.abs(fromX - bounds.left);
    const distRight = Math.abs(fromX - bounds.right);
    const distTop = Math.abs(fromY - bounds.top);
    const distBottom = Math.abs(fromY - bounds.bottom);

    const minDist = Math.min(distLeft, distRight, distTop, distBottom);

    if (minDist === distLeft) return { x: bounds.left, y: fromY };
    if (minDist === distRight) return { x: bounds.right, y: fromY };
    if (minDist === distTop) return { x: fromX, y: bounds.top };
    return { x: fromX, y: bounds.bottom };
  }

  /**
   * Check if hook hit an enemy or pullable object
   */
  checkEntityCollision() {
    const scene = this.player.scene;

    // Check enemies
    if (scene.enemies) {
      for (const enemy of scene.enemies) {
        if (!enemy.isAlive) continue;

        const dx = this.hookPosition.x - enemy.sprite.x;
        const dy = this.hookPosition.y - enemy.sprite.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 40) {
          this.foundTarget = enemy;
          this.targetType = 'enemy';
          return;
        }
      }
    }

    // TODO: Check pullable objects
    // if (scene.pullableObjects) { ... }
  }

  drawGrapple() {
    this.hookGraphics.clear();

    // Chain line
    this.hookGraphics.lineStyle(3, 0x888888, 1);
    this.hookGraphics.beginPath();
    this.hookGraphics.moveTo(this.sprite.x, this.sprite.y);
    this.hookGraphics.lineTo(this.hookPosition.x, this.hookPosition.y);
    this.hookGraphics.strokePath();

    // Hook head
    this.hookGraphics.fillStyle(0xcccccc, 1);
    this.hookGraphics.fillCircle(this.hookPosition.x, this.hookPosition.y, 6);
  }

  cancelGrapple() {
    if (this.body.onFloor()) {
      return this.input.getHorizontalAxis() !== 0
        ? PLAYER_STATES.RUN
        : PLAYER_STATES.IDLE;
    }
    return PLAYER_STATES.FALL;
  }

  exit(nextState) {
    // Pass data to next grapple state
    if (nextState.name === PLAYER_STATES.GRAPPLE_TRAVEL ||
        nextState.name === PLAYER_STATES.GRAPPLE_PULL) {
      nextState.hookGraphics = this.hookGraphics;
      nextState.foundTarget = this.foundTarget;
      nextState.targetType = this.targetType;
      nextState.targetPoint = { ...this.targetPoint };
    } else {
      if (this.hookGraphics) {
        this.hookGraphics.destroy();
        this.hookGraphics = null;
      }
    }
  }
}

/**
 * Grapple Travel State - Player zips to grapple point/surface
 */
export class GrappleTravelState extends PlayerState {
  constructor(stateMachine) {
    super(PLAYER_STATES.GRAPPLE_TRAVEL, stateMachine);

    this.travelSpeed = 1400;
    this.arrivalDistance = 25;    // How close before "arrived"
    this.maxTravelTime = 600;     // Safety timeout

    this.hookGraphics = null;
    this.foundTarget = null;
    this.targetType = null;
    this.targetPoint = { x: 0, y: 0 };
  }

  enter(prevState, params) {
    // Disable gravity during travel
    this.body.setAllowGravity(false);

    // Cancel any existing velocity
    this.body.setVelocity(0, 0);
  }

  update(time, delta) {
    const stateTime = this.stateMachine.getStateTime();

    // Get target position
    let targetX, targetY;

    if (this.targetType === 'surface') {
      targetX = this.targetPoint.x;
      targetY = this.targetPoint.y;
    } else if (this.foundTarget) {
      // Moving target (shouldn't happen for travel, but handle it)
      targetX = this.foundTarget.x ?? this.foundTarget.sprite?.x ?? this.targetPoint.x;
      targetY = this.foundTarget.y ?? this.foundTarget.sprite?.y ?? this.targetPoint.y;
    } else {
      return this.finishGrapple();
    }

    // Calculate distance
    const dx = targetX - this.sprite.x;
    const dy = targetY - this.sprite.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Arrived at target
    if (distance < this.arrivalDistance) {
      return this.finishGrapple();
    }

    // Safety timeout
    if (stateTime >= this.maxTravelTime) {
      return this.finishGrapple();
    }

    // Move toward target
    const speed = this.travelSpeed;
    this.body.setVelocity(
      (dx / distance) * speed,
      (dy / distance) * speed
    );

    // Update grapple visual
    this.drawGrapple(targetX, targetY);

    // Can cancel with flip
    if (this.input.justPressed(ACTIONS.FLIP)) {
      return PLAYER_STATES.FLIP;
    }

    return null;
  }

  drawGrapple(targetX, targetY) {
    if (!this.hookGraphics) return;

    this.hookGraphics.clear();

    // Chain line
    this.hookGraphics.lineStyle(3, 0x888888, 1);
    this.hookGraphics.beginPath();
    this.hookGraphics.moveTo(this.sprite.x, this.sprite.y);
    this.hookGraphics.lineTo(targetX, targetY);
    this.hookGraphics.strokePath();

    // Hook embedded in surface
    this.hookGraphics.fillStyle(0xffaa00, 1);
    this.hookGraphics.fillCircle(targetX, targetY, 6);
  }

  finishGrapple() {
    this.body.setAllowGravity(true);

    // Preserve some momentum based on input
    const inputH = this.input.getHorizontalAxis();
    let exitVelX = inputH * 200;
    let exitVelY = -150; // Small upward boost

    // If grappling upward, give more upward boost
    if (this.targetPoint.y < this.sprite.y - 50) {
      exitVelY = -250;
    }

    this.body.setVelocity(exitVelX, exitVelY);

    // Dust effect
    if (this.player.scene.effectsManager) {
      this.player.scene.effectsManager.dustPuff(
        this.sprite.x,
        this.sprite.y,
        3
      );
    }

    // Return appropriate state
    if (this.body.onFloor()) {
      return inputH !== 0 ? PLAYER_STATES.RUN : PLAYER_STATES.IDLE;
    }
    return PLAYER_STATES.FALL;
  }

  exit(nextState) {
    this.body.setAllowGravity(true);

    if (this.hookGraphics) {
      this.hookGraphics.destroy();
      this.hookGraphics = null;
    }
  }

  canBeInterrupted(nextStateName) {
    return nextStateName === PLAYER_STATES.FLIP ||
           nextStateName === PLAYER_STATES.IDLE ||
           nextStateName === PLAYER_STATES.FALL;
  }
}

/**
 * Grapple Pull State - Pull enemy/enemies toward player
 * Chain Whip can pull multiple enemies
 */
export class GrapplePullState extends PlayerState {
  constructor(stateMachine) {
    super(PLAYER_STATES.GRAPPLE_PULL, stateMachine);

    this.pullSpeed = 800;
    this.pullDuration = 400;
    this.stunDuration = 500; // How long enemy is stunned after pull
    this.hookGraphics = null;
    this.foundTarget = null;
    this.additionalTargets = []; // For multi-pull
  }

  enter(prevState, params) {
    this.additionalTargets = [];

    // Check if weapon supports multi-pull
    const weapon = this.player.getCurrentWeapon();
    const grappleMod = weapon?.getMovementMod('grapple');

    if (grappleMod?.multiPull && this.foundTarget) {
      // Find additional nearby enemies
      const maxTargets = grappleMod.maxTargets || 3;
      const scene = this.player.scene;

      if (scene.enemies) {
        const primaryPos = this.foundTarget.sprite;

        for (const enemy of scene.enemies) {
          if (enemy === this.foundTarget) continue;
          if (!enemy.isAlive) continue;
          if (this.additionalTargets.length >= maxTargets - 1) break;

          // Check if nearby the primary target
          const dx = enemy.sprite.x - primaryPos.x;
          const dy = enemy.sprite.y - primaryPos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 100) { // Within 100 units of primary target
            this.additionalTargets.push(enemy);
            enemy.hitstunRemaining = this.pullDuration + this.stunDuration;
            enemy.sprite.setTint(0x8888ff);
          }
        }
      }
    }

    // Stop player movement
    this.body.setVelocityX(0);

    // Stun the primary target
    if (this.foundTarget && this.foundTarget.isAlive) {
      this.foundTarget.hitstunRemaining = this.pullDuration + this.stunDuration;
      this.foundTarget.sprite.setTint(0x8888ff);
    }
  }

  update(time, delta) {
    const stateTime = this.stateMachine.getStateTime();

    // Maintain floor contact to prevent ground clipping
    if (this.body.onFloor()) {
      this.body.setVelocityY(0);
    }

    if (!this.foundTarget || !this.foundTarget.isAlive) {
      return this.finishPull();
    }

    // Pull all targets toward player
    const allTargets = [this.foundTarget, ...this.additionalTargets];
    let allArrived = true;

    for (const target of allTargets) {
      if (!target.isAlive) continue;

      const enemySprite = target.sprite;
      const dx = this.sprite.x - enemySprite.x;
      const dy = this.sprite.y - enemySprite.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance >= 50) {
        allArrived = false;

        // Move enemy toward player
        const speed = this.pullSpeed * (delta / 1000);
        enemySprite.x += (dx / distance) * speed;
        enemySprite.y += (dy / distance) * speed;
      }
    }

    // Update grapple visual
    this.drawGrapple(allTargets);

    // All arrived or time up
    if (allArrived || stateTime >= this.pullDuration) {
      return this.finishPull();
    }

    return null;
  }

  drawGrapple(targets) {
    if (!this.hookGraphics) return;

    this.hookGraphics.clear();

    // Draw chain to each target
    for (const target of targets) {
      if (!target.isAlive) continue;

      const targetX = target.sprite.x;
      const targetY = target.sprite.y;

      this.hookGraphics.lineStyle(3, 0x888888, 1);
      this.hookGraphics.beginPath();
      this.hookGraphics.moveTo(this.sprite.x, this.sprite.y);
      this.hookGraphics.lineTo(targetX, targetY);
      this.hookGraphics.strokePath();

      this.hookGraphics.fillStyle(0x8888ff, 1);
      this.hookGraphics.fillCircle(targetX, targetY, 6);
    }
  }

  finishPull() {
    // Clear all target tints
    if (this.foundTarget && this.foundTarget.sprite) {
      this.foundTarget.sprite.clearTint();
    }
    for (const target of this.additionalTargets) {
      if (target.sprite) {
        target.sprite.clearTint();
      }
    }

    // Return to idle/fall
    if (this.body.onFloor()) {
      return this.input.getHorizontalAxis() !== 0
        ? PLAYER_STATES.RUN
        : PLAYER_STATES.IDLE;
    }
    return PLAYER_STATES.FALL;
  }

  exit(nextState) {
    // Clear tints
    if (this.foundTarget && this.foundTarget.sprite) {
      this.foundTarget.sprite.clearTint();
    }
    for (const target of this.additionalTargets) {
      if (target.sprite) {
        target.sprite.clearTint();
      }
    }
    this.additionalTargets = [];

    if (this.hookGraphics) {
      this.hookGraphics.destroy();
      this.hookGraphics = null;
    }
  }

  canBeInterrupted(nextStateName) {
    // Can cancel into attack to combo off the pull, or exit normally
    return nextStateName === PLAYER_STATES.ATTACK_LIGHT_1 ||
           nextStateName === PLAYER_STATES.ATTACK_HEAVY ||
           nextStateName === PLAYER_STATES.FLIP ||
           nextStateName === PLAYER_STATES.IDLE ||
           nextStateName === PLAYER_STATES.RUN ||
           nextStateName === PLAYER_STATES.FALL;
  }
}

/**
 * Wall Slide State - Slow descent while against wall
 */
export class WallSlideState extends PlayerState {
  constructor(stateMachine) {
    super(PLAYER_STATES.WALL_SLIDE, stateMachine);

    this.slideSpeed = 80;           // Max fall speed while sliding
    this.wallJumpForceX = 400;      // Horizontal force when jumping off
    this.wallJumpForceY = 450;      // Vertical force when jumping off
    this.wallDirection = 0;         // -1 = wall on left, 1 = wall on right
    this.dustTimer = 0;
    this.dustInterval = 150;        // Dust particle interval
  }

  enter(prevState, params) {
    // Determine which side the wall is on
    if (this.body.blocked.left) {
      this.wallDirection = -1;
      this.sprite.setFlipX(false); // Face away from wall
    } else if (this.body.blocked.right) {
      this.wallDirection = 1;
      this.sprite.setFlipX(true);
    }

    // Cap fall speed immediately
    if (this.body.velocity.y > this.slideSpeed) {
      this.body.setVelocityY(this.slideSpeed);
    }

    this.dustTimer = 0;

    // TODO: Play wall slide animation
  }

  update(time, delta) {
    // Check if still against wall
    const touchingWall = (this.wallDirection === -1 && this.body.blocked.left) ||
                         (this.wallDirection === 1 && this.body.blocked.right);

    // Left the wall
    if (!touchingWall) {
      return PLAYER_STATES.FALL;
    }

    // Landed on ground
    if (this.body.onFloor()) {
      // Dust puff on landing
      if (this.player.scene.effectsManager) {
        this.player.scene.effectsManager.dustPuff(
          this.sprite.x,
          this.sprite.y + 20,
          3
        );
      }
      return PLAYER_STATES.IDLE;
    }

    // Cap descent speed
    if (this.body.velocity.y > this.slideSpeed) {
      this.body.setVelocityY(this.slideSpeed);
    }

    // Wall jump
    if (this.input.justPressed(ACTIONS.JUMP)) {
      return this.performWallJump();
    }

    // Can flip off wall
    if (this.input.justPressed(ACTIONS.FLIP)) {
      // Flip away from wall
      return PLAYER_STATES.FLIP;
    }

    // Can blink off wall
    if (this.input.justPressed(ACTIONS.BLINK)) {
      return PLAYER_STATES.BLINK;
    }

    // Can grapple from wall
    if (this.input.justPressed(ACTIONS.GRAPPLE)) {
      return PLAYER_STATES.GRAPPLE_FIRE;
    }

    // Push away from wall - let go
    const inputH = this.input.getHorizontalAxis();
    if ((this.wallDirection === -1 && inputH > 0) ||
        (this.wallDirection === 1 && inputH < 0)) {
      return PLAYER_STATES.FALL;
    }

    // Spawn dust particles while sliding
    this.dustTimer += delta;
    if (this.dustTimer >= this.dustInterval) {
      this.dustTimer = 0;
      if (this.player.scene.effectsManager) {
        const dustX = this.sprite.x + (this.wallDirection * 15);
        this.player.scene.effectsManager.dustPuff(dustX, this.sprite.y, 1);
      }
    }

    return null;
  }

  performWallJump() {
    // Jump away from wall
    const jumpDirX = -this.wallDirection; // Opposite of wall direction

    this.body.setVelocity(
      jumpDirX * this.wallJumpForceX,
      -this.wallJumpForceY
    );

    // Face jump direction
    this.sprite.setFlipX(jumpDirX < 0);

    // Dust burst on wall
    if (this.player.scene.effectsManager) {
      const dustX = this.sprite.x + (this.wallDirection * 15);
      this.player.scene.effectsManager.dustPuff(dustX, this.sprite.y, 4);
    }

    return PLAYER_STATES.JUMP;
  }

  exit(nextState) {
    // Nothing special to clean up
  }

  canBeInterrupted(nextStateName) {
    return true; // Wall slide can be interrupted by most things
  }
}

/**
 * Parry State - Block with counter opportunity (Tonfas special)
 */
export class ParryState extends PlayerState {
  constructor(stateMachine) {
    super(PLAYER_STATES.PARRY, stateMachine);

    this.parryDuration = 400;     // Total parry stance time
    this.perfectWindow = 80;      // Perfect parry frames
    this.wasHit = false;
    this.wasPerfect = false;
    this.counterWindowActive = false;
    this.counterWindowTime = 400;
    this.counterTimer = 0;
  }

  enter(prevState, params) {
    this.wasHit = false;
    this.wasPerfect = false;
    this.counterWindowActive = false;
    this.counterTimer = 0;

    // Get parry data from weapon
    const weapon = this.player.getCurrentWeapon();
    const parryData = weapon?.mechanics?.parry;

    if (parryData) {
      this.parryDuration = parryData.windowTime + 200; // Window + recovery
      this.perfectWindow = parryData.perfectWindow;
      this.counterWindowTime = parryData.counterWindowTime;
    }

    // Stop movement
    this.body.setVelocityX(0);

    // Visual: defensive stance
    this.sprite.setTint(0x8888ff);

    // Register for incoming damage
    this.player.isParrying = true;
    this.player.parryState = this;
  }

  /**
   * Called by combat system when player would take damage
   * @param {object} hitData
   * @returns {boolean} True if damage was blocked
   */
  onIncomingDamage(hitData) {
    const stateTime = this.stateMachine.getStateTime();

    // Check if within parry window
    if (stateTime > this.parryDuration - 200) {
      // Recovery frames, can't parry
      return false;
    }

    this.wasHit = true;

    // Perfect parry?
    if (stateTime <= this.perfectWindow) {
      this.wasPerfect = true;
      this.counterWindowActive = true;
      this.counterTimer = 0;

      // Visual feedback
      this.sprite.setTint(0xffff00);

      if (this.player.scene.effectsManager) {
        this.player.scene.effectsManager.screenFlash(0xffff00, 100, 0.3);
        this.player.scene.effectsManager.hitSparks(
          this.sprite.x,
          this.sprite.y,
          8,
          hitData.attacker?.sprite?.flipX ? 1 : -1
        );
      }

      // Stun the attacker
      if (hitData.attacker && hitData.attacker.hitstunRemaining !== undefined) {
        const weapon = this.player.getCurrentWeapon();
        const stunTime = weapon?.mechanics?.parry?.stunOnParry || 200;
        hitData.attacker.hitstunRemaining = stunTime;
      }

      // Time slow for impact
      if (this.player.scene.timeManager) {
        this.player.scene.timeManager.applySlowmo(150, 0.3);
      }

      // Full block
      return true;
    }

    // Normal parry - reduced damage
    const weapon = this.player.getCurrentWeapon();
    const reduction = weapon?.mechanics?.parry?.blockReduction || 0.5;

    // Apply reduced damage
    const reducedDamage = Math.floor(hitData.damage * (1 - reduction));
    if (reducedDamage > 0) {
      this.player.health -= reducedDamage;

      // Still show some feedback
      if (this.player.scene.effectsManager) {
        this.player.scene.effectsManager.hitSparks(
          this.sprite.x,
          this.sprite.y,
          3,
          hitData.attacker?.sprite?.flipX ? 1 : -1
        );
      }
    }

    // Damage was "blocked" (reduced)
    return true;
  }

  update(time, delta) {
    const stateTime = this.stateMachine.getStateTime();

    // Maintain floor contact
    if (this.body.onFloor()) {
      this.body.setVelocityY(0);
    }

    // Counter window active after perfect parry
    if (this.counterWindowActive) {
      this.counterTimer += delta;

      // Attack input during counter window = counter attack
      if (this.input.justPressed(ACTIONS.ATTACK_LIGHT) ||
          this.input.justPressed(ACTIONS.ATTACK_HEAVY)) {
        return PLAYER_STATES.COUNTER_ATTACK;
      }

      // Counter window expired
      if (this.counterTimer >= this.counterWindowTime) {
        this.counterWindowActive = false;
      }
    }

    // Can release parry early
    if (this.input.isUp(ACTIONS.SPECIAL) && stateTime > 100) {
      return this.exitParry();
    }

    // Parry duration complete
    if (stateTime >= this.parryDuration) {
      return this.exitParry();
    }

    // Can flip cancel
    if (this.input.justPressed(ACTIONS.FLIP)) {
      return PLAYER_STATES.FLIP;
    }

    return null;
  }

  exitParry() {
    if (this.body.onFloor()) {
      return this.input.getHorizontalAxis() !== 0
        ? PLAYER_STATES.RUN
        : PLAYER_STATES.IDLE;
    }
    return PLAYER_STATES.FALL;
  }

  exit(nextState) {
    this.player.isParrying = false;
    this.player.parryState = null;
    this.sprite.clearTint();
  }

  canBeInterrupted(nextStateName) {
    return nextStateName === PLAYER_STATES.FLIP ||
           nextStateName === PLAYER_STATES.COUNTER_ATTACK;
  }
}

/**
 * Counter Attack State - Powerful strike after perfect parry
 */
export class CounterAttackState extends PlayerState {
  constructor(stateMachine) {
    super(PLAYER_STATES.COUNTER_ATTACK, stateMachine);

    this.attackData = null;
    this.hitboxActivated = false;
  }

  enter(prevState, params) {
    this.hitboxActivated = false;

    // Get counter attack data (weapon's special)
    this.attackData = this.player.getAttackData('special');

    if (!this.attackData) {
      // Fallback
      this.attackData = {
        startupTime: 30,
        activeTime: 100,
        recoveryTime: 150,
        damage: 35,
        knockback: { x: 400, y: -200 },
        hitstun: 450,
        hitstop: 100,
        hitbox: { width: 60, height: 50, offsetX: 35, offsetY: 0 },
      };
    }

    // Dash forward slightly
    const direction = this.sprite.flipX ? -1 : 1;
    this.body.setVelocityX(direction * 300);

    // Visual flair
    this.sprite.setTint(0xffaa00);
  }

  update(time, delta) {
    const stateTime = this.stateMachine.getStateTime();

    // Maintain floor contact
    if (this.body.onFloor()) {
      this.body.setVelocityY(0);
    }

    // Startup
    if (stateTime < this.attackData.startupTime) {
      return null;
    }

    // Active
    if (stateTime < this.attackData.startupTime + this.attackData.activeTime) {
      if (!this.hitboxActivated) {
        this.hitboxActivated = true;
        this.player.activateAttackHitbox({
          damage: this.attackData.damage,
          knockback: this.attackData.knockback,
          hitstun: this.attackData.hitstun,
          hitstop: this.attackData.hitstop,
          width: this.attackData.hitbox.width,
          height: this.attackData.hitbox.height,
          offsetX: this.attackData.hitbox.offsetX,
          offsetY: this.attackData.hitbox.offsetY,
        });

        // Big screen shake
        if (this.player.scene.effectsManager) {
          this.player.scene.effectsManager.screenShake(10, 150);
        }
      }
      return null;
    }

    // Recovery
    if (this.hitboxActivated) {
      this.player.deactivateAttackHitbox();
      this.hitboxActivated = false;
    }

    const totalDuration = this.attackData.startupTime +
                          this.attackData.activeTime +
                          this.attackData.recoveryTime;

    if (stateTime >= totalDuration) {
      if (this.body.onFloor()) {
        return this.input.getHorizontalAxis() !== 0
          ? PLAYER_STATES.RUN
          : PLAYER_STATES.IDLE;
      }
      return PLAYER_STATES.FALL;
    }

    return null;
  }

  exit(nextState) {
    this.player.deactivateAttackHitbox();
    this.sprite.clearTint();
    this.hitboxActivated = false;
  }

  canBeInterrupted(nextStateName) {
    return nextStateName === PLAYER_STATES.FLIP ||
           nextStateName === PLAYER_STATES.BLINK;
  }
}

/**
 * Weapon Swap State - Brief pause while changing weapons
 */
export class WeaponSwapState extends PlayerState {
  constructor(stateMachine) {
    super(PLAYER_STATES.WEAPON_SWAP, stateMachine);
  }

  enter(prevState, params) {
    // Slow down movement during swap
    this.body.setVelocityX(this.body.velocity.x * 0.3);

    // Visual feedback - slight scale pulse
    this.player.scene.tweens.add({
      targets: this.sprite,
      scaleX: this.sprite.scaleX * 1.1,
      scaleY: this.sprite.scaleY * 1.1,
      duration: 80,
      yoyo: true,
      ease: 'Power2',
    });

    // Emit event for HUD animation
    const wm = this.player.weaponManager;
    const direction = wm?.pendingWeapon ? 'next' : 'prev';
    this.player.scene.events.emit('weapon:swapVisual', { direction });
  }

  update(time, delta) {
    const wm = this.player.weaponManager;

    // Fall if not on ground
    if (!this.body.onFloor()) {
      // Cancel swap if we fall
      wm?.cancelSwap();
      return PLAYER_STATES.FALL;
    }

    // Maintain floor contact
    this.body.setVelocityY(0);

    // Allow some drift movement
    const horizontal = this.input.getHorizontalAxis();
    if (horizontal !== 0) {
      this.body.setVelocityX(horizontal * 50); // Slow movement
      this.sprite.setFlipX(horizontal < 0);
    } else {
      this.body.setVelocityX(0);
    }

    // Check if swap is complete
    if (wm && !wm.isSwapping) {
      // Swap finished, return to appropriate state
      if (this.input.getHorizontalAxis() !== 0) {
        return PLAYER_STATES.RUN;
      }
      return PLAYER_STATES.IDLE;
    }

    // Allow cancel with flip or blink
    if (this.input.justPressed(ACTIONS.FLIP)) {
      wm?.cancelSwap();
      return PLAYER_STATES.FLIP;
    }
    if (this.input.justPressed(ACTIONS.BLINK)) {
      wm?.cancelSwap();
      return PLAYER_STATES.BLINK;
    }

    return null;
  }

  exit(nextState) {
    // Ensure swap is either completed or cancelled
    const wm = this.player.weaponManager;
    if (wm?.isSwapping && nextState !== PLAYER_STATES.WEAPON_SWAP) {
      // If exiting early (e.g., flip/blink), cancel the swap
      wm.cancelSwap();
    }
  }

  canBeInterrupted(nextStateName) {
    // Can be cancelled by evasive moves
    return nextStateName === PLAYER_STATES.FLIP ||
           nextStateName === PLAYER_STATES.BLINK;
  }
}

/**
 * Ultimate Attack State - Devastating area attack
 */
export class UltimateState extends PlayerState {
  constructor(stateMachine) {
    super(PLAYER_STATES.ULTIMATE, stateMachine);

    this.duration = 2000;
    this.damage = 50;
    this.attacksPerformed = 0;
    this.maxAttacks = 8;
    this.attackInterval = 200;
    this.lastAttackTime = 0;
    this.targetsHit = new Set();
  }

  enter(prevState, params) {
    // Consume ultimate meter
    if (!this.player.consumeUltimate()) {
      // Shouldn't happen, but failsafe
      return PLAYER_STATES.IDLE;
    }

    this.attacksPerformed = 0;
    this.lastAttackTime = 0;
    this.targetsHit.clear();

    // Become invulnerable
    this.setInvulnerable(true);

    // Stop movement
    this.body.setVelocity(0, 0);
    this.body.setAllowGravity(false);

    // Visual: glow effect
    this.sprite.setTint(0xffdd44);

    // Time slow effect
    if (this.player.scene.timeManager) {
      this.player.scene.timeManager.applySlowmo(this.duration, 0.3);
    }

    // Screen effects
    if (this.player.scene.effectsManager) {
      this.player.scene.effectsManager.screenFlash(0xffdd44, 200, 0.4);
      this.player.scene.effectsManager.screenShake(5, this.duration);
    }

    // Emit event
    this.player.scene.events.emit('ultimate:activated');

    return null;
  }

  update(time, delta) {
    const stateTime = this.stateMachine.getStateTime();

    // Perform attacks at intervals
    if (stateTime - this.lastAttackTime >= this.attackInterval &&
        this.attacksPerformed < this.maxAttacks) {
      this.performUltimateStrike();
      this.lastAttackTime = stateTime;
      this.attacksPerformed++;
    }

    // Pulse effect
    const pulse = Math.sin(stateTime * 0.02) * 0.2 + 1;
    this.sprite.setScale(pulse);

    // Ultimate complete
    if (stateTime >= this.duration) {
      return this.finishUltimate();
    }

    return null;
  }

  performUltimateStrike() {
    const scene = this.player.scene;
    if (!scene.enemies) return;

    // Find nearest enemy not yet hit (or cycle back)
    let target = null;
    let minDistance = Infinity;

    for (const enemy of scene.enemies) {
      if (!enemy.isAlive) continue;

      const dx = enemy.sprite.x - this.sprite.x;
      const dy = enemy.sprite.y - this.sprite.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Prioritize unhit targets, but allow re-hits if all hit
      if (!this.targetsHit.has(enemy) && distance < 400) {
        if (distance < minDistance) {
          minDistance = distance;
          target = enemy;
        }
      }
    }

    // If all enemies hit, reset and allow re-hits
    if (!target && this.targetsHit.size > 0) {
      this.targetsHit.clear();
      // Try again
      for (const enemy of scene.enemies) {
        if (!enemy.isAlive) continue;
        const dx = enemy.sprite.x - this.sprite.x;
        const dy = enemy.sprite.y - this.sprite.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 400 && distance < minDistance) {
          minDistance = distance;
          target = enemy;
        }
      }
    }

    if (target) {
      // Teleport to target and strike
      const direction = target.sprite.x < this.sprite.x ? -1 : 1;

      // Create afterimage at current position
      this.createAfterimage();

      // Teleport near target
      this.sprite.setPosition(
        target.sprite.x - (direction * 40),
        target.sprite.y
      );
      this.sprite.setFlipX(direction < 0);

      // Deal damage
      const hitData = {
        damage: this.damage,
        knockback: { x: direction * 200, y: -150 },
        hitstun: 300,
        hitstop: 0, // No hitstop during ultimate (too many hits)
        attacker: this.player,
      };

      target.takeDamage(this.damage, hitData);
      this.targetsHit.add(target);

      // Hit effect
      if (scene.effectsManager) {
        scene.effectsManager.hitEffect(
          target.sprite.x,
          target.sprite.y,
          'heavy',
          direction
        );
        scene.effectsManager.damageNumber(
          target.sprite.x,
          target.sprite.y - 20,
          this.damage,
          true // Always crit visual
        );
      }
    }
  }

  createAfterimage() {
    const scene = this.player.scene;

    const afterimage = scene.add.sprite(
      this.sprite.x,
      this.sprite.y,
      this.sprite.texture.key
    );

    afterimage.setFlipX(this.sprite.flipX);
    afterimage.setAlpha(0.5);
    afterimage.setTint(0xffdd44);
    afterimage.setDepth(this.sprite.depth - 1);

    scene.tweens.add({
      targets: afterimage,
      alpha: 0,
      scale: 1.5,
      duration: 300,
      ease: 'Power2',
      onComplete: () => afterimage.destroy(),
    });
  }

  finishUltimate() {
    // Final explosion effect
    if (this.player.scene.effectsManager) {
      this.player.scene.effectsManager.screenFlash(0xffffff, 100, 0.5);
      this.player.scene.effectsManager.screenShake(12, 200);
    }

    // Return to normal
    this.body.setAllowGravity(true);

    if (this.body.onFloor()) {
      return PLAYER_STATES.IDLE;
    }
    return PLAYER_STATES.FALL;
  }

  exit(nextState) {
    this.setInvulnerable(false);
    this.sprite.clearTint();
    this.sprite.setScale(1);
    this.body.setAllowGravity(true);

    // End time slow
    if (this.player.scene.timeManager) {
      this.player.scene.timeManager.clearSlowmo();
    }

    this.player.scene.events.emit('ultimate:ended');
  }

  canBeInterrupted(nextStateName) {
    return false; // Ultimate cannot be interrupted
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
    // Movement abilities
    new FlipState(stateMachine),
    new DiveKickState(stateMachine),
    // Spin attack
    new SpinChargeState(stateMachine),
    new SpinActiveState(stateMachine),
    new SpinReleaseState(stateMachine),
    // Blink
    new BlinkState(stateMachine),
    // Grapple
    new GrappleFireState(stateMachine),
    new GrappleTravelState(stateMachine),
    new GrapplePullState(stateMachine),
    // Wall slide
    new WallSlideState(stateMachine),
    // Weapon-specific states
    new ParryState(stateMachine),
    new CounterAttackState(stateMachine),
    new WeaponSwapState(stateMachine),
    // Ultimate
    new UltimateState(stateMachine),
  ];
}
