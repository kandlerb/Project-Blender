/**
 * @deprecated This file uses Arcade Physics and is no longer used.
 * The game has migrated to Matter.js. Use MatterRagdoll.js instead.
 * This file is kept for reference only and may be removed in the future.
 */

/**
 * Ragdoll - Physics-driven skeleton state (DEPRECATED)
 *
 * Converts an animated skeleton into individual physics bodies
 * connected by constraints. Used for death animations and corpse piling.
 */
export class Ragdoll {
  /**
   * @param {Phaser.Scene} scene - The scene for physics
   * @param {import('../SkeletonInstance.js').SkeletonInstance} skeletonInstance - The skeleton to ragdoll
   */
  constructor(scene, skeletonInstance) {
    this.scene = scene;
    this.skeleton = skeletonInstance.skeleton; // Skeleton definition
    this.originalInstance = skeletonInstance;

    // Physics bodies for each bone
    this.bodies = new Map(); // boneId -> { sprite, constraint }

    // State
    this.active = false;
    this.frozen = false;
    this.settleTime = 0;
    this.settleThreshold = 500; // ms of low velocity before considered settled
    this.onSettleCallback = null;

    // Config
    this.gravity = 800;
    this.bounce = 0.3;
    this.drag = 50;
    this.angularDrag = 50;
    this.constraintStiffness = 0.8; // How rigidly bones stay connected
  }

  /**
   * Activate ragdoll, converting skeleton to physics bodies
   * @param {object} config - Activation config
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
    const worldPositions = this.originalInstance.worldPositions;

    // Create physics body for each bone with length > 0
    for (const boneId of this.skeleton.getTraversalOrder()) {
      const bone = this.skeleton.getBone(boneId);
      if (bone.length === 0) continue; // Skip zero-length bones (like pelvis)

      const pos = worldPositions.get(bone.id);
      if (!pos) continue;

      // Create a small sprite/rectangle for the physics body
      // Position at bone midpoint
      const midX = (pos.x + pos.endX) / 2;
      const midY = (pos.y + pos.endY) / 2;

      // Create physics sprite (invisible, just for physics)
      const body = this.scene.physics.add.sprite(midX, midY, null);
      body.setVisible(false);

      // Size based on bone length
      const width = Math.max(6, bone.length * 0.3);
      const height = bone.length;
      body.body.setSize(width, height);

      // Set rotation to match bone angle
      // Note: Phaser arcade physics doesn't support rotated bodies well,
      // so we'll track rotation separately for rendering

      // Physics properties
      body.body.setBounce(this.bounce);
      body.body.setDrag(this.drag);
      body.body.setAngularDrag(this.angularDrag);
      body.body.setGravityY(this.gravity);
      body.body.setCollideWorldBounds(true);

      // Apply initial impulse (vary by distance from root for more dynamic motion)
      const distFromRoot = this.getDepth(bone.id);
      const impulseScale = 1 + distFromRoot * 0.15;
      const randomVariance = 0.8 + Math.random() * 0.4;

      body.body.setVelocity(
        impulse.x * impulseScale * randomVariance,
        impulse.y * impulseScale * randomVariance
      );

      // Add angular velocity for tumbling effect
      const baseAngular = angularImpulse || (impulse.x * 0.5);
      body.body.setAngularVelocity(
        baseAngular + (Math.random() - 0.5) * 200
      );

      // Store with bone reference
      this.bodies.set(bone.id, {
        sprite: body,
        bone: bone,
        angle: pos.angle, // Current rotation (updated manually)
        parentId: bone.parentId,
      });
    }

    // Add colliders with ground/platforms if available
    if (this.scene.ground) {
      this.bodies.forEach(({ sprite }) => {
        this.scene.physics.add.collider(sprite, this.scene.ground);
      });
    }
    if (this.scene.platforms) {
      this.bodies.forEach(({ sprite }) => {
        this.scene.physics.add.collider(sprite, this.scene.platforms);
      });
    }

    this.active = true;
    this.frozen = false;
    this.settleTime = 0;
  }

  /**
   * Get depth of bone from root (for impulse scaling)
   * @param {string} boneId
   * @returns {number}
   */
  getDepth(boneId) {
    let depth = 0;
    let current = this.skeleton.getBone(boneId);
    while (current.parentId) {
      depth++;
      current = this.skeleton.getBone(current.parentId);
    }
    return depth;
  }

  /**
   * Update ragdoll physics
   * @param {number} delta - Time since last frame in ms
   */
  update(delta) {
    if (!this.active || this.frozen) return;

    // Enforce constraints (keep bones somewhat connected)
    this.enforceConstraints();

    // Update rotation based on velocity (simulate tumbling)
    this.updateRotations(delta);

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
   * Enforce distance constraints between connected bones
   * This keeps the ragdoll from flying apart
   */
  enforceConstraints() {
    // For each bone, try to maintain connection to parent
    this.bodies.forEach((bodyData, boneId) => {
      const bone = bodyData.bone;
      if (!bone.parentId) return;

      const parentData = this.bodies.get(bone.parentId);
      if (!parentData) return;

      const childBody = bodyData.sprite.body;
      const parentBody = parentData.sprite.body;

      // Calculate current distance
      const dx = childBody.center.x - parentBody.center.x;
      const dy = childBody.center.y - parentBody.center.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Target distance based on parent bone length
      const targetDistance = parentData.bone.length;

      if (distance > targetDistance * 1.5) {
        // Too far apart, pull together
        const correction = (distance - targetDistance) * this.constraintStiffness;
        const nx = dx / distance;
        const ny = dy / distance;

        // Move child toward parent
        childBody.x -= nx * correction * 0.5;
        childBody.y -= ny * correction * 0.5;

        // Move parent toward child (less, since parent is "heavier")
        parentBody.x += nx * correction * 0.2;
        parentBody.y += ny * correction * 0.2;
      }
    });
  }

  /**
   * Update bone rotations based on velocity (visual tumbling)
   * @param {number} delta
   */
  updateRotations(delta) {
    this.bodies.forEach((bodyData) => {
      const body = bodyData.sprite.body;

      // Rotate based on angular velocity (stored separately since arcade physics
      // doesn't handle rotated rectangles)
      bodyData.angle += (body.angularVelocity * delta) / 1000;

      // Apply drag to angular velocity manually
      body.angularVelocity *= (1 - this.angularDrag * delta / 10000);
    });
  }

  /**
   * Check if ragdoll has settled (low velocity)
   * @returns {boolean}
   */
  checkSettled() {
    const velocityThreshold = 15;
    const angularThreshold = 30;

    for (const [, bodyData] of this.bodies) {
      const body = bodyData.sprite.body;
      const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);

      if (speed > velocityThreshold) return false;
      if (Math.abs(body.angularVelocity) > angularThreshold) return false;
    }

    return true;
  }

  /**
   * Called when ragdoll has settled
   */
  onSettle() {
    if (this.onSettleCallback) {
      this.onSettleCallback(this);
    }
  }

  /**
   * Freeze ragdoll in place (for corpse piling)
   */
  freeze() {
    if (this.frozen) return;

    this.frozen = true;

    this.bodies.forEach(({ sprite }) => {
      sprite.body.setVelocity(0, 0);
      sprite.body.setAngularVelocity(0);
      sprite.body.setImmovable(true);
      sprite.body.setAllowGravity(false);
      sprite.body.moves = false;
    });
  }

  /**
   * Get world positions for rendering (matches SkeletonInstance format)
   * @returns {Map<string, object>} World positions for each bone
   */
  getWorldPositions() {
    const positions = new Map();

    this.bodies.forEach((bodyData, boneId) => {
      const body = bodyData.sprite.body;
      const bone = bodyData.bone;
      const angle = bodyData.angle;

      // Calculate bone start and end from body center
      const halfLength = bone.length / 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      positions.set(boneId, {
        x: body.center.x - cos * halfLength,
        y: body.center.y - sin * halfLength,
        angle: angle,
        endX: body.center.x + cos * halfLength,
        endY: body.center.y + sin * halfLength,
      });
    });

    // Add zero-length bones (like pelvis) at a reasonable position
    // Use the first child's start position
    for (const boneId of this.skeleton.getTraversalOrder()) {
      const bone = this.skeleton.getBone(boneId);
      if (bone.length === 0 && !positions.has(bone.id)) {
        const children = this.skeleton.getChildren(bone.id);
        if (children.length > 0) {
          const childPos = positions.get(children[0]);
          if (childPos) {
            positions.set(bone.id, {
              x: childPos.x,
              y: childPos.y,
              angle: 0,
              endX: childPos.x,
              endY: childPos.y,
            });
          }
        }
      }
    }

    return positions;
  }

  /**
   * Get bounding box of the ragdoll
   * @returns {{x: number, y: number, width: number, height: number}}
   */
  getBounds() {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    this.bodies.forEach(({ sprite }) => {
      const body = sprite.body;
      minX = Math.min(minX, body.left);
      minY = Math.min(minY, body.top);
      maxX = Math.max(maxX, body.right);
      maxY = Math.max(maxY, body.bottom);
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Get approximate center position
   * @returns {{x: number, y: number}}
   */
  getCenter() {
    let sumX = 0, sumY = 0, count = 0;

    this.bodies.forEach(({ sprite }) => {
      sumX += sprite.body.center.x;
      sumY += sprite.body.center.y;
      count++;
    });

    return {
      x: count > 0 ? sumX / count : 0,
      y: count > 0 ? sumY / count : 0,
    };
  }

  /**
   * Add collider with another game object
   * @param {Phaser.GameObjects.GameObject} target
   */
  addCollider(target) {
    this.bodies.forEach(({ sprite }) => {
      this.scene.physics.add.collider(sprite, target);
    });
  }

  /**
   * Check if ragdoll is active and not frozen
   * @returns {boolean}
   */
  isSimulating() {
    return this.active && !this.frozen;
  }

  /**
   * Clean up all physics bodies
   */
  destroy() {
    this.bodies.forEach(({ sprite }) => {
      sprite.destroy();
    });
    this.bodies.clear();
    this.active = false;
  }
}
