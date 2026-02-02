/**
 * Pose - A snapshot of bone angles at one moment in time.
 * Used as keyframes in animations and for defining static poses.
 */
export class Pose {
  /**
   * Create a new Pose.
   * @param {Object} [config] - Pose configuration
   * @param {string} [config.id] - Optional identifier
   * @param {Object|Map} [config.boneAngles] - Bone angles { boneId: degrees }
   * @param {Object} [config.rootOffset] - Optional offset { x, y } for root
   * @param {Array} [config.events] - Optional events [{ type, data }]
   */
  constructor(config = {}) {
    /** @type {string} */
    this.id = config.id || '';

    /** @type {Map<string, number>} Bone angles in degrees */
    this.boneAngles = new Map();

    /** @type {{x: number, y: number}|null} */
    this.rootOffset = config.rootOffset ? { ...config.rootOffset } : null;

    /** @type {Array<{type: string, data: any}>} */
    this.events = config.events ? [...config.events] : [];

    // Initialize bone angles from config
    if (config.boneAngles) {
      const entries = config.boneAngles instanceof Map
        ? config.boneAngles.entries()
        : Object.entries(config.boneAngles);

      for (const [boneId, angle] of entries) {
        this.boneAngles.set(boneId, angle);
      }
    }
  }

  /**
   * Get angle for a bone.
   * @param {string} boneId - The bone ID
   * @returns {number} Angle in degrees, or 0 if not defined
   */
  getAngle(boneId) {
    return this.boneAngles.get(boneId) ?? 0;
  }

  /**
   * Set angle for a bone.
   * @param {string} boneId - The bone ID
   * @param {number} degrees - Angle in degrees
   */
  setAngle(boneId, degrees) {
    this.boneAngles.set(boneId, degrees);
  }

  /**
   * Check if bone has a defined angle.
   * @param {string} boneId - The bone ID
   * @returns {boolean}
   */
  hasAngle(boneId) {
    return this.boneAngles.has(boneId);
  }

  /**
   * Create a deep copy of this pose.
   * @returns {Pose}
   */
  clone() {
    const cloned = new Pose({
      id: this.id,
      rootOffset: this.rootOffset ? { ...this.rootOffset } : null,
      events: this.events.map(e => ({ ...e }))
    });

    for (const [boneId, angle] of this.boneAngles) {
      cloned.boneAngles.set(boneId, angle);
    }

    return cloned;
  }

  /**
   * Apply this pose to a skeleton instance.
   * @param {import('../SkeletonInstance.js').SkeletonInstance} skeletonInstance
   */
  applyTo(skeletonInstance) {
    // Apply bone angles
    for (const [boneId, angle] of this.boneAngles) {
      skeletonInstance.setBoneAngle(boneId, angle);
    }

    // Apply root offset if defined
    if (this.rootOffset) {
      const currentPos = skeletonInstance.position;
      skeletonInstance.setPosition(
        currentPos.x + this.rootOffset.x,
        currentPos.y + this.rootOffset.y
      );
    }
  }

  /**
   * Interpolate between two angles using shortest path.
   * Handles 360° wraparound correctly (e.g., 350° to 10° = 20° movement, not 340°).
   * @param {number} a - Start angle in degrees
   * @param {number} b - End angle in degrees
   * @param {number} t - Interpolation factor (0-1)
   * @returns {number} Interpolated angle in degrees
   */
  static lerpAngle(a, b, t) {
    // Normalize angles to [0, 360)
    a = ((a % 360) + 360) % 360;
    b = ((b % 360) + 360) % 360;

    // Calculate shortest path difference
    let diff = b - a;
    if (diff > 180) {
      diff -= 360;
    } else if (diff < -180) {
      diff += 360;
    }

    // Interpolate and normalize result
    let result = a + diff * t;
    if (result < 0) result += 360;
    if (result >= 360) result -= 360;

    // Convert back to signed angle if original was negative
    if (result > 180) result -= 360;

    return result;
  }

  /**
   * Interpolate between two poses.
   * @param {Pose} poseA - Start pose
   * @param {Pose} poseB - End pose
   * @param {number} t - Interpolation factor (0-1)
   * @returns {Pose} Interpolated pose
   */
  static lerp(poseA, poseB, t) {
    const result = new Pose();

    // Collect all bone IDs from both poses
    const allBoneIds = new Set([
      ...poseA.boneAngles.keys(),
      ...poseB.boneAngles.keys()
    ]);

    // Interpolate each bone angle
    for (const boneId of allBoneIds) {
      const angleA = poseA.getAngle(boneId);
      const angleB = poseB.getAngle(boneId);
      const interpolated = Pose.lerpAngle(angleA, angleB, t);
      result.setAngle(boneId, interpolated);
    }

    // Interpolate root offset if both have one
    if (poseA.rootOffset && poseB.rootOffset) {
      result.rootOffset = {
        x: poseA.rootOffset.x + (poseB.rootOffset.x - poseA.rootOffset.x) * t,
        y: poseA.rootOffset.y + (poseB.rootOffset.y - poseA.rootOffset.y) * t
      };
    } else if (poseA.rootOffset) {
      result.rootOffset = { ...poseA.rootOffset };
    } else if (poseB.rootOffset) {
      result.rootOffset = { ...poseB.rootOffset };
    }

    return result;
  }
}
