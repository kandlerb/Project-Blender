import { StateMachine, State } from '../systems/StateMachine.js';
import { CombatBox, BOX_TYPE, TEAM } from '../systems/CombatBox.js';
import { PHYSICS } from '../utils/physics.js';

/**
 * Enemy states (generic)
 */
export const ENEMY_STATES = Object.freeze({
  IDLE: 'idle',
  PATROL: 'patrol',
  CHASE: 'chase',
  ATTACK: 'attack',
  HITSTUN: 'hitstun',
  DEAD: 'dead',
});

/**
 * Swarmer-specific states for pack-based AI
 */
export const SWARMER_STATES = Object.freeze({
  IDLE: 'swarmer_idle',
  PATROL: 'swarmer_patrol',
  ALERT: 'swarmer_alert',
  CHASE: 'swarmer_chase',
  RETREAT: 'swarmer_retreat',
  ATTACK_WINDUP: 'swarmer_attack_windup',
  ATTACKING: 'swarmer_attacking',
  ATTACK_RECOVERY: 'swarmer_attack_recovery',
  HITSTUN: 'swarmer_hitstun',
  LAUNCHED: 'swarmer_launched',
  DOWNED: 'swarmer_downed',
  DEAD: 'swarmer_dead',
});

/**
 * Corpse interaction types for enemies
 */
export const CORPSE_INTERACTION = Object.freeze({
  BLOCK: 'block',       // Corpses block movement (default)
  DESTROY: 'destroy',   // Destroy corpses on contact (Brutes)
  CLIMB: 'climb',       // Can step up onto corpses (Swarmers)
  AVOID: 'avoid',       // Pathfind around corpses (Lobbers, future)
});

/**
 * Enemy configuration presets
 */
export const ENEMY_PRESETS = Object.freeze({
  /**
   * SWARMER - Fast rushdown enemy with pack behavior
   * Low HP, individually cowardly, dangerous in groups
   * "The Flood" - rush mindlessly in packs, retreat when isolated
   */
  SWARMER: {
    // Identity
    type: 'SWARMER',

    // Health & Damage
    maxHealth: 15,
    damage: 5,

    // Movement
    speed: 80,           // Patrol speed
    chaseSpeed: 200,     // Chasing player
    retreatSpeed: 180,   // Fleeing to pack

    // Detection
    detectionRange: 350,
    attackRange: 35,

    // Pack Behavior
    packRadius: 150,     // How far to look for pack members
    packThreshold: 2,    // Need 2+ others to feel confident

    // Attack Timing
    attackWindup: 200,   // ms
    attackActive: 100,   // ms
    attackRecovery: 150, // ms
    attackCooldown: 800, // ms between attacks

    // Combat Response
    hitstunMultiplier: 1.5,  // 50% longer hitstun than normal
    launchResistance: 0,     // Easy to launch
    grappleWeight: 'LIGHT',

    // State Durations
    alertDuration: 200,
    downedDuration: 300,

    // Appearance
    color: 0xffaa00,
    width: 28,
    height: 32,

    // Capabilities
    canBePulled: true,
    behavior: 'swarmer',
    corpseInteraction: 'climb',
    stepUpHeight: 32,
    mass: 1,
    canClimbEnemies: true,
    climbCooldown: 300,
  },
  /**
   * BRUTE - Slow tanky enemy
   * High HP, slow, heavy hits
   */
  BRUTE: {
    maxHealth: 60,
    damage: 20,
    speed: 80,
    chaseSpeed: 120,
    detectionRange: 250,
    attackRange: 60,
    attackCooldown: 1500,
    color: 0x884400,
    width: 44,
    height: 52,
    canBePulled: false,
    behavior: 'brute',
    corpseInteraction: 'destroy',
    corpseDestroyForce: 300,
    mass: 5,
    canClimbEnemies: false,
  },
  /**
   * LUNGER - Telegraphed charge attack
   * Dangerous but predictable
   */
  LUNGER: {
    maxHealth: 25,
    damage: 15,
    speed: 120,
    chaseSpeed: 120,
    chargeSpeed: 450,
    detectionRange: 350,
    attackRange: 300,
    attackCooldown: 2000,
    color: 0xff8844,
    width: 36,
    height: 44,
    canBePulled: true,
    behavior: 'lunger',
    chargeWindup: 600,
    chargeDuration: 400,
    corpseInteraction: 'climb',
    stepUpHeight: 32,
    mass: 3,
    canClimbEnemies: false,
  },
  /**
   * SHIELD_BEARER - Blocks frontal attacks
   * Must be flanked or guard-broken
   */
  SHIELD_BEARER: {
    maxHealth: 40,
    damage: 10,
    speed: 60,
    chaseSpeed: 60,
    detectionRange: 250,
    attackRange: 45,
    attackCooldown: 1500,
    color: 0x4488ff,
    width: 38,
    height: 48,
    canBePulled: true,
    pullResistance: 0.5,
    behavior: 'shield',
    blockAngle: 90,
    guardBreakThreshold: 30,
    corpseInteraction: 'climb',
    stepUpHeight: 32,
    mass: 3,
    canClimbEnemies: false,
  },
  /**
   * LOBBER - Ranged projectile attacker
   * Keeps distance, throws arcing projectiles
   */
  LOBBER: {
    maxHealth: 20,
    damage: 12,
    speed: 50,
    chaseSpeed: 50,
    detectionRange: 400,
    attackRange: 300,
    minRange: 150,
    attackCooldown: 2000,
    color: 0x88ff44,
    width: 32,
    height: 40,
    canBePulled: true,
    behavior: 'lobber',
    projectileSpeed: 300,
    projectileArc: 0.5,
    corpseInteraction: 'climb',
    stepUpHeight: 32,
    mass: 2,
    canClimbEnemies: false,
  },
  /**
   * DETONATOR - Suicide bomber
   * Explodes on death or contact, damages other enemies
   */
  DETONATOR: {
    maxHealth: 10,
    damage: 30,
    speed: 200,
    chaseSpeed: 200,
    detectionRange: 300,
    attackRange: 30,
    attackCooldown: 0,
    color: 0xff4444,
    width: 28,
    height: 32,
    canBePulled: true,
    behavior: 'detonator',
    explosionRadius: 80,
    fuseTime: 500,
    chainReaction: true,
    corpseInteraction: 'climb',
    stepUpHeight: 32,
    mass: 1,
    canClimbEnemies: false,
  },
});

/**
 * Base Enemy class with AI
 */
export class Enemy {
  constructor(scene, x, y, config = {}) {
    this.scene = scene;

    // Merge config with defaults
    const enemyType = config.type || 'SWARMER';
    const preset = ENEMY_PRESETS[enemyType] || ENEMY_PRESETS.SWARMER;
    this.config = { type: enemyType, ...preset, ...config };

    // Store full stats for behavior-specific AI
    this.stats = { ...this.config };

    // Stats
    this.maxHealth = this.config.maxHealth;
    this.health = this.maxHealth;
    this.damage = this.config.damage;
    this.speed = this.config.speed;
    this.chaseSpeed = this.config.chaseSpeed;
    this.isAlive = true;

    // AI
    this.detectionRange = this.config.detectionRange;
    this.attackRange = this.config.attackRange;
    this.attackCooldown = this.config.attackCooldown;
    this.lastAttackTime = 0;
    this.target = null; // Will be set to player

    // Corpse interaction
    this.corpseInteraction = this.config.corpseInteraction || 'block';
    this.stepUpHeight = this.config.stepUpHeight || 0;
    this.corpseDestroyForce = this.config.corpseDestroyForce || 0;

    // Mass for physics (affects push behavior in enemy-enemy collisions)
    this.mass = this.config.mass || 2;

    // Enemy climbing (only Swarmers can climb over other enemies)
    this.canClimbEnemies = this.config.canClimbEnemies || false;
    this.climbCooldown = this.config.climbCooldown || 300;
    this.lastClimbTime = 0;

    // Patrol
    this.patrolDirection = 1;
    this.patrolDistance = config.patrolDistance || 150;
    this.patrolOrigin = x;

    // Behavior-specific state
    this.currentState = 'IDLE';
    this.isBlocking = false;
    this.isExploding = false;
    this.isSteppingUp = false;
    this.chargeDirection = 1;
    this.windupTimer = 0;
    this.chargeTimer = 0;
    this.recoveryTimer = 0;
    this.attackTimer = 0;
    this.hasDealtDamage = false;

    // Create sprite
    this.sprite = scene.physics.add.sprite(x, y, 'enemy_placeholder');
    this.setupPhysics();

    // Terrain groups for clipping fix
    this.terrainGroups = [];

    // Apply color tint if defined
    if (this.stats.color) {
      this.sprite.setTint(this.stats.color);
    }

    // Combat boxes
    this.setupCombatBoxes();

    // State machine setup - use Swarmer-specific states for SWARMER type
    if (this.config.type === 'SWARMER') {
      this.setupSwarmerStates();
    } else {
      this.setupDefaultStates();
    }

    // Hitstun tracking
    this.hitstunRemaining = 0;

    // Swarmer-specific: retreat target for debug visualization
    this.currentRetreatTarget = null;

    // Swarmer-specific: pack debug graphics
    this.packDebugGraphics = null;

    // Store reference on sprite
    this.sprite.setData('owner', this);
  }

  setupPhysics() {
    const body = this.sprite.body;

    body.setCollideWorldBounds(true);
    body.setBounce(0);
    body.setGravityY(PHYSICS.GRAVITY);
    // Cap fall velocity to prevent tunneling through other enemies
    // At 120 physics FPS with maxVelocity 500, enemies move ~4.2px per frame
    // Smallest enemy (SWARMER) is 32px tall, so this prevents skipping collisions
    const maxFallSpeed = 500;
    body.setMaxVelocity(this.chaseSpeed * 1.5, maxFallSpeed);
    body.setDrag(300, 0);

    // The base texture is 28x28 pixels. We scale the sprite to reach target dimensions.
    // IMPORTANT: body.setSize() and body.setOffset() work in TEXTURE coordinates (pre-scale).
    // Phaser automatically scales the physics body along with the sprite.
    const textureSize = 28;

    // Scale sprite to match config dimensions
    const scaleX = this.stats.width / textureSize;
    const scaleY = this.stats.height / textureSize;
    this.sprite.setScale(scaleX, scaleY);

    // Set body to full texture size with no offset - after scaling this will
    // exactly match the displayed sprite dimensions
    body.setSize(textureSize, textureSize);
    body.setOffset(0, 0);

    // Set mass for enemy-enemy collision physics (heavier enemies push lighter ones)
    body.mass = this.mass;
  }

  setupCombatBoxes() {
    // Hurtbox - match sprite size from config
    this.hurtbox = new CombatBox(this.scene, {
      owner: this,
      type: BOX_TYPE.HURTBOX,
      team: TEAM.ENEMY,
      width: this.stats.width,
      height: this.stats.height,
      offsetX: 0,
      offsetY: 0,
    });

    // Attack hitbox - scale based on enemy size
    const attackWidth = Math.max(35, this.stats.width * 1.2);
    const attackHeight = Math.max(30, this.stats.height * 0.7);
    const attackOffset = Math.max(25, this.stats.width * 0.6);

    this.attackHitbox = new CombatBox(this.scene, {
      owner: this,
      type: BOX_TYPE.HITBOX,
      team: TEAM.ENEMY,
      width: attackWidth,
      height: attackHeight,
      offsetX: attackOffset,
      offsetY: 0,
      damage: this.damage,
      knockback: { x: 200, y: -100 },
      hitstun: 200,
      hitstop: 40,
    });

    if (this.scene.combatManager) {
      this.scene.combatManager.register(this.hurtbox);
      this.scene.combatManager.register(this.attackHitbox);
    }

    this.hurtbox.activate();
  }

  /**
   * Setup default state machine for standard enemies (Brute, etc.)
   */
  setupDefaultStates() {
    this.stateMachine = new StateMachine(this, ENEMY_STATES.IDLE);
    this.stateMachine.addStates([
      new EnemyIdleState(this.stateMachine),
      new EnemyPatrolState(this.stateMachine),
      new EnemyChaseState(this.stateMachine),
      new EnemyAttackState(this.stateMachine),
      new EnemyHitstunState(this.stateMachine),
      new EnemyDeadState(this.stateMachine),
    ]);
    this.stateMachine.start(ENEMY_STATES.PATROL);
  }

  /**
   * Setup Swarmer-specific state machine with pack behavior
   */
  setupSwarmerStates() {
    this.stateMachine = new StateMachine(this, SWARMER_STATES.IDLE);
    this.stateMachine.addStates([
      new SwarmerIdleState(this.stateMachine),
      new SwarmerPatrolState(this.stateMachine),
      new SwarmerAlertState(this.stateMachine),
      new SwarmerChaseState(this.stateMachine),
      new SwarmerRetreatState(this.stateMachine),
      new SwarmerAttackWindupState(this.stateMachine),
      new SwarmerAttackingState(this.stateMachine),
      new SwarmerAttackRecoveryState(this.stateMachine),
      new SwarmerHitstunState(this.stateMachine),
      new SwarmerLaunchedState(this.stateMachine),
      new SwarmerDownedState(this.stateMachine),
      new SwarmerDeadState(this.stateMachine),
    ]);
    this.stateMachine.start(SWARMER_STATES.PATROL);
  }

  /**
   * Set the target to chase/attack
   * @param {*} target
   */
  setTarget(target) {
    this.target = target;
  }

  /**
   * Get distance to target
   * @returns {number}
   */
  getDistanceToTarget() {
    if (!this.target) return Infinity;
    const targetSprite = this.target.sprite || this.target;
    const dx = targetSprite.x - this.sprite.x;
    const dy = targetSprite.y - this.sprite.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get direction to target (-1 or 1)
   * @returns {number}
   */
  getDirectionToTarget() {
    if (!this.target) return this.patrolDirection;
    const targetSprite = this.target.sprite || this.target;
    return targetSprite.x < this.sprite.x ? -1 : 1;
  }

  /**
   * Check if target is in detection range
   * @returns {boolean}
   */
  canSeeTarget() {
    if (!this.target || !this.target.isAlive) return false;
    return this.getDistanceToTarget() <= this.detectionRange;
  }

  /**
   * Check if target is in attack range
   * @returns {boolean}
   */
  canAttackTarget() {
    if (!this.target) return false;
    return this.getDistanceToTarget() <= this.attackRange;
  }

  /**
   * Check if attack is off cooldown
   * @param {number} time
   * @returns {boolean}
   */
  canAttack(time) {
    return (time - this.lastAttackTime) >= this.attackCooldown;
  }

  /**
   * Move in a direction
   * @param {number} direction - -1 or 1
   * @param {number} speed
   */
  move(direction, speed = this.speed) {
    this.sprite.setVelocityX(direction * speed);
    this.sprite.setFlipX(direction < 0);
  }

  /**
   * Stop moving
   */
  stop() {
    this.sprite.setVelocityX(0);
  }

  // ============================================
  // PACK DETECTION (Swarmer-specific)
  // ============================================

  /**
   * Get all living swarmers within radius
   * @param {number} radius - Detection radius (default packRadius from config)
   * @returns {Enemy[]} - Array of nearby swarmers (excluding self)
   */
  getNearbySwarmers(radius = null) {
    const searchRadius = radius || this.config.packRadius || 150;
    const enemies = this.scene.enemies || [];
    const nearby = [];

    for (const enemy of enemies) {
      // Skip self
      if (enemy === this) continue;

      // Only count swarmers
      if (enemy.config.type !== 'SWARMER') continue;

      // Must be alive
      if (!enemy.isAlive) continue;

      // Calculate distance
      const dx = enemy.sprite.x - this.sprite.x;
      const dy = enemy.sprite.y - this.sprite.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= searchRadius) {
        nearby.push(enemy);
      }
    }

    return nearby;
  }

  /**
   * Check if this swarmer is in a pack
   * @returns {boolean} - True if enough other swarmers nearby
   */
  isInPack() {
    const threshold = this.config.packThreshold || 2;
    return this.getNearbySwarmers().length >= threshold;
  }

  /**
   * Get current pack count (for debug display)
   * @returns {number} - Number of nearby swarmers
   */
  getPackCount() {
    return this.getNearbySwarmers().length;
  }

  /**
   * Find the nearest cluster of swarmers to retreat toward
   * @returns {{x: number, y: number}|null} - Position to retreat to, or null
   */
  findNearestPack() {
    // Search in extended range (3x pack radius)
    const extendedRadius = (this.config.packRadius || 150) * 3;
    const enemies = this.scene.enemies || [];

    let nearestSwarmer = null;
    let nearestDistance = Infinity;

    for (const enemy of enemies) {
      // Skip self
      if (enemy === this) continue;

      // Only consider swarmers
      if (enemy.config.type !== 'SWARMER') continue;

      // Must be alive
      if (!enemy.isAlive) continue;

      // Calculate distance
      const dx = enemy.sprite.x - this.sprite.x;
      const dy = enemy.sprite.y - this.sprite.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < nearestDistance && distance <= extendedRadius) {
        nearestDistance = distance;
        nearestSwarmer = enemy;
      }
    }

    if (nearestSwarmer) {
      return {
        x: nearestSwarmer.sprite.x,
        y: nearestSwarmer.sprite.y,
      };
    }

    return null;
  }

  /**
   * Get retreat target position
   * @returns {{x: number, y: number}} - Where to move
   */
  getRetreatTarget() {
    const packPosition = this.findNearestPack();
    if (packPosition) {
      return packPosition;
    }

    // No pack to retreat to — flee away from player
    if (this.target && this.target.sprite) {
      const fleeDirection = this.sprite.x < this.target.sprite.x ? -1 : 1;
      return {
        x: this.sprite.x + (fleeDirection * 200),
        y: this.sprite.y,
      };
    }

    // No target, just move in patrol direction
    return {
      x: this.sprite.x + (this.patrolDirection * 200),
      y: this.sprite.y,
    };
  }

  /**
   * Check if blocked by another enemy while trying to move
   * Only returns true for enemies that can climb (Swarmers)
   * @returns {boolean}
   */
  isBlockedByEnemy() {
    // Only climbing-capable enemies check for blocks
    if (!this.canClimbEnemies) return false;

    const body = this.sprite.body;

    // Must be on ground (blocked.down or touching.down)
    if (!body.blocked.down && !body.touching.down) return false;

    // Must have horizontal velocity (actively trying to move)
    const velocityX = body.velocity.x;
    if (Math.abs(velocityX) < 10) return false;

    // Get movement direction
    const moveDirection = velocityX > 0 ? 1 : -1;

    // Check for adjacent enemies in movement direction
    const checkDistance = 8; // pixels ahead to check
    const myBounds = this.sprite.getBounds();

    // Get scene's enemies array
    const enemies = this.scene.enemies || [];

    for (const other of enemies) {
      if (other === this || !other.isAlive) continue;

      const otherBounds = other.sprite.getBounds();

      // Check vertical overlap (enemies must be roughly on same level)
      const verticalOverlap = myBounds.bottom > otherBounds.top + 4 &&
                              myBounds.top < otherBounds.bottom - 4;
      if (!verticalOverlap) continue;

      // Check horizontal adjacency in movement direction
      if (moveDirection > 0) {
        // Moving right - check if other enemy is to our right within checkDistance
        const gap = otherBounds.left - myBounds.right;
        if (gap >= -4 && gap <= checkDistance) {
          return true;
        }
      } else {
        // Moving left - check if other enemy is to our left within checkDistance
        const gap = myBounds.left - otherBounds.right;
        if (gap >= -4 && gap <= checkDistance) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Attempt to climb over a blocking enemy
   * Applies small upward velocity if off cooldown
   * @param {number} time - Current game time
   */
  attemptClimb(time) {
    // Check cooldown
    if (time - this.lastClimbTime < this.climbCooldown) return;

    // Set cooldown
    this.lastClimbTime = time;

    // Apply upward velocity (60% of player jump force, roughly 200-250)
    const climbVelocity = -220;
    this.sprite.body.setVelocityY(climbVelocity);

    // Emit climb event
    this.scene.events.emit('enemy:climb', { enemy: this });

    // Debug flash yellow when combat debug is enabled
    if (this.scene.showCombatDebug) {
      const originalTint = this.stats.color || 0xffffff;
      this.sprite.setTint(0xffff00);
      this.scene.time.delayedCall(100, () => {
        if (this.sprite && this.sprite.active && this.isAlive) {
          this.sprite.setTint(originalTint);
        }
      });
    }
  }

  /**
   * Check if enemy can step up onto an obstacle
   * @param {Phaser.Physics.Arcade.Sprite} obstacleSprite
   * @returns {boolean} Whether step-up is possible
   */
  canStepUp(obstacleSprite) {
    if (this.corpseInteraction !== CORPSE_INTERACTION.CLIMB) return false;
    if (this.stepUpHeight <= 0) return false;

    // Calculate height difference
    const enemyBottom = this.sprite.body.bottom;
    const obstacleTop = obstacleSprite.body.top;
    const heightDiff = enemyBottom - obstacleTop;

    // Can step up if obstacle top is within step-up range
    return heightDiff > 0 && heightDiff <= this.stepUpHeight;
  }

  /**
   * Perform step-up onto obstacle
   */
  performStepUp() {
    if (this.isSteppingUp) return;

    this.isSteppingUp = true;

    // Gentle upward lift - just enough to clear corpses without a hop
    this.sprite.body.setVelocityY(-150);

    // Short cooldown for smooth traversal over multiple corpses
    this.scene.time.delayedCall(80, () => {
      this.isSteppingUp = false;
    });
  }

  update(time, delta) {
    if (!this.isAlive) return;

    if (this.hitstunRemaining > 0) {
      this.hitstunRemaining = Math.max(0, this.hitstunRemaining - delta);
    }

    // Route to behavior-specific AI
    switch (this.stats.behavior) {
      case 'lunger':
        this.updateLungerAI(time, delta);
        break;
      case 'shield':
        this.updateShieldAI(time, delta);
        break;
      case 'lobber':
        this.updateLobberAI(time, delta);
        break;
      case 'detonator':
        this.updateDetonatorAI(time, delta);
        break;
      case 'swarmer':
      case 'brute':
      default:
        // Use existing state machine for standard enemies
        this.stateMachine.update(time, delta);
        break;
    }

    this.hurtbox.updatePosition();
    this.attackHitbox.updatePosition();

    // Update pack debug visualization for swarmers
    if (this.config.type === 'SWARMER' && this.packDebugGraphics) {
      this.updatePackDebug();
    }

    // Fix any terrain clipping
    this.fixTerrainClipping();
  }

  takeDamage(amount, hitData = null) {
    if (!this.isAlive) return;

    // Check for shield block
    if (this.stats.behavior === 'shield' && this.checkBlock({ ...hitData, damage: amount })) {
      return; // Damage blocked
    }

    this.health = Math.max(0, this.health - amount);

    if (hitData && hitData.hitstun) {
      // Apply hitstun multiplier for swarmers (they have longer hitstun)
      let hitstun = hitData.hitstun;
      if (this.config.type === 'SWARMER') {
        const multiplier = this.config.hitstunMultiplier || 1.5;
        hitstun = Math.round(hitstun * multiplier);
      }

      this.hitstunRemaining = hitstun;
      this.currentState = 'HITSTUN';
      this.isBlocking = false;

      // Transition to correct hitstun state based on enemy type
      if (this.config.type === 'SWARMER') {
        // Check for launcher attacks (swarmers can be launched)
        if (hitData.launcher || (hitData.knockback && hitData.knockback.y < -200)) {
          this.stateMachine.transition(SWARMER_STATES.LAUNCHED, { hitData }, true);
        } else {
          this.stateMachine.transition(SWARMER_STATES.HITSTUN, { hitData }, true);
        }
      } else {
        this.stateMachine.transition(ENEMY_STATES.HITSTUN, { hitData }, true);
      }
    }

    this.flashWhite();

    this.scene.events.emit('enemy:damaged', {
      enemy: this,
      damage: amount,
      health: this.health,
      hitData,
    });

    if (this.health <= 0) {
      // Detonators explode on death
      if (this.stats.behavior === 'detonator' && !this.isExploding) {
        this.startExplosion();
      } else {
        this.die();
      }
    }
  }

  flashWhite() {
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(50, () => {
      if (this.sprite && this.sprite.active) {
        // Restore behavior-specific tint
        if (this.stats.behavior === 'shield' && this.isBlocking) {
          this.sprite.setTint(0x6699ff);
        } else if (this.stats.color) {
          this.sprite.setTint(this.stats.color);
        } else {
          this.sprite.clearTint();
        }
      }
    });
  }

  /**
   * Simple patrol behavior for new enemy types
   */
  updatePatrol(time, delta) {
    const distanceFromOrigin = this.sprite.x - this.patrolOrigin;

    if (distanceFromOrigin > this.patrolDistance) {
      this.patrolDirection = -1;
    } else if (distanceFromOrigin < -this.patrolDistance) {
      this.patrolDirection = 1;
    }

    if (this.sprite.body.blocked.left) {
      this.patrolDirection = 1;
    } else if (this.sprite.body.blocked.right) {
      this.patrolDirection = -1;
    }

    this.sprite.body.setVelocityX(this.patrolDirection * this.stats.speed);
    this.sprite.setFlipX(this.patrolDirection < 0);
  }

  /**
   * Check if overlapping player
   * @returns {boolean}
   */
  isOverlappingPlayer() {
    if (!this.target || !this.target.sprite) return false;
    const bounds1 = this.sprite.getBounds();
    const bounds2 = this.target.sprite.getBounds();
    return Phaser.Geom.Intersects.RectangleToRectangle(bounds1, bounds2);
  }

  /**
   * Deal damage to player on contact
   */
  dealDamageToPlayer() {
    if (!this.target || !this.target.takeDamage) return;
    const direction = this.sprite.flipX ? -1 : 1;
    this.target.takeDamage(this.stats.damage, {
      knockback: { x: direction * 300, y: -150 },
      hitstun: 200,
    });
  }

  // ============================================
  // LUNGER AI
  // ============================================

  /**
   * Lunger AI - Chase then telegraph charge attack
   */
  updateLungerAI(time, delta) {
    if (this.hitstunRemaining > 0) {
      this.currentState = 'HITSTUN';
      this.sprite.body.setVelocityX(0);
      return;
    }

    if (!this.target) return;

    const dx = this.target.sprite.x - this.sprite.x;
    const dy = this.target.sprite.y - this.sprite.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const direction = dx > 0 ? 1 : -1;

    switch (this.currentState) {
      case 'IDLE':
      case 'PATROL':
        if (distance < this.stats.detectionRange) {
          this.currentState = 'CHASE';
        } else {
          this.updatePatrol(time, delta);
        }
        break;

      case 'CHASE':
        if (distance > this.stats.detectionRange * 1.2) {
          this.currentState = 'IDLE';
        } else if (distance < this.stats.attackRange && this.canAttack(time)) {
          // Start charge windup
          this.currentState = 'CHARGE_WINDUP';
          this.chargeDirection = direction;
          this.windupTimer = 0;
          this.sprite.setTint(0xffff00); // Yellow warning
        } else {
          // Move toward player
          this.sprite.body.setVelocityX(direction * this.stats.speed);
          this.sprite.setFlipX(direction < 0);
        }
        break;

      case 'CHARGE_WINDUP':
        // Stop and telegraph
        this.sprite.body.setVelocityX(0);
        this.windupTimer += delta;

        // Shake to telegraph
        this.sprite.x += (Math.random() - 0.5) * 3;

        if (this.windupTimer >= this.stats.chargeWindup) {
          this.currentState = 'CHARGING';
          this.chargeTimer = 0;
          this.sprite.setTint(0xff0000); // Red = danger
          this.lastAttackTime = time;
        }
        break;

      case 'CHARGING':
        // Dash forward
        this.sprite.body.setVelocityX(this.chargeDirection * this.stats.chargeSpeed);
        this.chargeTimer += delta;

        // Create trail effect
        if (this.scene.effectsManager && Math.random() < 0.3) {
          this.scene.effectsManager.dustCloud(
            this.sprite.x,
            this.sprite.y + (this.stats.height || 32) / 2,
            -this.chargeDirection
          );
        }

        // Check if hit player
        if (this.isOverlappingPlayer()) {
          this.dealDamageToPlayer();
        }

        // Charge duration complete or hit wall
        if (this.chargeTimer >= this.stats.chargeDuration || this.sprite.body.blocked.left || this.sprite.body.blocked.right) {
          this.currentState = 'ATTACK_RECOVERY';
          this.recoveryTimer = 0;
          this.sprite.body.setVelocityX(0);
          this.sprite.setTint(this.stats.color);
        }
        break;

      case 'ATTACK_RECOVERY':
        this.recoveryTimer += delta;
        if (this.recoveryTimer >= 500) {
          this.currentState = 'CHASE';
        }
        break;

      case 'HITSTUN':
        if (this.hitstunRemaining <= 0) {
          this.currentState = 'CHASE';
          this.sprite.setTint(this.stats.color);
        }
        break;
    }
  }

  // ============================================
  // SHIELD BEARER AI
  // ============================================

  /**
   * Shield Bearer AI - Blocks frontal attacks, advances slowly
   */
  updateShieldAI(time, delta) {
    if (this.hitstunRemaining > 0) {
      this.currentState = 'HITSTUN';
      this.isBlocking = false;
      this.sprite.body.setVelocityX(0);
      return;
    }

    if (!this.target) return;

    const dx = this.target.sprite.x - this.sprite.x;
    const distance = Math.abs(dx);
    const direction = dx > 0 ? 1 : -1;

    switch (this.currentState) {
      case 'IDLE':
      case 'PATROL':
        if (distance < this.stats.detectionRange) {
          this.currentState = 'ADVANCE';
          this.isBlocking = true;
          this.sprite.setTint(0x6699ff); // Shield active tint
        } else {
          this.updatePatrol(time, delta);
          this.isBlocking = false;
        }
        break;

      case 'ADVANCE':
        // Always face player and block
        this.sprite.setFlipX(direction < 0);
        this.isBlocking = true;

        if (distance > this.stats.detectionRange * 1.3) {
          this.currentState = 'IDLE';
          this.isBlocking = false;
          this.sprite.setTint(this.stats.color);
        } else if (distance < this.stats.attackRange && this.canAttack(time)) {
          this.currentState = 'ATTACK';
          this.attackTimer = 0;
          this.isBlocking = false;
        } else {
          // Slow advance while blocking
          this.sprite.body.setVelocityX(direction * this.stats.speed);
        }
        break;

      case 'ATTACK':
        this.sprite.body.setVelocityX(0);
        this.attackTimer += delta;

        if (this.attackTimer >= 300 && !this.hasDealtDamage) {
          // Shield bash
          if (this.isOverlappingPlayer()) {
            this.dealDamageToPlayer();
          }
          this.hasDealtDamage = true;
          this.lastAttackTime = time;
        }

        if (this.attackTimer >= 600) {
          this.currentState = 'ADVANCE';
          this.hasDealtDamage = false;
          this.isBlocking = true;
          this.sprite.setTint(0x6699ff);
        }
        break;

      case 'HITSTUN':
        if (this.hitstunRemaining <= 0) {
          this.currentState = 'ADVANCE';
          this.isBlocking = true;
          this.sprite.setTint(0x6699ff);
        }
        break;
    }
  }

  /**
   * Check if attack should be blocked
   * @param {object} hitData - Contains attacker position and damage
   * @returns {boolean} True if blocked
   */
  checkBlock(hitData) {
    if (!this.isBlocking) return false;

    // Check if attack is from the front
    const attackerX = hitData?.attacker?.sprite?.x || hitData?.x || this.sprite.x;
    const attackDirection = attackerX > this.sprite.x ? 1 : -1;
    const facingDirection = this.sprite.flipX ? -1 : 1;

    // Block if attack is from the direction we're facing
    if (attackDirection === facingDirection) {
      // Check for guard break
      if (hitData.damage >= this.stats.guardBreakThreshold) {
        this.isBlocking = false;
        this.currentState = 'HITSTUN';
        this.hitstunRemaining = 500; // Staggered
        this.sprite.setTint(this.stats.color);

        if (this.scene.effectsManager) {
          this.scene.effectsManager.screenShake(6, 100);
        }
        return false; // Guard broken, damage goes through
      }

      // Successful block
      if (this.scene.effectsManager) {
        this.scene.effectsManager.hitSparks(
          this.sprite.x + facingDirection * 20,
          this.sprite.y,
          3,
          -facingDirection
        );
      }
      return true;
    }

    return false; // Hit from behind
  }

  // ============================================
  // LOBBER AI
  // ============================================

  /**
   * Lobber AI - Keep distance and throw projectiles
   */
  updateLobberAI(time, delta) {
    if (this.hitstunRemaining > 0) {
      this.currentState = 'HITSTUN';
      this.sprite.body.setVelocityX(0);
      return;
    }

    if (!this.target) return;

    const dx = this.target.sprite.x - this.sprite.x;
    const distance = Math.abs(dx);
    const direction = dx > 0 ? 1 : -1;

    switch (this.currentState) {
      case 'IDLE':
      case 'PATROL':
        if (distance < this.stats.detectionRange) {
          this.currentState = 'REPOSITION';
        } else {
          this.updatePatrol(time, delta);
        }
        break;

      case 'REPOSITION':
        this.sprite.setFlipX(direction < 0);

        if (distance > this.stats.detectionRange * 1.2) {
          this.currentState = 'IDLE';
        } else if (distance < this.stats.minRange) {
          // Too close, back away
          this.sprite.body.setVelocityX(-direction * this.stats.speed * 1.5);
        } else if (distance > this.stats.attackRange) {
          // Too far, get closer
          this.sprite.body.setVelocityX(direction * this.stats.speed);
        } else if (this.canAttack(time)) {
          // In range, attack
          this.currentState = 'ATTACK_WINDUP';
          this.windupTimer = 0;
          this.sprite.body.setVelocityX(0);
        } else {
          // Waiting for cooldown
          this.sprite.body.setVelocityX(0);
        }
        break;

      case 'ATTACK_WINDUP':
        this.windupTimer += delta;
        this.sprite.setTint(0xaaff44); // Glow before throw

        if (this.windupTimer >= 400) {
          this.throwProjectile(this.target);
          this.currentState = 'ATTACK_RECOVERY';
          this.recoveryTimer = 0;
          this.lastAttackTime = time;
          this.sprite.setTint(this.stats.color);
        }
        break;

      case 'ATTACK_RECOVERY':
        this.recoveryTimer += delta;
        if (this.recoveryTimer >= 300) {
          this.currentState = 'REPOSITION';
        }
        break;

      case 'HITSTUN':
        if (this.hitstunRemaining <= 0) {
          this.currentState = 'REPOSITION';
          this.sprite.setTint(this.stats.color);
        }
        break;
    }
  }

  /**
   * Throw arcing projectile at player
   * @param {Player} player
   */
  throwProjectile(player) {
    const scene = this.scene;
    const startX = this.sprite.x;
    const startY = this.sprite.y - 10;
    const targetX = player.sprite.x;
    const targetY = player.sprite.y;

    // Calculate arc trajectory
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.abs(dx);

    // Create projectile
    const projectile = scene.add.circle(startX, startY, 8, 0x88ff44);
    scene.physics.add.existing(projectile);

    const projBody = projectile.body;
    projBody.setCircle(8);
    projBody.setAllowGravity(true);

    const gravity = 400 * this.stats.projectileArc;
    projBody.setGravityY(gravity);

    // Calculate velocity for arc (corrected formula for projectile motion)
    const flightTime = distance / this.stats.projectileSpeed;
    const vx = dx / flightTime;
    const vy = (dy / flightTime) + (0.5 * gravity * flightTime);

    projBody.setVelocity(vx, vy);

    // Track projectile
    if (!scene.enemyProjectiles) scene.enemyProjectiles = [];
    scene.enemyProjectiles.push({
      sprite: projectile,
      damage: this.stats.damage,
      owner: this,
    });

    // Destroy after 3 seconds
    scene.time.delayedCall(3000, () => {
      const idx = scene.enemyProjectiles.findIndex(p => p.sprite === projectile);
      if (idx !== -1) scene.enemyProjectiles.splice(idx, 1);
      if (projectile && projectile.active) projectile.destroy();
    });
  }

  // ============================================
  // DETONATOR AI
  // ============================================

  /**
   * Detonator AI - Rush player and explode
   */
  updateDetonatorAI(time, delta) {
    if (this.hitstunRemaining > 0) {
      this.currentState = 'HITSTUN';
      this.sprite.body.setVelocityX(0);
      return;
    }

    if (this.isExploding) return;

    if (!this.target) return;

    const dx = this.target.sprite.x - this.sprite.x;
    const distance = Math.abs(dx);
    const direction = dx > 0 ? 1 : -1;

    switch (this.currentState) {
      case 'IDLE':
      case 'PATROL':
        if (distance < this.stats.detectionRange) {
          this.currentState = 'CHASE';
          this.sprite.setTint(0xff6666); // Warning color
        } else {
          this.updatePatrol(time, delta);
        }
        break;

      case 'CHASE':
        this.sprite.setFlipX(direction < 0);

        // Flash faster as it gets closer
        const flashRate = Math.max(100, 500 - (300 - distance));
        if (Math.floor(time / flashRate) % 2 === 0) {
          this.sprite.setTint(0xff0000);
        } else {
          this.sprite.setTint(0xff6666);
        }

        if (distance < this.stats.attackRange) {
          // Contact! Start explosion
          this.startExplosion();
        } else {
          this.sprite.body.setVelocityX(direction * this.stats.speed);
        }
        break;

      case 'HITSTUN':
        if (this.hitstunRemaining <= 0) {
          this.currentState = 'CHASE';
        }
        break;
    }
  }

  /**
   * Start explosion sequence
   */
  startExplosion() {
    if (this.isExploding) return;

    this.isExploding = true;
    this.sprite.body.setVelocity(0, 0);
    this.sprite.setTint(0xffffff);

    // Fuse countdown
    this.scene.time.delayedCall(this.stats.fuseTime, () => {
      if (this.sprite && this.sprite.active) {
        this.explode();
      }
    });
  }

  /**
   * Execute explosion
   */
  explode() {
    const scene = this.scene;
    const x = this.sprite.x;
    const y = this.sprite.y;
    const radius = this.stats.explosionRadius;

    // Visual explosion
    if (scene.effectsManager) {
      // Big particle burst
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2;
        const speed = 200 + Math.random() * 100;
        const particle = scene.add.circle(x, y, 6, 0xff4444);
        scene.physics.add.existing(particle);
        particle.body.setVelocity(
          Math.cos(angle) * speed,
          Math.sin(angle) * speed
        );
        particle.body.setAllowGravity(false);

        scene.tweens.add({
          targets: particle,
          alpha: 0,
          scale: 0,
          duration: 500,
          onComplete: () => particle.destroy(),
        });
      }

      scene.effectsManager.screenShake(10, 200);
      scene.effectsManager.screenFlash(0xff4444, 100, 0.3);
    }

    // Damage player if in radius
    if (scene.player && scene.player.isAlive) {
      const pdx = scene.player.sprite.x - x;
      const pdy = scene.player.sprite.y - y;
      const playerDist = Math.sqrt(pdx * pdx + pdy * pdy);

      if (playerDist < radius) {
        // Damage falls off with distance
        const falloff = 1 - (playerDist / radius);
        const damage = Math.floor(this.stats.damage * falloff);
        const dir = pdx > 0 ? 1 : -1;

        scene.player.takeDamage(damage, {
          knockback: { x: dir * 400 * falloff, y: -300 * falloff },
          hitstun: 400,
        });
      }
    }

    // Damage/trigger other enemies (chain reaction)
    if (scene.enemies && this.stats.chainReaction) {
      for (const enemy of scene.enemies) {
        if (enemy === this || !enemy.isAlive) continue;

        const edx = enemy.sprite.x - x;
        const edy = enemy.sprite.y - y;
        const enemyDist = Math.sqrt(edx * edx + edy * edy);

        if (enemyDist < radius) {
          const falloff = 1 - (enemyDist / radius);
          const damage = Math.floor(this.stats.damage * 0.5 * falloff);

          // Trigger other detonators
          if (enemy.stats.behavior === 'detonator' && !enemy.isExploding) {
            enemy.startExplosion();
          } else {
            enemy.takeDamage(damage, {
              knockback: { x: (edx / enemyDist) * 300, y: -200 },
              hitstun: 200,
            });
          }
        }
      }
    }

    // Die
    this.die();
  }

  die() {
    this.isAlive = false;
    this.hurtbox.deactivate();
    this.attackHitbox.deactivate();

    // Transition to correct dead state based on enemy type
    if (this.config.type === 'SWARMER') {
      this.stateMachine.transition(SWARMER_STATES.DEAD, {}, true);
    } else {
      this.stateMachine.transition(ENEMY_STATES.DEAD, {}, true);
    }

    this.scene.events.emit('enemy:killed', { enemy: this });
  }

  addCollider(target) {
    this.scene.physics.add.collider(this.sprite, target);
    // Track static groups for terrain clipping fix
    if (target && target.getChildren) {
      this.terrainGroups.push(target);
    }
  }

  /**
   * Check for and fix clipping into terrain
   * Pushes enemy up if embedded in ground/platforms
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

        // Check if enemy bottom is below terrain top (embedded)
        if (body.bottom > terrainBody.top && body.top < terrainBody.bottom) {
          // Calculate how much the enemy is embedded
          const overlap = body.bottom - terrainBody.top;
          if (overlap > maxOverlap) {
            maxOverlap = overlap;
          }
        }
      }
    }

    // If embedded, push enemy up
    if (maxOverlap > 0) {
      this.sprite.y -= maxOverlap + 1; // +1 to ensure clearance
      body.reset(this.sprite.x, this.sprite.y);

      // Stop downward velocity to prevent re-embedding
      if (body.velocity.y > 0) {
        body.setVelocityY(0);
      }
    }
  }

  setCombatDebug(show) {
    this.hurtbox.setDebug(show);
    this.attackHitbox.setDebug(show);

    // Swarmer pack debug visualization
    if (this.config.type === 'SWARMER') {
      if (show) {
        if (!this.packDebugGraphics) {
          this.packDebugGraphics = this.scene.add.graphics();
          this.packDebugGraphics.setDepth(999);
        }
        if (!this.stateText) {
          this.stateText = this.scene.add.text(0, 0, '', {
            fontSize: '10px',
            color: '#ffffff',
            backgroundColor: '#000000aa',
            padding: { x: 2, y: 1 },
          });
          this.stateText.setDepth(1000);
        }
      } else {
        if (this.packDebugGraphics) {
          this.packDebugGraphics.destroy();
          this.packDebugGraphics = null;
        }
        if (this.stateText) {
          this.stateText.destroy();
          this.stateText = null;
        }
      }
    }
  }

  /**
   * Update pack debug visualization (called in update for swarmers)
   */
  updatePackDebug() {
    if (!this.packDebugGraphics || !this.scene.showCombatDebug) return;

    this.packDebugGraphics.clear();

    const x = this.sprite.x;
    const y = this.sprite.y;
    const packRadius = this.config.packRadius || 150;
    const packCount = this.getPackCount();
    const inPack = this.isInPack();

    // Draw pack radius circle (faint)
    this.packDebugGraphics.lineStyle(1, inPack ? 0x00ff00 : 0xff6666, 0.3);
    this.packDebugGraphics.strokeCircle(x, y, packRadius);

    // Draw line to retreat target when in RETREAT state
    const currentState = this.stateMachine.getCurrentStateName();
    if (currentState === SWARMER_STATES.RETREAT && this.currentRetreatTarget) {
      this.packDebugGraphics.lineStyle(2, 0x6699ff, 0.7);
      this.packDebugGraphics.lineBetween(
        x, y,
        this.currentRetreatTarget.x, this.currentRetreatTarget.y
      );

      // Draw target marker
      this.packDebugGraphics.fillStyle(0x6699ff, 0.8);
      this.packDebugGraphics.fillCircle(this.currentRetreatTarget.x, this.currentRetreatTarget.y, 5);
    }

    // Update state text
    if (this.stateText) {
      const stateName = currentState.replace('swarmer_', '').toUpperCase();
      this.stateText.setText(`${stateName}\nPack: ${packCount}`);
      this.stateText.setPosition(x - 20, y - this.stats.height - 25);
    }
  }

  /**
   * Get debug info
   * @returns {object}
   */
  getDebugInfo() {
    const info = {
      health: `${this.health}/${this.maxHealth}`,
      state: this.stateMachine.getCurrentStateName(),
      hitstun: Math.round(this.hitstunRemaining),
      alive: this.isAlive,
    };

    // Add pack info for swarmers
    if (this.config.type === 'SWARMER') {
      info.packCount = this.getPackCount();
      info.inPack = this.isInPack();
    }

    return info;
  }

  /**
   * Debug AI state - logs comprehensive info to console
   */
  debugAI() {
    const type = this.config.type;
    const pos = `(${this.sprite.x.toFixed(0)}, ${this.sprite.y.toFixed(0)})`;
    const state = this.stateMachine.getCurrentStateName();
    const hasTarget = this.target ? 'SET' : 'NULL';
    const distance = this.target ? this.getDistanceToTarget().toFixed(0) : 'N/A';
    const canSee = this.canSeeTarget();
    const detRange = this.detectionRange;

    let line = `[${type}] pos=${pos} state=${state} target=${hasTarget}`;
    line += ` dist=${distance} range=${detRange} canSee=${canSee}`;

    if (type === 'SWARMER') {
      line += ` pack=${this.getPackCount()} inPack=${this.isInPack()}`;
    }

    console.log(line);
  }

  destroy() {
    if (this.scene.combatManager) {
      this.scene.combatManager.unregister(this.hurtbox);
      this.scene.combatManager.unregister(this.attackHitbox);
    }
    this.hurtbox.destroy();
    this.attackHitbox.destroy();

    // Clean up pack debug graphics (Swarmer-specific)
    if (this.packDebugGraphics) {
      this.packDebugGraphics.destroy();
      this.packDebugGraphics = null;
    }
    if (this.stateText) {
      this.stateText.destroy();
      this.stateText = null;
    }

    this.sprite.destroy();
  }
}

/**
 * Enemy Idle State - Brief pause between actions
 */
class EnemyIdleState extends State {
  constructor(stateMachine) {
    super(ENEMY_STATES.IDLE, stateMachine);
    this.idleDuration = 500;
  }

  get enemy() {
    return this.entity;
  }

  enter(prevState, params) {
    this.enemy.stop();
  }

  update(time, delta) {
    // Check for target
    if (this.enemy.canSeeTarget()) {
      return ENEMY_STATES.CHASE;
    }

    // Return to patrol after idle duration
    if (this.stateMachine.getStateTime() >= this.idleDuration) {
      return ENEMY_STATES.PATROL;
    }

    return null;
  }
}

/**
 * Enemy Patrol State - Walk back and forth
 */
class EnemyPatrolState extends State {
  constructor(stateMachine) {
    super(ENEMY_STATES.PATROL, stateMachine);
  }

  get enemy() {
    return this.entity;
  }

  enter(prevState, params) {
    // Continue in current direction
  }

  update(time, delta) {
    // Check for target
    if (this.enemy.canSeeTarget()) {
      return ENEMY_STATES.CHASE;
    }

    // Patrol movement
    const distanceFromOrigin = this.enemy.sprite.x - this.enemy.patrolOrigin;

    // Turn around at patrol limits
    if (distanceFromOrigin > this.enemy.patrolDistance) {
      this.enemy.patrolDirection = -1;
    } else if (distanceFromOrigin < -this.enemy.patrolDistance) {
      this.enemy.patrolDirection = 1;
    }

    // Check for walls/edges
    if (this.enemy.sprite.body.blocked.left) {
      this.enemy.patrolDirection = 1;
    } else if (this.enemy.sprite.body.blocked.right) {
      this.enemy.patrolDirection = -1;
    }

    // Move
    this.enemy.move(this.enemy.patrolDirection, this.enemy.speed);

    return null;
  }
}

/**
 * Enemy Chase State - Move toward player
 */
class EnemyChaseState extends State {
  constructor(stateMachine) {
    super(ENEMY_STATES.CHASE, stateMachine);
    this.loseTargetTime = 0;
    this.maxLoseTime = 2000; // Stop chasing after 2s of losing sight
  }

  get enemy() {
    return this.entity;
  }

  enter(prevState, params) {
    this.loseTargetTime = 0;
  }

  update(time, delta) {
    // Check if can attack
    if (this.enemy.canAttackTarget() && this.enemy.canAttack(time)) {
      return ENEMY_STATES.ATTACK;
    }

    // Check if target still visible
    if (this.enemy.canSeeTarget()) {
      this.loseTargetTime = 0;

      // Move toward target
      const direction = this.enemy.getDirectionToTarget();
      this.enemy.move(direction, this.enemy.chaseSpeed);

      // Swarmers attempt to climb over blocking enemies
      if (this.enemy.canClimbEnemies && this.enemy.isBlockedByEnemy()) {
        this.enemy.attemptClimb(time);
      }
    } else {
      // Lost sight of target
      this.loseTargetTime += delta;
      this.enemy.stop();

      if (this.loseTargetTime >= this.maxLoseTime) {
        return ENEMY_STATES.PATROL;
      }
    }

    return null;
  }
}

/**
 * Enemy Attack State - Strike at player
 */
class EnemyAttackState extends State {
  constructor(stateMachine) {
    super(ENEMY_STATES.ATTACK, stateMachine);

    this.windupTime = 300; // Telegraph before attack
    this.activeTime = 100; // Attack hitbox active
    this.recoveryTime = 200; // Recovery after attack
    this.totalDuration = this.windupTime + this.activeTime + this.recoveryTime;
  }

  get enemy() {
    return this.entity;
  }

  enter(prevState, params) {
    this.enemy.stop();
    this.enemy.lastAttackTime = this.stateMachine.scene?.time?.now || 0;

    // Face target
    const direction = this.enemy.getDirectionToTarget();
    this.enemy.sprite.setFlipX(direction < 0);

    // Telegraph - turn red during windup
    this.enemy.sprite.setTint(0xff8888);
  }

  update(time, delta) {
    const stateTime = this.stateMachine.getStateTime();

    // Windup phase
    if (stateTime < this.windupTime) {
      // Shake slightly to telegraph
      const shake = Math.sin(stateTime * 0.05) * 2;
      this.enemy.sprite.x += shake * 0.1;
      return null;
    }

    // Active phase - hitbox active
    if (stateTime < this.windupTime + this.activeTime) {
      if (!this.enemy.attackHitbox.active) {
        this.enemy.attackHitbox.activate();
        this.enemy.sprite.setTint(0xff4444); // Brighter red during attack

        // Lunge forward slightly
        const direction = this.enemy.sprite.flipX ? -1 : 1;
        this.enemy.sprite.body.setVelocityX(direction * 150);
      }
      return null;
    }

    // Recovery phase
    if (stateTime < this.totalDuration) {
      this.enemy.attackHitbox.deactivate();
      this.enemy.sprite.clearTint();
      this.enemy.stop();
      return null;
    }

    // Attack complete
    if (this.enemy.canSeeTarget()) {
      return ENEMY_STATES.CHASE;
    }
    return ENEMY_STATES.PATROL;
  }

  exit(nextState) {
    this.enemy.attackHitbox.deactivate();
    this.enemy.sprite.clearTint();
  }

  canBeInterrupted(nextStateName) {
    return nextStateName === ENEMY_STATES.HITSTUN ||
           nextStateName === ENEMY_STATES.DEAD;
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
    this.enemy.attackHitbox.deactivate();
  }

  update(time, delta) {
    if (this.enemy.hitstunRemaining <= 0) {
      if (this.enemy.canSeeTarget()) {
        return ENEMY_STATES.CHASE;
      }
      return ENEMY_STATES.PATROL;
    }
    return null;
  }

  canBeInterrupted(nextStateName) {
    return nextStateName === ENEMY_STATES.DEAD;
  }
}

/**
 * Enemy Dead State
 */
class EnemyDeadState extends State {
  constructor(stateMachine) {
    super(ENEMY_STATES.DEAD, stateMachine);
  }

  get enemy() {
    return this.entity;
  }

  enter(prevState, params) {
    // Emit event for corpse spawning - corpse system handles visual persistence
    this.enemy.scene.events.emit('enemy:died', {
      x: this.enemy.sprite.x,
      y: this.enemy.sprite.y,
      enemyType: this.enemy.config.type || 'SWARMER',
      width: this.enemy.sprite.body.width,
      height: this.enemy.sprite.body.height,
    });

    // Immediately destroy the enemy - corpse replaces the visual
    this.enemy.destroy();
  }

  update(time, delta) {
    return null;
  }

  canBeInterrupted() {
    return false;
  }
}

// ============================================
// SWARMER-SPECIFIC STATES
// Pack-based AI: brave in groups, cowardly alone
// ============================================

/**
 * Swarmer Idle State - Brief pause, waiting for stimulus
 */
class SwarmerIdleState extends State {
  constructor(stateMachine) {
    super(SWARMER_STATES.IDLE, stateMachine);
    this.idleDuration = 300;
  }

  get enemy() {
    return this.entity;
  }

  enter(prevState, params) {
    this.enemy.stop();
    // Restore original tint
    if (this.enemy.stats.color) {
      this.enemy.sprite.setTint(this.enemy.stats.color);
    }
  }

  update(time, delta) {
    // Check for player
    if (this.enemy.canSeeTarget()) {
      return SWARMER_STATES.ALERT;
    }

    // Return to patrol after idle
    if (this.stateMachine.getStateTime() >= this.idleDuration) {
      return SWARMER_STATES.PATROL;
    }

    return null;
  }
}

/**
 * Swarmer Patrol State - Wander back and forth
 */
class SwarmerPatrolState extends State {
  constructor(stateMachine) {
    super(SWARMER_STATES.PATROL, stateMachine);
  }

  get enemy() {
    return this.entity;
  }

  enter(prevState, params) {
    // Restore original tint
    if (this.enemy.stats.color) {
      this.enemy.sprite.setTint(this.enemy.stats.color);
    }
  }

  update(time, delta) {
    // Check for player
    if (this.enemy.canSeeTarget()) {
      return SWARMER_STATES.ALERT;
    }

    // Patrol movement
    const distanceFromOrigin = this.enemy.sprite.x - this.enemy.patrolOrigin;

    // Turn around at patrol limits
    if (distanceFromOrigin > this.enemy.patrolDistance) {
      this.enemy.patrolDirection = -1;
    } else if (distanceFromOrigin < -this.enemy.patrolDistance) {
      this.enemy.patrolDirection = 1;
    }

    // Check for walls
    if (this.enemy.sprite.body.blocked.left) {
      this.enemy.patrolDirection = 1;
    } else if (this.enemy.sprite.body.blocked.right) {
      this.enemy.patrolDirection = -1;
    }

    // Move at patrol speed
    this.enemy.move(this.enemy.patrolDirection, this.enemy.speed);

    return null;
  }
}

/**
 * Swarmer Alert State - Brief "noticed player" reaction
 */
class SwarmerAlertState extends State {
  constructor(stateMachine) {
    super(SWARMER_STATES.ALERT, stateMachine);
  }

  get enemy() {
    return this.entity;
  }

  enter(prevState, params) {
    this.enemy.stop();
    this.alertDuration = this.enemy.config.alertDuration || 200;

    // Face player
    const direction = this.enemy.getDirectionToTarget();
    this.enemy.sprite.setFlipX(direction < 0);

    // Yellow tint to indicate alert
    this.enemy.sprite.setTint(0xffff00);

    // Emit alert event for debugging
    this.enemy.scene.events.emit('swarmer:alert', { enemy: this.enemy });
  }

  update(time, delta) {
    const stateTime = this.stateMachine.getStateTime();

    if (stateTime >= this.alertDuration) {
      // Decide: chase or retreat based on pack status
      if (this.enemy.isInPack()) {
        return SWARMER_STATES.CHASE;
      } else {
        return SWARMER_STATES.RETREAT;
      }
    }

    return null;
  }

  exit(nextState) {
    // Restore tint
    if (this.enemy.stats.color) {
      this.enemy.sprite.setTint(this.enemy.stats.color);
    }
  }
}

/**
 * Swarmer Chase State - Rush directly at player (when in pack)
 */
class SwarmerChaseState extends State {
  constructor(stateMachine) {
    super(SWARMER_STATES.CHASE, stateMachine);
    this.packCheckInterval = 200; // Check pack status every 200ms
    this.lastPackCheck = 0;
    this.wasInPack = true;
  }

  get enemy() {
    return this.entity;
  }

  enter(prevState, params) {
    this.lastPackCheck = 0;
    this.wasInPack = this.enemy.isInPack();

    // Restore original tint (or slightly brighter for aggression)
    this.enemy.sprite.setTint(this.enemy.stats.color || 0xffaa00);
  }

  update(time, delta) {
    // Periodic pack status check
    this.lastPackCheck += delta;
    if (this.lastPackCheck >= this.packCheckInterval) {
      this.lastPackCheck = 0;
      this.wasInPack = this.enemy.isInPack();

      // Lost pack support - retreat!
      if (!this.wasInPack) {
        return SWARMER_STATES.RETREAT;
      }
    }

    // Check if can attack
    if (this.enemy.canAttackTarget() && this.enemy.canAttack(time)) {
      // Only attack if in pack
      if (this.wasInPack) {
        return SWARMER_STATES.ATTACK_WINDUP;
      }
    }

    // Move toward target
    if (this.enemy.canSeeTarget()) {
      const direction = this.enemy.getDirectionToTarget();
      this.enemy.move(direction, this.enemy.chaseSpeed);

      // Attempt to climb over blocking enemies
      if (this.enemy.canClimbEnemies && this.enemy.isBlockedByEnemy()) {
        this.enemy.attemptClimb(time);
      }
    } else {
      // Lost sight of player
      this.enemy.stop();
      return SWARMER_STATES.PATROL;
    }

    return null;
  }
}

/**
 * Swarmer Retreat State - Flee toward other swarmers (when isolated)
 */
class SwarmerRetreatState extends State {
  constructor(stateMachine) {
    super(SWARMER_STATES.RETREAT, stateMachine);
    this.packCheckInterval = 150;
    this.lastPackCheck = 0;
    this.retreatTimeout = 3000; // Give up retreating after 3s
  }

  get enemy() {
    return this.entity;
  }

  enter(prevState, params) {
    this.lastPackCheck = 0;

    // Blue-ish tint to indicate fleeing
    this.enemy.sprite.setTint(0x6699ff);

    // Calculate initial retreat target
    this.updateRetreatTarget();

    // Emit retreat event for debugging
    this.enemy.scene.events.emit('swarmer:retreat', { enemy: this.enemy });
  }

  updateRetreatTarget() {
    const target = this.enemy.getRetreatTarget();
    this.enemy.currentRetreatTarget = target;
    return target;
  }

  update(time, delta) {
    const stateTime = this.stateMachine.getStateTime();

    // Periodic pack check
    this.lastPackCheck += delta;
    if (this.lastPackCheck >= this.packCheckInterval) {
      this.lastPackCheck = 0;

      // Regrouped with pack - attack!
      if (this.enemy.isInPack()) {
        this.enemy.scene.events.emit('swarmer:regroup', { enemy: this.enemy });
        return SWARMER_STATES.CHASE;
      }

      // Update retreat target
      this.updateRetreatTarget();
    }

    // Timeout - no swarmers to retreat to, far from player
    if (stateTime >= this.retreatTimeout) {
      const distToPlayer = this.enemy.getDistanceToTarget();
      if (distToPlayer > this.enemy.detectionRange * 1.5) {
        return SWARMER_STATES.PATROL;
      }
    }

    // Move toward retreat target
    const target = this.enemy.currentRetreatTarget;
    if (target) {
      const dx = target.x - this.enemy.sprite.x;
      const direction = dx > 0 ? 1 : -1;
      const retreatSpeed = this.enemy.config.retreatSpeed || 180;
      this.enemy.move(direction, retreatSpeed);

      // Check if reached retreat target
      if (Math.abs(dx) < 30) {
        // Reached target but still isolated - keep looking
        this.updateRetreatTarget();
      }
    } else {
      // No retreat target - just run away from player
      const direction = this.enemy.getDirectionToTarget() * -1;
      const retreatSpeed = this.enemy.config.retreatSpeed || 180;
      this.enemy.move(direction, retreatSpeed);
    }

    return null;
  }

  exit(nextState) {
    this.enemy.currentRetreatTarget = null;
    // Restore tint
    if (this.enemy.stats.color) {
      this.enemy.sprite.setTint(this.enemy.stats.color);
    }
  }
}

/**
 * Swarmer Attack Windup State - Telegraph attack
 */
class SwarmerAttackWindupState extends State {
  constructor(stateMachine) {
    super(SWARMER_STATES.ATTACK_WINDUP, stateMachine);
  }

  get enemy() {
    return this.entity;
  }

  enter(prevState, params) {
    this.enemy.stop();
    this.windupDuration = this.enemy.config.attackWindup || 200;

    // Face player at start
    const direction = this.enemy.getDirectionToTarget();
    this.enemy.sprite.setFlipX(direction < 0);

    // Record attack cooldown
    this.enemy.lastAttackTime = this.enemy.scene?.time?.now || 0;

    // Red tint to telegraph
    this.enemy.sprite.setTint(0xff6666);
  }

  update(time, delta) {
    const stateTime = this.stateMachine.getStateTime();

    // Slight shake to telegraph
    const shake = Math.sin(stateTime * 0.08) * 2;
    this.enemy.sprite.x += shake * 0.1;

    if (stateTime >= this.windupDuration) {
      return SWARMER_STATES.ATTACKING;
    }

    return null;
  }

  canBeInterrupted(nextStateName) {
    // Can be interrupted by damage
    return nextStateName === SWARMER_STATES.HITSTUN ||
           nextStateName === SWARMER_STATES.LAUNCHED ||
           nextStateName === SWARMER_STATES.DEAD;
  }
}

/**
 * Swarmer Attacking State - Lunge and hitbox active
 */
class SwarmerAttackingState extends State {
  constructor(stateMachine) {
    super(SWARMER_STATES.ATTACKING, stateMachine);
  }

  get enemy() {
    return this.entity;
  }

  enter(prevState, params) {
    this.activeDuration = this.enemy.config.attackActive || 100;

    // Activate hitbox with swarmer-specific properties
    this.enemy.attackHitbox.damage = this.enemy.damage;
    this.enemy.attackHitbox.knockback = { x: 150, y: -50 };
    this.enemy.attackHitbox.hitstun = 200;
    this.enemy.attackHitbox.activate();

    // Brighter red during attack
    this.enemy.sprite.setTint(0xff4444);

    // Lunge forward
    const direction = this.enemy.sprite.flipX ? -1 : 1;
    this.enemy.sprite.body.setVelocityX(direction * 180);
  }

  update(time, delta) {
    const stateTime = this.stateMachine.getStateTime();

    if (stateTime >= this.activeDuration) {
      return SWARMER_STATES.ATTACK_RECOVERY;
    }

    return null;
  }

  exit(nextState) {
    this.enemy.attackHitbox.deactivate();
  }

  canBeInterrupted(nextStateName) {
    return nextStateName === SWARMER_STATES.HITSTUN ||
           nextStateName === SWARMER_STATES.LAUNCHED ||
           nextStateName === SWARMER_STATES.DEAD;
  }
}

/**
 * Swarmer Attack Recovery State - Vulnerable after attack
 */
class SwarmerAttackRecoveryState extends State {
  constructor(stateMachine) {
    super(SWARMER_STATES.ATTACK_RECOVERY, stateMachine);
  }

  get enemy() {
    return this.entity;
  }

  enter(prevState, params) {
    this.recoveryDuration = this.enemy.config.attackRecovery || 150;
    this.enemy.stop();
    this.enemy.attackHitbox.deactivate();

    // Restore tint
    if (this.enemy.stats.color) {
      this.enemy.sprite.setTint(this.enemy.stats.color);
    }
  }

  update(time, delta) {
    const stateTime = this.stateMachine.getStateTime();

    if (stateTime >= this.recoveryDuration) {
      // Check pack status to decide next action
      if (this.enemy.isInPack()) {
        return SWARMER_STATES.CHASE;
      } else {
        return SWARMER_STATES.RETREAT;
      }
    }

    return null;
  }

  canBeInterrupted(nextStateName) {
    return nextStateName === SWARMER_STATES.HITSTUN ||
           nextStateName === SWARMER_STATES.LAUNCHED ||
           nextStateName === SWARMER_STATES.DEAD;
  }
}

/**
 * Swarmer Hitstun State - Extended hitstun (fodder enemy)
 */
class SwarmerHitstunState extends State {
  constructor(stateMachine) {
    super(SWARMER_STATES.HITSTUN, stateMachine);
    this.wasLaunched = false;
  }

  get enemy() {
    return this.entity;
  }

  enter(prevState, params) {
    this.enemy.attackHitbox.deactivate();
    this.wasLaunched = false;

    // Apply hitstun multiplier (swarmers have longer hitstun)
    const multiplier = this.enemy.config.hitstunMultiplier || 1.5;

    // Check if this was a launcher hit
    if (params?.hitData?.launcher) {
      this.wasLaunched = true;
    }

    // Flash white
    this.enemy.sprite.setTint(0xffffff);

    // Schedule tint restoration
    this.enemy.scene.time.delayedCall(50, () => {
      if (this.enemy.sprite && this.enemy.sprite.active && this.enemy.isAlive) {
        // Darker tint during hitstun
        this.enemy.sprite.setTint(0xffccaa);
      }
    });
  }

  update(time, delta) {
    // Check for death
    if (this.enemy.health <= 0) {
      return SWARMER_STATES.DEAD;
    }

    // Check for launch (hit by launcher while in hitstun)
    if (this.wasLaunched || (this.enemy.sprite.body.velocity.y < -200 && !this.enemy.sprite.body.blocked.down)) {
      return SWARMER_STATES.LAUNCHED;
    }

    // Wait for hitstun to end
    if (this.enemy.hitstunRemaining <= 0) {
      // Restore tint
      if (this.enemy.stats.color) {
        this.enemy.sprite.setTint(this.enemy.stats.color);
      }

      // Check pack status
      if (this.enemy.isInPack()) {
        return SWARMER_STATES.CHASE;
      } else {
        return SWARMER_STATES.RETREAT;
      }
    }

    return null;
  }

  canBeInterrupted(nextStateName) {
    // Can be launched while in hitstun
    return nextStateName === SWARMER_STATES.LAUNCHED ||
           nextStateName === SWARMER_STATES.DEAD;
  }
}

/**
 * Swarmer Launched State - Airborne, combo-able
 */
class SwarmerLaunchedState extends State {
  constructor(stateMachine) {
    super(SWARMER_STATES.LAUNCHED, stateMachine);
  }

  get enemy() {
    return this.entity;
  }

  enter(prevState, params) {
    this.enemy.attackHitbox.deactivate();

    // Airborne visual
    this.enemy.sprite.setTint(0xffaaaa);
  }

  update(time, delta) {
    // Check for death
    if (this.enemy.health <= 0) {
      return SWARMER_STATES.DEAD;
    }

    // Check if landed
    if (this.enemy.sprite.body.blocked.down || this.enemy.sprite.body.touching.down) {
      return SWARMER_STATES.DOWNED;
    }

    return null;
  }

  canBeInterrupted(nextStateName) {
    // Can be hit again while launched (juggle)
    return nextStateName === SWARMER_STATES.HITSTUN ||
           nextStateName === SWARMER_STATES.DEAD;
  }
}

/**
 * Swarmer Downed State - On the ground, recovering
 */
class SwarmerDownedState extends State {
  constructor(stateMachine) {
    super(SWARMER_STATES.DOWNED, stateMachine);
  }

  get enemy() {
    return this.entity;
  }

  enter(prevState, params) {
    this.downedDuration = this.enemy.config.downedDuration || 300;
    this.enemy.stop();
    this.enemy.attackHitbox.deactivate();

    // Darker tint while downed
    this.enemy.sprite.setTint(0x886644);
  }

  update(time, delta) {
    const stateTime = this.stateMachine.getStateTime();

    // Check for death
    if (this.enemy.health <= 0) {
      return SWARMER_STATES.DEAD;
    }

    // Recovery complete
    if (stateTime >= this.downedDuration) {
      // Restore tint
      if (this.enemy.stats.color) {
        this.enemy.sprite.setTint(this.enemy.stats.color);
      }

      // Check pack status
      if (this.enemy.isInPack()) {
        return SWARMER_STATES.CHASE;
      } else {
        return SWARMER_STATES.RETREAT;
      }
    }

    return null;
  }

  canBeInterrupted(nextStateName) {
    // Can be hit while downed (OTG)
    return nextStateName === SWARMER_STATES.HITSTUN ||
           nextStateName === SWARMER_STATES.LAUNCHED ||
           nextStateName === SWARMER_STATES.DEAD;
  }
}

/**
 * Swarmer Dead State - Terminal state
 */
class SwarmerDeadState extends State {
  constructor(stateMachine) {
    super(SWARMER_STATES.DEAD, stateMachine);
  }

  get enemy() {
    return this.entity;
  }

  enter(prevState, params) {
    // Emit event for corpse spawning
    this.enemy.scene.events.emit('enemy:died', {
      x: this.enemy.sprite.x,
      y: this.enemy.sprite.y,
      enemyType: this.enemy.config.type || 'SWARMER',
      width: this.enemy.sprite.body.width,
      height: this.enemy.sprite.body.height,
    });

    // Clean up debug graphics
    if (this.enemy.packDebugGraphics) {
      this.enemy.packDebugGraphics.destroy();
      this.enemy.packDebugGraphics = null;
    }

    // Destroy the enemy
    this.enemy.destroy();
  }

  update(time, delta) {
    return null;
  }

  canBeInterrupted() {
    return false;
  }
}
