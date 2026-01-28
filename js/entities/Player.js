import { StateMachine } from '../systems/StateMachine.js';
import { createPlayerStates, PLAYER_STATES } from '../systems/PlayerStates.js';
import { PHYSICS } from '../utils/physics.js';

/**
 * Player Entity
 * The legendary warrior - handles all player behavior
 */
export class Player {
  /**
   * @param {Phaser.Scene} scene - The scene this player belongs to
   * @param {number} x - Spawn X position
   * @param {number} y - Spawn Y position
   */
  constructor(scene, x, y) {
    this.scene = scene;

    // Create sprite
    this.sprite = scene.physics.add.sprite(x, y, 'player_placeholder');
    this.setupPhysics();

    // State tracking
    this.leftGroundTime = 0; // For coyote time
    this.facingRight = true;

    // Health system (basic for now)
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.isInvulnerable = false;

    // Combat stats (will expand later)
    this.comboCount = 0;
    this.ultimateMeter = 0;

    // State machine
    this.stateMachine = new StateMachine(this, PLAYER_STATES.IDLE);
    this.stateMachine.addStates(createPlayerStates(this.stateMachine));
    this.stateMachine.start();

    // Store reference on sprite for collision callbacks
    this.sprite.setData('owner', this);
  }

  /**
   * Configure physics body
   */
  setupPhysics() {
    const body = this.sprite.body;

    body.setCollideWorldBounds(true);
    body.setBounce(0);
    body.setGravityY(PHYSICS.GRAVITY);
    body.setMaxVelocityY(PHYSICS.TERMINAL_VELOCITY);

    // Slightly smaller hitbox than sprite for forgiving collisions
    // Sprite is 32x48, hitbox is 24x44 centered
    body.setSize(24, 44);
    body.setOffset(4, 4);
  }

  /**
   * Update player - called each frame by scene
   * @param {number} time - Total elapsed time in ms
   * @param {number} delta - Time since last frame in ms
   */
  update(time, delta) {
    this.stateMachine.update(time, delta);

    // Update facing direction based on sprite flip
    this.facingRight = !this.sprite.flipX;
  }

  /**
   * Get current position
   * @returns {{x: number, y: number}}
   */
  getPosition() {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  /**
   * Get current velocity
   * @returns {{x: number, y: number}}
   */
  getVelocity() {
    return {
      x: this.sprite.body.velocity.x,
      y: this.sprite.body.velocity.y,
    };
  }

  /**
   * Check if player is on the ground
   * @returns {boolean}
   */
  isOnGround() {
    return this.sprite.body.onFloor();
  }

  /**
   * Get current state name
   * @returns {string}
   */
  getCurrentState() {
    return this.stateMachine.getCurrentStateName();
  }

  /**
   * Take damage
   * @param {number} amount - Damage amount
   * @param {object} source - What dealt the damage
   */
  takeDamage(amount, source = null) {
    if (this.isInvulnerable) return;

    this.health = Math.max(0, this.health - amount);

    // Notify state machine
    this.stateMachine.onDamage(amount, source);

    // Emit event for UI/effects
    this.scene.events.emit('player:damaged', {
      player: this,
      damage: amount,
      health: this.health,
      source,
    });

    if (this.health <= 0) {
      this.die();
    }
  }

  /**
   * Heal the player
   * @param {number} amount
   */
  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);

    this.scene.events.emit('player:healed', {
      player: this,
      amount,
      health: this.health,
    });
  }

  /**
   * Handle player death
   */
  die() {
    this.scene.events.emit('player:died', { player: this });
    // TODO: Death state, respawn logic
  }

  /**
   * Add collision with a group or object
   * @param {Phaser.GameObjects.Group|Phaser.Tilemaps.TilemapLayer} target
   * @param {Function} callback - Optional collision callback
   */
  addCollider(target, callback = null) {
    this.scene.physics.add.collider(this.sprite, target, callback);
  }

  /**
   * Debug info for HUD
   * @returns {object}
   */
  getDebugInfo() {
    const pos = this.getPosition();
    const vel = this.getVelocity();

    return {
      position: `${Math.round(pos.x)}, ${Math.round(pos.y)}`,
      velocity: `${Math.round(vel.x)}, ${Math.round(vel.y)}`,
      state: this.getCurrentState(),
      stateTime: Math.round(this.stateMachine.getStateTime()),
      onGround: this.isOnGround(),
      health: `${this.health}/${this.maxHealth}`,
      facing: this.facingRight ? 'right' : 'left',
    };
  }

  /**
   * Clean up when player is destroyed
   */
  destroy() {
    this.sprite.destroy();
  }
}
