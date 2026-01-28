/**
 * Frame/timing conversion utilities
 */
export const TIMING = Object.freeze({
  /**
   * Convert frames (at 60fps) to milliseconds
   * @param {number} frames
   * @returns {number} milliseconds
   */
  framesToMs: (frames) => frames * (1000 / 60),

  /**
   * Convert milliseconds to frames (at 60fps)
   * @param {number} ms
   * @returns {number} frames (rounded)
   */
  msToFrames: (ms) => Math.round(ms / (1000 / 60)),

  /**
   * Check if a duration has elapsed
   * @param {number} startTime - timestamp when period started
   * @param {number} duration - duration in ms
   * @param {number} currentTime - current timestamp
   * @returns {boolean}
   */
  hasElapsed: (startTime, duration, currentTime) => {
    return (currentTime - startTime) >= duration;
  },
});
