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

    // Config
    this.bodyConfig = {
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
    if (this.active) return;

    const impulse = config.impulse || { x: 0, y: 0 };
    const angularImpulse = config.angularImpulse || 0;
    this.onSettleCallback = config.onSettle || null;

    // Get current world positions from skeleton
    this.skeletonInstance.computeWorldPositions();
    const worldPositions = this.skeletonInstance.worldPositions;

    // Create physics bodies for each bone
    this.createBodies(worldPositions);

    // Create joint constraints between connected bones
    this.createConstraints();

    // Add composite to world
    this.scene.matter.world.add(this.composite);

    // Apply initial impulse to all bodies
    this.applyImpulse(impulse, angularImpulse);

    this.active = true;
    this.frozen = false;
    this.settleTime = 0;
  }

  /**
   * Create physics bodies for each bone
   */
  createBodies(worldPositions) {
    this.skeleton.traverseDepthFirst((bone) => {
      // Skip zero-length bones but track position for constraints
      if (bone.length === 0) {
        const pos = worldPositions.get(bone.id);
        if (pos) {
          // Create tiny sensor body for constraint anchor
          const body = this.Bodies.circle(pos.x, pos.y, 2, {
            ...this.bodyConfig,
            isSensor: true,
            label: `ragdoll_${bone.id}`,
          });
          // Prevent Phaser from trying to emit events on this raw body
          body.gameObject = null;
          this.bodies.set(bone.id, body);
          this.Composite.add(this.composite, body);
        }
        return;
      }

      const pos = worldPositions.get(bone.id);
      if (!pos) return;

      // Calculate body dimensions
      const length = bone.length;
      const thickness = this.boneThickness[bone.id] || 6;

      // Create capsule-like body (rectangle with rounded ends)
      // Matter.js doesn't have capsules, so we use rectangle
      const body = this.Bodies.rectangle(
        (pos.x + pos.endX) / 2,  // Center X
        (pos.y + pos.endY) / 2,  // Center Y
        length,                   // Width = bone length
        thickness,                // Height = bone thickness
        {
          ...this.bodyConfig,
          label: `ragdoll_${bone.id}`,
          angle: pos.angle,       // Initial rotation
          chamfer: { radius: thickness / 3 }, // Rounded corners
        }
      );

      // Prevent Phaser from trying to emit events on this raw body
      body.gameObject = null;

      // Store reference
      this.bodies.set(bone.id, body);

      // Add to composite
      this.Composite.add(this.composite, body);
    });
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
    for (const [boneId, body] of this.bodies) {
      // Vary impulse by depth for more dynamic motion
      const depth = this.getBoneDepth(boneId);
      const scale = 1 + depth * 0.1;
      const randomVariance = 0.85 + Math.random() * 0.3;

      // Set velocity
      this.Body.setVelocity(body, {
        x: impulse.x * scale * randomVariance / 60, // Scale for Matter.js
        y: impulse.y * scale * randomVariance / 60,
      });

      // Set angular velocity
      const angularScale = (Math.random() - 0.5) * 0.5 + 1;
      this.Body.setAngularVelocity(body, angularImpulse * angularScale / 1000);
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

    // Check if settled
    if (this.checkSettled()) {
      this.settleTime += delta;
      if (this.settleTime >= this.settleThreshold) {
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
    const velocityThreshold = 0.5;
    const angularThreshold = 0.05;

    for (const body of this.bodies.values()) {
      if (body.isSensor) continue; // Skip anchor bodies

      const speed = Math.sqrt(
        body.velocity.x * body.velocity.x +
        body.velocity.y * body.velocity.y
      );

      if (speed > velocityThreshold) return false;
      if (Math.abs(body.angularVelocity) > angularThreshold) return false;
    }

    return true;
  }

  /**
   * Called when ragdoll settles
   */
  onSettle() {
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
   * Clean up
   */
  destroy() {
    // Remove from world
    if (this.composite) {
      this.scene.matter.world.remove(this.composite);
    }

    // Clear references
    this.bodies.clear();
    this.constraints = [];
    this.active = false;
  }
}
