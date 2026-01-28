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
  SWARMER: {
    maxHealth: 20,
    damage: 8,
    speed: 150,
    chaseSpeed: 250,
    detectionRange: 300,
    attackRange: 40,
    attackCooldown: 1000,
  },
  BRUTE: {
    maxHealth: 60,
    damage: 20,
    speed: 80,
    chaseSpeed: 120,
    detectionRange: 250,
    attackRange: 60,
    attackCooldown: 1500,
  },
});

/**
 * Base Enemy class with AI
 */
export class Enemy {
  constructor(scene, x, y, config = {}) {
    this.scene = scene;

    // Merge config with defaults
    const preset = ENEMY_PRESETS[config.type] || ENEMY_PRESETS.SWARMER;
    this.config = { ...preset, ...config };

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

    // Create sprite
    this.sprite = scene.physics.add.sprite(x, y, 'enemy_placeholder');
    this.setupPhysics();

    // Combat boxes
    this.setupCombatBoxes();

    // State machine
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
    // Hurtbox
    this.hurtbox = new CombatBox(this.scene, {
      owner: this,
      type: BOX_TYPE.HURTBOX,
      team: TEAM.ENEMY,
      width: 24,
      height: 24,
      offsetX: 0,
      offsetY: 0,
    });

    // Attack hitbox
    this.attackHitbox = new CombatBox(this.scene, {
      owner: this,
      type: BOX_TYPE.HITBOX,
      team: TEAM.ENEMY,
      width: 35,
      height: 30,
      offsetX: 25,
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

    this.stateMachine.update(time, delta);
    this.hurtbox.updatePosition();
    this.attackHitbox.updatePosition();
  }

  takeDamage(amount, hitData = null) {
    if (!this.isAlive) return;

    this.health = Math.max(0, this.health - amount);

    if (hitData && hitData.hitstun) {
      this.hitstunRemaining = hitData.hitstun;
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
      this.die();
    }
  }

  flashWhite() {
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(50, () => {
      if (this.sprite && this.sprite.active) {
        this.sprite.clearTint();
      }
    });
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
