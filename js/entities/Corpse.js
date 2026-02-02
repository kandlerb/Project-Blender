import { PHYSICS } from '../utils/physics.js';

/**
 * Corpse state machine states
 * Snap-first approach: snap when velocity drops, then cascade if unstable
 */
export const CORPSE_STATE = Object.freeze({
  FALLING: 'falling',      // Physics-enabled, gravity active, waiting to land
  SNAPPING: 'snapping',    // Found position, lerping into grid cell
  SETTLED: 'settled',      // Static sprite, stability check pending or complete
});

/**
 * Corpse configuration for snap-first settling
 */
export const CORPSE_CONFIG = Object.freeze({
  // Physics thresholds
  LANDING_VELOCITY_THRESHOLD: 20,  // Speed below which we force snap

  // Snapping
  SNAP_DURATION: 150,              // ms to lerp into final position

  // Cascade
  MAX_CASCADE_COUNT: 10,           // Prevent infinite cascade loops
  STABILITY_CHECK_DELAY: 100,      // ms after settling before checking stability
  CASCADE_COOLDOWN: 200,           // ms after cascade before allowing re-snap

  // Visuals
  SETTLED_ALPHA: 1.0,
  SETTLED_TINT: 0x666666,
  FALLING_DEPTH: 10,
  SETTLED_DEPTH: 5,
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
// DEBUG: Static counter for corpse IDs
let corpseIdCounter = 0;

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

    // Unique ID for tracking
    this.id = ++corpseIdCounter;

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

    // Cascade tracking - prevents infinite cascade loops
    this.cascadeCount = 0;
    this.settledAt = 0;
    this.cascadeCooldownUntil = 0;  // Time until we can snap again after cascade

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
    // Settled corpses skip all update logic - stability checked via delayed call
    if (this.state === CORPSE_STATE.SETTLED) return;

    // Bounds check - destroy if fallen off world
    if (this.sprite.y > this.scene.physics.world.bounds.bottom + 100) {
      this.destroy();
      return;
    }

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
   * Snap-first approach: force snap when velocity drops low enough
   * @param {number} time - Current game time
   * @param {number} delta - Delta time in ms
   */
  updateFalling(time, delta) {
    if (!this.grid) {
      // No grid - fall back to simple ground check
      this.checkSimpleSettling();
      return;
    }

    // Don't snap during cascade cooldown - need time to fall away from previous position
    if (this.scene.time.now < this.cascadeCooldownUntil) {
      return;
    }

    // Check velocity - force snap when low enough (landed on something)
    const velocity = this.sprite.body.velocity;
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

    if (speed < CORPSE_CONFIG.LANDING_VELOCITY_THRESHOLD) {
      // Velocity is low - force snap to nearest open cell
      this.forceSnapToNearestCell();
    }
  }

  /**
   * Force snap to the nearest unoccupied cell - no stability check
   * Stability will be checked AFTER settling
   */
  forceSnapToNearestCell() {
    const { col, row } = this.grid.worldToGrid(this.sprite.x, this.sprite.y);

    // Find nearest unoccupied cell - don't check stability, just find ANY open cell
    const cell = this.findNearestUnoccupiedCell(col, row);

    if (!cell) {
      // Extremely rare - no cells available at all
      console.warn(`Corpse #${this.id}: No cells available near (${col},${row}), destroying`);
      this.destroy();
      return;
    }

    this.startSnappingToCell(cell.col, cell.row);
  }

  /**
   * Find the nearest unoccupied cell, searching outward from start position
   * @param {number} startCol - Starting column
   * @param {number} startRow - Starting row
   * @returns {{ col: number, row: number } | null}
   */
  findNearestUnoccupiedCell(startCol, startRow) {
    // Check current cell first
    if (!this.grid.isOccupied(startCol, startRow) && !this.grid.isGroundAt(startCol, startRow)) {
      return { col: startCol, row: startRow };
    }

    // Spiral outward to find nearest unoccupied cell
    for (let radius = 1; radius <= 10; radius++) {
      for (let dRow = -radius; dRow <= radius; dRow++) {
        for (let dCol = -radius; dCol <= radius; dCol++) {
          // Only check cells on the edge of this radius
          if (Math.abs(dCol) !== radius && Math.abs(dRow) !== radius) continue;

          const col = startCol + dCol;
          const row = startRow + dRow;

          if (col >= 0 && !this.grid.isOccupied(col, row) && !this.grid.isGroundAt(col, row)) {
            return { col, row };
          }
        }
      }
    }

    return null;
  }

  /**
   * Start snapping to a specific grid cell
   * @param {number} col - Grid column
   * @param {number} row - Grid row
   */
  startSnappingToCell(col, row) {
    // Check if cell is still available
    if (this.grid.isOccupied(col, row)) {
      // Cell was taken - go back to falling
      this.state = CORPSE_STATE.FALLING;
      return;
    }

    // Claim the cell
    this.grid.occupyCell(col, row, this);
    this.gridCell = { col, row };

    // Get target world position
    const target = this.grid.gridToWorld(col, row);

    // Store snapping data
    this.snapData = {
      startX: this.sprite.x,
      startY: this.sprite.y,
      targetX: target.x,
      targetY: target.y,
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
      cell: { col, row, worldX: target.x, worldY: target.y },
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

    // Fade to full opacity during snapping (0.8 → 1.0)
    const alpha = 0.8 + progress * 0.2;
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
   * Converts physics body to static platform for walkability
   */
  settle() {
    if (this.isSettled) return;

    this.isSettled = true;
    this.state = CORPSE_STATE.SETTLED;
    this.settledAt = this.scene.time.now; // Track when we settled for cascade immunity

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

    // Convert to static platform body for walking on
    if (this.sprite.body) {
      // Stop all movement
      this.sprite.body.setVelocity(0, 0);
      this.sprite.body.setAllowGravity(false);
      this.sprite.body.setImmovable(true);
      this.sprite.body.moves = false;

      // The sprite is rotated 90 degrees, so:
      // - Visual width = config.height (original height becomes visual width)
      // - Visual height = config.width (original width becomes visual height)
      const visualWidth = this.config.height;
      const visualHeight = this.config.width;

      // Create a thin platform body at the TOP of the visual corpse
      const platformHeight = 4; // Very thin platform surface
      const platformWidth = visualWidth * 0.85; // Slightly narrower than visual

      this.sprite.body.setSize(platformWidth, platformHeight);

      // Calculate offset to position platform at visual top and centered horizontally
      // Body offset is relative to the unrotated sprite's top-left corner
      // For origin (0.5, 0.5): body top-left = sprite.position - sprite.dimensions/2 + offset

      // Horizontal: center the narrower body within the unrotated sprite width
      const offsetX = (this.config.width - platformWidth) / 2;

      // Vertical: position body at visual top
      // Body top = sprite.y - config.height/2 + offset.y
      // Visual top = sprite.y - visualHeight/2 = sprite.y - config.width/2
      // For body top = visual top: offset.y = config.height/2 - config.width/2
      const offsetY = (this.config.height - this.config.width) / 2;

      this.sprite.body.setOffset(offsetX, offsetY);

      // One-way platform: entities can pass through from below and sides
      // but stand ON from above - prevents getting stuck inside piles
      this.sprite.body.checkCollision.up = true;
      this.sprite.body.checkCollision.down = false;
      this.sprite.body.checkCollision.left = false;
      this.sprite.body.checkCollision.right = false;
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

    console.log(`Corpse #${this.id}: Entered SETTLED state at (${this.gridCell?.col},${this.gridCell?.row})`);

    // Schedule stability check after a brief delay (let other corpses settle too)
    this.scene.time.delayedCall(CORPSE_CONFIG.STABILITY_CHECK_DELAY, () => {
      console.log(`Corpse #${this.id}: Running scheduled stability check`);
      this.checkStabilityAndCascade();
    });
  }

  /**
   * Check if this corpse is stable and cascade if not
   * Called after settling via delayed call
   */
  checkStabilityAndCascade() {
    if (this.state !== CORPSE_STATE.SETTLED) {
      console.log(`Corpse #${this.id}: stability check skipped - not settled (state=${this.state})`);
      return;
    }
    if (!this.gridCell) {
      console.log(`Corpse #${this.id}: stability check skipped - no grid cell`);
      return;
    }
    if (!this.grid) {
      console.log(`Corpse #${this.id}: stability check skipped - no grid reference`);
      return;
    }

    const { col, row } = this.gridCell;

    // Ground level is always stable
    if (this.grid.isGroundBelow(col, row)) {
      console.log(`Corpse #${this.id}: STABLE at (${col},${row}) - on ground`);
      return;
    }

    // Check support cells - need BOTH occupied to be stable
    const supports = this.grid.getSupportCells(col, row);
    const leftSupport = supports[0];
    const rightSupport = supports[1];
    const leftOccupied = this.grid.isOccupied(leftSupport.col, leftSupport.row);
    const rightOccupied = this.grid.isOccupied(rightSupport.col, rightSupport.row);

    console.log(`Corpse #${this.id} at (${col},${row}): supports = (${leftSupport.col},${leftSupport.row}):${leftOccupied ? 'occupied' : 'EMPTY'}, (${rightSupport.col},${rightSupport.row}):${rightOccupied ? 'occupied' : 'EMPTY'}`);

    if (leftOccupied && rightOccupied) {
      console.log(`Corpse #${this.id}: STABLE - dual support`);
      return;
    }

    // UNSTABLE - cascade down
    console.log(`Corpse #${this.id}: UNSTABLE - cascading!`);
    this.cascade();
  }

  /**
   * Cascade: unsettle and fall to find a new position
   * Called when stability check fails
   */
  cascade() {
    if (this.state !== CORPSE_STATE.SETTLED) {
      console.log(`Corpse #${this.id}: cascade() called but not settled (state=${this.state})`);
      return;
    }

    // Prevent infinite cascade loops
    this.cascadeCount++;
    if (this.cascadeCount > CORPSE_CONFIG.MAX_CASCADE_COUNT) {
      console.warn(`Corpse #${this.id}: Cascade limit reached, forcing stable`);
      return; // Stay where you are
    }

    console.log(`Corpse #${this.id}: Cascading (count: ${this.cascadeCount})`);

    // Set cascade cooldown to prevent immediately re-snapping to the same cell
    this.cascadeCooldownUntil = this.scene.time.now + CORPSE_CONFIG.CASCADE_COOLDOWN;

    // Clear grid cell
    if (this.grid && this.gridCell) {
      console.log(`Corpse #${this.id}: Clearing cell (${this.gridCell.col},${this.gridCell.row})`);
      this.grid.clearCell(this.gridCell.col, this.gridCell.row);
      this.gridCell = null;
    }

    // Re-enable physics for falling
    if (this.sprite && this.sprite.body) {
      this.sprite.body.setAllowGravity(true);
      this.sprite.body.setImmovable(false);
      this.sprite.body.moves = true;

      // Restore full body size for falling
      this.sprite.body.setSize(this.config.width, this.config.height);
      this.sprite.body.setOffset(0, 0);

      // Re-enable all collision directions
      this.sprite.body.checkCollision.up = true;
      this.sprite.body.checkCollision.down = true;
      this.sprite.body.checkCollision.left = true;
      this.sprite.body.checkCollision.right = true;

      // Give corpse velocity to fall away from current position
      // Higher velocity ensures it moves before the cooldown ends
      const nudge = (Math.random() - 0.5) * 80;
      this.sprite.body.setVelocity(nudge, 100);
    }

    // Restore falling visuals
    this.sprite.setTint(this.config.tint);
    this.sprite.setAlpha(CORPSE_DEFAULTS.ALPHA);
    this.sprite.setDepth(CORPSE_CONFIG.FALLING_DEPTH);

    // Return to falling state
    this.state = CORPSE_STATE.FALLING;
    this.isSettled = false;
    this.snapData = null;

    console.log(`Corpse #${this.id}: Now FALLING`);

    // Emit event
    this.scene.events.emit('corpse:cascading', {
      corpse: this,
      cascadeCount: this.cascadeCount,
    });
  }

  /**
   * Force corpse back to falling state (for external cascade triggers)
   * Used when a corpse becomes unstable due to support being removed
   */
  unsettle() {
    if (this.state !== CORPSE_STATE.SETTLED) return;
    this.cascade();
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
