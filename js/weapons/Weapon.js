/**
 * Base Weapon class
 * Defines attack data and movement modifiers for a weapon type
 */
export class Weapon {
  constructor(config) {
    // Identity
    this.id = config.id;
    this.name = config.name;
    this.description = config.description || '';
    this.icon = config.icon || null;

    // Attack data
    this.attacks = {
      light1: config.attacks?.light1 || null,
      light2: config.attacks?.light2 || null,
      light3: config.attacks?.light3 || null,
      heavy: config.attacks?.heavy || null,
      air: config.attacks?.air || null,
      spin: config.attacks?.spin || null,
      special: config.attacks?.special || null,
    };

    // Movement modifiers (optional overrides)
    this.movementMods = {
      flip: config.movementMods?.flip || null,
      blink: config.movementMods?.blink || null,
      spin: config.movementMods?.spin || null,
      dive: config.movementMods?.dive || null,
    };

    // Weapon-specific mechanics
    this.mechanics = config.mechanics || {};

    // Visual
    this.trailColor = config.trailColor || 0xffffff;
  }

  /**
   * Get attack data for a specific attack type
   * @param {string} attackType - 'light1', 'light2', 'light3', 'heavy', 'air', 'spin', 'special'
   * @returns {AttackData|null}
   */
  getAttack(attackType) {
    return this.attacks[attackType] || null;
  }

  /**
   * Check if weapon has a movement modifier
   * @param {string} moveType - 'flip', 'blink', 'spin', 'dive'
   * @returns {boolean}
   */
  hasMovementMod(moveType) {
    return this.movementMods[moveType] !== null;
  }

  /**
   * Get movement modifier data
   * @param {string} moveType
   * @returns {object|null}
   */
  getMovementMod(moveType) {
    return this.movementMods[moveType];
  }

  /**
   * Called when weapon is equipped
   * @param {Player} player
   */
  onEquip(player) {
    // Override in subclasses for special behavior
  }

  /**
   * Called when weapon is unequipped
   * @param {Player} player
   */
  onUnequip(player) {
    // Override in subclasses for special behavior
  }

  /**
   * Called each frame while equipped
   * @param {Player} player
   * @param {number} time
   * @param {number} delta
   */
  update(player, time, delta) {
    // Override in subclasses for ongoing effects (bleed, etc.)
  }
}

/**
 * Attack data structure
 */
export class AttackData {
  constructor(config) {
    // Timing (in ms)
    this.startupTime = config.startupTime || 100;
    this.activeTime = config.activeTime || 100;
    this.recoveryTime = config.recoveryTime || 150;

    // Damage
    this.damage = config.damage || 10;
    this.knockback = config.knockback || { x: 200, y: -50 };
    this.hitstun = config.hitstun || 150;
    this.hitstop = config.hitstop || 40;

    // Hitbox
    this.hitbox = {
      width: config.hitbox?.width || 50,
      height: config.hitbox?.height || 40,
      offsetX: config.hitbox?.offsetX || 35,
      offsetY: config.hitbox?.offsetY || 0,
    };

    // Properties
    this.launches = config.launches || false;
    this.canComboInto = config.canComboInto || []; // Which attacks can follow
    this.cancelWindow = config.cancelWindow || 0.6; // % of recovery that's cancelable

    // Effects
    this.sfx = config.sfx || null;
    this.vfx = config.vfx || null;

    // Ultimate meter gain
    this.meterGain = config.meterGain || 5;
  }
}
