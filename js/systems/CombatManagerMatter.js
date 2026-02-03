/**
 * CombatManagerMatter - Matter.js collision-based combat system
 *
 * Uses Matter.js sensor collisions instead of manual overlap checking.
 * Hitboxes and hurtboxes are Matter.js sensor bodies that trigger
 * collision events when they overlap.
 */

import { CollisionCategories } from './MatterPhysics.js';
import { COMBAT } from '../utils/combat.js';

/**
 * Combat box types
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
 * CombatManagerMatter - Handles combat using Matter.js collisions
 */
export class CombatManagerMatter {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.hitboxes = new Map();  // body.id -> combat data
    this.hurtboxes = new Map(); // body.id -> combat data
    this.timeManager = null;

    // Track hits to prevent multi-hit per attack
    this.hitTracker = new Map(); // hitboxId -> Set of hurtboxOwners hit

    // Hit event callbacks
    this.onHitCallbacks = [];

    // Debug visualization
    this.debugGraphics = null;
    this.debugEnabled = false;

    // Listen for Matter.js collision events
    this.setupCollisionEvents();
  }

  /**
   * Set the time manager for hitstop
   * @param {TimeManager} timeManager
   */
  setTimeManager(timeManager) {
    this.timeManager = timeManager;
  }

  /**
   * Setup Matter.js collision event listeners
   */
  setupCollisionEvents() {
    this.scene.matter.world.on('collisionstart', (event) => {
      for (const pair of event.pairs) {
        this.handleCollision(pair);
      }
    });
  }

  /**
   * Handle collision between two bodies
   * @param {object} pair - Collision pair
   */
  handleCollision(pair) {
    const { bodyA, bodyB } = pair;

    // Check if this is a hitbox-hurtbox collision
    const catA = bodyA.collisionFilter.category;
    const catB = bodyB.collisionFilter.category;

    // Hitbox hitting hurtbox
    if (catA === CollisionCategories.HITBOX && catB === CollisionCategories.HURTBOX) {
      this.processHit(bodyA, bodyB);
    } else if (catB === CollisionCategories.HITBOX && catA === CollisionCategories.HURTBOX) {
      this.processHit(bodyB, bodyA);
    }
  }

  /**
   * Process a hit between hitbox and hurtbox
   * @param {MatterJS.BodyType} hitboxBody
   * @param {MatterJS.BodyType} hurtboxBody
   */
  processHit(hitboxBody, hurtboxBody) {
    const hitbox = this.hitboxes.get(hitboxBody.id);
    const hurtbox = this.hurtboxes.get(hurtboxBody.id);

    if (!hitbox || !hurtbox) return;
    if (!hitbox.active || !hurtbox.active) return;

    // Skip same team
    if (hitbox.team === hurtbox.team) return;

    // Skip same owner
    if (hitbox.owner === hurtbox.owner) return;

    // Check if already hit this target
    const hitSet = this.hitTracker.get(hitboxBody.id);
    if (hitSet && hitSet.has(hurtbox.owner)) return;

    // Mark as hit
    if (!this.hitTracker.has(hitboxBody.id)) {
      this.hitTracker.set(hitboxBody.id, new Set());
    }
    this.hitTracker.get(hitboxBody.id).add(hurtbox.owner);

    // Resolve the hit
    this.resolveHit(hitbox, hurtbox);
  }

  /**
   * Register a hitbox
   * @param {MatterJS.BodyType} body - The Matter.js body
   * @param {object} data - Combat data for this hitbox
   */
  registerHitbox(body, data) {
    this.hitboxes.set(body.id, {
      body,
      owner: data.owner,
      team: data.team || TEAM.PLAYER,
      damage: data.damage || 10,
      knockback: data.knockback || { x: 200, y: -100 },
      hitstun: data.hitstun || 200,
      hitstop: data.hitstop || 50,
      active: false,
    });
  }

  /**
   * Register a hurtbox
   * @param {MatterJS.BodyType} body - The Matter.js body
   * @param {object} data - Combat data for this hurtbox
   */
  registerHurtbox(body, data) {
    this.hurtboxes.set(body.id, {
      body,
      owner: data.owner,
      team: data.team || TEAM.PLAYER,
      active: true,  // Hurtboxes are usually always active
    });
  }

  /**
   * Unregister a hitbox
   * @param {MatterJS.BodyType} body
   */
  unregisterHitbox(body) {
    this.hitboxes.delete(body.id);
    this.hitTracker.delete(body.id);
  }

  /**
   * Unregister a hurtbox
   * @param {MatterJS.BodyType} body
   */
  unregisterHurtbox(body) {
    this.hurtboxes.delete(body.id);
  }

  /**
   * Activate a hitbox
   * @param {MatterJS.BodyType} body
   * @param {object} overrides - Optional property overrides
   */
  activateHitbox(body, overrides = {}) {
    const hitbox = this.hitboxes.get(body.id);
    if (!hitbox) return;

    hitbox.active = true;

    // Apply overrides
    if (overrides.damage !== undefined) hitbox.damage = overrides.damage;
    if (overrides.knockback) hitbox.knockback = overrides.knockback;
    if (overrides.hitstun !== undefined) hitbox.hitstun = overrides.hitstun;
    if (overrides.hitstop !== undefined) hitbox.hitstop = overrides.hitstop;

    // Clear hit tracking for fresh attack
    this.hitTracker.delete(body.id);
  }

  /**
   * Deactivate a hitbox
   * @param {MatterJS.BodyType} body
   */
  deactivateHitbox(body) {
    const hitbox = this.hitboxes.get(body.id);
    if (hitbox) {
      hitbox.active = false;
    }
    this.hitTracker.delete(body.id);
  }

  /**
   * Update hitbox position and properties
   * @param {MatterJS.BodyType} body
   * @param {number} x - World X position
   * @param {number} y - World Y position
   */
  updateHitboxPosition(body, x, y) {
    this.scene.matter.body.setPosition(body, { x, y });
  }

  /**
   * Update hurtbox position
   * @param {MatterJS.BodyType} body
   * @param {number} x
   * @param {number} y
   */
  updateHurtboxPosition(body, x, y) {
    this.scene.matter.body.setPosition(body, { x, y });
  }

  /**
   * Resolve a hit between hitbox and hurtbox
   * @param {object} hitbox - Hitbox combat data
   * @param {object} hurtbox - Hurtbox combat data
   */
  resolveHit(hitbox, hurtbox) {
    // Build hit data
    const hitData = {
      attacker: hitbox.owner,
      defender: hurtbox.owner,
      damage: hitbox.damage,
      knockback: { ...hitbox.knockback },
      hitstun: hitbox.hitstun,
      hitstop: hitbox.hitstop,
    };

    // Determine knockback direction based on attacker facing
    const attackerSprite = hitbox.owner.sprite || hitbox.owner;
    if (attackerSprite.flipX) {
      hitData.knockback.x = -Math.abs(hitData.knockback.x);
    } else {
      hitData.knockback.x = Math.abs(hitData.knockback.x);
    }

    // Apply hitstop
    if (this.timeManager && hitData.hitstop > 0) {
      this.timeManager.applyHitstop(hitData.hitstop);
    }

    // Deal damage to defender
    if (hurtbox.owner.takeDamage) {
      hurtbox.owner.takeDamage(hitData.damage, hitData);
    }

    // Grant ultimate meter to attacker (if player)
    if (hitbox.team === TEAM.PLAYER && hitbox.owner.addUltimateMeter) {
      const meterGain = hitbox.damage >= 20
        ? COMBAT.ULTIMATE.GAIN_PER_HEAVY_HIT
        : COMBAT.ULTIMATE.GAIN_PER_LIGHT_HIT;
      hitbox.owner.addUltimateMeter(meterGain);
    }

    // Apply knockback to defender
    if (hurtbox.owner.body) {
      // Matter.js body - use velocity directly
      this.scene.matter.body.setVelocity(hurtbox.owner.body, {
        x: hitData.knockback.x / 50,  // Scale for Matter.js
        y: hitData.knockback.y / 50,
      });
    } else if (hurtbox.owner.sprite && hurtbox.owner.sprite.body) {
      // Fallback for Arcade-style sprite
      hurtbox.owner.sprite.body.setVelocity(
        hitData.knockback.x,
        hitData.knockback.y
      );
    }

    // Emit hit event
    this.scene.events.emit('combat:hit', hitData);

    // Call registered callbacks
    for (const callback of this.onHitCallbacks) {
      callback(hitData);
    }

    console.log(`Hit! ${hitData.damage} damage to ${hurtbox.team}`);
  }

  /**
   * Add a callback for when hits occur
   * @param {Function} callback - (hitData) => void
   */
  onHit(callback) {
    this.onHitCallbacks.push(callback);
  }

  /**
   * Update - called each frame (for debug rendering)
   * @param {number} time
   * @param {number} delta
   */
  update(time, delta) {
    if (this.debugEnabled) {
      this.renderDebug();
    }
  }

  /**
   * Toggle debug visualization
   * @param {boolean} enabled
   */
  setDebug(enabled) {
    this.debugEnabled = enabled;
    if (enabled && !this.debugGraphics) {
      this.debugGraphics = this.scene.add.graphics();
      this.debugGraphics.setDepth(1000);
    } else if (!enabled && this.debugGraphics) {
      this.debugGraphics.destroy();
      this.debugGraphics = null;
    }
  }

  /**
   * Render debug visualization
   */
  renderDebug() {
    if (!this.debugGraphics) return;

    this.debugGraphics.clear();

    // Draw hitboxes (red)
    for (const hitbox of this.hitboxes.values()) {
      if (!hitbox.active) continue;
      const body = hitbox.body;
      this.debugGraphics.fillStyle(0xff0000, 0.3);
      this.debugGraphics.lineStyle(2, 0xff0000, 0.8);
      this.drawBody(body);
    }

    // Draw hurtboxes (green)
    for (const hurtbox of this.hurtboxes.values()) {
      if (!hurtbox.active) continue;
      const body = hurtbox.body;
      this.debugGraphics.fillStyle(0x00ff00, 0.3);
      this.debugGraphics.lineStyle(2, 0x00ff00, 0.8);
      this.drawBody(body);
    }
  }

  /**
   * Draw a Matter.js body for debug
   * @param {MatterJS.BodyType} body
   */
  drawBody(body) {
    const vertices = body.vertices;
    if (vertices.length < 3) return;

    this.debugGraphics.beginPath();
    this.debugGraphics.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
      this.debugGraphics.lineTo(vertices[i].x, vertices[i].y);
    }
    this.debugGraphics.closePath();
    this.debugGraphics.fillPath();
    this.debugGraphics.strokePath();
  }

  /**
   * Clean up
   */
  destroy() {
    this.hitboxes.clear();
    this.hurtboxes.clear();
    this.hitTracker.clear();
    this.onHitCallbacks = [];
    if (this.debugGraphics) {
      this.debugGraphics.destroy();
    }
  }
}
