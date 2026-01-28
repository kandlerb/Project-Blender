import { InputManager } from '../systems/InputManager.js';

/**
 * Base class for all gameplay scenes
 * Provides common functionality: input, camera setup, transitions
 */
export class BaseScene extends Phaser.Scene {
  constructor(key) {
    super(key);
    this.inputManager = null;
  }

  /**
   * Standard Phaser create - sets up common systems then calls onCreate
   */
  create() {
    // Initialize input system
    this.inputManager = new InputManager(this);

    // Setup camera defaults
    this.setupCamera();

    // Call subclass-specific setup
    this.onCreate();
  }

  /**
   * Standard Phaser update - updates systems then calls onUpdate
   * @param {number} time - Total elapsed time in ms
   * @param {number} delta - Time since last frame in ms
   */
  update(time, delta) {
    // Update input system (cleans buffer)
    if (this.inputManager) {
      this.inputManager.update(time);
    }

    // Call subclass-specific update
    this.onUpdate(time, delta);
  }

  /**
   * Override in subclasses for scene-specific setup
   */
  onCreate() {
    // Override me
  }

  /**
   * Override in subclasses for scene-specific update logic
   * @param {number} time
   * @param {number} delta
   */
  onUpdate(time, delta) {
    // Override me
  }

  /**
   * Setup default camera settings
   */
  setupCamera() {
    this.cameras.main.setBackgroundColor('#1a1a2e');
  }

  /**
   * Transition to another scene
   * @param {string} sceneKey
   * @param {object} data - Optional data to pass
   */
  transitionTo(sceneKey, data = {}) {
    if (this.inputManager) {
      this.inputManager.destroy();
    }
    this.scene.start(sceneKey, data);
  }

  /**
   * Clean up when scene shuts down
   */
  shutdown() {
    if (this.inputManager) {
      this.inputManager.destroy();
      this.inputManager = null;
    }
  }
}
