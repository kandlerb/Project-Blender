/**
 * Game actions - use these instead of raw key codes
 */
export const ACTIONS = Object.freeze({
  // Movement
  MOVE_LEFT: 'move_left',
  MOVE_RIGHT: 'move_right',
  JUMP: 'jump',
  CROUCH: 'crouch',

  // Combat
  ATTACK_LIGHT: 'attack_light',
  ATTACK_HEAVY: 'attack_heavy',
  SPIN: 'spin',
  SPECIAL: 'special',

  // Movement Abilities
  FLIP: 'flip',
  BLINK: 'blink',
  GRAPPLE: 'grapple',

  // Weapons
  WEAPON_SWAP: 'weapon_swap',
  WEAPON_1: 'weapon_1',
  WEAPON_2: 'weapon_2',
  WEAPON_3: 'weapon_3',
  WEAPON_4: 'weapon_4',

  // System
  PAUSE: 'pause',
  MAP: 'map',
  INTERACT: 'interact',
});

/**
 * Default keyboard bindings
 * Each action maps to an array of Phaser key codes
 */
const DEFAULT_BINDINGS = {
  [ACTIONS.MOVE_LEFT]: ['A', 'LEFT'],
  [ACTIONS.MOVE_RIGHT]: ['D', 'RIGHT'],
  [ACTIONS.JUMP]: ['SPACE', 'W', 'UP'],
  [ACTIONS.CROUCH]: ['S', 'DOWN'],
  [ACTIONS.ATTACK_LIGHT]: ['J'],
  [ACTIONS.ATTACK_HEAVY]: ['K'],
  [ACTIONS.SPIN]: ['L'],
  [ACTIONS.SPECIAL]: ['O'],
  [ACTIONS.FLIP]: ['SHIFT'],
  [ACTIONS.BLINK]: ['I'],
  [ACTIONS.GRAPPLE]: ['U'],
  [ACTIONS.WEAPON_SWAP]: ['TAB'],
  [ACTIONS.WEAPON_1]: ['ONE'],
  [ACTIONS.WEAPON_2]: ['TWO'],
  [ACTIONS.WEAPON_3]: ['THREE'],
  [ACTIONS.WEAPON_4]: ['FOUR'],
  [ACTIONS.PAUSE]: ['ESC', 'P'],
  [ACTIONS.MAP]: ['M'],
  [ACTIONS.INTERACT]: ['E'],
};

/**
 * InputManager - Handles all game input with buffering support
 */
export class InputManager {
  /**
   * @param {Phaser.Scene} scene - The scene this manager belongs to
   */
  constructor(scene) {
    this.scene = scene;
    this.keys = {};
    this.buffer = [];
    this.bindings = { ...DEFAULT_BINDINGS };

    this.setupKeys();
  }

  /**
   * Create Phaser key objects for all bindings
   */
  setupKeys() {
    for (const action in this.bindings) {
      const keyCodes = this.bindings[action];
      this.keys[action] = keyCodes.map(code =>
        this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[code])
      );
    }
  }

  /**
   * Check if any key for an action is currently held down
   * @param {string} action - Action from ACTIONS enum
   * @returns {boolean}
   */
  isDown(action) {
    const keys = this.keys[action];
    if (!keys) return false;
    return keys.some(key => key.isDown);
  }

  /**
   * Check if all keys for an action are currently up
   * @param {string} action - Action from ACTIONS enum
   * @returns {boolean}
   */
  isUp(action) {
    return !this.isDown(action);
  }

  /**
   * Check if action was just pressed this frame
   * @param {string} action - Action from ACTIONS enum
   * @returns {boolean}
   */
  justPressed(action) {
    const keys = this.keys[action];
    if (!keys) return false;
    return keys.some(key => Phaser.Input.Keyboard.JustDown(key));
  }

  /**
   * Check if action was just released this frame
   * @param {string} action - Action from ACTIONS enum
   * @returns {boolean}
   */
  justReleased(action) {
    const keys = this.keys[action];
    if (!keys) return false;
    return keys.some(key => Phaser.Input.Keyboard.JustUp(key));
  }

  /**
   * Add an action to the input buffer
   * @param {string} action - Action to buffer
   * @param {number} time - Current game time
   */
  bufferAction(action, time) {
    this.buffer.push({
      action,
      timestamp: time,
    });
  }

  /**
   * Check if an action is in the buffer and consume it if found
   * @param {string} action - Action to check for
   * @param {number} currentTime - Current game time
   * @param {number} windowMs - How far back to check (default 100ms)
   * @returns {boolean} - True if action was buffered and consumed
   */
  consumeBuffered(action, currentTime, windowMs = 100) {
    const index = this.buffer.findIndex(entry =>
      entry.action === action &&
      (currentTime - entry.timestamp) <= windowMs
    );

    if (index !== -1) {
      this.buffer.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Check if action is buffered without consuming it
   * @param {string} action
   * @param {number} currentTime
   * @param {number} windowMs
   * @returns {boolean}
   */
  isBuffered(action, currentTime, windowMs = 100) {
    return this.buffer.some(entry =>
      entry.action === action &&
      (currentTime - entry.timestamp) <= windowMs
    );
  }

  /**
   * Get horizontal movement axis (-1, 0, or 1)
   * @returns {number}
   */
  getHorizontalAxis() {
    const left = this.isDown(ACTIONS.MOVE_LEFT) ? -1 : 0;
    const right = this.isDown(ACTIONS.MOVE_RIGHT) ? 1 : 0;
    return left + right;
  }

  /**
   * Get vertical movement axis (-1, 0, or 1)
   * -1 = up, 1 = down
   * @returns {number}
   */
  getVerticalAxis() {
    const up = this.isDown(ACTIONS.JUMP) ? -1 : 0;
    const down = this.isDown(ACTIONS.CROUCH) ? 1 : 0;
    return up + down;
  }

  /**
   * Update - call each frame to clean expired buffer entries
   * @param {number} time - Current game time
   * @param {number} maxAge - Max age of buffer entries in ms (default 200)
   */
  update(time, maxAge = 200) {
    // Remove expired buffer entries
    this.buffer = this.buffer.filter(entry =>
      (time - entry.timestamp) <= maxAge
    );
  }

  /**
   * Clear all buffered inputs
   */
  clearBuffer() {
    this.buffer = [];
  }

  /**
   * Clean up when scene is destroyed
   */
  destroy() {
    this.buffer = [];
    this.keys = {};
  }
}
