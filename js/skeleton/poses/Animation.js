import { Pose } from './Pose.js';

/**
 * Animation - A timed sequence of keyframes (poses) with interpolation.
 * Supports looping, easing functions, and event triggers.
 */
export class Animation {
  /**
   * Easing functions for smooth interpolation.
   * @type {Object<string, function(number): number>}
   */
  static EASING = Object.freeze({
    linear: t => t,
    easeIn: t => t * t,
    easeOut: t => t * (2 - t),
    easeInOut: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
  });

  /**
   * Create a new Animation.
   * @param {Object} config - Animation configuration
   * @param {string} config.id - Animation identifier
   * @param {Array<Object>} config.keyframes - Array of keyframes
   * @param {number} config.keyframes[].time - Time in ms from start
   * @param {Pose} config.keyframes[].pose - Pose at this keyframe
   * @param {string} [config.keyframes[].easing='linear'] - Easing function name
   * @param {number} [config.duration] - Total duration (computed if not provided)
   * @param {boolean} [config.loop=false] - Whether to loop
   */
  constructor(config) {
    if (!config.id) {
      throw new Error('Animation requires an id');
    }
    if (!config.keyframes || config.keyframes.length === 0) {
      throw new Error('Animation requires at least one keyframe');
    }

    /** @type {string} */
    this.id = config.id;

    /** @type {boolean} */
    this.loop = config.loop ?? false;

    /** @type {Array<{time: number, pose: Pose, easing: string}>} */
    this.keyframes = config.keyframes.map(kf => ({
      time: kf.time,
      pose: kf.pose,
      easing: kf.easing || 'linear'
    }));

    // Sort keyframes by time
    this.keyframes.sort((a, b) => a.time - b.time);

    // Compute or set duration
    if (config.duration !== undefined) {
      this.duration = config.duration;
    } else {
      // Use the last keyframe's time as duration
      this.duration = this.keyframes[this.keyframes.length - 1].time;
    }
  }

  /**
   * Get interpolated pose at a given time.
   * @param {number} timeMs - Time in milliseconds
   * @returns {Pose} Interpolated pose
   */
  getPoseAtTime(timeMs) {
    // Handle looping
    if (this.loop && this.duration > 0) {
      timeMs = timeMs % this.duration;
    }

    // Clamp to valid range
    timeMs = Math.max(0, Math.min(timeMs, this.duration));

    // Handle edge cases
    if (this.keyframes.length === 1) {
      return this.keyframes[0].pose.clone();
    }

    // Find surrounding keyframes
    let prevIndex = 0;
    let nextIndex = 1;

    for (let i = 0; i < this.keyframes.length - 1; i++) {
      if (timeMs >= this.keyframes[i].time && timeMs <= this.keyframes[i + 1].time) {
        prevIndex = i;
        nextIndex = i + 1;
        break;
      }
    }

    // If at or past the last keyframe
    if (timeMs >= this.keyframes[this.keyframes.length - 1].time) {
      return this.keyframes[this.keyframes.length - 1].pose.clone();
    }

    const prevKf = this.keyframes[prevIndex];
    const nextKf = this.keyframes[nextIndex];

    // Calculate progress between keyframes
    const timeDiff = nextKf.time - prevKf.time;
    if (timeDiff === 0) {
      return prevKf.pose.clone();
    }

    let t = (timeMs - prevKf.time) / timeDiff;

    // Apply easing function
    const easingFn = Animation.EASING[prevKf.easing] || Animation.EASING.linear;
    t = easingFn(t);

    // Interpolate between poses
    return Pose.lerp(prevKf.pose, nextKf.pose, t);
  }

  /**
   * Get events that occur within a time range.
   * Useful for triggering hitboxes, sound effects, etc.
   * @param {number} startTime - Start time in ms
   * @param {number} endTime - End time in ms
   * @returns {Array<{time: number, type: string, data: any}>}
   */
  getEventsInRange(startTime, endTime) {
    const events = [];

    for (const keyframe of this.keyframes) {
      if (keyframe.time >= startTime && keyframe.time < endTime) {
        for (const event of keyframe.pose.events) {
          events.push({
            time: keyframe.time,
            type: event.type,
            data: event.data
          });
        }
      }
    }

    return events;
  }

  /**
   * Add a keyframe to the animation.
   * Maintains sorted order by time.
   * @param {number} time - Time in ms
   * @param {Pose} pose - Pose at this keyframe
   * @param {string} [easing='linear'] - Easing function name
   */
  addKeyframe(time, pose, easing = 'linear') {
    const keyframe = { time, pose, easing };

    // Find insertion point to maintain sorted order
    let insertIndex = this.keyframes.length;
    for (let i = 0; i < this.keyframes.length; i++) {
      if (this.keyframes[i].time > time) {
        insertIndex = i;
        break;
      }
    }

    this.keyframes.splice(insertIndex, 0, keyframe);

    // Update duration if needed
    if (time > this.duration) {
      this.duration = time;
    }
  }

  /**
   * Get the total number of keyframes.
   * @returns {number}
   */
  getKeyframeCount() {
    return this.keyframes.length;
  }

  /**
   * Check if this animation loops.
   * @returns {boolean}
   */
  isLooping() {
    return this.loop;
  }
}
