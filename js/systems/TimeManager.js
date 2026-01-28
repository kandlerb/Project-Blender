/**
 * TimeManager - Handles hitstop, slowmo, and time manipulation
 */
export class TimeManager {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.hitstopRemaining = 0;
    this.slowmoRemaining = 0;
    this.slowmoScale = 1;
    this.isPaused = false;
  }

  /**
   * Apply hitstop (brief freeze on impact)
   * @param {number} duration - Duration in ms
   */
  applyHitstop(duration) {
    this.hitstopRemaining = Math.max(this.hitstopRemaining, duration);
  }

  /**
   * Apply slow motion
   * @param {number} duration - Duration in ms
   * @param {number} scale - Time scale (0.1 = 10% speed)
   */
  applySlowmo(duration, scale = 0.3) {
    this.slowmoRemaining = duration;
    this.slowmoScale = scale;
  }

  /**
   * Check if game should be frozen (hitstop active)
   * @returns {boolean}
   */
  isFrozen() {
    return this.hitstopRemaining > 0;
  }

  /**
   * Get current time scale
   * @returns {number}
   */
  getTimeScale() {
    if (this.hitstopRemaining > 0) return 0;
    if (this.slowmoRemaining > 0) return this.slowmoScale;
    return 1;
  }

  /**
   * Get scaled delta time
   * @param {number} delta - Raw delta time
   * @returns {number} - Scaled delta time
   */
  getScaledDelta(delta) {
    return delta * this.getTimeScale();
  }

  /**
   * Update time effects
   * @param {number} delta - Raw frame delta in ms
   */
  update(delta) {
    // Hitstop counts down with real time (not scaled)
    if (this.hitstopRemaining > 0) {
      this.hitstopRemaining = Math.max(0, this.hitstopRemaining - delta);
    }

    // Slowmo counts down with real time
    if (this.slowmoRemaining > 0) {
      this.slowmoRemaining = Math.max(0, this.slowmoRemaining - delta);
      if (this.slowmoRemaining === 0) {
        this.slowmoScale = 1;
      }
    }
  }

  /**
   * Debug info
   * @returns {object}
   */
  getDebugInfo() {
    return {
      hitstop: Math.round(this.hitstopRemaining),
      slowmo: Math.round(this.slowmoRemaining),
      timeScale: this.getTimeScale().toFixed(2),
    };
  }
}
