import { StateMachine, State } from '../systems/StateMachine.js';
import { CombatBox, BOX_TYPE, TEAM } from '../systems/CombatBox.js';
import { PHYSICS } from '../utils/physics.js';

/**
 * Enemy states
 */
export const ENEMY_STATES = Object.freeze({
  IDLE: 'idle',
  HITSTUN: 'hitstun',
  DEAD: 'dead',
});

/**
 * Base Enemy class
 */
export class Enemy {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {object} config
   */
  constructor(scene, x, y, config = {}) {
    this.scene = scene;

    // Stats
    this.maxHealth = config.maxHealth || 30;
    this.health = this.maxHealth;
    this.damage = config.damage || 10;
    this.isAlive = true;

    // Create sprite
    this.sprite = scene.physics.add.sprite(x, y, 'enemy_placeholder');
    this.setupPhysics();

    // Combat boxes
    this.hurtbox = new CombatBox(scene, {
      owner: this,
      type: BOX_TYPE.HURTBOX,
      team: TEAM.ENEMY,
      width: 24,
      height: 24,
      offsetX: 0,
      offsetY: 0,
    });

    // Register with combat manager
    if (scene.combatManager) {
      scene.combatManager.register(this.hurtbox);
    }

    // Hurtbox always active while alive
    this.hurtbox.activate();

    // State machine
    this.stateMachine = new StateMachine(this, ENEMY_STATES.IDLE);
    this.stateMachine.addStates([
      new EnemyIdleState(this.stateMachine),
      new EnemyHitstunState(this.stateMachine),
      new EnemyDeadState(this.stateMachine),
    ]);
    this.stateMachine.start();

    // Store reference on sprite
    this.sprite.setData('owner', this);

    // Hitstun tracking
    this.hitstunRemaining = 0;
    this.lastHitData = null;
  }

  setupPhysics() {
    const body = this.sprite.body;

    body.setCollideWorldBounds(true);
    body.setBounce(0.2);
    body.setGravityY(PHYSICS.GRAVITY);
    body.setMaxVelocityY(PHYSICS.TERMINAL_VELOCITY);
    body.setDrag(200, 0);

    // Smaller hitbox
    body.setSize(20, 24);
    body.setOffset(4, 4);
  }

  /**
   * Update enemy
   * @param {number} time
   * @param {number} delta
   */
  update(time, delta) {
    if (!this.isAlive) return;

    // Update hitstun timer
    if (this.hitstunRemaining > 0) {
      this.hitstunRemaining = Math.max(0, this.hitstunRemaining - delta);
    }

    this.stateMachine.update(time, delta);
    this.hurtbox.updatePosition();
  }

  /**
   * Take damage
   * @param {number} amount
   * @param {object} hitData
   */
  takeDamage(amount, hitData = null) {
    if (!this.isAlive) return;

    this.health = Math.max(0, this.health - amount);
    this.lastHitData = hitData;

    // Apply hitstun
    if (hitData && hitData.hitstun) {
      this.hitstunRemaining = hitData.hitstun;
      this.stateMachine.transition(ENEMY_STATES.HITSTUN, { hitData }, true);
    }

    // Flash white briefly
    this.flashWhite();

    // Emit event
    this.scene.events.emit('enemy:damaged', {
      enemy: this,
      damage: amount,
      health: this.health,
      hitData,
    });

    if (this.health <= 0) {
      this.die();
    }
  }

  /**
   * Flash sprite white on hit
   */
  flashWhite() {
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(50, () => {
      if (this.sprite && this.sprite.active) {
        this.sprite.clearTint();
      }
    });
  }

  /**
   * Handle death
   */
  die() {
    this.isAlive = false;
    this.hurtbox.deactivate();
    this.stateMachine.transition(ENEMY_STATES.DEAD, {}, true);

    this.scene.events.emit('enemy:killed', { enemy: this });
  }

  /**
   * Add collision with ground/platforms
   * @param {*} target
   */
  addCollider(target) {
    this.scene.physics.add.collider(this.sprite, target);
  }

  /**
   * Toggle debug display
   * @param {boolean} show
   */
  setCombatDebug(show) {
    this.hurtbox.setDebug(show);
  }

  /**
   * Get debug info
   * @returns {object}
   */
  getDebugInfo() {
    return {
      health: `${this.health}/${this.maxHealth}`,
      state: this.stateMachine.getCurrentStateName(),
      hitstun: Math.round(this.hitstunRemaining),
      alive: this.isAlive,
    };
  }

  /**
   * Clean up
   */
  destroy() {
    if (this.scene.combatManager) {
      this.scene.combatManager.unregister(this.hurtbox);
    }
    this.hurtbox.destroy();
    this.sprite.destroy();
  }
}

/**
 * Enemy Idle State
 */
class EnemyIdleState extends State {
  constructor(stateMachine) {
    super(ENEMY_STATES.IDLE, stateMachine);
  }

  get enemy() {
    return this.entity;
  }

  enter(prevState, params) {
    // TODO: Play idle animation
  }

  update(time, delta) {
    // Basic enemies just stand there for now
    // TODO: Add patrol, chase, attack behaviors
    return null;
  }
}

/**
 * Enemy Hitstun State
 */
class EnemyHitstunState extends State {
  constructor(stateMachine) {
    super(ENEMY_STATES.HITSTUN, stateMachine);
  }

  get enemy() {
    return this.entity;
  }

  enter(prevState, params) {
    // TODO: Play hitstun animation
  }

  update(time, delta) {
    // Exit hitstun when timer expires
    if (this.enemy.hitstunRemaining <= 0) {
      return ENEMY_STATES.IDLE;
    }
    return null;
  }

  canBeInterrupted(nextStateName) {
    // Can be interrupted by death
    return nextStateName === ENEMY_STATES.DEAD;
  }
}

/**
 * Enemy Dead State
 */
class EnemyDeadState extends State {
  constructor(stateMachine) {
    super(ENEMY_STATES.DEAD, stateMachine);
    this.deathDuration = 500; // ms before despawn
  }

  get enemy() {
    return this.entity;
  }

  enter(prevState, params) {
    // Death animation
    this.enemy.sprite.setTint(0x666666);
    this.enemy.sprite.setAlpha(0.7);

    // Disable physics
    this.enemy.sprite.body.setVelocity(0, 0);
    this.enemy.sprite.body.setAllowGravity(false);

    // Fade out and destroy
    this.enemy.scene.tweens.add({
      targets: this.enemy.sprite,
      alpha: 0,
      y: this.enemy.sprite.y - 20,
      duration: this.deathDuration,
      ease: 'Power2',
      onComplete: () => {
        this.enemy.destroy();
      },
    });
  }

  update(time, delta) {
    return null;
  }

  canBeInterrupted() {
    return false; // Death is final
  }
}
