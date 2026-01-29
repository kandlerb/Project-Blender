import { PHYSICS } from '../utils/physics.js';

/**
 * Default corpse configuration values
 */
export const CORPSE_DEFAULTS = Object.freeze({
  WIDTH: 24,
  HEIGHT: 16,
  TINT: 0x444444,
  ALPHA: 0.8,
  DECAY: false,
  DECAY_TIME: 30000,
  DECAY_DURATION: 1000,
});

/**
 * Corpse entity - represents a dead enemy's body persisting in the game world
 */
export class Corpse {
  /**
   * Create a new corpse
   * @param {Phaser.Scene} scene - The scene this corpse belongs to
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {object} config - Corpse configuration
   * @param {string} [config.enemyType] - Which enemy type this was (for visual differentiation)
   * @param {number} [config.width=24] - Corpse width
   * @param {number} [config.height=16] - Corpse height
   * @param {number} [config.tint=0x444444] - Visual tint color
   * @param {boolean} [config.decay=false] - Whether corpse should fade over time
   * @param {number} [config.decayTime=30000] - Milliseconds before decay starts
   */
  constructor(scene, x, y, config = {}) {
    this.scene = scene;

    // Store config with defaults
    this.config = {
      enemyType: config.enemyType || 'unknown',
      width: config.width ?? CORPSE_DEFAULTS.WIDTH,
      height: config.height ?? CORPSE_DEFAULTS.HEIGHT,
      tint: config.tint ?? CORPSE_DEFAULTS.TINT,
      decay: config.decay ?? CORPSE_DEFAULTS.DECAY,
      decayTime: config.decayTime ?? CORPSE_DEFAULTS.DECAY_TIME,
    };

    // Create physics sprite
    this.sprite = scene.physics.add.sprite(x, y, 'enemy_placeholder');

    // Configure physics body
    this.setupPhysics();

    // Apply visual properties
    this.setupVisuals();

    // Store reference on sprite for collision callbacks
    this.sprite.setData('owner', this);
    this.sprite.setData('type', 'corpse');

    // Set up decay timer if enabled
    if (this.config.decay) {
      this.decayTimer = scene.time.delayedCall(this.config.decayTime, () => {
        this.startDecay();
      });
    }

    this.isDecaying = false;
  }

  /**
   * Configure physics body for static-like collision behavior
   */
  setupPhysics() {
    const body = this.sprite.body;

    // Immovable by default - only Brutes can move corpses (via destroyCorpseWithForce)
    // All other entities should step up onto or be blocked by corpses
    body.setImmovable(true);

    // Allow gravity so corpses fall (world gravity is 0, so we set per-body)
    body.setAllowGravity(true);
    body.setGravityY(PHYSICS.GRAVITY);

    // High drag so they settle quickly
    body.setDrag(1000, 0);

    // Limited movement speed
    body.setMaxVelocity(200, 800);

    // Slight bounce for feel
    body.setBounce(0.1);

    // Set collision size to match config dimensions
    body.setSize(this.config.width, this.config.height);

    // Collide with world bounds
    body.setCollideWorldBounds(true);
  }

  /**
   * Apply visual properties to sprite
   */
  setupVisuals() {
    // Apply tint
    this.sprite.setTint(this.config.tint);

    // Set alpha for dead appearance
    this.sprite.setAlpha(CORPSE_DEFAULTS.ALPHA);

    // Scale sprite to approximate config dimensions
    // Using the placeholder texture, scale to match desired size
    const currentWidth = this.sprite.width;
    const currentHeight = this.sprite.height;

    if (currentWidth > 0 && currentHeight > 0) {
      const scaleX = this.config.width / currentWidth;
      const scaleY = this.config.height / currentHeight;
      this.sprite.setScale(scaleX, scaleY);
    }

    // Rotate slightly to look fallen
    this.sprite.setRotation(Math.PI / 2);
  }

  /**
   * Begin the decay fade-out animation
   */
  startDecay() {
    if (this.isDecaying) return;

    this.isDecaying = true;

    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: CORPSE_DEFAULTS.DECAY_DURATION,
      ease: 'Power2',
      onComplete: () => {
        this.destroy();
      },
    });
  }

  /**
   * Add a collider with another game object
   * @param {Phaser.GameObjects.GameObject} target - The object to collide with
   * @returns {Phaser.Physics.Arcade.Collider} The collider object
   */
  addCollider(target) {
    return this.scene.physics.add.collider(this.sprite, target);
  }

  /**
   * Clean up the corpse and remove from scene
   */
  destroy() {
    // Cancel decay timer if it exists
    if (this.decayTimer) {
      this.decayTimer.remove();
      this.decayTimer = null;
    }

    // Destroy the sprite
    if (this.sprite && this.sprite.active) {
      this.sprite.destroy();
    }

    this.sprite = null;
  }
}
