/**
 * AnimationLayer - Single animation in the blend stack.
 * Manages playback state for one animation on specific bones.
 */
export class AnimationLayer {
  /**
   * Create a new AnimationLayer.
   * @param {Object} config - Layer configuration
   * @param {import('./Animation.js').Animation} config.animation - Animation to play
   * @param {string[]} [config.boneMask] - Bone IDs to affect, null = all bones
   * @param {number} [config.weight=1] - Blend weight (0-1)
   * @param {number} [config.speed=1] - Playback speed multiplier
   * @param {number} [config.startTime=0] - Initial playback time in ms
   * @param {Function} [config.onComplete] - Called when non-looping anim ends
   * @param {Function} [config.onLoop] - Called each loop
   * @param {Function} [config.onEvent] - Called for pose events
   */
  constructor(config) {
    if (!config.animation) {
      throw new Error('AnimationLayer requires an animation');
    }

    /** @type {import('./Animation.js').Animation} */
    this.animation = config.animation;

    /** @type {string[]|null} Bone IDs to affect, null = all */
    this.boneMask = config.boneMask || null;

    /** @type {Set<string>|null} Cached bone mask set for fast lookup */
    this._boneMaskSet = this.boneMask ? new Set(this.boneMask) : null;

    /** @type {number} Blend weight 0-1 */
    this.weight = Math.max(0, Math.min(1, config.weight ?? 1));

    /** @type {number} Playback speed multiplier */
    this.speed = config.speed ?? 1;

    /** @type {number} Current playback time in ms */
    this.time = config.startTime ?? 0;

    /** @type {boolean} Is this layer playing? */
    this.playing = true;

    /** @type {boolean} Has this layer completed (for non-looping anims)? */
    this.completed = false;

    /** @type {Function|null} */
    this.onComplete = config.onComplete || null;

    /** @type {Function|null} */
    this.onLoop = config.onLoop || null;

    /** @type {Function|null} */
    this.onEvent = config.onEvent || null;

    /** @type {string} Layer name for identification */
    this.name = config.name || 'default';
  }

  /**
   * Update playback time.
   * @param {number} deltaMs - Time elapsed since last update
   * @returns {Array} Events triggered this frame
   */
  update(deltaMs) {
    if (!this.playing || this.completed) {
      return [];
    }

    const prevTime = this.time;
    this.time += deltaMs * this.speed;

    const events = [];
    const duration = this.animation.duration;

    // Check for events in the time range
    if (this.onEvent) {
      const triggeredEvents = this.animation.getEventsInRange(prevTime, this.time);
      for (const event of triggeredEvents) {
        events.push(event);
        this.onEvent(event);
      }
    }

    // Handle animation completion/looping
    if (this.time >= duration) {
      if (this.animation.loop) {
        // Calculate how many loops occurred
        const loopsBefore = Math.floor(prevTime / duration);
        const loopsAfter = Math.floor(this.time / duration);
        const loopsThisFrame = loopsAfter - loopsBefore;

        // Wrap time
        this.time = this.time % duration;

        // Trigger loop callback for each loop
        if (this.onLoop && loopsThisFrame > 0) {
          for (let i = 0; i < loopsThisFrame; i++) {
            this.onLoop();
          }
        }
      } else {
        // Non-looping animation completed
        this.time = duration;
        this.completed = true;
        this.playing = false;

        if (this.onComplete) {
          this.onComplete();
        }
      }
    }

    return events;
  }

  /**
   * Get current interpolated pose.
   * @returns {import('./Pose.js').Pose}
   */
  getCurrentPose() {
    return this.animation.getPoseAtTime(this.time);
  }

  /**
   * Check if this layer affects a specific bone.
   * @param {string} boneId - The bone ID
   * @returns {boolean}
   */
  affectsBone(boneId) {
    if (!this._boneMaskSet) {
      return true; // No mask = affects all bones
    }
    return this._boneMaskSet.has(boneId);
  }

  /**
   * Pause playback.
   */
  pause() {
    this.playing = false;
  }

  /**
   * Resume playback.
   */
  resume() {
    if (!this.completed) {
      this.playing = true;
    }
  }

  /**
   * Reset to start.
   */
  reset() {
    this.time = 0;
    this.completed = false;
    this.playing = true;
  }

  /**
   * Set blend weight.
   * @param {number} weight - Weight 0-1
   */
  setWeight(weight) {
    this.weight = Math.max(0, Math.min(1, weight));
  }

  /**
   * Set playback speed.
   * @param {number} speed - Speed multiplier
   */
  setSpeed(speed) {
    this.speed = speed;
  }

  /**
   * Check if animation is still playing.
   * @returns {boolean}
   */
  isPlaying() {
    return this.playing && !this.completed;
  }

  /**
   * Check if animation has completed.
   * @returns {boolean}
   */
  isCompleted() {
    return this.completed;
  }

  /**
   * Get current playback progress (0-1).
   * @returns {number}
   */
  getProgress() {
    if (this.animation.duration === 0) return 1;
    return this.time / this.animation.duration;
  }
}
