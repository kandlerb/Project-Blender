/**
 * Bone - Immutable bone data representing a single bone in a skeleton.
 * Bones are connected in a parent-child hierarchy to form a skeleton.
 */
export class Bone {
  /**
   * Create a new Bone.
   * @param {Object} config - Bone configuration
   * @param {string} config.id - Unique identifier for this bone
   * @param {string|null} config.parentId - ID of parent bone, null for root
   * @param {number} config.length - Length of the bone in pixels
   * @param {number} [config.baseAngle=0] - Default angle in degrees relative to parent
   * @param {Object} [config.anchor] - Attachment point on parent bone
   * @param {number} [config.anchor.x=1] - 0 = start of parent, 1 = end of parent
   * @param {number} [config.anchor.y=0] - Perpendicular offset from parent axis
   */
  constructor(config) {
    if (!config.id) {
      throw new Error('Bone requires an id');
    }
    if (typeof config.length !== 'number') {
      throw new Error('Bone requires a length');
    }

    this.id = config.id;
    this.parentId = config.parentId ?? null;
    this.length = config.length;
    this.baseAngle = config.baseAngle ?? 0;
    this.anchor = Object.freeze({
      x: config.anchor?.x ?? 1,
      y: config.anchor?.y ?? 0
    });

    // Freeze to make immutable
    Object.freeze(this);
  }

  /**
   * Check if this bone is a root bone (has no parent).
   * @returns {boolean}
   */
  isRoot() {
    return this.parentId === null;
  }
}
