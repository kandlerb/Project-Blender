import { PHYSICS } from '../utils/physics.js';

/**
 * Corpse state machine states
 */
export const CORPSE_STATE = Object.freeze({
  FALLING: 'falling',    // Normal physics, checking for snap opportunity
  SNAPPING: 'snapping',  // Lerping to grid position, physics disabled
  SETTLED: 'settled',    // Static sprite, no updates needed
});

/**
 * Corpse configuration for grid snapping
 */
export const CORPSE_CONFIG = Object.freeze({
  SNAP_DURATION: 200,         // ms to lerp into position
  SNAP_THRESHOLD_X: 15,       // How close horizontally to start snap
  SNAP_THRESHOLD_Y: 40,       // How close vertically (more forgiving)
  SETTLED_ALPHA: 0.7,
  SETTLED_TINT: 0x333333,
  FALLING_DEPTH: 10,          // Depth for falling corpses (render in front)
  SETTLED_DEPTH: 5,           // Depth for settled corpses (render behind)
});

/**
 * Default corpse configuration values
 */
export const CORPSE_DEFAULTS = Object.freeze({
  WIDTH: 20,
  HEIGHT: 24,
  TINT: 0x444444,
  ALPHA: 0.8,
  DECAY: false,
  DECAY_TIME: 30000,
  DECAY_DURATION: 1000,
  // Physics settings
  MASS: 1,
  DRAG_X: 350,
  BOUNCE: 0,
});

/**
 * Corpse entity - represents a dead enemy's body persisting in the game world
 * Uses grid snapping to settle into staggered brick-pattern positions
 */
export class Corpse {
  /**
   * Create a new corpse
   * @param {Phaser.Scene} scene - The scene this corpse belongs to
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {object} config - Corpse configuration
   * @param {CorpseGrid} config.grid - The grid system for settling positions
   * @param {string} [config.enemyType] - Which enemy type this was
   * @param {number} [config.width=20] - Corpse width
   * @param {number} [config.height=24] - Corpse height
   * @param {number} [config.tint=0x444444] - Visual tint color
   * @param {boolean} [config.decay=false] - Whether corpse should fade over time
   * @param {number} [config.decayTime=30000] - Milliseconds before decay starts
   */
  constructor(scene, x, y, config = {}) {
    this.scene = scene;

    // Grid reference for settling positions
    this.grid = config.grid || null;

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

    // State machine
    this.state = CORPSE_STATE.FALLING;
    this.isSettled = false;

    // Snapping state data
    this.snapData = null;

    // Grid cell this corpse occupies (set during snapping)
    this.gridCell = null;

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
   * Configure physics body for falling state
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

    // Set initial depth (falling corpses render in front)
    this.sprite.setDepth(CORPSE_CONFIG.FALLING_DEPTH);
  }

  /**
   * Update method - handles state-based behavior
   * Called by CorpseManager each frame
   * @param {number} time - Current game time in ms
   * @param {number} delta - Time since last frame in ms
   */
  update(time, delta) {
    // Settled corpses skip all update logic
    if (this.state === CORPSE_STATE.SETTLED) return;

    switch (this.state) {
      case CORPSE_STATE.FALLING:
        this.updateFalling(time, delta);
        break;

      case CORPSE_STATE.SNAPPING:
        this.updateSnapping(time, delta);
        break;
    }
  }

  /**
   * Update logic for FALLING state
   * Normal physics, checking for snap opportunity each frame
   * @param {number} time - Current game time
   * @param {number} delta - Delta time in ms
   */
  updateFalling(time, delta) {
    if (!this.grid) {
      // No grid - fall back to simple ground check
      this.checkSimpleSettling();
      return;
    }

    // Find a valid grid cell to snap to
    const cell = this.grid.findSettlingCell(this.sprite.x, this.sprite.y);

    if (cell && this.isCloseEnoughToSnap(cell)) {
      this.startSnapping(cell);
    }
  }

  /**
   * Check if the corpse is close enough to a target cell to begin snapping
   * @param {{ worldX: number, worldY: number }} cell - Target cell with world coordinates
   * @returns {boolean}
   */
  isCloseEnoughToSnap(cell) {
    const dx = Math.abs(this.sprite.x - cell.worldX);
    const dy = Math.abs(this.sprite.y - cell.worldY);

    // Must be within horizontal threshold
    if (dx > CORPSE_CONFIG.SNAP_THRESHOLD_X) return false;

    // Must be within vertical threshold AND moving downward or nearly stopped
    // This prevents snapping while still moving upward
    const body = this.sprite.body;
    const isMovingDown = body.velocity.y >= -50;

    // More forgiving vertical check - can be above or below target
    if (dy > CORPSE_CONFIG.SNAP_THRESHOLD_Y) return false;

    return isMovingDown;
  }

  /**
   * Begin the snapping transition to a grid cell
   * @param {{ col: number, row: number, worldX: number, worldY: number }} cell - Target cell
   */
  startSnapping(cell) {
    // Claim the grid cell immediately to prevent other corpses from targeting it
    this.grid.occupyCell(cell.col, cell.row, this);
    this.gridCell = { col: cell.col, row: cell.row };

    // Store snapping data
    this.snapData = {
      startX: this.sprite.x,
      startY: this.sprite.y,
      targetX: cell.worldX,
      targetY: cell.worldY,
      startTime: this.scene.time.now,
      duration: CORPSE_CONFIG.SNAP_DURATION,
    };

    // Disable physics during snap
    const body = this.sprite.body;
    body.setVelocity(0, 0);
    body.setAllowGravity(false);
    body.setImmovable(true);

    // Transition to snapping state
    this.state = CORPSE_STATE.SNAPPING;

    // Emit event
    this.scene.events.emit('corpse:snapping', {
      corpse: this,
      cell,
    });
  }

  /**
   * Update logic for SNAPPING state
   * Lerps sprite position toward target with easing
   * @param {number} time - Current game time
   * @param {number} delta - Delta time in ms
   */
  updateSnapping(time, delta) {
    if (!this.snapData) {
      // Something went wrong - settle immediately
      this.settle();
      return;
    }

    const elapsed = this.scene.time.now - this.snapData.startTime;
    const progress = Math.min(elapsed / this.snapData.duration, 1);

    // Cubic ease out for natural deceleration
    const eased = 1 - Math.pow(1 - progress, 3);

    // Lerp position
    this.sprite.x = Phaser.Math.Linear(
      this.snapData.startX,
      this.snapData.targetX,
      eased
    );
    this.sprite.y = Phaser.Math.Linear(
      this.snapData.startY,
      this.snapData.targetY,
      eased
    );

    // Alpha pulse during snapping (0.7 → 0.9) to mask the movement
    const pulseProgress = Math.sin(progress * Math.PI);
    const alpha = 0.7 + pulseProgress * 0.2;
    this.sprite.setAlpha(alpha);

    // Check if snap is complete
    if (progress >= 1) {
      this.settle();
    }
  }

  /**
   * Fallback settling for when no grid is available
   */
  checkSimpleSettling() {
    const body = this.sprite.body;

    // Check if on floor and nearly stopped
    if ((body.onFloor() || body.blocked.down) &&
        Math.abs(body.velocity.y) < 10 &&
        Math.abs(body.velocity.x) < 10) {
      this.settle();
    }
  }

  /**
   * Complete the settling process
   * Destroys physics body and marks corpse as static
   */
  settle() {
    if (this.isSettled) return;

    this.isSettled = true;
    this.state = CORPSE_STATE.SETTLED;

    // Snap to exact target position if we have snap data
    if (this.snapData) {
      this.sprite.x = this.snapData.targetX;
      this.sprite.y = this.snapData.targetY;
    }

    // Apply settled visuals
    this.sprite.setAlpha(CORPSE_CONFIG.SETTLED_ALPHA);
    this.sprite.setTint(CORPSE_CONFIG.SETTLED_TINT);

    // Move to background depth
    this.sprite.setDepth(CORPSE_CONFIG.SETTLED_DEPTH);

    // Destroy physics body entirely - sprite becomes static visual
    if (this.sprite.body) {
      // First stop all movement
      this.sprite.body.setVelocity(0, 0);
      this.sprite.body.setAllowGravity(false);
      this.sprite.body.setImmovable(true);

      // Disable the body (keeps sprite but removes from physics simulation)
      this.sprite.body.enable = false;
    }

    // Clear snap data
    this.snapData = null;

    // Emit settled event
    this.scene.events.emit('corpse:settled', {
      corpse: this,
      x: this.sprite.x,
      y: this.sprite.y,
      gridCell: this.gridCell,
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

    // Clear grid cell if occupied
    if (this.grid && this.gridCell) {
      this.grid.clearCell(this.gridCell.col, this.gridCell.row);
      this.gridCell = null;
    }

    // Destroy the sprite
    if (this.sprite && this.sprite.active) {
      this.sprite.destroy();
    }

    this.sprite = null;
    this.grid = null;
    this.snapData = null;
  }
}
