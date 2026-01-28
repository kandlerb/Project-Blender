/**
 * Box types for combat collision
 */
export const BOX_TYPE = Object.freeze({
  HITBOX: 'hitbox',   // Deals damage
  HURTBOX: 'hurtbox', // Receives damage
});

/**
 * Combat teams - hitboxes only affect opposing teams
 */
export const TEAM = Object.freeze({
  PLAYER: 'player',
  ENEMY: 'enemy',
  NEUTRAL: 'neutral', // Hits everyone
});

/**
 * CombatBox - A hitbox or hurtbox attached to an entity
 */
export class CombatBox {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} config
   */
  constructor(scene, config) {
    this.scene = scene;
    this.owner = config.owner;           // Entity that owns this box
    this.type = config.type;             // BOX_TYPE.HITBOX or HURTBOX
    this.team = config.team;             // TEAM.PLAYER, ENEMY, etc.

    // Box dimensions and offset from owner
    this.width = config.width || 32;
    this.height = config.height || 32;
    this.offsetX = config.offsetX || 0;
    this.offsetY = config.offsetY || 0;
    this.followFacing = config.followFacing !== false; // Flip offset based on facing

    // Hitbox-specific properties
    this.damage = config.damage || 0;
    this.knockback = config.knockback || { x: 200, y: -100 };
    this.hitstun = config.hitstun || 200; // ms
    this.hitstop = config.hitstop || 50;  // ms

    // State
    this.active = false;
    this.hasHit = new Set(); // Track what we've already hit (prevent multi-hit)

    // Create the physics body (sensor - no physical collision)
    this.zone = scene.add.zone(0, 0, this.width, this.height);
    scene.physics.add.existing(this.zone, false);
    this.zone.body.setAllowGravity(false);
    this.zone.body.setImmovable(true);

    // Store reference back to this CombatBox
    this.zone.setData('combatBox', this);

    // Debug visualization
    this.debugGraphics = null;
    if (scene.physics.world.drawDebug) {
      this.createDebugGraphics();
    }

    // Start inactive
    this.deactivate();
  }

  /**
   * Activate the combat box
   * @param {object} overrides - Optional property overrides
   */
  activate(overrides = {}) {
    this.active = true;
    this.hasHit.clear();
    this.zone.body.enable = true;

    // Apply any overrides
    if (overrides.damage !== undefined) this.damage = overrides.damage;
    if (overrides.knockback) this.knockback = overrides.knockback;
    if (overrides.hitstun !== undefined) this.hitstun = overrides.hitstun;
    if (overrides.hitstop !== undefined) this.hitstop = overrides.hitstop;

    this.updatePosition();
  }

  /**
   * Deactivate the combat box
   */
  deactivate() {
    this.active = false;
    this.zone.body.enable = false;
    this.hasHit.clear();
  }

  /**
   * Update position to follow owner
   */
  updatePosition() {
    if (!this.active || !this.owner) return;

    // Get owner position
    const ownerSprite = this.owner.sprite || this.owner;
    const ownerX = ownerSprite.x;
    const ownerY = ownerSprite.y;

    // Calculate offset (flip X if facing left)
    let offsetX = this.offsetX;
    if (this.followFacing && ownerSprite.flipX) {
      offsetX = -offsetX;
    }

    // Update zone position
    this.zone.setPosition(ownerX + offsetX, ownerY + this.offsetY);

    // Update debug graphics
    if (this.debugGraphics) {
      this.updateDebugGraphics();
    }
  }

  /**
   * Check if this box has already hit a target
   * @param {*} target
   * @returns {boolean}
   */
  hasAlreadyHit(target) {
    return this.hasHit.has(target);
  }

  /**
   * Mark a target as hit
   * @param {*} target
   */
  markHit(target) {
    this.hasHit.add(target);
  }

  /**
   * Create debug visualization
   */
  createDebugGraphics() {
    this.debugGraphics = this.scene.add.graphics();
    this.debugGraphics.setDepth(1000);
  }

  /**
   * Update debug visualization
   */
  updateDebugGraphics() {
    if (!this.debugGraphics) return;

    this.debugGraphics.clear();

    if (!this.active) return;

    const color = this.type === BOX_TYPE.HITBOX ? 0xff0000 : 0x00ff00;
    const alpha = 0.3;

    this.debugGraphics.fillStyle(color, alpha);
    this.debugGraphics.fillRect(
      this.zone.x - this.width / 2,
      this.zone.y - this.height / 2,
      this.width,
      this.height
    );

    this.debugGraphics.lineStyle(2, color, 0.8);
    this.debugGraphics.strokeRect(
      this.zone.x - this.width / 2,
      this.zone.y - this.height / 2,
      this.width,
      this.height
    );
  }

  /**
   * Toggle debug display
   * @param {boolean} show
   */
  setDebug(show) {
    if (show && !this.debugGraphics) {
      this.createDebugGraphics();
    } else if (!show && this.debugGraphics) {
      this.debugGraphics.destroy();
      this.debugGraphics = null;
    }
  }

  /**
   * Clean up
   */
  destroy() {
    if (this.debugGraphics) {
      this.debugGraphics.destroy();
    }
    this.zone.destroy();
  }
}
