import { StateMachine } from '../systems/StateMachine.js';
import { createPlayerStates, PLAYER_STATES } from '../systems/PlayerStates.js';
import { CombatBox, BOX_TYPE, TEAM } from '../systems/CombatBox.js';
import { PHYSICS } from '../utils/physics.js';
import { COMBAT } from '../utils/combat.js';
import { WeaponManager } from '../weapons/WeaponManager.js';

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

    // Create sprite
    this.sprite = scene.physics.add.sprite(x, y, 'player_placeholder');
    this.setupPhysics();

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

    // Terrain groups for clipping fix
    this.terrainGroups = [];

    // State tracking
    this.leftGroundTime = 0; // For coyote time
    this.facingRight = true;

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

    // Combat boxes
    this.hurtbox = new CombatBox(scene, {
      owner: this,
      type: BOX_TYPE.HURTBOX,
      team: TEAM.PLAYER,
      width: 28,
      height: 44,
      offsetX: 0,
      offsetY: 0,
    });

    // Primary attack hitbox (activated during attacks)
    this.attackHitbox = new CombatBox(scene, {
      owner: this,
      type: BOX_TYPE.HITBOX,
      team: TEAM.PLAYER,
      width: 50,
      height: 40,
      offsetX: 35, // In front of player
      offsetY: -5,
      damage: 10,
      knockback: { x: 300, y: -150 },
      hitstun: 200,
      hitstop: 50,
    });

    // Secondary attack hitbox (for attacks that hit both sides, like spin)
    this.attackHitboxSecondary = new CombatBox(scene, {
      owner: this,
      type: BOX_TYPE.HITBOX,
      team: TEAM.PLAYER,
      width: 50,
      height: 40,
      offsetX: -35, // Behind player
      offsetY: -5,
      damage: 10,
      knockback: { x: -300, y: -150 }, // Knockback in opposite direction
      hitstun: 200,
      hitstop: 50,
      followFacing: false, // Don't flip with facing - stay on opposite side
    });

    // Register with combat manager if available
    if (scene.combatManager) {
      scene.combatManager.register(this.hurtbox);
      scene.combatManager.register(this.attackHitbox);
      scene.combatManager.register(this.attackHitboxSecondary);
    }

    // Hurtbox always active
    this.hurtbox.activate();

    // Store reference on sprite for collision callbacks
    this.sprite.setData('owner', this);

    // Initialize skeletal animation system
    this.initializeSkeleton();
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

    // Set mass for player-enemy collision physics
    // Player mass = 2: Brutes (mass 5) push player slightly, swarmers (mass 1) don't
    body.mass = 2;
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
    this.stateMachine.update(time, delta);

    // Update weapon manager
    this.weaponManager.update(delta);

    // Update facing direction based on sprite flip
    this.facingRight = !this.sprite.flipX;

    // Update fist visuals position
    const facingMult = this.sprite.flipX ? -1 : 1;
    this.fistVisual.setPosition(
      this.sprite.x + (this.fistLocalX * facingMult),
      this.sprite.y + this.fistLocalY
    );
    // Second fist - also apply facingMult so it mirrors correctly when player turns
    this.fistVisual2.setPosition(
      this.sprite.x + (this.fistLocal2X * facingMult),
      this.sprite.y + this.fistLocal2Y
    );
    this.drawFist();

    // Fix any terrain clipping
    this.fixTerrainClipping();

    // Update skeletal animation
    this.updateSkeleton(delta);
  }

  /**
   * Update skeleton position, animation, and rendering
   * @param {number} delta - Time since last frame in ms
   */
  updateSkeleton(delta) {
    if (!this.skeletonInstance) return;

    // Sync skeleton position to sprite (physics body is source of truth)
    // Offset Y so skeleton's pelvis aligns with sprite center
    const offsetY = -10; // Adjust based on visual alignment
    this.skeletonInstance.setPosition(this.sprite.x, this.sprite.y + offsetY);

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
   * @param {Phaser.GameObjects.Group|Phaser.Tilemaps.TilemapLayer} target
   * @param {Function} callback - Optional collision callback
   */
  addCollider(target, callback = null) {
    this.scene.physics.add.collider(this.sprite, target, callback);
    // Track static groups for terrain clipping fix
    if (target && target.getChildren) {
      this.terrainGroups.push(target);
    }
  }

  /**
   * Check for and fix clipping into terrain
   * Pushes player up if embedded in ground/platforms
   */
  fixTerrainClipping() {
    if (this.terrainGroups.length === 0) return;

    const body = this.sprite.body;
    if (!body) return;

    let maxOverlap = 0;

    // Check against all terrain groups
    for (const terrainGroup of this.terrainGroups) {
      if (!terrainGroup) continue;

      const children = terrainGroup.getChildren();
      for (const terrain of children) {
        if (!terrain.body) continue;

        const terrainBody = terrain.body;

        // Check if there's horizontal overlap
        const horizontalOverlap =
          body.right > terrainBody.left && body.left < terrainBody.right;

        if (!horizontalOverlap) continue;

        // Check if player bottom is below terrain top (embedded)
        if (body.bottom > terrainBody.top && body.top < terrainBody.bottom) {
          // Calculate how much the player is embedded
          const overlap = body.bottom - terrainBody.top;
          if (overlap > maxOverlap) {
            maxOverlap = overlap;
          }
        }
      }
    }

    // If embedded, push player up
    if (maxOverlap > 0) {
      this.sprite.y -= maxOverlap + 1; // +1 to ensure clearance
      body.reset(this.sprite.x, this.sprite.y);

      // Stop downward velocity to prevent re-embedding
      if (body.velocity.y > 0) {
        body.setVelocityY(0);
      }
    }
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
   */
  drawFist() {
    const size = 12; // Fist size

    // First fist
    this.fistVisual.clear();
    if (this.fistVisible) {
      this.fistVisual.fillStyle(this.color, 0.9);
      this.fistVisual.fillRect(-size / 2, -size / 2, size, size);
    }

    // Second fist (for spin attacks)
    this.fistVisual2.clear();
    if (this.fistVisible2) {
      this.fistVisual2.fillStyle(this.color, 0.9);
      this.fistVisual2.fillRect(-size / 2, -size / 2, size, size);
    }
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
      const hitboxTargets = [this.attackHitbox, this.attackHitboxSecondary];

      config.hitboxes.forEach((hitboxConfig, index) => {
        if (index >= hitboxTargets.length) return; // Only support 2 hitboxes for now

        const hitbox = hitboxTargets[index];
        const hbKnockback = hitboxConfig.knockback || config.knockback || { x: 300, y: -150 };

        hitbox.activate({
          damage: config.damage || 10,
          knockback: hbKnockback,
          hitstun: config.hitstun || 200,
          hitstop: config.hitstop || 50,
        });

        // Update dimensions
        const width = hitboxConfig.width || config.width;
        const height = hitboxConfig.height || config.height;
        if (width) {
          hitbox.width = width;
          hitbox.zone.body.setSize(width, hitbox.height);
        }
        if (height) {
          hitbox.height = height;
          hitbox.zone.body.setSize(hitbox.width, height);
        }
        if (hitboxConfig.offsetX !== undefined) {
          hitbox.offsetX = hitboxConfig.offsetX;
        }
        if (hitboxConfig.offsetY !== undefined) {
          hitbox.offsetY = hitboxConfig.offsetY;
        }

        // Update position immediately with new offset
        hitbox.updatePosition();
      });

      // For multi-hitbox attacks, animate both fists (dual-sided spin)
      const primaryConfig = config.hitboxes[0] || {};
      const secondaryConfig = config.hitboxes[1] || {};

      // First fist (uses facingMult in update) - front side
      const primaryWidth = primaryConfig.width || config.width || this.attackHitbox.width;
      const primaryHeight = primaryConfig.height || config.height || this.attackHitbox.height;
      const primaryOffsetX = primaryConfig.offsetX !== undefined ? primaryConfig.offsetX : (config.offsetX !== undefined ? config.offsetX : this.attackHitbox.offsetX);
      const primaryOffsetY = primaryConfig.offsetY !== undefined ? primaryConfig.offsetY : (config.offsetY !== undefined ? config.offsetY : this.attackHitbox.offsetY);

      this.animateFist({
        width: primaryWidth,
        height: primaryHeight,
        offsetX: primaryOffsetX,
        offsetY: primaryOffsetY,
      });

      // Second fist (no facingMult - raw position) - back side
      if (config.hitboxes.length >= 2) {
        const secondaryWidth = secondaryConfig.width || config.width || this.attackHitboxSecondary.width;
        const secondaryHeight = secondaryConfig.height || config.height || this.attackHitboxSecondary.height;
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
      this.attackHitbox.activate({
        damage: config.damage || 10,
        knockback: config.knockback || { x: 300, y: -150 },
        hitstun: config.hitstun || 200,
        hitstop: config.hitstop || 50,
      });

      // Update dimensions if provided
      if (config.width) {
        this.attackHitbox.width = config.width;
        this.attackHitbox.zone.body.setSize(config.width, this.attackHitbox.height);
      }
      if (config.height) {
        this.attackHitbox.height = config.height;
        this.attackHitbox.zone.body.setSize(this.attackHitbox.width, config.height);
      }
      if (config.offsetX !== undefined) {
        this.attackHitbox.offsetX = config.offsetX;
      }
      if (config.offsetY !== undefined) {
        this.attackHitbox.offsetY = config.offsetY;
      }

      // Update position immediately with new offset
      this.attackHitbox.updatePosition();

      // Animate fist from inner edge to outer edge of hitbox
      this.animateFist({
        width: config.width || this.attackHitbox.width,
        height: config.height || this.attackHitbox.height,
        offsetX: config.offsetX !== undefined ? config.offsetX : this.attackHitbox.offsetX,
        offsetY: config.offsetY !== undefined ? config.offsetY : this.attackHitbox.offsetY,
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
    this.attackHitbox.deactivate();
    this.attackHitboxSecondary.deactivate();

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
    this.hurtbox.setDebug(show);
    this.attackHitbox.setDebug(show);
    this.attackHitboxSecondary.setDebug(show);
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
    }
    this.hurtbox.destroy();
    this.attackHitbox.destroy();

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

    this.sprite.destroy();
  }
}
