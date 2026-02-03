/**
 * SkeletonInstance - Runtime skeleton attached to an entity.
 * Holds current pose state and computes world positions via forward kinematics.
 */
export class SkeletonInstance {
  /** Conversion factor from degrees to radians */
  static DEG_TO_RAD = Math.PI / 180;

  /** Conversion factor from radians to degrees */
  static RAD_TO_DEG = 180 / Math.PI;

  /**
   * Create a new SkeletonInstance.
   * @param {import('./Skeleton.js').Skeleton} skeleton - The skeleton definition
   * @param {Object} [config] - Optional configuration
   * @param {Object} [config.position] - Initial world position {x, y}
   * @param {Object} [config.scale] - Initial scale {x, y}
   * @param {number} [config.rotation] - Initial rotation in radians
   */
  constructor(skeleton, config = {}) {
    if (!skeleton) {
      throw new Error('SkeletonInstance requires a skeleton');
    }

    /** @type {import('./Skeleton.js').Skeleton} */
    this.skeleton = skeleton;

    /** @type {{x: number, y: number}} World position of root joint */
    this.position = {
      x: config.position?.x ?? 0,
      y: config.position?.y ?? 0
    };

    /** @type {{x: number, y: number}} Scale factors (x=-1 for horizontal flip) */
    this.scale = {
      x: config.scale?.x ?? 1,
      y: config.scale?.y ?? 1
    };

    /** @type {number} Base rotation in radians */
    this.rotation = config.rotation ?? 0;

    /** @type {Map<string, number>} Current angle offset for each bone (degrees) */
    this.boneAngles = new Map();

    /** @type {Map<string, BoneWorldPosition>} Computed world positions */
    this.worldPositions = new Map();

    // Initialize all bone angles to 0
    for (const boneId of skeleton.getBoneIds()) {
      this.boneAngles.set(boneId, 0);
    }

    // Compute initial world positions
    this.computeWorldPositions();
  }

  /**
   * Update root world position.
   * @param {number} x - World X coordinate
   * @param {number} y - World Y coordinate
   */
  setPosition(x, y) {
    this.position.x = x;
    this.position.y = y;
    this.computeWorldPositions();
  }

  /**
   * Update scale factors.
   * @param {number} x - X scale (use -1 for horizontal flip)
   * @param {number} y - Y scale
   */
  setScale(x, y) {
    this.scale.x = x;
    this.scale.y = y;
    this.computeWorldPositions();
  }

  /**
   * Update base rotation.
   * @param {number} radians - Rotation in radians
   */
  setRotation(radians) {
    this.rotation = radians;
    this.computeWorldPositions();
  }

  /**
   * Set angle offset for a single bone.
   * @param {string} boneId - The bone ID
   * @param {number} degrees - Angle offset in degrees
   */
  setBoneAngle(boneId, degrees) {
    if (!this.skeleton.getBone(boneId)) {
      throw new Error(`Bone '${boneId}' not found in skeleton`);
    }
    this.boneAngles.set(boneId, degrees);
    this.computeWorldPositions();
  }

  /**
   * Set multiple bone angles at once.
   * @param {Object|Map<string, number>} anglesMap - Map or object of boneId -> degrees
   */
  setBoneAngles(anglesMap) {
    const entries = anglesMap instanceof Map
      ? anglesMap.entries()
      : Object.entries(anglesMap);

    for (const [boneId, degrees] of entries) {
      if (!this.skeleton.getBone(boneId)) {
        throw new Error(`Bone '${boneId}' not found in skeleton`);
      }
      this.boneAngles.set(boneId, degrees);
    }
    // Recompute once after all angles are set
    this.computeWorldPositions();
  }

  /**
   * Get current angle offset for a bone.
   * @param {string} boneId - The bone ID
   * @returns {number} Angle offset in degrees
   */
  getBoneAngle(boneId) {
    return this.boneAngles.get(boneId) ?? 0;
  }

  /**
   * Get computed world position for a bone.
   * @param {string} boneId - The bone ID
   * @returns {BoneWorldPosition|undefined}
   */
  getBoneWorldPosition(boneId) {
    return this.worldPositions.get(boneId);
  }

  /**
   * Reset all bone angles to 0 (default pose).
   */
  resetPose() {
    for (const boneId of this.boneAngles.keys()) {
      this.boneAngles.set(boneId, 0);
    }
    this.computeWorldPositions();
  }

  /**
   * Compute world positions for all bones using forward kinematics.
   * Must be called after changing position, scale, rotation, or bone angles.
   */
  computeWorldPositions() {
    const traversalOrder = this.skeleton.getTraversalOrder();
    const isFlippedX = this.scale.x < 0;

    for (const boneId of traversalOrder) {
      const bone = this.skeleton.getBone(boneId);
      const angleOffset = this.boneAngles.get(boneId) ?? 0;

      let startX, startY, worldAngle;

      if (bone.isRoot()) {
        // Root bone starts at instance position
        startX = this.position.x;
        startY = this.position.y;

        // World angle = base rotation + bone base angle + angle offset
        // When flipped horizontally, we mirror angles around the Y axis
        const localAngle = (bone.baseAngle + angleOffset) * SkeletonInstance.DEG_TO_RAD;

        if (isFlippedX) {
          worldAngle = this.rotation + (Math.PI - localAngle);
        } else {
          worldAngle = this.rotation + localAngle;
        }
      } else {
        // Child bone - compute position from parent
        const parentPos = this.worldPositions.get(bone.parentId);
        const parentBone = this.skeleton.getBone(bone.parentId);

        if (!parentPos) {
          throw new Error(`Parent position for '${bone.parentId}' not computed`);
        }

        // Calculate start position based on anchor point
        // anchor.x: 0 = start of parent, 1 = end of parent
        // anchor.y: perpendicular offset from parent axis
        const anchorT = bone.anchor.x;
        const anchorPerp = bone.anchor.y;

        // Interpolate along parent bone
        const alongX = parentPos.x + (parentPos.endX - parentPos.x) * anchorT;
        const alongY = parentPos.y + (parentPos.endY - parentPos.y) * anchorT;

        // Apply perpendicular offset (rotate 90 degrees from parent angle)
        const perpAngle = parentPos.angle + Math.PI / 2;
        startX = alongX + Math.cos(perpAngle) * anchorPerp * Math.abs(this.scale.x);
        startY = alongY + Math.sin(perpAngle) * anchorPerp * Math.abs(this.scale.y);

        // World angle = parent angle + bone base angle + angle offset
        const localAngle = (bone.baseAngle + angleOffset) * SkeletonInstance.DEG_TO_RAD;

        if (isFlippedX) {
          // When flipped, angles are mirrored
          worldAngle = parentPos.angle - localAngle;
        } else {
          worldAngle = parentPos.angle + localAngle;
        }
      }

      // Calculate end position using angle and length
      const length = bone.length;
      const endX = startX + Math.cos(worldAngle) * length;
      const endY = startY + Math.sin(worldAngle) * length;

      // Store computed position
      this.worldPositions.set(boneId, {
        x: startX,
        y: startY,
        angle: worldAngle,
        endX: endX,
        endY: endY
      });
    }
  }
}

/**
 * @typedef {Object} BoneWorldPosition
 * @property {number} x - Joint start position X (world)
 * @property {number} y - Joint start position Y (world)
 * @property {number} angle - World angle in radians
 * @property {number} endX - Joint end position X (world)
 * @property {number} endY - Joint end position Y (world)
 */
