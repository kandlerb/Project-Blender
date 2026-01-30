import { Corpse, CORPSE_DEFAULTS, CORPSE_STATE } from '../entities/Corpse.js';
import { CorpseGrid } from './CorpseGrid.js';
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
  MAX_CORPSES: 50,
  CLEANUP_MODE: CLEANUP_MODE.OLDEST,
  DECAY_ENABLED: false,
  DECAY_TIME: 30000,
});

/**
 * CorpseManager - Manages all corpses in a scene
 * Uses CorpseGrid for staggered grid-based settling
 * Handles spawning, tracking, cleanup, and collision grouping
 */
export class CorpseManager {
  /**
   * @param {Phaser.Scene} scene - The scene this manager belongs to
   * @param {object} config - Manager configuration
   * @param {Phaser.Physics.Arcade.StaticGroup} [config.platformLayer] - Platform layer for grid ground detection
   * @param {number} [config.maxCorpses=50] - Maximum corpses allowed
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
    // Only used for corpse-to-platform collision while falling
    this.corpseGroup = scene.physics.add.group({
      collideWorldBounds: true,
      allowGravity: true,
    });

    // Terrain references for corpse-to-platform collision
    this.terrainGroups = [];

    // Create the grid for settling positions
    // platformLayer is used for ground detection
    this.grid = new CorpseGrid(scene, config.platformLayer || null);

    // Reference position for farthest cleanup (usually player position)
    this.referenceX = 0;
    this.referenceY = 0;

    // Debug visualization state
    this.debugEnabled = false;
    this.debugGraphics = null;
  }

  /**
   * Set terrain groups that corpses should collide with while falling
   * @param  {...Phaser.Physics.Arcade.StaticGroup} groups - Terrain static groups
   */
  setTerrain(...groups) {
    this.terrainGroups = groups.filter((g) => g != null);

    // Update grid's platform reference if not already set
    if (!this.grid.platformLayer && groups.length > 0) {
      this.grid.platformLayer = groups[0];
    }
  }

  /**
   * Enforce the corpse limit by removing excess corpses
   * Prioritizes removing settled corpses (less disruptive)
   */
  enforceCorpseLimit() {
    while (this.corpses.length >= this.config.maxCorpses) {
      if (this.config.cleanupMode === CLEANUP_MODE.NONE) {
        // Can't remove any, bail out
        return;
      }

      // Emit limit reached event
      this.scene.events.emit('corpse:limitReached', {
        count: this.corpses.length,
        max: this.config.maxCorpses,
        cleanupMode: this.config.cleanupMode,
      });

      // Remove based on cleanup mode
      if (this.config.cleanupMode === CLEANUP_MODE.OLDEST) {
        this.removeOldest();
      } else if (this.config.cleanupMode === CLEANUP_MODE.FARTHEST) {
        this.removeFarthest(this.referenceX, this.referenceY);
      }
    }
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
    // Enforce limit BEFORE spawning
    this.enforceCorpseLimit();

    // Check if still at limit after cleanup (NONE mode)
    if (this.corpses.length >= this.config.maxCorpses) {
      return null;
    }

    // Merge manager defaults with additional config
    const corpseConfig = {
      enemyType,
      decay: this.config.decayEnabled,
      decayTime: this.config.decayTime,
      grid: this.grid, // Pass grid for settling positions
      ...additionalConfig,
    };

    // Create the corpse
    const corpse = new Corpse(this.scene, x, y, corpseConfig);

    // Add to tracking array
    this.corpses.push(corpse);

    // Add sprite to group for platform collisions while falling
    this.corpseGroup.add(corpse.sprite);

    // Re-apply physics settings that group membership may have overwritten
    // World gravity is 0, so we must set per-body gravity
    corpse.sprite.body.setImmovable(false);
    corpse.sprite.body.setMass(CORPSE_DEFAULTS.MASS);
    corpse.sprite.body.setAllowGravity(true);
    corpse.sprite.body.setGravityY(PHYSICS.GRAVITY);
    corpse.sprite.body.setBounce(CORPSE_DEFAULTS.BOUNCE);
    corpse.sprite.body.setDrag(CORPSE_DEFAULTS.DRAG_X, 0);
    corpse.sprite.body.setMaxVelocityY(PHYSICS.TERMINAL_VELOCITY);

    // Set up individual terrain colliders for this corpse
    for (const terrain of this.terrainGroups) {
      corpse.addCollider(terrain);
    }

    // Apply debug visualization if enabled
    if (this.debugEnabled) {
      corpse.sprite.setTint(0xff8800); // Orange = falling
    }

    // Spawn effect - brief flash and particles if EffectsManager available
    this.createSpawnEffect(x, y);

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
   * Create a visual spawn effect at the given position
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  createSpawnEffect(x, y) {
    // Use EffectsManager if available
    if (this.scene.effectsManager) {
      // Small dust cloud effect
      this.scene.effectsManager.dustCloud(x, y, 3, 0);
    } else {
      // Fallback: simple particle burst using scene directly
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + Math.random() * 0.5;
        const speed = 30 + Math.random() * 20;
        const particle = this.scene.add.circle(x, y, 3, 0x666666, 0.6);

        // Simple tween animation
        this.scene.tweens.add({
          targets: particle,
          x: x + Math.cos(angle) * speed,
          y: y + Math.sin(angle) * speed - 10, // Slight upward drift
          alpha: 0,
          scale: 0.5,
          duration: 300,
          ease: 'Power2',
          onComplete: () => particle.destroy(),
        });
      }
    }
  }

  /**
   * Remove a specific corpse from tracking and destroy it
   * Clears the grid cell if the corpse was settled
   * @param {Corpse} corpse - The corpse to remove
   */
  remove(corpse) {
    if (!corpse) return;

    const index = this.corpses.indexOf(corpse);
    if (index === -1) return;

    // Remove from tracking array
    this.corpses.splice(index, 1);

    // Clear grid cell if it was claimed
    if (corpse.gridCell) {
      this.grid.clearCell(corpse.gridCell.col, corpse.gridCell.row);
    }

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
   * Remove the oldest corpse, prioritizing settled corpses first
   * This is less disruptive as settled corpses are no longer moving
   * @returns {Corpse|null} The removed corpse, or null if none exist
   */
  removeOldest() {
    if (this.corpses.length === 0) return null;

    // First, try to find the oldest SETTLED corpse (least disruptive)
    for (const corpse of this.corpses) {
      if (corpse.state === CORPSE_STATE.SETTLED) {
        this.remove(corpse);
        return corpse;
      }
    }

    // If all corpses are unsettled, remove the oldest one anyway
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

    // Also clear the grid
    this.grid.clearAll();
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
   * @returns {Phaser.Physics.Arcade.Group} The corpse collision group
   */
  getGroup() {
    return this.corpseGroup;
  }

  /**
   * Get the grid instance
   * @returns {CorpseGrid} The grid
   */
  getGrid() {
    return this.grid;
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
        // Clear grid cell if it was claimed
        if (corpse.gridCell) {
          this.grid.clearCell(corpse.gridCell.col, corpse.gridCell.row);
        }
        this.corpses.splice(i, 1);
      }
    }

    // Update only non-settled corpses
    // Settled corpses skip their update internally, but we can skip the call entirely
    for (const corpse of this.corpses) {
      if (corpse.state !== CORPSE_STATE.SETTLED) {
        if (corpse.sprite && corpse.sprite.active) {
          corpse.update(time, delta);
        }
      }
    }

    // Update debug visualization if enabled
    if (this.debugEnabled) {
      this.updateDebugVisualization();
    }

    // Draw grid debug (only if grid debug is enabled)
    if (this.grid.debugEnabled) {
      this.drawDebug();
    }
  }

  /**
   * Update debug visualization for corpses
   */
  updateDebugVisualization() {
    for (const corpse of this.corpses) {
      if (!corpse.sprite || !corpse.sprite.active) continue;

      // Color based on state
      switch (corpse.state) {
        case CORPSE_STATE.FALLING:
          corpse.sprite.setTint(0xff8800); // Orange = falling
          break;
        case CORPSE_STATE.SNAPPING:
          corpse.sprite.setTint(0xffff00); // Yellow = snapping
          break;
        case CORPSE_STATE.SETTLED:
          corpse.sprite.setTint(0x00ff00); // Green = settled
          break;
      }
    }
  }

  /**
   * Toggle debug visualization
   * @param {boolean} show - Whether to show debug visualization
   */
  setDebug(show) {
    this.debugEnabled = show;

    if (show) {
      // Create debug graphics if needed
      if (!this.debugGraphics) {
        this.debugGraphics = this.scene.add.graphics();
        this.debugGraphics.setDepth(1000);
      }
    } else {
      // Destroy debug graphics
      if (this.debugGraphics) {
        this.debugGraphics.destroy();
        this.debugGraphics = null;
      }

      // Restore normal tints
      for (const corpse of this.corpses) {
        if (!corpse.sprite || !corpse.sprite.active) continue;
        if (corpse.state === CORPSE_STATE.SETTLED) {
          corpse.sprite.setTint(0x333333); // Settled tint
        } else {
          corpse.sprite.setTint(corpse.config.tint || CORPSE_DEFAULTS.TINT);
        }
      }
    }
  }

  /**
   * Toggle grid debug visualization
   * @returns {boolean} New debug state
   */
  toggleGridDebug() {
    const newState = !this.grid.debugEnabled;
    this.grid.setDebug(newState);

    // Also enable corpse state debug when grid debug is on
    this.setDebug(newState);

    return newState;
  }

  /**
   * Draw debug visualization for the grid and snapping corpses
   * Call this from scene's update if debug is enabled
   */
  drawDebug() {
    // Draw grid debug
    this.grid.drawDebug();

    // Draw snap indicators for snapping corpses
    if (this.grid.debugEnabled && this.grid.debugGraphics) {
      for (const corpse of this.corpses) {
        if (corpse.state === CORPSE_STATE.SNAPPING && corpse.snapData) {
          const elapsed = this.scene.time.now - corpse.snapData.startTime;
          const progress = Math.min(elapsed / corpse.snapData.duration, 1);

          this.grid.drawSnapIndicator(
            this.grid.debugGraphics,
            corpse.sprite.x,
            corpse.sprite.y,
            corpse.snapData.targetX,
            corpse.snapData.targetY,
            progress
          );
        }
      }
    }
  }

  /**
   * Get statistics about corpse states
   * @returns {object} Stats object with counts
   */
  getStats() {
    let falling = 0;
    let snapping = 0;
    let settled = 0;

    for (const corpse of this.corpses) {
      switch (corpse.state) {
        case CORPSE_STATE.FALLING:
          falling++;
          break;
        case CORPSE_STATE.SNAPPING:
          snapping++;
          break;
        case CORPSE_STATE.SETTLED:
          settled++;
          break;
      }
    }

    return {
      total: this.corpses.length,
      falling,
      snapping,
      settled,
      max: this.config.maxCorpses,
      gridOccupied: this.grid.getOccupiedCount(),
    };
  }

  /**
   * Clean up the manager and all corpses
   */
  destroy() {
    this.clear();

    if (this.debugGraphics) {
      this.debugGraphics.destroy();
      this.debugGraphics = null;
    }

    this.corpseGroup.destroy(true);
    this.grid.destroy();
    this.corpses = [];
  }
}
