import { Bone } from './Bone.js';

/**
 * Skeleton - Defines the bone hierarchy for an entity.
 * This is the immutable definition; use SkeletonInstance for runtime pose data.
 */
export class Skeleton {
  /**
   * Create a new Skeleton.
   * @param {Object} config - Skeleton configuration
   * @param {string} config.id - Unique identifier for this skeleton
   * @param {string} config.rootBoneId - ID of the root bone
   * @param {Array<Object>} config.bones - Array of bone configurations
   */
  constructor(config) {
    if (!config.id) {
      throw new Error('Skeleton requires an id');
    }
    if (!config.rootBoneId) {
      throw new Error('Skeleton requires a rootBoneId');
    }
    if (!Array.isArray(config.bones) || config.bones.length === 0) {
      throw new Error('Skeleton requires at least one bone');
    }

    this.id = config.id;
    this.rootBoneId = config.rootBoneId;

    /** @type {Map<string, Bone>} */
    this.bones = new Map();

    /** @type {Map<string, string[]>} */
    this.children = new Map();

    // Create bone instances and build hierarchy
    for (const boneConfig of config.bones) {
      const bone = new Bone(boneConfig);
      this.bones.set(bone.id, bone);
      this.children.set(bone.id, []);
    }

    // Validate root bone exists
    if (!this.bones.has(this.rootBoneId)) {
      throw new Error(`Root bone '${this.rootBoneId}' not found in bones`);
    }

    // Build parent-child relationships
    for (const bone of this.bones.values()) {
      if (bone.parentId !== null) {
        if (!this.bones.has(bone.parentId)) {
          throw new Error(`Parent bone '${bone.parentId}' not found for bone '${bone.id}'`);
        }
        this.children.get(bone.parentId).push(bone.id);
      }
    }

    // Cache traversal order (depth-first from root)
    this._traversalOrder = this._computeTraversalOrder();

    // Freeze collections
    Object.freeze(this._traversalOrder);
  }

  /**
   * Get a bone by ID.
   * @param {string} boneId - The bone ID
   * @returns {Bone|undefined}
   */
  getBone(boneId) {
    return this.bones.get(boneId);
  }

  /**
   * Get the root bone.
   * @returns {Bone}
   */
  getRootBone() {
    return this.bones.get(this.rootBoneId);
  }

  /**
   * Get child bone IDs for a given bone.
   * @param {string} boneId - The parent bone ID
   * @returns {string[]}
   */
  getChildren(boneId) {
    return this.children.get(boneId) || [];
  }

  /**
   * Get the cached depth-first traversal order of bone IDs.
   * @returns {string[]}
   */
  getTraversalOrder() {
    return this._traversalOrder;
  }

  /**
   * Compute depth-first traversal order starting from root.
   * @private
   * @returns {string[]}
   */
  _computeTraversalOrder() {
    const order = [];
    const stack = [this.rootBoneId];

    while (stack.length > 0) {
      const boneId = stack.pop();
      order.push(boneId);

      // Add children in reverse order so they're processed in correct order
      const childIds = this.children.get(boneId) || [];
      for (let i = childIds.length - 1; i >= 0; i--) {
        stack.push(childIds[i]);
      }
    }

    return order;
  }

  /**
   * Get all bone IDs in this skeleton.
   * @returns {string[]}
   */
  getBoneIds() {
    return Array.from(this.bones.keys());
  }

  /**
   * Get the total number of bones.
   * @returns {number}
   */
  getBoneCount() {
    return this.bones.size;
  }
}
