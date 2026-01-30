import { PHYSICS } from '../utils/physics.js';

/**
 * Corpse settling constants (cellular automata style)
 */
export const CORPSE_SETTLE = Object.freeze({
  CHECK_INTERVAL: 200,      // ms between settling checks
  MAX_STUCK_COUNT: 3,       // stuck checks before becoming settled
  SLIDE_IMPULSE: 80,        // horizontal impulse when sliding off
  GROUND_CHECK_OFFSET: 4,   // pixels below body to check for ground/corpse
  SIDE_CHECK_DISTANCE: 12,  // pixels to the side to check for clearance
});

/**
 * Default corpse configuration values
 */
export const CORPSE_DEFAULTS = Object.freeze({
  WIDTH: 20,
  HEIGHT: 24,
  TINT: 0x444444,
  ALPHA: 0.8,
  SETTLED_ALPHA: 0.6,
  DECAY: false,
  DECAY_TIME: 30000,
  DECAY_DURATION: 1000,
  // Physics settings
  MASS: 1,
  DRAG_X: 350,          // High horizontal drag so they don't slide forever
  BOUNCE: 0,            // Corpses don't bounce
});

/**
 * Corpse entity - represents a dead enemy's body persisting in the game world
 * Uses "sand physics" cellular automata settling to form natural piles
 */
export class Corpse {
  /**
   * Create a new corpse
   * @param {Phaser.Scene} scene - The scene this corpse belongs to
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {object} config - Corpse configuration
   * @param {string} [config.enemyType] - Which enemy type this was
   * @param {number} [config.width=20] - Corpse width
   * @param {number} [config.height=24] - Corpse height
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

    // Settling state (cellular automata)
    this.isSettled = false;
    this.stuckCount = 0;
    this.lastSettleCheck = 0;

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
   * Configure physics body
   * - Gravity: Uses PHYSICS.GRAVITY
   * - Body size: ~20x24
   * - Bounce: 0
   * - Drag: High horizontal drag (350)
   * - Mass: 1
   */
  setupPhysics() {
    const body = this.sprite.body;

    // Dynamic body that falls with gravity
    body.setImmovable(false);
    body.setMass(CORPSE_DEFAULTS.MASS);

    // Allow gravity (world gravity is 0, so we set per-body)
    body.setAllowGravity(true);
    body.setGravityY(PHYSICS.GRAVITY);

    // High horizontal drag so corpses don't slide forever
    body.setDrag(CORPSE_DEFAULTS.DRAG_X, 0);

    // No bounce - corpses settle, not bounce
    body.setBounce(CORPSE_DEFAULTS.BOUNCE);

    // Terminal velocity
    body.setMaxVelocityY(PHYSICS.TERMINAL_VELOCITY);

    // Set collision size
    body.setSize(this.config.width, this.config.height);

    // Collide with world bounds
    body.setCollideWorldBounds(true);
  }

  /**
   * Apply visual properties to sprite
   */
  setupVisuals() {
    // Apply dark tint
    this.sprite.setTint(this.config.tint);

    // Slight alpha reduction
    this.sprite.setAlpha(CORPSE_DEFAULTS.ALPHA);

    // Scale sprite to approximate config dimensions
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
   * Update method - handles settling logic
   * Called by CorpseManager each frame
   * @param {number} time - Current game time in ms
   * @param {number} delta - Time since last frame in ms
   */
  update(time, delta) {
    // Settled corpses skip all update logic
    if (this.isSettled) return;

    // Check settling at interval
    if (time - this.lastSettleCheck >= CORPSE_SETTLE.CHECK_INTERVAL) {
      this.lastSettleCheck = time;
      this.checkSettling();
    }
  }

  /**
   * Cellular automata settling check
   * 1. If not touching anything below -> do nothing (falling)
   * 2. If touching GROUND below -> settled = true, become static
   * 3. If touching CORPSE below:
   *    a. Randomly pick direction (left or right)
   *    b. Check if that direction is clear
   *    c. If clear -> apply small horizontal impulse that direction
   *    d. If blocked -> check opposite direction
   *    e. If opposite clear -> apply impulse opposite direction
   *    f. If both blocked -> increment stuck counter
   *    g. After 3 stuck checks -> settled = true
   */
  checkSettling() {
    if (!this.sprite || !this.sprite.body) return;

    const body = this.sprite.body;

    // Check what's below us
    const belowResult = this.checkBelow();

    if (belowResult === 'none') {
      // Not touching anything below - still falling, reset stuck count
      this.stuckCount = 0;
      return;
    }

    if (belowResult === 'ground') {
      // Touching ground - become settled
      this.settle();
      return;
    }

    if (belowResult === 'corpse') {
      // Touching another corpse - try to slide off
      this.trySlideOff();
    }
  }

  /**
   * Check what's directly below the corpse
   * @returns {'none' | 'ground' | 'corpse'} What's below
   */
  checkBelow() {
    if (!this.sprite || !this.sprite.body) return 'none';

    const body = this.sprite.body;
    const checkY = body.bottom + CORPSE_SETTLE.GROUND_CHECK_OFFSET;
    const centerX = body.center.x;

    // First check if on floor (world bounds or ground collision)
    if (body.onFloor() || body.blocked.down) {
      // Check if it's a corpse or ground by looking at what we're touching
      // If velocity is near zero and blocked.down, likely on ground or stable surface
      if (Math.abs(body.velocity.y) < 10) {
        // Check for corpse collision specifically
        const corpseBelow = this.findCorpseBelow();
        if (corpseBelow) {
          return 'corpse';
        }
        return 'ground';
      }
    }

    // Check terrain groups for ground contact
    const manager = this.scene.corpseManager;
    if (manager && manager.terrainGroups) {
      for (const terrainGroup of manager.terrainGroups) {
        if (!terrainGroup) continue;

        const children = terrainGroup.getChildren();
        for (const terrain of children) {
          if (!terrain.body) continue;

          const terrainBody = terrain.body;

          // Check if we're horizontally aligned
          const horizontalOverlap =
            body.right > terrainBody.left && body.left < terrainBody.right;

          if (!horizontalOverlap) continue;

          // Check if terrain is directly below us
          if (body.bottom >= terrainBody.top - CORPSE_SETTLE.GROUND_CHECK_OFFSET &&
              body.bottom <= terrainBody.top + CORPSE_SETTLE.GROUND_CHECK_OFFSET) {
            return 'ground';
          }
        }
      }
    }

    // Check for corpse below
    const corpseBelow = this.findCorpseBelow();
    if (corpseBelow) {
      return 'corpse';
    }

    return 'none';
  }

  /**
   * Find a corpse directly below this one
   * @returns {Corpse|null} The corpse below, or null
   */
  findCorpseBelow() {
    const manager = this.scene.corpseManager;
    if (!manager) return null;

    const body = this.sprite.body;
    const checkY = body.bottom + CORPSE_SETTLE.GROUND_CHECK_OFFSET;

    for (const otherCorpse of manager.corpses) {
      if (otherCorpse === this) continue;
      if (!otherCorpse.sprite || !otherCorpse.sprite.body) continue;

      const otherBody = otherCorpse.sprite.body;

      // Check horizontal overlap
      const horizontalOverlap =
        body.right > otherBody.left && body.left < otherBody.right;

      if (!horizontalOverlap) continue;

      // Check if other corpse is directly below us
      const verticalDistance = otherBody.top - body.bottom;
      if (verticalDistance >= -CORPSE_SETTLE.GROUND_CHECK_OFFSET &&
          verticalDistance <= CORPSE_SETTLE.GROUND_CHECK_OFFSET) {
        return otherCorpse;
      }
    }

    return null;
  }

  /**
   * Try to slide off the corpse below
   */
  trySlideOff() {
    const body = this.sprite.body;

    // Randomly pick initial direction
    let direction = Math.random() < 0.5 ? -1 : 1;

    // Check if first direction is clear
    if (this.isDirectionClear(direction)) {
      this.applySlideImpulse(direction);
      this.stuckCount = 0;
      return;
    }

    // Try opposite direction
    direction = -direction;
    if (this.isDirectionClear(direction)) {
      this.applySlideImpulse(direction);
      this.stuckCount = 0;
      return;
    }

    // Both directions blocked - increment stuck counter
    this.stuckCount++;

    if (this.stuckCount >= CORPSE_SETTLE.MAX_STUCK_COUNT) {
      // Stuck for too long - settle in place
      this.settle();
    }
  }

  /**
   * Check if a direction is clear for sliding
   * @param {number} direction - -1 for left, 1 for right
   * @returns {boolean} Whether the direction is clear
   */
  isDirectionClear(direction) {
    if (!this.sprite || !this.sprite.body) return false;

    const body = this.sprite.body;
    const checkX = direction > 0
      ? body.right + CORPSE_SETTLE.SIDE_CHECK_DISTANCE
      : body.left - CORPSE_SETTLE.SIDE_CHECK_DISTANCE;
    const checkY = body.center.y;

    // Check against terrain
    const manager = this.scene.corpseManager;
    if (manager && manager.terrainGroups) {
      for (const terrainGroup of manager.terrainGroups) {
        if (!terrainGroup) continue;

        const children = terrainGroup.getChildren();
        for (const terrain of children) {
          if (!terrain.body) continue;

          const terrainBody = terrain.body;

          // Check if the check point would be inside terrain
          if (checkX >= terrainBody.left && checkX <= terrainBody.right &&
              checkY >= terrainBody.top && checkY <= terrainBody.bottom) {
            return false;
          }
        }
      }
    }

    // Check against other corpses
    if (manager) {
      for (const otherCorpse of manager.corpses) {
        if (otherCorpse === this) continue;
        if (!otherCorpse.sprite || !otherCorpse.sprite.body) continue;

        const otherBody = otherCorpse.sprite.body;

        // Check if the check point would be inside this corpse
        if (checkX >= otherBody.left && checkX <= otherBody.right &&
            checkY >= otherBody.top && checkY <= otherBody.bottom) {
          return false;
        }
      }
    }

    // Check world bounds
    const worldBounds = this.scene.physics.world.bounds;
    if (checkX <= worldBounds.left || checkX >= worldBounds.right) {
      return false;
    }

    return true;
  }

  /**
   * Apply a horizontal sliding impulse
   * @param {number} direction - -1 for left, 1 for right
   */
  applySlideImpulse(direction) {
    if (!this.sprite || !this.sprite.body) return;

    const body = this.sprite.body;
    body.setVelocityX(direction * CORPSE_SETTLE.SLIDE_IMPULSE);
  }

  /**
   * Settle the corpse - make it static and stop processing
   */
  settle() {
    if (this.isSettled) return;

    this.isSettled = true;

    if (!this.sprite || !this.sprite.body) return;

    const body = this.sprite.body;

    // Stop all movement
    body.setVelocity(0, 0);

    // Make static - disable gravity and make immovable
    body.setAllowGravity(false);
    body.setImmovable(true);

    // Fade slightly more when settled
    this.sprite.setAlpha(CORPSE_DEFAULTS.SETTLED_ALPHA);

    // Emit settled event
    this.scene.events.emit('corpse:settled', {
      corpse: this,
      x: this.sprite.x,
      y: this.sprite.y,
    });
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
