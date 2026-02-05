/**
 * RagdollManager - Manages active ragdoll physics and rendering
 *
 * Owns the lifecycle of ragdolls from enemy death until they settle
 * and become static corpses. This separates ragdoll updates from
 * the enemy update loop, allowing clean enemy cleanup after death.
 *
 * Lifecycle:
 *   Enemy dies → Ragdoll extracted here → Updates/renders each frame
 *   → Ragdoll settles → Transferred to CorpseRenderer/TerrainManager
 *   → Removed from this manager
 */
export class RagdollManager {
  /**
   * @param {Phaser.Scene} scene - The scene this manager belongs to
   */
  constructor(scene) {
    this.scene = scene;

    /**
     * Active ragdolls being simulated
     * @type {Array<{ragdoll: MatterRagdoll, skin: LineSkin, onSettle: Function, enemy: Enemy}>}
     */
    this.activeRagdolls = [];
  }

  /**
   * Add a ragdoll to be managed
   * Called by Enemy.die() to transfer ownership of ragdoll and skin
   *
   * @param {MatterRagdoll} ragdoll - The ragdoll physics object
   * @param {LineSkin} skin - The visual skin for rendering
   * @param {Function} onSettleCallback - Called when ragdoll settles, receives (ragdoll, skin)
   * @param {Enemy} enemy - Reference to the original enemy (for corpse data)
   */
  addRagdoll(ragdoll, skin, onSettleCallback, enemy = null) {
    // Set up the settle callback to go through our handler
    const originalOnSettle = ragdoll.onSettleCallback;
    ragdoll.onSettleCallback = () => {
      this.handleRagdollSettle(ragdoll);
    };

    this.activeRagdolls.push({
      ragdoll,
      skin,
      onSettle: onSettleCallback,
      enemy,
      settled: false,
    });

    console.log(`RagdollManager: Added ragdoll. Active count: ${this.activeRagdolls.length}`);
  }

  /**
   * Update all active ragdolls
   * Called each frame by the scene
   *
   * @param {number} delta - Time since last frame in ms
   */
  update(delta) {
    for (let i = this.activeRagdolls.length - 1; i >= 0; i--) {
      const entry = this.activeRagdolls[i];

      if (entry.settled) {
        // Already settled, waiting for cleanup
        continue;
      }

      // Update ragdoll physics and settle detection
      entry.ragdoll.update(delta);

      // Render skin at physics body positions
      if (entry.skin) {
        const positions = entry.ragdoll.getWorldPositions();
        entry.skin.renderFromPositions(positions);
      }
    }
  }

  /**
   * Handle ragdoll settling
   * Called internally when a ragdoll's settle detection triggers
   *
   * @param {MatterRagdoll} ragdoll - The ragdoll that settled
   */
  handleRagdollSettle(ragdoll) {
    const entry = this.activeRagdolls.find(e => e.ragdoll === ragdoll);
    if (!entry || entry.settled) return;

    console.log('RagdollManager: Ragdoll settled');
    entry.settled = true;

    // Freeze the ragdoll physics
    ragdoll.freeze();

    // Call the settle callback (transfers to corpse systems)
    if (entry.onSettle) {
      entry.onSettle(ragdoll, entry.skin, entry.enemy);
    }

    // Remove from active list
    this.removeRagdoll(ragdoll);
  }

  /**
   * Remove a ragdoll from management
   * Called after settle callback completes
   *
   * @param {MatterRagdoll} ragdoll - The ragdoll to remove
   */
  removeRagdoll(ragdoll) {
    const index = this.activeRagdolls.findIndex(e => e.ragdoll === ragdoll);
    if (index > -1) {
      this.activeRagdolls.splice(index, 1);
      console.log(`RagdollManager: Removed ragdoll. Active count: ${this.activeRagdolls.length}`);
    }
  }

  /**
   * Get count of active ragdolls
   * @returns {number}
   */
  getActiveCount() {
    return this.activeRagdolls.length;
  }

  /**
   * Clean up all ragdolls
   * Called on scene shutdown
   */
  destroy() {
    for (const entry of this.activeRagdolls) {
      if (entry.ragdoll) {
        entry.ragdoll.destroy();
      }
      if (entry.skin) {
        entry.skin.destroy();
      }
    }
    this.activeRagdolls = [];
  }
}
