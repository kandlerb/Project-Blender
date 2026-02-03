/**
 * MatterWorldManager - Handles safe addition/removal of Matter.js bodies
 *
 * Matter.js crashes if bodies are added or removed during collision iteration.
 * This manager queues modifications and applies them after the physics update.
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
   * Execute a removal operation
   */
  executeRemove(item) {
    try {
      if (item && this.matter?.world) {
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
   * @param {MatterJS.BodyType|MatterJS.Composite} item - Body or composite to remove
   */
  safeRemove(item) {
    if (!item) return;

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
