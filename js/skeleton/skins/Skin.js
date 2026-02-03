/**
 * Skin - Base class for skeleton visualization.
 * Subclasses implement different rendering styles (lines, sprites, meshes, etc.)
 */
export class Skin {
  /**
   * Create a new Skin.
   * @param {import('../SkeletonInstance.js').SkeletonInstance} skeletonInstance - The skeleton to render
   */
  constructor(skeletonInstance) {
    if (!skeletonInstance) {
      throw new Error('Skin requires a SkeletonInstance');
    }

    /** @type {import('../SkeletonInstance.js').SkeletonInstance} */
    this.skeleton = skeletonInstance;

    /** @type {boolean} Whether this skin is visible */
    this.visible = true;

    /** @type {number} Phaser render depth */
    this.depth = 0;

    /** @type {Phaser.Scene|null} Phaser scene reference */
    this.scene = null;
  }

  /**
   * Initialize rendering resources.
   * Must be called before render() with a valid Phaser scene.
   * @param {Phaser.Scene} scene - The Phaser scene to render in
   */
  initialize(scene) {
    throw new Error('Subclass must implement initialize()');
  }

  /**
   * Render the skeleton with its current pose.
   * Called each frame to update the visual representation.
   */
  render() {
    throw new Error('Subclass must implement render()');
  }

  /**
   * Update the skin to match skeleton state.
   * Default implementation just re-renders.
   */
  update() {
    this.render();
  }

  /**
   * Set visibility of the skin.
   * @param {boolean} visible - Whether the skin should be visible
   */
  setVisible(visible) {
    this.visible = visible;
  }

  /**
   * Set the render depth (z-order).
   * @param {number} depth - Phaser render depth value
   */
  setDepth(depth) {
    this.depth = depth;
  }

  /**
   * Clean up rendering resources.
   * Must be called when the skin is no longer needed.
   */
  destroy() {
    throw new Error('Subclass must implement destroy()');
  }
}
