import { Skin } from './Skin.js';

/**
 * LineSkin - Renders a skeleton as simple lines between joints.
 * Classic stick figure visualization for debugging and simple aesthetics.
 */
export class LineSkin extends Skin {
  /** Default configuration values */
  static DEFAULTS = Object.freeze({
    lineWidth: 3,
    color: 0xffffff,
    jointRadius: 3,
    headRadius: 8,
    alpha: 1,
    showJoints: true
  });

  /**
   * Create a new LineSkin.
   * @param {import('../SkeletonInstance.js').SkeletonInstance} skeletonInstance - The skeleton to render
   * @param {Object} [config] - Configuration options
   * @param {number} [config.lineWidth=3] - Default line thickness
   * @param {number} [config.color=0xffffff] - Default color (hex)
   * @param {number} [config.jointRadius=3] - Radius of joint circles
   * @param {number} [config.headRadius=8] - Radius of head circle
   * @param {number} [config.alpha=1] - Default alpha transparency
   * @param {boolean} [config.showJoints=true] - Whether to draw joint circles
   * @param {Object} [config.boneStyles] - Per-bone style overrides
   */
  constructor(skeletonInstance, config = {}) {
    super(skeletonInstance);

    /** @type {Object} Merged configuration */
    this.config = {
      ...LineSkin.DEFAULTS,
      ...config,
      boneStyles: { ...config.boneStyles }
    };

    /** @type {Phaser.GameObjects.Graphics|null} */
    this.graphics = null;
  }

  /**
   * Initialize rendering resources.
   * @param {Phaser.Scene} scene - The Phaser scene to render in
   */
  initialize(scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(this.depth);
  }

  /**
   * Render the skeleton with its current pose.
   */
  render() {
    if (!this.graphics) {
      return;
    }

    // Clear previous frame
    this.graphics.clear();

    // Early exit if not visible
    if (!this.visible) {
      return;
    }

    const worldPositions = this.skeleton.worldPositions;
    const joints = [];

    // Draw bones as lines
    for (const [boneId, pos] of worldPositions) {
      const bone = this.skeleton.skeleton.getBone(boneId);

      // Skip zero-length bones (like pelvis) for line drawing
      if (bone.length === 0) {
        // Still track joint position
        joints.push({ x: pos.x, y: pos.y });
        continue;
      }

      // Get style for this bone
      const style = this.getBoneStyle(boneId);

      // Skip if explicitly hidden
      if (style.visible === false) {
        continue;
      }

      // Special handling for head - draw as circle at end, not line
      if (boneId === 'head') {
        this.drawHead(pos, style);
        continue;
      }

      // Draw the bone line
      this.graphics.lineStyle(style.lineWidth, style.color, style.alpha);
      this.graphics.beginPath();
      this.graphics.moveTo(pos.x, pos.y);
      this.graphics.lineTo(pos.endX, pos.endY);
      this.graphics.strokePath();

      // Track joint positions
      joints.push({ x: pos.x, y: pos.y });
    }

    // Draw joints on top of lines
    if (this.config.showJoints) {
      this.drawJoints(joints);
    }
  }

  /**
   * Render from a custom world positions map.
   * Used for ragdoll rendering where positions come from physics bodies.
   * @param {Map<string, {x: number, y: number, endX: number, endY: number, angle: number}>} worldPositions
   */
  renderFromPositions(worldPositions) {
    if (!this.graphics) {
      return;
    }

    // Clear previous frame
    this.graphics.clear();

    // Early exit if not visible
    if (!this.visible) {
      return;
    }

    const joints = [];

    // Draw bones as lines
    for (const [boneId, pos] of worldPositions) {
      const bone = this.skeleton.skeleton.getBone(boneId);
      if (!bone) continue;

      // Skip zero-length bones (like pelvis) for line drawing
      if (bone.length === 0) {
        // Still track joint position
        joints.push({ x: pos.x, y: pos.y });
        continue;
      }

      // Get style for this bone
      const style = this.getBoneStyle(boneId);

      // Skip if explicitly hidden
      if (style.visible === false) {
        continue;
      }

      // Special handling for head - draw as circle at end, not line
      if (boneId === 'head') {
        this.drawHead(pos, style);
        continue;
      }

      // Draw the bone line
      this.graphics.lineStyle(style.lineWidth, style.color, style.alpha);
      this.graphics.beginPath();
      this.graphics.moveTo(pos.x, pos.y);
      this.graphics.lineTo(pos.endX, pos.endY);
      this.graphics.strokePath();

      // Track joint positions
      joints.push({ x: pos.x, y: pos.y });
    }

    // Draw joints on top of lines
    if (this.config.showJoints) {
      this.drawJoints(joints);
    }
  }

  /**
   * Draw the head as a filled circle.
   * @param {Object} pos - World position of the head bone
   * @param {Object} style - Style settings for the head
   * @private
   */
  drawHead(pos, style) {
    const radius = style.headRadius ?? this.config.headRadius;

    // Draw outline
    this.graphics.lineStyle(style.lineWidth, style.color, style.alpha);
    this.graphics.strokeCircle(pos.endX, pos.endY, radius);

    // Draw filled circle
    this.graphics.fillStyle(style.color, style.alpha * 0.3);
    this.graphics.fillCircle(pos.endX, pos.endY, radius);
  }

  /**
   * Draw joint circles at bone connection points.
   * @param {Array<{x: number, y: number}>} joints - Joint positions
   * @private
   */
  drawJoints(joints) {
    const { jointRadius, color, alpha } = this.config;

    this.graphics.fillStyle(color, alpha);

    for (const joint of joints) {
      this.graphics.fillCircle(joint.x, joint.y, jointRadius);
    }
  }

  /**
   * Get the merged style for a specific bone.
   * @param {string} boneId - The bone ID
   * @returns {Object} Style settings
   * @private
   */
  getBoneStyle(boneId) {
    const boneStyle = this.config.boneStyles[boneId] || {};

    return {
      lineWidth: boneStyle.lineWidth ?? this.config.lineWidth,
      color: boneStyle.color ?? this.config.color,
      alpha: boneStyle.alpha ?? this.config.alpha,
      visible: boneStyle.visible,
      headRadius: boneStyle.headRadius
    };
  }

  /**
   * Update the default color.
   * @param {number} color - New color (hex)
   */
  setColor(color) {
    this.config.color = color;
  }

  /**
   * Update the default line width.
   * @param {number} width - New line width
   */
  setLineWidth(width) {
    this.config.lineWidth = width;
  }

  /**
   * Update the default alpha transparency.
   * @param {number} alpha - New alpha value (0-1)
   */
  setAlpha(alpha) {
    this.config.alpha = alpha;
  }

  /**
   * Set style override for a specific bone.
   * @param {string} boneId - The bone ID
   * @param {Object} style - Style settings to apply
   */
  setBoneStyle(boneId, style) {
    this.config.boneStyles[boneId] = {
      ...this.config.boneStyles[boneId],
      ...style
    };
  }

  /**
   * Set render depth.
   * @param {number} depth - Phaser render depth
   */
  setDepth(depth) {
    super.setDepth(depth);
    if (this.graphics) {
      this.graphics.setDepth(depth);
    }
  }

  /**
   * Set visibility of the skin.
   * @param {boolean} visible - Whether the skin should be visible
   */
  setVisible(visible) {
    super.setVisible(visible);
    if (!visible && this.graphics) {
      this.graphics.clear();
    }
  }

  /**
   * Clean up rendering resources.
   */
  destroy() {
    if (this.graphics) {
      this.graphics.destroy();
      this.graphics = null;
    }
    this.scene = null;
  }
}
