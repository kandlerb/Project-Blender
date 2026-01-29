import { StateMachine, State } from '../systems/StateMachine.js';
import { CombatBox, BOX_TYPE, TEAM } from '../systems/CombatBox.js';
import { PHYSICS } from '../utils/physics.js';

/**
 * Enemy states
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
 * Enemy configuration presets
 */
export const ENEMY_PRESETS = Object.freeze({
  /**
   * SWARMER - Fast rushdown enemy
   * Low HP, high speed, swarms the player
   */
  SWARMER: {
    maxHealth: 10,
    damage: 8,
    speed: 150,
    chaseSpeed: 250,
    detectionRange: 300,
    attackRange: 40,
    attackCooldown: 1000,
    color: 0xffaa00,
    width: 28,
    height: 32,
    canBePulled: true,
    behavior: 'swarmer',
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

    // Patrol
    this.patrolDirection = 1;
    this.patrolDistance = config.patrolDistance || 150;
    this.patrolOrigin = x;

    // Behavior-specific state
    this.currentState = 'IDLE';
    this.isBlocking = false;
    this.isExploding = false;
    this.chargeDirection = 1;
    this.windupTimer = 0;
    this.chargeTimer = 0;
    this.recoveryTimer = 0;
    this.attackTimer = 0;
    this.hasDealtDamage = false;

    // Create sprite
    this.sprite = scene.physics.add.sprite(x, y, 'enemy_placeholder');
    this.setupPhysics();

    // Apply color tint if defined
    if (this.stats.color) {
      this.sprite.setTint(this.stats.color);
    }

    // Combat boxes
    this.setupCombatBoxes();

    // State machine (used for standard swarmer/brute behavior)
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

    // Hitstun tracking
    this.hitstunRemaining = 0;

    // Store reference on sprite
    this.sprite.setData('owner', this);
  }

  setupPhysics() {
    const body = this.sprite.body;

    body.setCollideWorldBounds(true);
    body.setBounce(0);
    body.setGravityY(PHYSICS.GRAVITY);
    body.setMaxVelocityY(PHYSICS.TERMINAL_VELOCITY);
    body.setDrag(300, 0);

    body.setSize(20, 24);
    body.setOffset(4, 4);
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
  }

  takeDamage(amount, hitData = null) {
    if (!this.isAlive) return;

    // Check for shield block
    if (this.stats.behavior === 'shield' && this.checkBlock({ ...hitData, damage: amount })) {
      return; // Damage blocked
    }

    this.health = Math.max(0, this.health - amount);

    if (hitData && hitData.hitstun) {
      this.hitstunRemaining = hitData.hitstun;
      this.currentState = 'HITSTUN';
      this.isBlocking = false;
      this.stateMachine.transition(ENEMY_STATES.HITSTUN, { hitData }, true);
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
    this.stateMachine.transition(ENEMY_STATES.DEAD, {}, true);
    this.scene.events.emit('enemy:killed', { enemy: this });
  }

  addCollider(target) {
    this.scene.physics.add.collider(this.sprite, target);
  }

  setCombatDebug(show) {
    this.hurtbox.setDebug(show);
    this.attackHitbox.setDebug(show);
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

  destroy() {
    if (this.scene.combatManager) {
      this.scene.combatManager.unregister(this.hurtbox);
      this.scene.combatManager.unregister(this.attackHitbox);
    }
    this.hurtbox.destroy();
    this.attackHitbox.destroy();
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
    // Emit event for corpse spawning before fade
    this.enemy.scene.events.emit('enemy:died', {
      x: this.enemy.sprite.x,
      y: this.enemy.sprite.y,
      enemyType: this.enemy.config.type || 'SWARMER',
      width: this.enemy.sprite.body.width,
      height: this.enemy.sprite.body.height,
    });

    this.enemy.sprite.setTint(0x666666);
    this.enemy.sprite.setAlpha(0.7);
    this.enemy.sprite.body.setVelocity(0, 0);
    this.enemy.sprite.body.setAllowGravity(false);

    this.enemy.scene.tweens.add({
      targets: this.enemy.sprite,
      alpha: 0,
      y: this.enemy.sprite.y - 20,
      duration: 500,
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
    return false;
  }
}
