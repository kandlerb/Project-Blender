import { COMBAT } from '../utils/combat.js';
import { PHYSICS } from '../utils/physics.js';
import { BOX_TYPE, TEAM } from '../systems/CombatManagerMatter.js';
import {
  CollisionCategories,
  CollisionMasks,
  createBossBodyConfig,
  createHurtboxConfig,
  MatterPhysicsHelper
} from '../systems/MatterPhysics.js';

/**
 * Boss entity base class
 * Handles phases, attack patterns, and transitions
 * Uses Matter.js physics
 */
export class Boss {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {object} config - Boss configuration
   */
  constructor(scene, x, y, config) {
    this.scene = scene;
    this.config = config;

    // Identity
    this.id = config.id;
    this.name = config.name;
    this.weaponDrop = config.weaponDrop;

    // Stats
    this.health = config.maxHealth;
    this.maxHealth = config.maxHealth;
    this.damage = config.damage;
    this.isAlive = true;
    this.isInvulnerable = false;

    // Dimensions
    this.bodyWidth = config.width || 64;
    this.bodyHeight = config.height || 80;

    // Phase system
    this.currentPhase = 0;
    this.phases = config.phases || [
      { threshold: 1.0, attacks: [] },
      { threshold: 0.66, attacks: [] },
      { threshold: 0.33, attacks: [] },
    ];

    // Attack system
    this.attackPatterns = config.attackPatterns || {};
    this.currentAttack = null;
    this.attackTimer = 0;
    this.attackCooldowns = {}; // Track individual attack cooldowns
    this.globalCooldown = 0;
    this.minGlobalCooldown = config.minGlobalCooldown || 500;

    // State
    this.state = 'INTRO';
    this.stateTimer = 0;
    this.facingDirection = -1;

    // Hitstun (bosses have reduced hitstun)
    this.hitstunRemaining = 0;
    this.hitstunResistance = config.hitstunResistance || 0.3;

    // Create visual sprite (no physics, just graphics)
    this.sprite = scene.add.rectangle(x, y, this.bodyWidth, this.bodyHeight, config.color || 0xff0000);
    this.sprite.setDepth(5);

    // Add compatibility properties for existing code
    this.sprite.flipX = false;
    this.sprite.setFlipX = (flip) => {
      this.sprite.flipX = flip;
      // Could also flip the sprite visually if needed
    };

    // Create Matter.js physics body
    const bodyConfig = createBossBodyConfig(this.bodyWidth, this.bodyHeight);
    this.body = scene.matter.add.rectangle(
      x, y,
      this.bodyWidth,
      this.bodyHeight,
      bodyConfig
    );

    // Store reference to owner on body for collision callbacks
    this.body.gameObject = this;
    this.body.label = 'boss';

    // Create Matter.js physics helper
    this.matterHelper = new MatterPhysicsHelper(scene);

    // Ground contact tracking
    this.groundContacts = 0;
    this._isOnGround = false;

    // Setup collision events
    this.setupCollisionEvents();

    // Terminal velocity (Matter.js scale - roughly divide Arcade by 60)
    this.maxVelocityY = PHYSICS.TERMINAL_VELOCITY / 60; // ~30

    // Health bar (special boss health bar)
    this.createHealthBar();

    // Hitbox for attacks (set by subclass)
    this.hitbox = null;
    this.hitboxBody = null;

    // Create hurtbox (Matter.js sensor)
    this.createHurtbox();

    // Store reference on sprite for combat system
    this.sprite.setData('owner', this);

    // Register with scene
    if (scene.currentBoss === undefined) {
      scene.currentBoss = this;
    }
  }

  /**
   * Setup Matter.js collision events
   */
  setupCollisionEvents() {
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
   * Handle collision start
   * @param {object} pair - Collision pair
   */
  handleCollisionStart(pair) {
    const { bodyA, bodyB } = pair;
    const isA = bodyA === this.body;
    const isB = bodyB === this.body;
    if (!isA && !isB) return;

    const other = isA ? bodyB : bodyA;
    const category = other.collisionFilter?.category || 0;

    // Check for ground contact
    if (category & (CollisionCategories.GROUND | CollisionCategories.PLATFORM)) {
      // Check if collision is from below (we're on top)
      const normal = pair.collision.normal;
      const ny = isA ? normal.y : -normal.y;
      if (ny < -0.5) {
        this.groundContacts++;
        this._isOnGround = true;
      }
    }
  }

  /**
   * Handle collision end
   * @param {object} pair - Collision pair
   */
  handleCollisionEnd(pair) {
    const { bodyA, bodyB } = pair;
    const isA = bodyA === this.body;
    const isB = bodyB === this.body;
    if (!isA && !isB) return;

    const other = isA ? bodyB : bodyA;
    const category = other.collisionFilter?.category || 0;

    if (category & (CollisionCategories.GROUND | CollisionCategories.PLATFORM)) {
      this.groundContacts = Math.max(0, this.groundContacts - 1);
      if (this.groundContacts === 0) {
        this._isOnGround = false;
      }
    }
  }

  /**
   * Create Matter.js hurtbox sensor
   */
  createHurtbox() {
    const hurtboxConfig = createHurtboxConfig('boss_hurtbox');
    this.hurtboxBody = this.scene.matter.add.rectangle(
      this.sprite.x,
      this.sprite.y,
      this.bodyWidth,
      this.bodyHeight,
      hurtboxConfig
    );

    // Store reference to owner
    this.hurtboxBody.gameObject = this;

    // Register hurtbox with combat manager
    if (this.scene.combatManager) {
      this.scene.combatManager.registerHurtbox(this.hurtboxBody, {
        owner: this,
        team: TEAM.ENEMY,
      });
      // Activate hurtbox
      const hurtboxData = this.scene.combatManager.hurtboxes.get(this.hurtboxBody.id);
      if (hurtboxData) {
        hurtboxData.active = true;
      }
    }
  }

  /**
   * Create boss health bar (top of screen)
   */
  createHealthBar() {
    const cam = this.scene.cameras.main;
    const barWidth = 400;
    const barHeight = 20;
    const x = cam.width / 2 - barWidth / 2;
    const y = 30;

    // Container for UI elements
    this.healthBarContainer = this.scene.add.container(0, 0);
    this.healthBarContainer.setScrollFactor(0);
    this.healthBarContainer.setDepth(100);

    // Background
    this.healthBarBg = this.scene.add.rectangle(x, y, barWidth, barHeight, 0x222222);
    this.healthBarBg.setOrigin(0, 0.5);
    this.healthBarBg.setStrokeStyle(2, 0x444444);

    // Fill
    this.healthBarFill = this.scene.add.rectangle(x + 2, y, barWidth - 4, barHeight - 4, 0xff3333);
    this.healthBarFill.setOrigin(0, 0.5);

    // Boss name
    this.nameText = this.scene.add.text(cam.width / 2, y - 20, this.name.toUpperCase(), {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.nameText.setOrigin(0.5, 0.5);

    // Phase indicators
    this.phaseIndicators = [];
    for (let i = 0; i < this.phases.length - 1; i++) {
      const threshold = this.phases[i + 1].threshold;
      const indicatorX = x + (barWidth * threshold);
      const indicator = this.scene.add.rectangle(indicatorX, y, 3, barHeight + 4, 0xffffff);
      indicator.setOrigin(0.5, 0.5);
      this.phaseIndicators.push(indicator);
    }

    this.healthBarContainer.add([
      this.healthBarBg,
      this.healthBarFill,
      this.nameText,
      ...this.phaseIndicators,
    ]);

    // Initially hidden
    this.healthBarContainer.setAlpha(0);
  }

  /**
   * Update health bar display
   */
  updateHealthBar() {
    const percent = this.health / this.maxHealth;
    const maxWidth = this.healthBarBg.width - 4;
    this.healthBarFill.setScale(percent, 1);

    // Color based on phase
    const colors = [0xff3333, 0xff8833, 0xffff33];
    this.healthBarFill.setFillStyle(colors[this.currentPhase] || 0xff3333);
  }

  /**
   * Show boss health bar with animation
   */
  showHealthBar() {
    this.scene.tweens.add({
      targets: this.healthBarContainer,
      alpha: 1,
      duration: 500,
      ease: 'Power2',
    });
  }

  /**
   * Hide boss health bar
   */
  hideHealthBar() {
    this.scene.tweens.add({
      targets: this.healthBarContainer,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
    });
  }

  /**
   * Main update loop
   */
  update(time, delta) {
    if (!this.isAlive) return;

    // Sync sprite position with physics body
    this.sprite.x = this.body.position.x;
    this.sprite.y = this.body.position.y;

    // Sync hurtbox position
    if (this.hurtboxBody) {
      this.scene.matter.body.setPosition(this.hurtboxBody, {
        x: this.body.position.x,
        y: this.body.position.y
      });
    }

    // Clamp vertical velocity (terminal velocity)
    if (this.body.velocity.y > this.maxVelocityY) {
      this.scene.matter.body.setVelocity(this.body, {
        x: this.body.velocity.x,
        y: this.maxVelocityY
      });
    }

    // Update timers
    this.stateTimer += delta;
    this.globalCooldown = Math.max(0, this.globalCooldown - delta);

    // Update attack cooldowns
    for (const key in this.attackCooldowns) {
      this.attackCooldowns[key] = Math.max(0, this.attackCooldowns[key] - delta);
    }

    // Handle hitstun
    if (this.hitstunRemaining > 0) {
      this.hitstunRemaining -= delta;
      if (this.hitstunRemaining <= 0) {
        this.hitstunRemaining = 0;
        this.sprite.setFillStyle(this.config.color || 0xff0000);
      }
      return;
    }

    // State machine
    switch (this.state) {
      case 'INTRO':
        this.updateIntro(time, delta);
        break;
      case 'IDLE':
        this.updateIdle(time, delta);
        break;
      case 'ATTACKING':
        this.updateAttacking(time, delta);
        break;
      case 'PHASE_TRANSITION':
        this.updatePhaseTransition(time, delta);
        break;
      case 'DEFEATED':
        this.updateDefeated(time, delta);
        break;
      case 'STAGGERED':
        this.updateStaggered(time, delta);
        break;
    }

    // Face player
    if (this.scene.player && this.state !== 'ATTACKING') {
      this.facingDirection = this.scene.player.sprite.x < this.sprite.x ? -1 : 1;
      this.sprite.flipX = this.facingDirection < 0;
    }

    // Update health bar
    this.updateHealthBar();
  }

  /**
   * Intro state - boss entrance
   */
  updateIntro(time, delta) {
    // Override in subclass for custom intro
    if (this.stateTimer >= 1000) {
      this.showHealthBar();
      this.setState('IDLE');
    }
  }

  /**
   * Idle state - choose next attack and chase player
   */
  updateIdle(time, delta) {
    // Chase player to maintain fighting distance
    const distance = this.getDistanceToPlayer();
    const idealRange = this.config.idealRange || 150;

    // Matter.js velocity scale (divide Arcade by ~60)
    const chaseSpeed = (this.config.chaseSpeed || 200) / 60; // ~3.3
    const backSpeed = 100 / 60; // ~1.67

    if (distance > idealRange + 50) {
      // Too far - move toward player
      this.moveTowardPlayer(chaseSpeed);
    } else if (distance < idealRange - 30) {
      // Too close - back away slightly
      this.matterHelper.setVelocityX(this.body, -this.facingDirection * backSpeed);
    } else {
      // In range - stop moving
      this.stopMovement();
    }

    if (this.globalCooldown > 0) return;

    // Get available attacks for current phase
    const phase = this.phases[this.currentPhase];
    const availableAttacks = phase.attacks.filter(atk =>
      this.attackCooldowns[atk] === undefined || this.attackCooldowns[atk] <= 0
    );

    if (availableAttacks.length === 0) return;

    // Select attack (can be weighted, conditional, etc.)
    const attackId = this.selectAttack(availableAttacks);
    if (attackId) {
      this.startAttack(attackId);
    }
  }

  /**
   * Select which attack to use
   * @param {string[]} availableAttacks
   * @returns {string|null}
   */
  selectAttack(availableAttacks) {
    // Override in subclass for smarter selection
    // Default: random
    return availableAttacks[Math.floor(Math.random() * availableAttacks.length)];
  }

  /**
   * Start an attack
   * @param {string} attackId
   */
  startAttack(attackId) {
    const pattern = this.attackPatterns[attackId];
    if (!pattern) {
      console.warn(`Unknown attack pattern: ${attackId}`);
      return;
    }

    this.currentAttack = { id: attackId, ...pattern };
    this.attackTimer = 0;
    this.setState('ATTACKING');

    // Call attack's start function if defined
    if (pattern.onStart) {
      pattern.onStart.call(this);
    }
  }

  /**
   * Attacking state - execute attack pattern
   */
  updateAttacking(time, delta) {
    if (!this.currentAttack) {
      this.setState('IDLE');
      return;
    }

    this.attackTimer += delta;

    // Call attack's update function
    if (this.currentAttack.onUpdate) {
      const result = this.currentAttack.onUpdate.call(this, this.attackTimer, delta);
      if (result === 'complete') {
        this.finishAttack();
      }
    } else {
      // Simple timed attack
      if (this.attackTimer >= (this.currentAttack.duration || 1000)) {
        this.finishAttack();
      }
    }
  }

  /**
   * Finish current attack
   */
  finishAttack() {
    if (this.currentAttack) {
      // Set cooldown
      this.attackCooldowns[this.currentAttack.id] = this.currentAttack.cooldown || 2000;
      this.globalCooldown = this.minGlobalCooldown;

      // Call end function
      if (this.currentAttack.onEnd) {
        this.currentAttack.onEnd.call(this);
      }
    }

    this.currentAttack = null;
    this.deactivateHitbox();
    this.setState('IDLE');
  }

  /**
   * Phase transition state
   */
  updatePhaseTransition(time, delta) {
    // Invulnerable during transition
    if (this.stateTimer >= 2000) {
      this.isInvulnerable = false;
      this.sprite.setFillStyle(this.config.color || 0xff0000);
      this.setState('IDLE');
    }
  }

  /**
   * Staggered state (after certain attacks or conditions)
   */
  updateStaggered(time, delta) {
    if (this.stateTimer >= 1500) {
      this.setState('IDLE');
    }
  }

  /**
   * Defeated state
   */
  updateDefeated(time, delta) {
    // Death animation handled here
    // Override in subclass
  }

  /**
   * Set state with timer reset
   * @param {string} newState
   */
  setState(newState) {
    this.state = newState;
    this.stateTimer = 0;
  }

  /**
   * Take damage
   * @param {number} amount
   * @param {object} hitData
   */
  takeDamage(amount, hitData = null) {
    if (!this.isAlive || this.isInvulnerable) return;

    this.health = Math.max(0, this.health - amount);

    // Reduced hitstun for bosses
    const baseHitstun = hitData?.hitstun || 100;
    this.hitstunRemaining = baseHitstun * this.hitstunResistance;
    this.sprite.setFillStyle(0xff8888);

    // Check for phase transition
    this.checkPhaseTransition();

    // Check for defeat
    if (this.health <= 0) {
      this.defeat();
    }

    // Emit event
    this.scene.events.emit('boss:damaged', { boss: this, damage: amount });
  }

  /**
   * Check if we should transition to next phase
   */
  checkPhaseTransition() {
    const healthPercent = this.health / this.maxHealth;

    for (let i = this.phases.length - 1; i > this.currentPhase; i--) {
      if (healthPercent <= this.phases[i].threshold) {
        this.transitionToPhase(i);
        break;
      }
    }
  }

  /**
   * Transition to a new phase
   * @param {number} phaseIndex
   */
  transitionToPhase(phaseIndex) {
    this.currentPhase = phaseIndex;
    this.isInvulnerable = true;
    this.finishAttack();
    this.setState('PHASE_TRANSITION');

    // Visual feedback
    this.sprite.setFillStyle(0xffff00);

    if (this.scene.effectsManager) {
      this.scene.effectsManager.screenShake(8, 500);
      this.scene.effectsManager.screenFlash(0xffff00, 200, 0.3);
    }

    if (this.scene.timeManager) {
      this.scene.timeManager.applySlowmo(500, 0.5);
    }

    // Emit event
    this.scene.events.emit('boss:phaseChange', {
      boss: this,
      phase: phaseIndex,
    });
  }

  /**
   * Boss defeated
   */
  defeat() {
    this.isAlive = false;
    this.setState('DEFEATED');

    // Drop weapon
    if (this.weaponDrop) {
      this.scene.events.emit('boss:defeated', {
        boss: this,
        weaponDrop: this.weaponDrop,
      });

      // Grant weapon to player
      if (this.scene.player) {
        this.scene.player.unlockWeapon(this.weaponDrop);
      }
    }

    // Visual feedback
    if (this.scene.effectsManager) {
      this.scene.effectsManager.screenShake(15, 1000);
      this.scene.effectsManager.screenFlash(0xffffff, 500, 0.5);
    }

    if (this.scene.timeManager) {
      this.scene.timeManager.applySlowmo(1000, 0.1);
    }

    // Hide health bar
    this.hideHealthBar();

    // Death animation then destroy
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      scale: 2,
      duration: 1000,
      onComplete: () => {
        this.destroy();
      },
    });
  }

  /**
   * Activate attack hitbox
   * @param {object} config
   */
  activateHitbox(config) {
    // Similar to enemy hitbox activation
    // Implementation depends on CombatBox system
  }

  /**
   * Deactivate attack hitbox
   */
  deactivateHitbox() {
    if (this.hitbox) {
      this.hitbox.deactivate();
    }
  }

  /**
   * Get distance to player
   * @returns {number}
   */
  getDistanceToPlayer() {
    if (!this.scene.player) return Infinity;
    const dx = this.scene.player.sprite.x - this.sprite.x;
    const dy = this.scene.player.sprite.y - this.sprite.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get direction to player (-1 or 1)
   * @returns {number}
   */
  getDirectionToPlayer() {
    if (!this.scene.player) return this.facingDirection;
    return this.scene.player.sprite.x < this.sprite.x ? -1 : 1;
  }

  /**
   * Move toward player
   * @param {number} speed - Matter.js velocity scale (~2-10)
   */
  moveTowardPlayer(speed) {
    const direction = this.getDirectionToPlayer();
    this.matterHelper.setVelocityX(this.body, direction * speed);
    this.facingDirection = direction;
  }

  /**
   * Stop movement
   */
  stopMovement() {
    this.matterHelper.setVelocityX(this.body, 0);
  }

  /**
   * Set X velocity (Matter.js scale)
   * @param {number} vx - X velocity in Matter.js scale
   */
  setVelocityX(vx) {
    this.matterHelper.setVelocityX(this.body, vx);
  }

  /**
   * Get debug info
   * @returns {object}
   */
  getDebugInfo() {
    return {
      name: this.name,
      health: `${this.health}/${this.maxHealth}`,
      phase: this.currentPhase + 1,
      state: this.state,
      attack: this.currentAttack?.id || 'none',
      invulnerable: this.isInvulnerable,
    };
  }

  /**
   * Toggle combat debug visualization
   * @param {boolean} show - Whether to show debug graphics
   */
  setCombatDebug(show) {
    // Combat debug is handled by CombatManagerMatter
  }

  /**
   * Clean up
   */
  destroy() {
    if (this.healthBarContainer) {
      this.healthBarContainer.destroy();
    }

    // Helper for safe body removal with pair cleanup
    const safeRemove = (body) => {
      if (!body) return;

      // Immediately disable collisions
      if (body.collisionFilter) {
        body.collisionFilter.mask = 0;
        body.collisionFilter.category = 0;
      }

      if (this.scene?.worldManager) {
        this.scene.worldManager.safeRemove(body);
      } else if (this.scene?.matter?.world) {
        // Fallback with pair cleanup
        this.scene.matter.world.once('afterupdate', () => {
          try {
            // Clear collision pairs before removal
            const engine = this.scene.matter.world.engine;
            if (engine?.pairs?.table) {
              for (const id in engine.pairs.table) {
                const pair = engine.pairs.table[id];
                if (pair && (pair.bodyA === body || pair.bodyB === body)) {
                  delete engine.pairs.table[id];
                  if (engine.pairs.list) {
                    const idx = engine.pairs.list.indexOf(pair);
                    if (idx !== -1) engine.pairs.list.splice(idx, 1);
                  }
                }
              }
            }
            this.scene.matter.world.remove(body);
          } catch (e) {
            // Ignore
          }
        });
      }
    };

    // Unregister hurtbox from combat manager before destroying
    if (this.hurtboxBody) {
      if (this.scene?.combatManager) {
        this.scene.combatManager.hurtboxes.delete(this.hurtboxBody.id);
      }
      safeRemove(this.hurtboxBody);
      this.hurtboxBody = null;
    }
    if (this.hitboxBody) {
      if (this.scene?.combatManager) {
        this.scene.combatManager.hitboxes.delete(this.hitboxBody.id);
      }
      safeRemove(this.hitboxBody);
      this.hitboxBody = null;
    }
    if (this.body) {
      safeRemove(this.body);
      this.body = null;
    }
    if (this.sprite) {
      this.sprite.destroy();
    }
    if (this.scene?.currentBoss === this) {
      this.scene.currentBoss = null;
    }
  }
}
