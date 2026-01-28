import { BOX_TYPE, TEAM } from './CombatBox.js';

/**
 * CombatManager - Handles all combat collision detection and resolution
 */
export class CombatManager {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.hitboxes = new Set();
    this.hurtboxes = new Set();
    this.timeManager = null; // Set by scene if available

    // Hit event callbacks
    this.onHitCallbacks = [];
  }

  /**
   * Set the time manager for hitstop
   * @param {TimeManager} timeManager
   */
  setTimeManager(timeManager) {
    this.timeManager = timeManager;
  }

  /**
   * Register a combat box
   * @param {CombatBox} box
   */
  register(box) {
    if (box.type === BOX_TYPE.HITBOX) {
      this.hitboxes.add(box);
    } else {
      this.hurtboxes.add(box);
    }
  }

  /**
   * Unregister a combat box
   * @param {CombatBox} box
   */
  unregister(box) {
    this.hitboxes.delete(box);
    this.hurtboxes.delete(box);
  }

  /**
   * Add a callback for when hits occur
   * @param {Function} callback - (hitData) => void
   */
  onHit(callback) {
    this.onHitCallbacks.push(callback);
  }

  /**
   * Update all combat boxes and check for hits
   * @param {number} time
   * @param {number} delta
   */
  update(time, delta) {
    // Update positions of all active boxes
    for (const box of this.hitboxes) {
      if (box.active) box.updatePosition();
    }
    for (const box of this.hurtboxes) {
      if (box.active) box.updatePosition();
    }

    // Check hitbox vs hurtbox collisions
    this.checkCollisions();
  }

  /**
   * Check all hitbox vs hurtbox collisions
   */
  checkCollisions() {
    for (const hitbox of this.hitboxes) {
      if (!hitbox.active) continue;

      for (const hurtbox of this.hurtboxes) {
        if (!hurtbox.active) continue;

        // Skip same team
        if (hitbox.team === hurtbox.team) continue;

        // Skip if same owner
        if (hitbox.owner === hurtbox.owner) continue;

        // Skip if already hit this target
        if (hitbox.hasAlreadyHit(hurtbox.owner)) continue;

        // Check overlap
        if (this.boxesOverlap(hitbox, hurtbox)) {
          this.resolveHit(hitbox, hurtbox);
        }
      }
    }
  }

  /**
   * Check if two boxes overlap
   * @param {CombatBox} boxA
   * @param {CombatBox} boxB
   * @returns {boolean}
   */
  boxesOverlap(boxA, boxB) {
    const a = {
      left: boxA.zone.x - boxA.width / 2,
      right: boxA.zone.x + boxA.width / 2,
      top: boxA.zone.y - boxA.height / 2,
      bottom: boxA.zone.y + boxA.height / 2,
    };

    const b = {
      left: boxB.zone.x - boxB.width / 2,
      right: boxB.zone.x + boxB.width / 2,
      top: boxB.zone.y - boxB.height / 2,
      bottom: boxB.zone.y + boxB.height / 2,
    };

    return a.left < b.right &&
           a.right > b.left &&
           a.top < b.bottom &&
           a.bottom > b.top;
  }

  /**
   * Resolve a hit between hitbox and hurtbox
   * @param {CombatBox} hitbox
   * @param {CombatBox} hurtbox
   */
  resolveHit(hitbox, hurtbox) {
    // Mark as hit to prevent multi-hit
    hitbox.markHit(hurtbox.owner);

    // Build hit data
    const hitData = {
      attacker: hitbox.owner,
      defender: hurtbox.owner,
      damage: hitbox.damage,
      knockback: { ...hitbox.knockback },
      hitstun: hitbox.hitstun,
      hitstop: hitbox.hitstop,
      hitbox,
      hurtbox,
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

    // Apply knockback to defender
    if (hurtbox.owner.sprite && hurtbox.owner.sprite.body) {
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
   * Toggle debug display for all boxes
   * @param {boolean} show
   */
  setDebug(show) {
    for (const box of this.hitboxes) {
      box.setDebug(show);
    }
    for (const box of this.hurtboxes) {
      box.setDebug(show);
    }
  }

  /**
   * Clean up
   */
  destroy() {
    for (const box of this.hitboxes) {
      box.destroy();
    }
    for (const box of this.hurtboxes) {
      box.destroy();
    }
    this.hitboxes.clear();
    this.hurtboxes.clear();
    this.onHitCallbacks = [];
  }
}
