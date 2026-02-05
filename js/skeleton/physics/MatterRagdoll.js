import { CollisionCategories, CollisionMasks } from '../../systems/MatterPhysics.js';

/**
 * MatterRagdoll - Physics-driven skeleton using Matter.js constraints
 *
 * Converts an animated skeleton into Matter.js bodies connected by
 * real joint constraints. Used for death animations and corpse piling.
 */
export class MatterRagdoll {
  constructor(scene, skeletonInstance) {
    this.scene = scene;
    this.skeleton = skeletonInstance.skeleton;
    this.skeletonInstance = skeletonInstance;

    // Matter.js references
    this.Bodies = Phaser.Physics.Matter.Matter.Bodies;
    this.Body = Phaser.Physics.Matter.Matter.Body;
    this.Constraint = Phaser.Physics.Matter.Matter.Constraint;
    this.Composite = Phaser.Physics.Matter.Matter.Composite;

    // Ragdoll composite (contains all bodies and constraints)
    this.composite = this.Composite.create({ label: 'ragdoll' });

    // Body storage
    this.bodies = new Map();      // boneId -> Matter.Body
    this.constraints = [];         // Joint constraints

    // State
    this.active = false;
    this.frozen = false;
    this.settleTime = 0;
    this.settleThreshold = 500;   // ms of low velocity before settled
    this.onSettleCallback = null;
    this.minSimulationTime = 0;   // Track time since activation

    // Config - IMPORTANT: isStatic must be false for ragdoll to fall
    this.bodyConfig = {
      isStatic: false,  // CRITICAL: Must be false for physics simulation
      friction: 0.8,
      frictionAir: 0.02,
      restitution: 0.2,
      collisionFilter: {
        category: CollisionCategories.CORPSE,
        mask: CollisionMasks.CORPSE,
      },
    };

    // Bone dimensions (thickness for physics bodies)
    this.boneThickness = {
      pelvis: 10,
      torso: 12,
      neck: 6,
      head: 16,
      upperArmL: 6, upperArmR: 6,
      lowerArmL: 5, lowerArmR: 5,
      handL: 4, handR: 4,
      thighL: 8, thighR: 8,
      shinL: 6, shinR: 6,
      footL: 5, footR: 5,
    };

    // Joint stiffness (0 = loose, 1 = rigid)
    this.jointStiffness = 0.9;
    this.jointDamping = 0.3;
  }

  /**
   * Activate ragdoll, creating physics bodies from current skeleton pose
   * @param {object} config
   * @param {object} config.impulse - Initial velocity {x, y}
   * @param {number} config.angularImpulse - Initial spin
   * @param {function} config.onSettle - Callback when ragdoll settles
   */
  activate(config = {}) {
    if (this.active) {
      console.warn('Ragdoll already active');
      return;
    }

    console.log('=== RAGDOLL ACTIVATION ===');

    const impulse = config.impulse || { x: 0, y: 0 };
    const angularImpulse = config.angularImpulse || 0;
    this.onSettleCallback = config.onSettle || null;

    console.log('Impulse:', impulse);
    console.log('Angular impulse:', angularImpulse);

    // CRITICAL: Compute world positions BEFORE creating bodies
    this.skeletonInstance.computeWorldPositions();
    const worldPositions = this.skeletonInstance.worldPositions;

    console.log('Skeleton position:', this.skeletonInstance.position);
    console.log('World positions count:', worldPositions.size);

    // Debug: Log a few bone positions
    for (const [boneId, pos] of worldPositions) {
      if (boneId === 'torso' || boneId === 'head' || boneId === 'pelvis') {
        console.log(`  ${boneId}: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) angle: ${pos.angle.toFixed(2)}`);
      }
    }

    // Create physics bodies for each bone
    this.createBodies(worldPositions);

    console.log('Bodies created:', this.bodies.size);

    // Create joint constraints between connected bones
    this.createConstraints();

    console.log('Constraints created:', this.constraints.length);

    // DEFER adding composite to world using safe manager
    // This prevents corruption if called during collision callback
    if (this.scene.worldManager) {
      this.scene.worldManager.safeAdd(this.composite, () => {
        console.log('Ragdoll composite added to world (deferred)');
        // Apply impulse AFTER bodies are in the world
        this.applyImpulse(impulse, angularImpulse);
      });
    } else {
      // Fallback: use afterupdate event directly
      console.warn('No worldManager found, using fallback deferred add');
      this.scene.matter.world.once('afterupdate', () => {
        this.scene.matter.world.add(this.composite);
        this.applyImpulse(impulse, angularImpulse);
      });
    }

    // Verify bodies are dynamic (not static)
    for (const [boneId, body] of this.bodies) {
      if (body.isStatic) {
        console.error(`ERROR: Body ${boneId} is STATIC - won't fall!`);
      }
    }

    this.active = true;
    this.frozen = false;
    this.settleTime = 0;
    this.minSimulationTime = 0;

    console.log('Ragdoll activation queued');
    console.log('=== END ACTIVATION ===');
  }

  /**
   * Create physics bodies for each bone
   */
  createBodies(worldPositions) {
    // Get ground Y level for validation
    const groundY = this.getGroundY();
    console.log('Ground Y level:', groundY);

    this.skeleton.traverseDepthFirst((bone) => {
      // Skip zero-length bones but track position for constraints
      if (bone.length === 0) {
        const pos = worldPositions.get(bone.id);
        if (pos) {
          // Create tiny sensor body for constraint anchor
          let anchorY = pos.y;
          // Ensure anchor is above ground
          if (anchorY > groundY - 20) {
            anchorY = groundY - 50;
          }
          const body = this.Bodies.circle(pos.x, anchorY, 2, {
            isSensor: true,
            isStatic: false,  // IMPORTANT: Must be false even for anchors
            label: `ragdoll_anchor_${bone.id}`,
          });
          // Prevent Phaser from trying to emit events on this raw body
          body.gameObject = null;
          this.bodies.set(bone.id, body);
          this.Composite.add(this.composite, body);
        }
        return;
      }

      const pos = worldPositions.get(bone.id);
      if (!pos) {
        console.warn(`No position for bone: ${bone.id}`);
        return;
      }

      // Calculate body dimensions
      const length = bone.length;
      const thickness = this.boneThickness[bone.id] || 6;

      // Calculate center position
      let centerX = (pos.x + pos.endX) / 2;
      let centerY = (pos.y + pos.endY) / 2;

      // Ensure body is above ground
      if (centerY > groundY - 20) {
        console.warn(`Body ${bone.id} would be below ground, adjusting Y from ${centerY.toFixed(1)} to ${(groundY - 50).toFixed(1)}`);
        centerY = groundY - 50;
      }

      // CRITICAL: isStatic must be false for ragdoll to fall
      const bodyOptions = {
        isStatic: false,  // MUST BE FALSE
        friction: 0.8,
        frictionAir: 0.02,
        restitution: 0.2,
        angle: pos.angle,
        label: `ragdoll_${bone.id}`,
        chamfer: { radius: thickness / 3 },
        collisionFilter: {
          category: CollisionCategories.CORPSE,
          mask: CollisionMasks.CORPSE,
        },
      };

      // Create rectangle body at bone center
      const body = this.Bodies.rectangle(
        centerX,
        centerY,
        length,                   // Width = bone length
        thickness,                // Height = bone thickness
        bodyOptions
      );

      if (!body) {
        console.error(`Failed to create body for bone: ${bone.id}`);
        return;
      }

      // Prevent Phaser from trying to emit events on this raw body
      body.gameObject = null;

      console.log(`Created body: ${bone.id} at (${body.position.x.toFixed(1)}, ${body.position.y.toFixed(1)}) static: ${body.isStatic}`);

      // Store reference
      this.bodies.set(bone.id, body);

      // Add to composite
      this.Composite.add(this.composite, body);
    });
  }

  /**
   * Get approximate ground Y level
   */
  getGroundY() {
    // Try to find ground body in the scene
    try {
      const allBodies = Phaser.Physics.Matter.Matter.Composite.allBodies(
        this.scene.matter.world.localWorld
      );

      for (const body of allBodies) {
        if (body.label === 'ground' && body.isStatic) {
          return body.bounds.min.y;
        }
      }
    } catch (e) {
      console.warn('Could not find ground body:', e.message);
    }

    // Fallback: assume ground near bottom of screen
    return this.scene.game.config.height - 50;
  }

  /**
   * Create joint constraints between connected bones
   */
  createConstraints() {
    const worldPositions = this.skeletonInstance.worldPositions;

    this.skeleton.traverseDepthFirst((bone) => {
      if (!bone.parentId) return;

      const parentBody = this.bodies.get(bone.parentId);
      const childBody = this.bodies.get(bone.id);

      if (!parentBody || !childBody) return;

      const parentBone = this.skeleton.getBone(bone.parentId);
      const parentPos = worldPositions.get(bone.parentId);
      const childPos = worldPositions.get(bone.id);

      if (!parentPos || !childPos) return;

      // Calculate connection point on parent body (in local coordinates)
      // For most bones, this is the end of the parent
      let parentAnchor;
      if (parentBone.length === 0) {
        // Parent is zero-length (like pelvis), connect at center
        parentAnchor = { x: 0, y: 0 };
      } else {
        // Connect at parent's end point (accounting for anchor offset)
        const anchorY = bone.anchor?.y ?? 1;
        const anchorX = bone.anchor?.x ?? 0;

        // Local offset along parent bone
        const alongBone = (anchorY - 0.5) * parentBone.length;
        const perpBone = anchorX * parentBone.length;

        parentAnchor = {
          x: alongBone * Math.cos(0) - perpBone * Math.sin(0),
          y: alongBone * Math.sin(0) + perpBone * Math.cos(0),
        };
      }

      // Child anchor is at the start of the child bone (local coords)
      const childAnchor = {
        x: -bone.length / 2,  // Start of bone (left side of rectangle)
        y: 0,
      };

      // Create constraint
      const constraint = this.Constraint.create({
        bodyA: parentBody,
        bodyB: childBody,
        pointA: parentAnchor,
        pointB: childAnchor,
        stiffness: this.jointStiffness,
        damping: this.jointDamping,
        length: 0,  // Zero length = bodies connected at points
        label: `joint_${bone.parentId}_${bone.id}`,
      });

      this.constraints.push(constraint);
      this.Composite.add(this.composite, constraint);
    });
  }

  /**
   * Apply initial impulse to all bodies
   */
  applyImpulse(impulse, angularImpulse) {
    console.log('Applying impulse to', this.bodies.size, 'bodies');
    console.log('Raw impulse:', impulse);

    // Matter.js uses MUCH smaller velocities than Arcade
    // Arcade: 300 = fast, Matter: 5-10 = fast
    // Scale factor should be roughly 1/100 to 1/200
    const velocityScale = 1 / 150;

    // Clamp maximum velocity to prevent flying off screen
    const maxVelocity = 15;

    for (const [boneId, body] of this.bodies) {
      if (body.isSensor) continue;
      if (body.isStatic) {
        console.warn(`Skipping static body: ${boneId}`);
        continue;
      }

      const depth = this.getBoneDepth(boneId);
      const scale = 1 + depth * 0.05; // Reduced depth influence
      const randomVariance = 0.9 + Math.random() * 0.2;

      let vx = impulse.x * velocityScale * scale * randomVariance;
      let vy = impulse.y * velocityScale * scale * randomVariance;

      // Clamp velocities
      vx = Math.max(-maxVelocity, Math.min(maxVelocity, vx));
      vy = Math.max(-maxVelocity, Math.min(maxVelocity, vy));

      // Set velocity
      this.Body.setVelocity(body, { x: vx, y: vy });

      // Angular velocity - also scale down significantly
      const angVel = angularImpulse * 0.001 * (Math.random() - 0.3);
      this.Body.setAngularVelocity(body, Math.max(-0.3, Math.min(0.3, angVel)));

      if (boneId === 'torso') {
        console.log(`Torso velocity set to: (${vx.toFixed(2)}, ${vy.toFixed(2)})`);
      }
    }
  }

  /**
   * Get depth of bone from root
   */
  getBoneDepth(boneId) {
    let depth = 0;
    let current = this.skeleton.getBone(boneId);
    while (current && current.parentId) {
      depth++;
      current = this.skeleton.getBone(current.parentId);
    }
    return depth;
  }

  /**
   * Update ragdoll (call each frame)
   */
  update(delta) {
    if (!this.active || this.frozen) return;

    // Track simulation time
    this.minSimulationTime += delta;

    // Don't check settle for first 500ms - let physics simulate
    if (this.minSimulationTime < 500) {
      return; // Still in initial simulation phase
    }

    // Now check if settled
    if (this.checkSettled()) {
      this.settleTime += delta;
      if (this.settleTime >= this.settleThreshold) {
        console.log('Ragdoll settled after', this.minSimulationTime.toFixed(0), 'ms');
        this.onSettle();
      }
    } else {
      this.settleTime = 0;
    }
  }

  /**
   * Check if ragdoll has settled (low velocity)
   */
  checkSettled() {
    const velocityThreshold = 0.3;  // Lowered threshold for Matter.js scale
    const angularThreshold = 0.03;

    for (const body of this.bodies.values()) {
      if (body.isSensor) continue; // Skip anchor bodies

      const speed = Math.sqrt(
        body.velocity.x * body.velocity.x +
        body.velocity.y * body.velocity.y
      );

      // Debug: Log velocity occasionally
      if (Math.random() < 0.005) {
        console.log(`Body speed: ${speed.toFixed(3)}, angular: ${Math.abs(body.angularVelocity).toFixed(3)}`);
      }

      if (speed > velocityThreshold) return false;
      if (Math.abs(body.angularVelocity) > angularThreshold) return false;
    }

    return true;
  }

  /**
   * Called when ragdoll settles
   */
  onSettle() {
    console.log('Ragdoll settle callback triggered');
    if (this.onSettleCallback) {
      this.onSettleCallback(this);
    }
  }

  /**
   * Freeze ragdoll in place (convert to static)
   */
  freeze() {
    if (this.frozen) return;
    this.frozen = true;

    console.log('Freezing ragdoll');

    for (const body of this.bodies.values()) {
      this.Body.setStatic(body, true);
      this.Body.setVelocity(body, { x: 0, y: 0 });
      this.Body.setAngularVelocity(body, 0);
    }
  }

  /**
   * Get world positions for rendering (matches SkeletonInstance format)
   * @returns {Map<string, object>}
   */
  getWorldPositions() {
    const positions = new Map();

    for (const [boneId, body] of this.bodies) {
      const bone = this.skeleton.getBone(boneId);

      if (!bone || bone.length === 0) {
        // Zero-length bone (anchor)
        positions.set(boneId, {
          x: body.position.x,
          y: body.position.y,
          angle: body.angle,
          endX: body.position.x,
          endY: body.position.y,
        });
        continue;
      }

      // Calculate bone start and end from body center and angle
      const halfLength = bone.length / 2;
      const cos = Math.cos(body.angle);
      const sin = Math.sin(body.angle);

      positions.set(boneId, {
        x: body.position.x - cos * halfLength,
        y: body.position.y - sin * halfLength,
        angle: body.angle,
        endX: body.position.x + cos * halfLength,
        endY: body.position.y + sin * halfLength,
      });
    }

    return positions;
  }

  /**
   * Get bounding box of ragdoll
   */
  getBounds() {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const body of this.bodies.values()) {
      if (body.isSensor) continue;

      minX = Math.min(minX, body.bounds.min.x);
      minY = Math.min(minY, body.bounds.min.y);
      maxX = Math.max(maxX, body.bounds.max.x);
      maxY = Math.max(maxY, body.bounds.max.y);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Get center position
   */
  getCenter() {
    let sumX = 0, sumY = 0, count = 0;

    for (const body of this.bodies.values()) {
      if (body.isSensor) continue;
      sumX += body.position.x;
      sumY += body.position.y;
      count++;
    }

    return {
      x: count > 0 ? sumX / count : 0,
      y: count > 0 ? sumY / count : 0,
    };
  }

  /**
   * Get all physics bodies (for external collision setup)
   */
  getBodies() {
    return Array.from(this.bodies.values()).filter(b => !b.isSensor);
  }

  /**
   * Get the composite (for adding to collision groups)
   */
  getComposite() {
    return this.composite;
  }

  /**
   * Generate polygon vertices from ragdoll silhouette
   * Used for corpse terrain
   */
  generateSilhouetteVertices() {
    const points = [];

    // Collect all body vertices
    for (const body of this.bodies.values()) {
      if (body.isSensor) continue;

      for (const vertex of body.vertices) {
        points.push({ x: vertex.x, y: vertex.y });
      }
    }

    // Compute convex hull
    return this.computeConvexHull(points);
  }

  /**
   * Compute convex hull of points (Graham scan)
   */
  computeConvexHull(points) {
    if (points.length < 3) return points;

    // Find lowest point
    let lowest = 0;
    for (let i = 1; i < points.length; i++) {
      if (points[i].y > points[lowest].y ||
          (points[i].y === points[lowest].y && points[i].x < points[lowest].x)) {
        lowest = i;
      }
    }

    // Swap to front
    [points[0], points[lowest]] = [points[lowest], points[0]];
    const pivot = points[0];

    // Sort by polar angle
    const sorted = points.slice(1).sort((a, b) => {
      const angleA = Math.atan2(a.y - pivot.y, a.x - pivot.x);
      const angleB = Math.atan2(b.y - pivot.y, b.x - pivot.x);
      return angleA - angleB;
    });

    // Build hull
    const hull = [pivot];
    for (const point of sorted) {
      while (hull.length > 1 && this.cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
        hull.pop();
      }
      hull.push(point);
    }

    return hull;
  }

  /**
   * Cross product of vectors OA and OB
   */
  cross(o, a, b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  }

  /**
   * Check if active and simulating
   */
  isSimulating() {
    return this.active && !this.frozen;
  }

  /**
   * Clean up - uses safe removal to avoid mid-physics-update errors
   */
  destroy() {
    console.log('Destroying ragdoll');

    // Remove from world using safe removal
    if (this.composite) {
      if (this.scene.worldManager) {
        this.scene.worldManager.safeRemove(this.composite);
      } else if (this.scene?.matter?.world) {
        // Fallback: manually clear pairs and defer removal
        // First, disable collisions on all bodies to prevent new pairs
        const Matter = Phaser.Physics.Matter.Matter;
        const allBodies = Matter.Composite.allBodies(this.composite);
        for (const body of allBodies) {
          if (body.collisionFilter) {
            body.collisionFilter.mask = 0;
            body.collisionFilter.category = 0;
          }
        }

        this.scene.matter.world.once('afterupdate', () => {
          try {
            // Clear collision pairs for all bodies before removal
            const engine = this.scene.matter.world.engine;
            if (engine?.pairs) {
              for (const body of allBodies) {
                this.clearPairsForBody(engine.pairs, body);
              }
            }
            this.scene.matter.world.remove(this.composite);
          } catch (e) {
            // Ignore - may already be removed
          }
        });
      }
    }

    // Clear references
    this.bodies.clear();
    this.constraints = [];
    this.active = false;
  }

  /**
   * Helper to clear collision pairs for a body (used in fallback destroy)
   * @param {object} pairs - engine.pairs object
   * @param {MatterJS.BodyType} body - body to clear pairs for
   */
  clearPairsForBody(pairs, body) {
    if (!pairs || !body) return;

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

    // Remove from both table and list
    for (const id of pairsToRemove) {
      const pair = pairs.table[id];
      if (pair) {
        if (pairs.list) {
          const listIndex = pairs.list.indexOf(pair);
          if (listIndex !== -1) {
            pairs.list.splice(listIndex, 1);
          }
        }
        delete pairs.table[id];
      }
    }

    // Also clear from collisionActive if present
    if (pairs.collisionActive) {
      for (let i = pairs.collisionActive.length - 1; i >= 0; i--) {
        const pair = pairs.collisionActive[i];
        if (pair && (pair.bodyA === body || pair.bodyB === body)) {
          pairs.collisionActive.splice(i, 1);
        }
      }
    }
  }
}
