import { Corpse, CORPSE_DEFAULTS } from '../entities/Corpse.js';
import { PHYSICS } from '../utils/physics.js';

/**
 * Cleanup mode options for when corpse limit is reached
 */
export const CLEANUP_MODE = Object.freeze({
  OLDEST: 'oldest',
  FARTHEST: 'farthest',
  NONE: 'none',
});

/**
 * Default configuration for CorpseManager
 */
export const CORPSE_MANAGER_DEFAULTS = Object.freeze({
  MAX_CORPSES: 30,
  CLEANUP_MODE: CLEANUP_MODE.OLDEST,
  DECAY_ENABLED: false,
  DECAY_TIME: 30000,
});

/**
 * CorpseManager - Manages all corpses in a scene
 * Handles spawning, tracking, cleanup, and collision grouping
 */
export class CorpseManager {
  /**
   * @param {Phaser.Scene} scene - The scene this manager belongs to
   * @param {object} config - Manager configuration
   * @param {number} [config.maxCorpses=30] - Maximum corpses allowed
   * @param {string} [config.cleanupMode='oldest'] - How to remove corpses at limit ('oldest' | 'farthest' | 'none')
   * @param {boolean} [config.decayEnabled=false] - Whether corpses auto-decay
   * @param {number} [config.decayTime=30000] - Milliseconds before decay if enabled
   */
  constructor(scene, config = {}) {
    this.scene = scene;

    // Store config with defaults
    this.config = {
      maxCorpses: config.maxCorpses ?? CORPSE_MANAGER_DEFAULTS.MAX_CORPSES,
      cleanupMode: config.cleanupMode ?? CORPSE_MANAGER_DEFAULTS.CLEANUP_MODE,
      decayEnabled: config.decayEnabled ?? CORPSE_MANAGER_DEFAULTS.DECAY_ENABLED,
      decayTime: config.decayTime ?? CORPSE_MANAGER_DEFAULTS.DECAY_TIME,
    };

    // Track all active corpses
    this.corpses = [];

    // Create dynamic group for collision handling
    // Dynamic group allows gravity and corpse-corpse collision
    this.corpseGroup = scene.physics.add.group({
      collideWorldBounds: true,
      allowGravity: true,
    });

    // Reference position for farthest cleanup (usually player position)
    this.referenceX = 0;
    this.referenceY = 0;

    // Terrain references for individual corpse colliders
    this.terrainGroups = [];
  }

  /**
   * Set terrain groups that corpses should collide with
   * @param  {...Phaser.Physics.Arcade.StaticGroup} groups - Terrain static groups
   */
  setTerrain(...groups) {
    this.terrainGroups = groups.filter((g) => g != null);
  }

  /**
   * Spawn a new corpse at the given position
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} enemyType - The type of enemy this corpse represents
   * @param {object} additionalConfig - Additional configuration to merge
   * @returns {Corpse} The newly created corpse
   */
  spawn(x, y, enemyType, additionalConfig = {}) {
    // Check if at max capacity
    if (this.corpses.length >= this.config.maxCorpses) {
      if (this.config.cleanupMode === CLEANUP_MODE.NONE) {
        // Don't spawn if at limit with no cleanup
        return null;
      }

      // Emit limit reached event
      this.scene.events.emit('corpse:limitReached', {
        count: this.corpses.length,
        max: this.config.maxCorpses,
        cleanupMode: this.config.cleanupMode,
      });

      // Remove corpse based on cleanup mode
      if (this.config.cleanupMode === CLEANUP_MODE.OLDEST) {
        this.removeOldest();
      } else if (this.config.cleanupMode === CLEANUP_MODE.FARTHEST) {
        this.removeFarthest(this.referenceX, this.referenceY);
      }
    }

    // Merge manager defaults with additional config
    const corpseConfig = {
      enemyType,
      decay: this.config.decayEnabled,
      decayTime: this.config.decayTime,
      ...additionalConfig,
    };

    // Create the corpse
    const corpse = new Corpse(this.scene, x, y, corpseConfig);

    // Add to tracking array
    this.corpses.push(corpse);

    // Add sprite to group for collisions
    this.corpseGroup.add(corpse.sprite);

    // Re-apply physics settings that group membership may have overwritten
    // World gravity is 0, so we must set per-body gravity
    // Corpses are movable with high mass for natural stacking
    corpse.sprite.body.setImmovable(false);
    corpse.sprite.body.setMass(CORPSE_DEFAULTS.MASS);
    corpse.sprite.body.setAllowGravity(true);
    corpse.sprite.body.setGravityY(PHYSICS.GRAVITY);
    corpse.sprite.body.setBounce(0);
    corpse.sprite.body.setDrag(CORPSE_DEFAULTS.DRAG_X, CORPSE_DEFAULTS.DRAG_Y);
    corpse.sprite.body.setMaxVelocity(200, 800);

    // Set up individual terrain colliders for this corpse
    // Group-level colliders don't reliably apply to sprites with pre-existing physics bodies
    for (const terrain of this.terrainGroups) {
      corpse.addCollider(terrain);
    }

    // Emit spawned event
    this.scene.events.emit('corpse:spawned', {
      corpse,
      x,
      y,
      enemyType,
      count: this.corpses.length,
    });

    return corpse;
  }

  /**
   * Remove a specific corpse from tracking and destroy it
   * @param {Corpse} corpse - The corpse to remove
   */
  remove(corpse) {
    if (!corpse) return;

    const index = this.corpses.indexOf(corpse);
    if (index === -1) return;

    // Remove from tracking array
    this.corpses.splice(index, 1);

    // Remove from physics group
    if (corpse.sprite && corpse.sprite.active) {
      this.corpseGroup.remove(corpse.sprite, true, true);
    }

    // Emit removed event before destroying
    this.scene.events.emit('corpse:removed', {
      corpse,
      remainingCount: this.corpses.length,
    });

    // Destroy the corpse
    corpse.destroy();
  }

  /**
   * Remove the oldest corpse (first in array)
   * @returns {Corpse|null} The removed corpse, or null if none exist
   */
  removeOldest() {
    if (this.corpses.length === 0) return null;

    const oldest = this.corpses[0];
    this.remove(oldest);
    return oldest;
  }

  /**
   * Remove the corpse farthest from the given position
   * @param {number} fromX - Reference X position
   * @param {number} fromY - Reference Y position
   * @returns {Corpse|null} The removed corpse, or null if none exist
   */
  removeFarthest(fromX, fromY) {
    if (this.corpses.length === 0) return null;

    let farthestCorpse = null;
    let maxDistance = -1;

    for (const corpse of this.corpses) {
      if (!corpse.sprite || !corpse.sprite.active) continue;

      const dx = corpse.sprite.x - fromX;
      const dy = corpse.sprite.y - fromY;
      const distance = dx * dx + dy * dy; // Skip sqrt for performance

      if (distance > maxDistance) {
        maxDistance = distance;
        farthestCorpse = corpse;
      }
    }

    if (farthestCorpse) {
      this.remove(farthestCorpse);
    }

    return farthestCorpse;
  }

  /**
   * Remove all corpses
   */
  clear() {
    // Remove all corpses in reverse order to avoid index issues
    while (this.corpses.length > 0) {
      this.remove(this.corpses[this.corpses.length - 1]);
    }
  }

  /**
   * Get the current number of active corpses
   * @returns {number} The corpse count
   */
  getCount() {
    return this.corpses.length;
  }

  /**
   * Get a copy of all active corpses
   * @returns {Corpse[]} Array copy of all corpses
   */
  getCorpses() {
    return [...this.corpses];
  }

  /**
   * Set the reference position for farthest cleanup calculations
   * Typically called with player position each frame
   * @param {number} x - Reference X position
   * @param {number} y - Reference Y position
   */
  setReferencePosition(x, y) {
    this.referenceX = x;
    this.referenceY = y;
  }

  /**
   * Get the physics group for collision setup
   * @returns {Phaser.Physics.Arcade.StaticGroup} The corpse collision group
   */
  getGroup() {
    return this.corpseGroup;
  }

  /**
   * Update method called each frame
   * @param {number} time - Current game time
   * @param {number} delta - Time since last frame in ms
   */
  update(time, delta) {
    // Clean up any corpses that have been destroyed externally
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const corpse = this.corpses[i];
      if (!corpse.sprite || !corpse.sprite.active) {
        this.corpses.splice(i, 1);
      }
    }

    // Fix any corpses that have clipped into terrain
    this.fixTerrainClipping();
  }

  /**
   * Check for and fix corpses that have clipped into terrain
   * Pushes embedded corpses up along with any corpses stacked above them
   */
  fixTerrainClipping() {
    if (this.terrainGroups.length === 0) return;

    // Sort corpses by Y position (bottom to top) so we fix lower ones first
    const sortedCorpses = [...this.corpses].sort((a, b) => {
      if (!a.sprite?.body || !b.sprite?.body) return 0;
      return b.sprite.body.bottom - a.sprite.body.bottom;
    });

    for (const corpse of sortedCorpses) {
      if (!corpse.sprite?.body || !corpse.sprite.active) continue;

      const body = corpse.sprite.body;

      // Skip corpses that are settled (not moving significantly)
      const isSettled =
        Math.abs(body.velocity.x) < 5 && Math.abs(body.velocity.y) < 5;
      if (isSettled) continue;

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

          // Check if corpse bottom is below terrain top (embedded)
          if (body.bottom > terrainBody.top && body.top < terrainBody.bottom) {
            // Calculate how much the corpse is embedded
            const overlap = body.bottom - terrainBody.top;
            if (overlap > maxOverlap) {
              maxOverlap = overlap;
            }
          }
        }
      }

      // If embedded, push corpse up and any corpses stacked above it
      if (maxOverlap > 0) {
        this.pushCorpseUp(corpse, maxOverlap); // Exact correction, no overshoot
      }
    }
  }

  /**
   * Push a corpse up by a given amount, along with any corpses stacked on top
   * @param {Corpse} corpse - The corpse to push up
   * @param {number} amount - Pixels to move up
   */
  pushCorpseUp(corpse, amount) {
    if (!corpse.sprite?.body) return;

    const body = corpse.sprite.body;
    // Calculate old top position before moving (bottom - height = top)
    const oldTop = body.bottom - body.height;

    // Move the corpse up
    corpse.sprite.y -= amount;
    body.reset(corpse.sprite.x, corpse.sprite.y);

    // Stop downward velocity to prevent re-embedding
    if (body.velocity.y > 0) {
      body.setVelocityY(0);
    }

    // Find and push up any corpses that were resting on this one
    for (const otherCorpse of this.corpses) {
      if (otherCorpse === corpse) continue;
      if (!otherCorpse.sprite?.body || !otherCorpse.sprite.active) continue;

      const otherBody = otherCorpse.sprite.body;

      // Check if other corpse was resting on this one (their bottom near our old top)
      const wasOnTop =
        Math.abs(otherBody.bottom - oldTop) < 5 &&
        otherBody.right > body.left &&
        otherBody.left < body.right;

      if (wasOnTop) {
        this.pushCorpseUp(otherCorpse, amount);
      }
    }
  }

  /**
   * Clean up the manager and all corpses
   */
  destroy() {
    this.clear();
    this.corpseGroup.destroy(true);
    this.corpses = [];
  }
}
