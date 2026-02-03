import { StateMachine } from '../systems/StateMachine.js';
import { createPlayerStates, PLAYER_STATES } from '../systems/PlayerStates.js';
import { PHYSICS } from '../utils/physics.js';
import { COMBAT } from '../utils/combat.js';
import { WeaponManager } from '../weapons/WeaponManager.js';
import {
  CollisionCategories,
  CollisionMasks,
  createPlayerBodyConfig,
  createHitboxConfig,
  createHurtboxConfig,
  MatterPhysicsHelper
} from '../systems/MatterPhysics.js';
import { BOX_TYPE, TEAM } from '../systems/CombatManagerMatter.js';

// Skeletal animation system
import { SkeletonInstance } from '../skeleton/SkeletonInstance.js';
import { createHumanoidSkeleton } from '../skeleton/definitions/humanoid.js';
import { LineSkin } from '../skeleton/skins/LineSkin.js';
import { PoseBlender } from '../skeleton/poses/PoseBlender.js';

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

    // Store color for visual effects
    this.color = 0x00ffff;

    // Body dimensions
    this.width = 24;
    this.height = 44;

    // Create Matter.js body with rectangle shape
    this.body = this.scene.matter.add.rectangle(
      x, y, this.width, this.height,
      createPlayerBodyConfig(this.width, this.height)
    );

    // Store owner reference on body for collision callbacks
    // Note: Use 'owner' not 'gameObject' - Phaser reserves gameObject for internal use
    this.body.owner = this;
    this.body.label = 'player';

    // Create visual sprite (no physics, just graphics for compatibility)
    // This maintains compatibility with existing code that references this.sprite
    this.sprite = this.scene.add.rectangle(x, y, this.width, this.height, 0x00ff00);
    this.sprite.setDepth(10);
    this.sprite.setVisible(false); // Skeleton handles visuals
    // Add compatibility properties that states might use
    this.sprite.flipX = false;
    this.sprite.setFlipX = (flip) => {
      this.sprite.flipX = flip;
      this.facingRight = !flip;
    };
    this.sprite.setData = (key, value) => {
      if (!this.sprite._data) this.sprite._data = {};
      this.sprite._data[key] = value;
    };
    this.sprite.getData = (key) => {
      if (!this.sprite._data) return undefined;
      return this.sprite._data[key];
    };
    this.sprite.setAlpha = (alpha) => {
      this.sprite.alpha = alpha;
      if (this.skin) this.skin.setAlpha(alpha);
    };

    // Create physics helper
    this.matterHelper = new MatterPhysicsHelper(this.scene);

    // Movement properties (tuned for Matter.js - scale is different from Arcade)
    this.moveSpeed = 5;           // Matter velocity scale
    this.jumpForce = 12;          // Matter jump force
    this.airControl = 0.7;        // Multiplier for air movement

    // Fist visual - small square that animates through hitbox area during attacks
    this.fistVisual = scene.add.graphics();
    this.fistVisual.setDepth(this.sprite.depth + 1);
    this.fistLocalX = 0;  // Local offset from sprite
    this.fistLocalY = 0;
    this.fistVisible = false;
    this.fistTween = null;

    // Second fist for dual-sided attacks (spin)
    this.fistVisual2 = scene.add.graphics();
    this.fistVisual2.setDepth(this.sprite.depth + 1);
    this.fistLocal2X = 0;
    this.fistLocal2Y = 0;
    this.fistVisible2 = false;
    this.fistTween2 = null;

    // Ground detection via collision events
    this.groundContacts = 0;
    this._isOnGround = false;
    this.setupCollisionEvents();

    // State tracking
    this.leftGroundTime = 0; // For coyote time
    this.facingRight = true;

    // Wall contact tracking
    this.wallContactLeft = 0;
    this.wallContactRight = 0;

    // Health system (basic for now)
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.isAlive = true;
    this.isInvulnerable = false;

    // Combat stats (will expand later)
    this.comboCount = 0;
    this.ultimateMeter = 0;
    this.maxUltimateMeter = COMBAT.ULTIMATE.MAX_METER;

    // Parry tracking (for Tonfas and similar weapons)
    this.isParrying = false;
    this.parryState = null;

    // State machine
    this.stateMachine = new StateMachine(this, PLAYER_STATES.IDLE);
    this.stateMachine.addStates(createPlayerStates(this.stateMachine));
    this.stateMachine.start();

    // Weapon system
    this.weaponManager = new WeaponManager(this);

    // Combat boxes - Matter.js sensors
    // Hurtbox dimensions
    this.hurtboxWidth = 28;
    this.hurtboxHeight = 44;

    // Hitbox dimensions
    this.hitboxWidth = 50;
    this.hitboxHeight = 40;
    this.hitboxOffsetX = 35;
    this.hitboxOffsetY = -5;

    // Secondary hitbox offset (behind player)
    this.hitboxSecondaryOffsetX = -35;

    // Create Matter.js sensor for hurtbox
    this.hurtboxBody = scene.matter.add.rectangle(
      x, y, this.hurtboxWidth, this.hurtboxHeight,
      createHurtboxConfig('player_hurtbox')
    );
    this.hurtboxBody.owner = this;

    // Create Matter.js sensor for primary attack hitbox
    this.hitboxBody = scene.matter.add.rectangle(
      x + this.hitboxOffsetX, y + this.hitboxOffsetY,
      this.hitboxWidth, this.hitboxHeight,
      createHitboxConfig('player_hitbox')
    );
    this.hitboxBody.owner = this;

    // Create Matter.js sensor for secondary attack hitbox (spin attacks)
    this.hitboxBodySecondary = scene.matter.add.rectangle(
      x + this.hitboxSecondaryOffsetX, y + this.hitboxOffsetY,
      this.hitboxWidth, this.hitboxHeight,
      createHitboxConfig('player_hitbox_secondary')
    );
    this.hitboxBodySecondary.owner = this;

    // Store hitbox data for combat resolution (Matter.js scale)
    this.hitboxData = {
      damage: 10,
      knockback: { x: 6, y: -3 },
      hitstun: 200,
      hitstop: 50,
    };
    this.hitboxDataSecondary = {
      damage: 10,
      knockback: { x: -6, y: -3 },
      hitstun: 200,
      hitstop: 50,
    };

    // Register with combat manager if available
    if (scene.combatManager) {
      scene.combatManager.registerHurtbox(this.hurtboxBody, {
        owner: this,
        team: TEAM.PLAYER,
      });
      scene.combatManager.registerHitbox(this.hitboxBody, {
        owner: this,
        team: TEAM.PLAYER,
        ...this.hitboxData,
      });
      scene.combatManager.registerHitbox(this.hitboxBodySecondary, {
        owner: this,
        team: TEAM.PLAYER,
        ...this.hitboxDataSecondary,
      });
    }

    // Hitboxes start inactive
    this.hitboxActive = false;
    this.hitboxSecondaryActive = false;

    // Store reference on sprite for collision callbacks
    this.sprite.setData('owner', this);

    // Initialize skeletal animation system
    this.initializeSkeleton();
  }

  /**
   * Set up collision event listeners for ground/wall detection
   */
  setupCollisionEvents() {
    // Track ground contact
    this.scene.matter.world.on('collisionstart', (event) => {
      for (const pair of event.pairs) {
        this.handleCollisionStart(pair);
      }
    });

    this.scene.matter.world.on('collisionend', (event) => {
      for (const pair of event.pairs) {
        this.handleCollisionEnd(pair);
      }
    });
  }

  /**
   * Handle collision start event
   * @param {object} pair - Collision pair
   */
  handleCollisionStart(pair) {
    const dominated = pair.bodyA === this.body || pair.bodyB === this.body;
    if (!dominated) return;

    const other = pair.bodyA === this.body ? pair.bodyB : pair.bodyA;
    const category = other.collisionFilter.category;

    // Check if it's a ground-like surface
    if (!(category & (CollisionCategories.GROUND | CollisionCategories.PLATFORM | CollisionCategories.CORPSE))) {
      return;
    }

    // Check collision normal to determine contact direction
    const normal = pair.collision.normal;
    const ny = pair.bodyA === this.body ? normal.y : -normal.y;
    const nx = pair.bodyA === this.body ? normal.x : -normal.x;

    // Normal points up = we're standing on it (ground contact)
    if (ny < -0.5) {
      this.groundContacts++;
    }

    // Normal points left = wall on right
    if (nx < -0.5) {
      this.wallContactRight++;
    }

    // Normal points right = wall on left
    if (nx > 0.5) {
      this.wallContactLeft++;
    }
  }

  /**
   * Handle collision end event
   * @param {object} pair - Collision pair
   */
  handleCollisionEnd(pair) {
    const dominated = pair.bodyA === this.body || pair.bodyB === this.body;
    if (!dominated) return;

    const other = pair.bodyA === this.body ? pair.bodyB : pair.bodyA;
    const category = other.collisionFilter.category;

    // Check if it's a ground-like surface
    if (!(category & (CollisionCategories.GROUND | CollisionCategories.PLATFORM | CollisionCategories.CORPSE))) {
      return;
    }

    // Check collision normal to determine which contact ended
    const normal = pair.collision.normal;
    const ny = pair.bodyA === this.body ? normal.y : -normal.y;
    const nx = pair.bodyA === this.body ? normal.x : -normal.x;

    // Ground contact ended
    if (ny < -0.5) {
      this.groundContacts = Math.max(0, this.groundContacts - 1);
    }

    // Wall contact ended
    if (nx < -0.5) {
      this.wallContactRight = Math.max(0, this.wallContactRight - 1);
    }

    if (nx > 0.5) {
      this.wallContactLeft = Math.max(0, this.wallContactLeft - 1);
    }
  }

  /**
   * Initialize skeletal animation system
   */
  initializeSkeleton() {
    // Create skeleton instance
    const skeletonDef = createHumanoidSkeleton();
    this.skeletonInstance = new SkeletonInstance(skeletonDef, {
      position: { x: this.sprite.x, y: this.sprite.y }
    });

    // Create skin renderer
    this.skin = new LineSkin(this.skeletonInstance, {
      lineWidth: 3,
      color: 0x00ffcc,      // Cyan for visibility during testing
      jointRadius: 3,
      headRadius: 10
    });
    this.skin.initialize(this.scene);
    this.skin.setDepth(this.sprite.depth + 1); // Render above sprite

    // Create pose blender for animation control
    this.poseBlender = new PoseBlender(this.skeletonInstance);

    // Flag to toggle skeleton visibility (for testing)
    this.showSkeleton = true;

    // Hide the placeholder sprite - skeleton handles visuals now
    this.sprite.setVisible(false);
  }

  /**
   * Update player - called each frame by scene
   * @param {number} time - Total elapsed time in ms
   * @param {number} delta - Time since last frame in ms
   */
  update(time, delta) {
    // Update ground state
    this._isOnGround = this.groundContacts > 0;

    // Sync visual sprite to physics body
    this.sprite.setPosition(this.body.position.x, this.body.position.y);
    this.sprite.x = this.body.position.x;
    this.sprite.y = this.body.position.y;

    // Update facing direction based on velocity
    if (this.body.velocity.x > 0.5) {
      this.facingRight = true;
      this.sprite.flipX = false;
    } else if (this.body.velocity.x < -0.5) {
      this.facingRight = false;
      this.sprite.flipX = true;
    }

    this.stateMachine.update(time, delta);

    // Update weapon manager
    this.weaponManager.update(delta);

    // Update fist visuals position
    const facingMult = this.sprite.flipX ? -1 : 1;
    this.fistVisual.setPosition(
      this.body.position.x + (this.fistLocalX * facingMult),
      this.body.position.y + this.fistLocalY
    );
    // Second fist - also apply facingMult so it mirrors correctly when player turns
    this.fistVisual2.setPosition(
      this.body.position.x + (this.fistLocal2X * facingMult),
      this.body.position.y + this.fistLocal2Y
    );
    this.drawFist();

    // Update hitboxes to follow body position
    this.updateHitboxes();

    // Update skeletal animation
    this.updateSkeleton(delta);
  }

  /**
   * Sync hitboxes to body position
   */
  updateHitboxes() {
    // Update hurtbox position
    if (this.hurtboxBody) {
      this.scene.matter.body.setPosition(this.hurtboxBody, {
        x: this.body.position.x,
        y: this.body.position.y,
      });
    }

    // Update hitbox positions (offset based on facing direction)
    const facingMult = this.facingRight ? 1 : -1;

    if (this.hitboxBody) {
      this.scene.matter.body.setPosition(this.hitboxBody, {
        x: this.body.position.x + (this.hitboxOffsetX * facingMult),
        y: this.body.position.y + this.hitboxOffsetY,
      });
    }

    if (this.hitboxBodySecondary) {
      // Secondary hitbox stays on opposite side
      this.scene.matter.body.setPosition(this.hitboxBodySecondary, {
        x: this.body.position.x + this.hitboxSecondaryOffsetX, // Note: no facingMult - stays on back side
        y: this.body.position.y + this.hitboxOffsetY,
      });
    }
  }

  /**
   * Update skeleton position, animation, and rendering
   * @param {number} delta - Time since last frame in ms
   */
  updateSkeleton(delta) {
    if (!this.skeletonInstance) return;

    // Sync skeleton position to physics body (body is source of truth)
    // Offset Y so skeleton's pelvis aligns with body center
    const offsetY = -10; // Adjust based on visual alignment
    this.skeletonInstance.setPosition(this.body.position.x, this.body.position.y + offsetY);

    // Sync facing direction
    this.skeletonInstance.setScale(this.facingRight ? 1 : -1, 1);

    // Update animation blender
    if (this.poseBlender) {
      this.poseBlender.update(delta);
    }

    // Render skeleton
    if (this.showSkeleton && this.skin) {
      this.skin.render();
    }
  }

  /**
   * Get current position
   * @returns {{x: number, y: number}}
   */
  getPosition() {
    return { x: this.body.position.x, y: this.body.position.y };
  }

  /**
   * Get current velocity
   * @returns {{x: number, y: number}}
   */
  getVelocity() {
    return {
      x: this.body.velocity.x,
      y: this.body.velocity.y,
    };
  }

  /**
   * Check if player is on the ground
   * @returns {boolean}
   */
  isOnGround() {
    return this._isOnGround;
  }

  /**
   * Check if player is touching a wall on the left
   * @returns {boolean}
   */
  isTouchingLeftWall() {
    return this.wallContactLeft > 0;
  }

  /**
   * Check if player is touching a wall on the right
   * @returns {boolean}
   */
  isTouchingRightWall() {
    return this.wallContactRight > 0;
  }

  /**
   * Set position (for respawn, teleport, etc.)
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  setPosition(x, y) {
    this.scene.matter.body.setPosition(this.body, { x, y });
    this.scene.matter.body.setVelocity(this.body, { x: 0, y: 0 });
    // Sync visual sprite
    this.sprite.x = x;
    this.sprite.y = y;
  }

  /**
   * Move horizontally
   * @param {number} direction - -1 for left, 1 for right
   */
  moveX(direction) {
    const speed = this._isOnGround ? this.moveSpeed : this.moveSpeed * this.airControl;
    this.matterHelper.setVelocityX(this.body, direction * speed);
  }

  /**
   * Stop horizontal movement with friction
   */
  stopX() {
    // Apply friction-like stopping (don't instantly stop)
    const vx = this.body.velocity.x * 0.8;
    if (Math.abs(vx) < 0.5) {
      this.matterHelper.setVelocityX(this.body, 0);
    } else {
      this.matterHelper.setVelocityX(this.body, vx);
    }
  }

  /**
   * Jump
   */
  jump() {
    if (this._isOnGround) {
      // Matter.js: negative Y is up
      this.matterHelper.setVelocityY(this.body, -this.jumpForce);
    }
  }

  /**
   * Force jump (for wall jump, etc.) - ignores ground check
   */
  forceJump() {
    this.matterHelper.setVelocityY(this.body, -this.jumpForce);
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
   * @param {object} source - What dealt the damage (hitData object)
   */
  takeDamage(amount, source = null) {
    if (this.isInvulnerable) return;

    // Check for parry
    if (this.isParrying && this.parryState) {
      const blocked = this.parryState.onIncomingDamage({
        damage: amount,
        attacker: source?.owner || source,
        ...source,
      });
      if (blocked) return;
    }

    this.health = Math.max(0, this.health - amount);

    // Reduce ultimate meter on damage
    this.ultimateMeter = Math.max(
      0,
      this.ultimateMeter - COMBAT.ULTIMATE.METER_DECAY_ON_HIT
    );

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
   * Add to ultimate meter
   * @param {number} amount
   */
  addUltimateMeter(amount) {
    this.ultimateMeter = Math.min(
      this.maxUltimateMeter,
      this.ultimateMeter + amount
    );

    if (this.ultimateMeter >= this.maxUltimateMeter) {
      this.scene.events.emit('ultimate:ready');
    }
  }

  /**
   * Check if ultimate is ready
   * @returns {boolean}
   */
  isUltimateReady() {
    return this.ultimateMeter >= this.maxUltimateMeter;
  }

  /**
   * Consume ultimate meter
   * @returns {boolean} True if consumed
   */
  consumeUltimate() {
    if (this.isUltimateReady()) {
      this.ultimateMeter = 0;
      return true;
    }
    return false;
  }

  /**
   * Handle player death
   */
  die() {
    this.isAlive = false;
    this.scene.events.emit('player:died', { player: this });
    // TODO: Death state, respawn logic
  }

  /**
   * Add collision with a group or object
   * With Matter.js, collisions are handled via collision categories/masks
   * This method is kept for API compatibility but Matter.js doesn't need explicit colliders
   * @param {object} target - Target to collide with (ignored in Matter.js)
   * @param {Function} callback - Optional collision callback (ignored in Matter.js)
   */
  addCollider(target, callback = null) {
    // Matter.js handles collisions via collision filters set in createPlayerBodyConfig
    // This method exists for API compatibility with existing scene code
    // No action needed - collisions are automatic based on collision categories
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
      velocity: `${Math.round(vel.x * 100) / 100}, ${Math.round(vel.y * 100) / 100}`,
      state: this.getCurrentState(),
      stateTime: Math.round(this.stateMachine.getStateTime()),
      onGround: this.isOnGround(),
      health: `${this.health}/${this.maxHealth}`,
      facing: this.facingRight ? 'right' : 'left',
      groundContacts: this.groundContacts,
    };
  }

  // ==================== Skeleton Animation Methods ====================

  /**
   * Play animation on the skeleton
   * @param {Animation} animation - Animation to play
   * @param {object} options - Playback options (see PoseBlender.playAnimation)
   * @returns {AnimationLayer|null}
   */
  playSkeletonAnimation(animation, options = {}) {
    if (this.poseBlender) {
      return this.poseBlender.playAnimation(animation, options);
    }
    return null;
  }

  /**
   * Stop animation on a layer
   * @param {string} layerName - Layer to stop
   * @param {number} blendDuration - Blend out duration in ms
   */
  stopSkeletonAnimation(layerName, blendDuration = 0) {
    if (this.poseBlender) {
      this.poseBlender.stopAnimation(layerName, blendDuration);
    }
  }

  /**
   * Toggle skeleton visibility (for debugging)
   * @param {boolean} visible
   */
  setSkeletonVisible(visible) {
    this.showSkeleton = visible;
    if (this.skin) {
      this.skin.setVisible(visible);
    }
  }

  /**
   * Set skeleton color (for debugging/effects)
   * @param {number} color - Hex color
   */
  setSkeletonColor(color) {
    if (this.skin) {
      this.skin.setColor(color);
    }
  }

  /**
   * Draw the fist visual indicator(s)
   * Note: Disabled now that skeleton handles attack visuals
   */
  drawFist() {
    // Clear fist graphics - skeleton animations handle attack visuals now
    this.fistVisual.clear();
    this.fistVisual2.clear();
  }

  /**
   * Activate attack hitbox with specific properties
   * @param {object} config - Attack configuration
   *   - For single hitbox: { damage, knockback, width, height, offsetX, offsetY, ... }
   *   - For multi-hitbox (e.g. spin): { hitboxes: [{ offsetX, offsetY, knockback }, ...], damage, ... }
   */
  activateAttackHitbox(config = {}) {
    // Check if this is a multi-hitbox attack
    if (config.hitboxes && Array.isArray(config.hitboxes)) {
      // Multi-hitbox attack (like spin that hits both sides)
      const hitboxTargets = [this.hitboxBody, this.hitboxBodySecondary];
      const hitboxDataTargets = [this.hitboxData, this.hitboxDataSecondary];

      config.hitboxes.forEach((hitboxConfig, index) => {
        if (index >= hitboxTargets.length) return; // Only support 2 hitboxes for now

        const hitboxBody = hitboxTargets[index];
        const hitboxData = hitboxDataTargets[index];
        const hbKnockback = hitboxConfig.knockback || config.knockback || hitboxData.knockback;

        // Update hitbox data
        hitboxData.damage = config.damage || hitboxData.damage || 10;
        hitboxData.knockback = hbKnockback;
        hitboxData.hitstun = config.hitstun || hitboxData.hitstun || 200;
        hitboxData.hitstop = config.hitstop || hitboxData.hitstop || 50;

        // Activate through combat manager
        if (this.scene.combatManager) {
          this.scene.combatManager.activateHitbox(hitboxBody, hitboxData);
        }
      });

      this.hitboxActive = true;
      this.hitboxSecondaryActive = true;

      // For multi-hitbox attacks, animate both fists (dual-sided spin)
      const primaryConfig = config.hitboxes[0] || {};
      const secondaryConfig = config.hitboxes[1] || {};

      // First fist (uses facingMult in update) - front side
      const primaryWidth = primaryConfig.width || config.width || this.hitboxWidth;
      const primaryHeight = primaryConfig.height || config.height || this.hitboxHeight;
      const primaryOffsetX = primaryConfig.offsetX !== undefined ? primaryConfig.offsetX : (config.offsetX !== undefined ? config.offsetX : this.hitboxOffsetX);
      const primaryOffsetY = primaryConfig.offsetY !== undefined ? primaryConfig.offsetY : (config.offsetY !== undefined ? config.offsetY : this.hitboxOffsetY);

      this.animateFist({
        width: primaryWidth,
        height: primaryHeight,
        offsetX: primaryOffsetX,
        offsetY: primaryOffsetY,
      });

      // Second fist (no facingMult - raw position) - back side
      if (config.hitboxes.length >= 2) {
        const secondaryWidth = secondaryConfig.width || config.width || this.hitboxWidth;
        const secondaryHeight = secondaryConfig.height || config.height || this.hitboxHeight;
        const secondaryOffsetX = secondaryConfig.offsetX !== undefined ? secondaryConfig.offsetX : -primaryOffsetX;
        const secondaryOffsetY = secondaryConfig.offsetY !== undefined ? secondaryConfig.offsetY : primaryOffsetY;

        // Calculate second fist animation (outward from body)
        // Since this fist doesn't use facingMult, we animate from inner to outer edge
        const startX = secondaryOffsetX + (secondaryWidth / 2); // Inner edge (closer to body, so ADD since negative)
        const endX = secondaryOffsetX - (secondaryWidth / 2);   // Outer edge (away from body)

        this.fistLocal2X = startX;
        this.fistLocal2Y = secondaryOffsetY;
        this.fistVisible2 = true;

        if (this.fistTween2) {
          this.fistTween2.stop();
        }

        this.fistTween2 = this.scene.tweens.add({
          targets: this,
          fistLocal2X: endX,
          fistLocal2Y: secondaryOffsetY,
          duration: 50,
          ease: 'Quad.easeOut',
        });
      }
    } else {
      // Single hitbox attack (normal attacks)
      // Update hitbox data
      this.hitboxData.damage = config.damage || this.hitboxData.damage || 10;
      this.hitboxData.knockback = config.knockback || this.hitboxData.knockback || { x: 6, y: -3 }; // Matter.js scale
      this.hitboxData.hitstun = config.hitstun || this.hitboxData.hitstun || 200;
      this.hitboxData.hitstop = config.hitstop || this.hitboxData.hitstop || 50;

      // Activate through combat manager
      if (this.scene.combatManager) {
        this.scene.combatManager.activateHitbox(this.hitboxBody, this.hitboxData);
      }
      this.hitboxActive = true;

      // Update hitbox offset if provided
      if (config.offsetX !== undefined) {
        this.hitboxOffsetX = config.offsetX;
      }
      if (config.offsetY !== undefined) {
        this.hitboxOffsetY = config.offsetY;
      }

      // Animate fist from inner edge to outer edge of hitbox
      this.animateFist({
        width: config.width || this.hitboxWidth,
        height: config.height || this.hitboxHeight,
        offsetX: config.offsetX !== undefined ? config.offsetX : this.hitboxOffsetX,
        offsetY: config.offsetY !== undefined ? config.offsetY : this.hitboxOffsetY,
      });

      // Make sure second fist is hidden for single attacks
      this.fistVisible2 = false;
      if (this.fistTween2) {
        this.fistTween2.stop();
      }
    }
  }

  /**
   * Animate fist from inner edge to outer edge of hitbox
   * @param {object} hitboxConfig - Hitbox dimensions and offset
   */
  animateFist(hitboxConfig) {
    const width = hitboxConfig.width;
    const height = hitboxConfig.height;
    const offsetX = hitboxConfig.offsetX;
    const offsetY = hitboxConfig.offsetY;

    // Calculate start and end positions based on hitbox geometry
    // For horizontal attacks (offsetX != 0): travel along X axis
    // For vertical attacks (offsetY != 0, offsetX ~= 0): travel along Y axis
    const isVerticalAttack = Math.abs(offsetY) > Math.abs(offsetX);

    let startX, startY, endX, endY;

    if (isVerticalAttack) {
      // Vertical attack (like dive kick) - fist travels up/down
      const direction = offsetY >= 0 ? 1 : -1;
      startX = offsetX;
      startY = offsetY - (height / 2) * direction; // Inner edge
      endX = offsetX;
      endY = offsetY + (height / 2) * direction;   // Outer edge
    } else {
      // Horizontal attack - fist travels left/right
      startX = offsetX - (width / 2);  // Inner edge (closer to body)
      startY = offsetY;
      endX = offsetX + (width / 2);    // Outer edge
      endY = offsetY;
    }

    // Show fist at start position
    this.fistLocalX = startX;
    this.fistLocalY = startY;
    this.fistVisible = true;

    // Kill any existing tween
    if (this.fistTween) {
      this.fistTween.stop();
    }

    // Animate to end position
    this.fistTween = this.scene.tweens.add({
      targets: this,
      fistLocalX: endX,
      fistLocalY: endY,
      duration: 50,
      ease: 'Quad.easeOut',
    });
  }

  /**
   * Deactivate attack hitbox(es)
   */
  deactivateAttackHitbox() {
    // Deactivate through combat manager
    if (this.scene.combatManager) {
      this.scene.combatManager.deactivateHitbox(this.hitboxBody);
      this.scene.combatManager.deactivateHitbox(this.hitboxBodySecondary);
    }
    this.hitboxActive = false;
    this.hitboxSecondaryActive = false;

    // Retract first fist
    if (this.fistTween) {
      this.fistTween.stop();
    }

    this.fistTween = this.scene.tweens.add({
      targets: this,
      fistLocalX: 0,
      fistLocalY: 0,
      duration: 30,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.fistVisible = false;
      },
    });

    // Retract second fist (if visible)
    if (this.fistVisible2) {
      if (this.fistTween2) {
        this.fistTween2.stop();
      }

      this.fistTween2 = this.scene.tweens.add({
        targets: this,
        fistLocal2X: 0,
        fistLocal2Y: 0,
        duration: 30,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this.fistVisible2 = false;
        },
      });
    }
  }

  /**
   * Toggle combat debug display
   * @param {boolean} show
   */
  setCombatDebug(show) {
    // Combat debug is handled by CombatManagerMatter
    if (this.scene.combatManager && this.scene.combatManager.setDebug) {
      this.scene.combatManager.setDebug(show);
    }
  }

  /**
   * Get current weapon's attack data
   * @param {string} attackType
   * @returns {AttackData|null}
   */
  getAttackData(attackType) {
    return this.weaponManager.getAttack(attackType);
  }

  /**
   * Get current weapon
   * @returns {Weapon|null}
   */
  getCurrentWeapon() {
    return this.weaponManager.equippedWeapon;
  }

  /**
   * Unlock a new weapon
   * @param {string} weaponId
   */
  unlockWeapon(weaponId) {
    this.weaponManager.unlockWeapon(weaponId);
  }

  /**
   * Start swapping to a different weapon
   * @param {string} weaponId
   */
  swapWeapon(weaponId) {
    this.weaponManager.startSwap(weaponId);
  }

  /**
   * Clean up when player is destroyed
   */
  destroy() {
    if (this.scene.combatManager) {
      this.scene.combatManager.unregister(this.hurtbox);
      this.scene.combatManager.unregister(this.attackHitbox);
      this.scene.combatManager.unregister(this.attackHitboxSecondary);
    }
    this.hurtbox.destroy();
    this.attackHitbox.destroy();
    this.attackHitboxSecondary.destroy();

    // Clean up fist visuals
    if (this.fistTween) {
      this.fistTween.stop();
      this.fistTween = null;
    }
    if (this.fistVisual) {
      this.fistVisual.destroy();
      this.fistVisual = null;
    }

    // Clean up second fist visual
    if (this.fistTween2) {
      this.fistTween2.stop();
      this.fistTween2 = null;
    }
    if (this.fistVisual2) {
      this.fistVisual2.destroy();
      this.fistVisual2 = null;
    }

    // Clean up skeleton
    if (this.skin) {
      this.skin.destroy();
      this.skin = null;
    }
    this.skeletonInstance = null;
    this.poseBlender = null;

    // Clean up Matter.js body
    if (this.body) {
      this.scene.matter.world.remove(this.body);
      this.body = null;
    }

    // Clean up visual sprite
    if (this.sprite) {
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}
