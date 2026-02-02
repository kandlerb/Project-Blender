import { Pose } from './Pose.js';
import { AnimationLayer } from './AnimationLayer.js';

/**
 * PoseBlender - Manages animation playback, transitions, and layering.
 * Computes final blended pose from multiple animation layers.
 */
export class PoseBlender {
  /**
   * Create a new PoseBlender.
   * @param {import('../SkeletonInstance.js').SkeletonInstance} skeletonInstance
   */
  constructor(skeletonInstance) {
    if (!skeletonInstance) {
      throw new Error('PoseBlender requires a SkeletonInstance');
    }

    /** @type {import('../SkeletonInstance.js').SkeletonInstance} */
    this.skeleton = skeletonInstance;

    /** @type {AnimationLayer[]} Ordered layers (later = higher priority) */
    this.layers = [];

    /** @type {Map<string, AnimationLayer>} Layer lookup by name */
    this._layersByName = new Map();

    /** @type {Array<Object>} Active transitions for smooth blending */
    this.transitions = [];

    /** @type {Pose|null} Default pose when no animations playing */
    this.basePose = null;
  }

  /**
   * Play an animation.
   * @param {import('./Animation.js').Animation} animation - Animation to play
   * @param {Object} [options] - Playback options
   * @param {string} [options.layer='default'] - Layer name
   * @param {string[]} [options.boneMask] - Bone IDs to affect
   * @param {number} [options.weight=1] - Blend weight
   * @param {number} [options.speed=1] - Playback speed
   * @param {number} [options.startTime=0] - Start time in ms
   * @param {number} [options.blendDuration=0] - Transition duration in ms
   * @param {Function} [options.onComplete] - Completion callback
   * @param {Function} [options.onLoop] - Loop callback
   * @param {Function} [options.onEvent] - Event callback
   * @returns {AnimationLayer} The created layer
   */
  playAnimation(animation, options = {}) {
    const layerName = options.layer || 'default';
    const blendDuration = options.blendDuration || 0;

    // Capture current pose if blending
    let fromPose = null;
    if (blendDuration > 0) {
      fromPose = this.computeBlendedPose();
    }

    // Remove existing layer with same name
    const existingLayer = this._layersByName.get(layerName);
    if (existingLayer) {
      this._removeLayer(existingLayer);
    }

    // Create new layer
    const layer = new AnimationLayer({
      animation,
      name: layerName,
      boneMask: options.boneMask || null,
      weight: options.weight ?? 1,
      speed: options.speed ?? 1,
      startTime: options.startTime ?? 0,
      onComplete: options.onComplete || null,
      onLoop: options.onLoop || null,
      onEvent: options.onEvent || null
    });

    // Add layer
    this.layers.push(layer);
    this._layersByName.set(layerName, layer);

    // Setup transition if blending
    if (blendDuration > 0 && fromPose) {
      this.transitions.push({
        fromPose,
        toLayerName: layerName,
        duration: blendDuration,
        elapsed: 0
      });
    }

    return layer;
  }

  /**
   * Stop animation on a named layer.
   * @param {string} layerName - Layer to stop
   * @param {number} [blendDuration=0] - Blend out duration in ms
   */
  stopAnimation(layerName, blendDuration = 0) {
    const layer = this._layersByName.get(layerName);
    if (!layer) return;

    if (blendDuration > 0) {
      // Fade out by reducing weight over time
      // For simplicity, we'll just remove instantly for now
      // A full implementation would track fadeout state
      this._removeLayer(layer);
    } else {
      this._removeLayer(layer);
    }
  }

  /**
   * Stop all animations.
   * @param {number} [blendDuration=0] - Blend out duration in ms
   */
  stopAllAnimations(blendDuration = 0) {
    if (blendDuration > 0) {
      // Would implement fadeout for each layer
      // For simplicity, instant stop
    }

    this.layers = [];
    this._layersByName.clear();
    this.transitions = [];
  }

  /**
   * Set weight for a named layer.
   * @param {string} layerName - Layer name
   * @param {number} weight - New weight (0-1)
   */
  setLayerWeight(layerName, weight) {
    const layer = this._layersByName.get(layerName);
    if (layer) {
      layer.setWeight(weight);
    }
  }

  /**
   * Get a layer by name.
   * @param {string} layerName - Layer name
   * @returns {AnimationLayer|undefined}
   */
  getLayer(layerName) {
    return this._layersByName.get(layerName);
  }

  /**
   * Check if a layer exists.
   * @param {string} layerName - Layer name
   * @returns {boolean}
   */
  hasLayer(layerName) {
    return this._layersByName.has(layerName);
  }

  /**
   * Update all layers and apply blended pose.
   * @param {number} deltaMs - Time elapsed since last update
   */
  update(deltaMs) {
    // Update transitions
    this._updateTransitions(deltaMs);

    // Update all layers
    for (const layer of this.layers) {
      layer.update(deltaMs);
    }

    // Remove completed non-looping layers
    this._cleanupCompletedLayers();

    // Compute and apply final pose
    const finalPose = this.computeBlendedPose();
    finalPose.applyTo(this.skeleton);
  }

  /**
   * Compute the final blended pose from all layers.
   * @returns {Pose}
   */
  computeBlendedPose() {
    // Start with base pose or empty pose
    const result = this.basePose ? this.basePose.clone() : new Pose();

    // Collect all bone IDs that need blending
    const allBoneIds = new Set();
    for (const layer of this.layers) {
      const layerPose = layer.getCurrentPose();
      for (const boneId of layerPose.boneAngles.keys()) {
        if (layer.affectsBone(boneId)) {
          allBoneIds.add(boneId);
        }
      }
    }

    // Process each layer in order (later layers override)
    for (const layer of this.layers) {
      const layerPose = layer.getCurrentPose();
      let effectiveWeight = layer.weight;

      // Check if this layer is in a transition
      const transition = this.transitions.find(t => t.toLayerName === layer.name);
      if (transition) {
        // During transition, blend from fromPose
        const t = Math.min(1, transition.elapsed / transition.duration);
        effectiveWeight = layer.weight * t;

        // Also blend in the fromPose contribution
        for (const [boneId, angle] of transition.fromPose.boneAngles) {
          if (layer.affectsBone(boneId)) {
            const currentAngle = result.getAngle(boneId);
            const fromWeight = (1 - t) * layer.weight;
            const blendedAngle = Pose.lerpAngle(currentAngle, angle, fromWeight);
            result.setAngle(boneId, blendedAngle);
          }
        }
      }

      // Blend layer pose
      for (const [boneId, angle] of layerPose.boneAngles) {
        if (!layer.affectsBone(boneId)) continue;

        const currentAngle = result.getAngle(boneId);
        const blendedAngle = Pose.lerpAngle(currentAngle, angle, effectiveWeight);
        result.setAngle(boneId, blendedAngle);
      }
    }

    return result;
  }

  /**
   * Update active transitions.
   * @param {number} deltaMs - Time elapsed
   * @private
   */
  _updateTransitions(deltaMs) {
    for (let i = this.transitions.length - 1; i >= 0; i--) {
      const transition = this.transitions[i];
      transition.elapsed += deltaMs;

      // Remove completed transitions
      if (transition.elapsed >= transition.duration) {
        this.transitions.splice(i, 1);
      }
    }
  }

  /**
   * Remove completed non-looping layers.
   * @private
   */
  _cleanupCompletedLayers() {
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];
      if (layer.isCompleted() && !layer.animation.loop) {
        // Keep completed layers for now - they may want the final pose
        // Could add auto-remove option if needed
      }
    }
  }

  /**
   * Remove a layer from the blender.
   * @param {AnimationLayer} layer - Layer to remove
   * @private
   */
  _removeLayer(layer) {
    const index = this.layers.indexOf(layer);
    if (index !== -1) {
      this.layers.splice(index, 1);
    }
    this._layersByName.delete(layer.name);

    // Also remove any transitions for this layer
    this.transitions = this.transitions.filter(t => t.toLayerName !== layer.name);
  }

  /**
   * Set the base/rest pose.
   * @param {Pose} pose - Base pose
   */
  setBasePose(pose) {
    this.basePose = pose;
  }

  /**
   * Get the number of active layers.
   * @returns {number}
   */
  getLayerCount() {
    return this.layers.length;
  }

  /**
   * Pause all layers.
   */
  pauseAll() {
    for (const layer of this.layers) {
      layer.pause();
    }
  }

  /**
   * Resume all layers.
   */
  resumeAll() {
    for (const layer of this.layers) {
      layer.resume();
    }
  }
}
