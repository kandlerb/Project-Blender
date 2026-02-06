/**
 * MatterWorldManager - Handles safe addition/removal of Matter.js bodies
 *
 * Matter.js crashes if bodies are added or removed during collision iteration.
 * This manager queues modifications and applies them after the physics update.
 *
 * Additionally, it clears stale collision pairs before removing bodies to prevent
 * "Cannot read properties of undefined (reading 'index')" errors in _findSupports.
 */
export class MatterWorldManager {
  constructor(scene) {
    this.scene = scene;
    this.matter = scene.matter;

    // Queues for deferred operations
    this.addQueue = [];
    this.removeQueue = [];

    // Track if we're currently in a physics update
    this.isUpdating = false;

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Set up Matter.js event listeners to track update cycle
   */
  setupEventListeners() {
    // Track when physics update starts
    this.matter.world.on('beforeupdate', () => {
      this.isUpdating = true;
    });

    // Process queues after physics update completes
    this.matter.world.on('afterupdate', () => {
      this.isUpdating = false;
      this.processQueues();
    });
  }

  /**
   * Process all queued additions and removals
   */
  processQueues() {
    // Process removals first (in case something is being replaced)
    while (this.removeQueue.length > 0) {
      const item = this.removeQueue.shift();
      this.executeRemove(item);
    }

    // Then process additions
    while (this.addQueue.length > 0) {
      const item = this.addQueue.shift();
      this.executeAdd(item);
    }
  }

  /**
   * Clear all collision pairs involving a specific body
   * This prevents stale pair data from causing errors in the next physics step
   * @param {MatterJS.BodyType} body - The body to clear pairs for
   */
  clearPairsForBody(body) {
    if (!body) return;

    const engine = this.matter.world.engine;
    if (!engine || !engine.pairs) return;

    const pairs = engine.pairs;
    const pairsToRemove = [];

    // Find all pairs involving this body
    if (pairs.table) {
      for (const id in pairs.table) {
        const pair = pairs.table[id];
        if (pair && (pair.bodyA === body || pair.bodyB === body)) {
          pairsToRemove.push(id);
        }
      }
    }

    // Remove the pairs from both table and list
    for (const id of pairsToRemove) {
      const pair = pairs.table[id];
      if (pair) {
        // Remove from list
        if (pairs.list) {
          const listIndex = pairs.list.indexOf(pair);
          if (listIndex !== -1) {
            pairs.list.splice(listIndex, 1);
          }
        }
        // Remove from table
        delete pairs.table[id];
      }
    }

    // Also clear from collisionActive pairs if they exist
    if (pairs.collisionActive) {
      for (let i = pairs.collisionActive.length - 1; i >= 0; i--) {
        const pair = pairs.collisionActive[i];
        if (pair && (pair.bodyA === body || pair.bodyB === body)) {
          pairs.collisionActive.splice(i, 1);
        }
      }
    }
  }

  /**
   * Clear collision pairs for all bodies in a composite
   * @param {MatterJS.Composite} composite - The composite to clear pairs for
   */
  clearPairsForComposite(composite) {
    if (!composite) return;

    // Get all bodies in the composite recursively
    const Matter = Phaser.Physics.Matter.Matter;
    const allBodies = Matter.Composite.allBodies(composite);

    for (const body of allBodies) {
      this.clearPairsForBody(body);
    }
  }

  /**
   * Execute a removal operation
   * @param {MatterJS.BodyType|MatterJS.Composite} item - Body or composite to remove
   */
  executeRemove(item) {
    try {
      if (item && this.matter?.world) {
        // Check if item is a composite or body
        if (item.type === 'composite') {
          // Clear pairs for all bodies in composite BEFORE removing
          this.clearPairsForComposite(item);
        } else {
          // Clear pairs for single body BEFORE removing
          this.clearPairsForBody(item);
        }

        // Now remove from world
        this.matter.world.remove(item);
      }
    } catch (e) {
      // Body may already be removed, ignore
    }
  }

  /**
   * Execute an addition operation
   */
  executeAdd(item) {
    try {
      if (item && this.matter?.world) {
        this.matter.world.add(item.body || item);

        // Call callback if provided
        if (item.callback) {
          item.callback();
        }
      }
    } catch (e) {
      console.error('MatterWorldManager: Add failed:', e);
    }
  }

  /**
   * Safely add a body or composite to the world
   * If called during physics update, defers until after update completes
   * @param {MatterJS.BodyType|MatterJS.Composite} body - Body or composite to add
   * @param {Function} [onAdd] - Optional callback after item is added
   */
  safeAdd(body, onAdd = null) {
    if (!body) return;

    const item = onAdd ? { body, callback: onAdd } : body;

    if (this.isUpdating) {
      // Queue for later
      this.addQueue.push(item);
    } else {
      // Safe to add immediately
      this.executeAdd(item);
    }
  }

  /**
   * Safely remove a body or composite from the world
   * If called during physics update, defers until after update completes
   * Immediately disables collision filter to prevent new pairs being created
   * @param {MatterJS.BodyType|MatterJS.Composite} item - Body or composite to remove
   */
  safeRemove(item) {
    if (!item) return;

    // Immediately disable collisions to prevent new pairs being created
    // This is critical - even if removal is deferred, we don't want new collisions
    if (item.type === 'composite') {
      // Disable collisions for all bodies in composite
      const Matter = Phaser.Physics.Matter.Matter;
      const allBodies = Matter.Composite.allBodies(item);
      for (const body of allBodies) {
        if (body.collisionFilter) {
          body.collisionFilter.mask = 0;
          body.collisionFilter.category = 0;
        }
      }
    } else if (item.collisionFilter) {
      // Single body
      item.collisionFilter.mask = 0;
      item.collisionFilter.category = 0;
    }

    if (this.isUpdating) {
      // Queue for later
      this.removeQueue.push(item);
    } else {
      // Safe to remove immediately
      this.executeRemove(item);
    }
  }

  /**
   * Safely remove multiple items
   * @param {Array} items - Array of bodies/composites to remove
   */
  safeRemoveAll(items) {
    if (!items) return;
    for (const item of items) {
      this.safeRemove(item);
    }
  }

  /**
   * Check if currently in physics update (for debugging)
   */
  isDuringUpdate() {
    return this.isUpdating;
  }

  /**
   * Get pending operation counts (for debugging)
   */
  getPendingCounts() {
    return {
      adds: this.addQueue.length,
      removes: this.removeQueue.length,
    };
  }

  /**
   * Clean up
   */
  destroy() {
    this.addQueue = [];
    this.removeQueue = [];
    // Event listeners are cleaned up when world is destroyed
  }
}
