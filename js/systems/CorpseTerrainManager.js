import { CollisionCategories, CollisionMasks } from './MatterPhysics.js';

/**
 * CorpseTerrainManager - Manages corpse pile terrain using Matter.js polygons
 *
 * When enemies die and their ragdolls settle, this system:
 * 1. Converts frozen ragdoll bodies into static terrain
 * 2. Optionally merges overlapping corpses into combined polygons
 * 3. Manages corpse limit and cleanup
 *
 * The player can walk on the actual shapes of fallen enemies.
 */
export class CorpseTerrainManager {
  constructor(scene) {
    this.scene = scene;

    // Matter.js references
    this.Bodies = Phaser.Physics.Matter.Matter.Bodies;
    this.Body = Phaser.Physics.Matter.Matter.Body;
    this.Vertices = Phaser.Physics.Matter.Matter.Vertices;
    this.Composite = Phaser.Physics.Matter.Matter.Composite;

    // Corpse tracking
    this.corpses = [];              // Array of corpse data
    this.maxCorpses = 30;           // Limit for performance
    this.terrainBodies = new Set(); // All terrain bodies for collision

    // Terrain composite (holds all corpse terrain)
    this.terrainComposite = this.Composite.create({ label: 'corpse_terrain' });
    this.scene.matter.world.add(this.terrainComposite);

    // Collision config for terrain
    this.terrainCollisionConfig = {
      category: CollisionCategories.CORPSE,
      mask: CollisionMasks.CORPSE,
    };

    // Merge settings
    this.enableMerging = true;       // Merge overlapping corpses
    this.mergeDistance = 30;         // Distance threshold for merging

    // Debug graphics
    this.debugGraphics = null;

    // Initialize event listeners
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for corpse events
   */
  setupEventListeners() {
    this.scene.events.on('corpse:ready', this.onCorpseReady, this);
  }

  /**
   * Handle a new corpse being ready
   * @param {object} data - { enemy, ragdoll, bounds, center, silhouette, bodies }
   */
  onCorpseReady(data) {
    const { enemy, ragdoll, bounds, center, silhouette, bodies } = data;

    // Create terrain from ragdoll
    const terrainData = this.createCorpseTerrain(ragdoll, bodies);

    // Store corpse data
    const corpseData = {
      id: `corpse_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      enemy: enemy,
      ragdoll: ragdoll,
      terrainBodies: terrainData.bodies,
      bounds: bounds,
      center: center,
      createdAt: Date.now(),
    };

    this.corpses.push(corpseData);

    // Check for merging with nearby corpses
    if (this.enableMerging) {
      this.checkAndMergeCorpses(corpseData);
    }

    // Enforce corpse limit
    this.enforceCorpseLimit();

    // Emit event
    this.scene.events.emit('corpse:terrain:added', corpseData);

    console.log(`Corpse terrain added. Total: ${this.corpses.length}`);
  }

  /**
   * Create terrain bodies from a frozen ragdoll
   * Uses the ragdoll's actual body shapes as terrain
   */
  createCorpseTerrain(ragdoll, ragdollBodies) {
    const terrainBodies = [];

    // Get all non-sensor bodies from ragdoll
    const sourceBodies = ragdollBodies || ragdoll.getBodies();

    for (const sourceBody of sourceBodies) {
      if (sourceBody.isSensor) continue;

      // Create static copy of the body's shape
      const vertices = sourceBody.vertices.map(v => ({ x: v.x, y: v.y }));

      // Create terrain body from vertices
      const terrainBody = this.Bodies.fromVertices(
        sourceBody.position.x,
        sourceBody.position.y,
        [vertices],
        {
          isStatic: true,
          friction: 0.8,
          label: `terrain_${sourceBody.label}`,
          collisionFilter: this.terrainCollisionConfig,
          // Preserve rotation
          angle: sourceBody.angle,
        }
      );

      if (terrainBody) {
        // Prevent Phaser from trying to emit events on this raw body
        terrainBody.gameObject = null;

        // Add to composite
        this.Composite.add(this.terrainComposite, terrainBody);
        this.terrainBodies.add(terrainBody);
        terrainBodies.push(terrainBody);
      }
    }

    return { bodies: terrainBodies };
  }

  /**
   * Check if a new corpse should merge with existing ones
   */
  checkAndMergeCorpses(newCorpse) {
    const nearbyCorpses = this.findNearbyCorpses(newCorpse.center, this.mergeDistance);

    if (nearbyCorpses.length === 0) return;

    // For now, we keep corpses separate but could implement hull merging here
    // Full polygon merging is complex (boolean operations on polygons)
    // The current approach of using individual bone bodies works well enough

    // Future enhancement: Use a library like clipper.js for polygon boolean ops
    // to merge overlapping corpse silhouettes into single terrain pieces
  }

  /**
   * Find corpses near a point
   */
  findNearbyCorpses(point, radius) {
    return this.corpses.filter(c => {
      if (!c.center) return false;
      const dx = c.center.x - point.x;
      const dy = c.center.y - point.y;
      return Math.sqrt(dx * dx + dy * dy) <= radius;
    });
  }

  /**
   * Remove oldest corpses if over limit
   */
  enforceCorpseLimit() {
    while (this.corpses.length > this.maxCorpses) {
      const oldest = this.corpses.shift();
      this.removeCorpse(oldest);
    }
  }

  /**
   * Remove a corpse and its terrain
   */
  removeCorpse(corpseData) {
    // Remove terrain bodies
    if (corpseData.terrainBodies) {
      for (const body of corpseData.terrainBodies) {
        this.Composite.remove(this.terrainComposite, body);
        this.terrainBodies.delete(body);
      }
      corpseData.terrainBodies = [];
    }

    // Destroy ragdoll
    if (corpseData.ragdoll) {
      corpseData.ragdoll.destroy();
    }

    // Destroy enemy
    if (corpseData.enemy && corpseData.enemy.destroy) {
      corpseData.enemy.destroy();
    }

    // Remove from array
    const index = this.corpses.indexOf(corpseData);
    if (index > -1) {
      this.corpses.splice(index, 1);
    }
  }

  /**
   * Get corpse count
   */
  getCorpseCount() {
    return this.corpses.length;
  }

  /**
   * Get total terrain body count
   */
  getTerrainBodyCount() {
    return this.terrainBodies.size;
  }

  /**
   * Get corpses in a region
   */
  getCorpsesInRegion(x, y, radius) {
    return this.findNearbyCorpses({ x, y }, radius);
  }

  /**
   * Get pile height at a position (for gameplay queries)
   */
  getPileHeightAt(x) {
    const groundY = this.scene.game.config.height - 50; // Assume ground near bottom
    let highestPoint = groundY;

    for (const corpse of this.corpses) {
      if (!corpse.bounds) continue;

      // Check if x is within corpse bounds
      if (x >= corpse.bounds.x && x <= corpse.bounds.x + corpse.bounds.width) {
        highestPoint = Math.min(highestPoint, corpse.bounds.y);
      }
    }

    return groundY - highestPoint;
  }

  /**
   * Clear all corpses
   */
  clearAllCorpses() {
    while (this.corpses.length > 0) {
      this.removeCorpse(this.corpses[0]);
    }
  }

  /**
   * Debug: Highlight terrain bodies
   */
  debugHighlightTerrain(color = 0xff0000, alpha = 0.3) {
    if (this.debugGraphics) {
      this.debugGraphics.destroy();
    }

    this.debugGraphics = this.scene.add.graphics();
    this.debugGraphics.setDepth(1000);

    for (const body of this.terrainBodies) {
      this.debugGraphics.lineStyle(2, color, 1);
      this.debugGraphics.fillStyle(color, alpha);

      this.debugGraphics.beginPath();
      const vertices = body.vertices;
      this.debugGraphics.moveTo(vertices[0].x, vertices[0].y);
      for (let i = 1; i < vertices.length; i++) {
        this.debugGraphics.lineTo(vertices[i].x, vertices[i].y);
      }
      this.debugGraphics.closePath();
      this.debugGraphics.fillPath();
      this.debugGraphics.strokePath();
    }
  }

  /**
   * Clear debug graphics
   */
  clearDebugGraphics() {
    if (this.debugGraphics) {
      this.debugGraphics.destroy();
      this.debugGraphics = null;
    }
  }

  /**
   * Update (call each frame if needed)
   */
  update(time, delta) {
    // Could add effects, decay, etc.
  }

  /**
   * Clean up
   */
  destroy() {
    this.scene.events.off('corpse:ready', this.onCorpseReady, this);
    this.clearAllCorpses();
    this.clearDebugGraphics();

    if (this.terrainComposite) {
      this.scene.matter.world.remove(this.terrainComposite);
    }
  }
}
