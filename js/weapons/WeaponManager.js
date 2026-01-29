import { WEAPONS } from './WeaponRegistry.js';

/**
 * Manages player's weapon inventory and equipped weapon
 */
export class WeaponManager {
  /**
   * @param {Player} player
   */
  constructor(player) {
    this.player = player;

    // Inventory of unlocked weapons (by id)
    this.unlockedWeapons = new Set(['fists']); // Start with fists

    // Currently equipped weapon
    this.equippedWeapon = null;

    // Quick swap slots (for controller/hotkey swapping)
    this.quickSlots = [null, null, null, null];

    // Swap state
    this.isSwapping = false;
    this.swapTime = 300; // ms to swap weapons
    this.swapTimer = 0;
    this.pendingWeapon = null;

    // Initialize with fists
    this.equipWeapon('fists');
  }

  /**
   * Unlock a weapon (usually from defeating a boss)
   * @param {string} weaponId
   */
  unlockWeapon(weaponId) {
    if (WEAPONS[weaponId]) {
      this.unlockedWeapons.add(weaponId);
      this.player.scene.events.emit('weapon:unlocked', {
        weaponId,
        weapon: WEAPONS[weaponId],
      });
      return true;
    }
    return false;
  }

  /**
   * Check if a weapon is unlocked
   * @param {string} weaponId
   * @returns {boolean}
   */
  hasWeapon(weaponId) {
    return this.unlockedWeapons.has(weaponId);
  }

  /**
   * Get list of unlocked weapons
   * @returns {string[]}
   */
  getUnlockedWeapons() {
    return Array.from(this.unlockedWeapons);
  }

  /**
   * Equip a weapon immediately (no swap animation)
   * @param {string} weaponId
   * @returns {boolean}
   */
  equipWeapon(weaponId) {
    if (!this.hasWeapon(weaponId)) {
      console.warn(`Weapon ${weaponId} not unlocked`);
      return false;
    }

    const newWeapon = WEAPONS[weaponId];
    if (!newWeapon) {
      console.warn(`Weapon ${weaponId} not found in registry`);
      return false;
    }

    // Unequip current weapon
    if (this.equippedWeapon) {
      this.equippedWeapon.onUnequip(this.player);
    }

    // Equip new weapon
    this.equippedWeapon = newWeapon;
    this.equippedWeapon.onEquip(this.player);

    this.player.scene.events.emit('weapon:equipped', {
      weaponId,
      weapon: newWeapon,
    });

    return true;
  }

  /**
   * Start weapon swap (with animation/delay)
   * @param {string} weaponId
   * @returns {boolean}
   */
  startSwap(weaponId) {
    if (this.isSwapping) return false;
    if (!this.hasWeapon(weaponId)) return false;
    if (this.equippedWeapon?.id === weaponId) return false;

    this.isSwapping = true;
    this.swapTimer = 0;
    this.pendingWeapon = weaponId;

    this.player.scene.events.emit('weapon:swapStart', {
      from: this.equippedWeapon?.id,
      to: weaponId,
    });

    return true;
  }

  /**
   * Update swap timer
   * @param {number} delta
   */
  update(delta) {
    if (this.isSwapping) {
      this.swapTimer += delta;

      if (this.swapTimer >= this.swapTime) {
        this.completeSwap();
      }
    }

    // Update equipped weapon
    if (this.equippedWeapon) {
      this.equippedWeapon.update(this.player, 0, delta);
    }
  }

  /**
   * Complete the weapon swap
   */
  completeSwap() {
    if (this.pendingWeapon) {
      this.equipWeapon(this.pendingWeapon);
    }

    this.isSwapping = false;
    this.swapTimer = 0;
    this.pendingWeapon = null;

    this.player.scene.events.emit('weapon:swapComplete', {
      weaponId: this.equippedWeapon?.id,
    });
  }

  /**
   * Cancel an in-progress swap
   */
  cancelSwap() {
    this.isSwapping = false;
    this.swapTimer = 0;
    this.pendingWeapon = null;
  }

  /**
   * Get current attack data for an attack type
   * @param {string} attackType
   * @returns {AttackData|null}
   */
  getAttack(attackType) {
    return this.equippedWeapon?.getAttack(attackType) || null;
  }

  /**
   * Get movement modifier for current weapon
   * @param {string} moveType
   * @returns {object|null}
   */
  getMovementMod(moveType) {
    return this.equippedWeapon?.getMovementMod(moveType) || null;
  }

  /**
   * Assign weapon to quick slot
   * @param {number} slot - 0-3
   * @param {string} weaponId
   */
  setQuickSlot(slot, weaponId) {
    if (slot >= 0 && slot < 4 && this.hasWeapon(weaponId)) {
      this.quickSlots[slot] = weaponId;
    }
  }

  /**
   * Swap to weapon in quick slot
   * @param {number} slot - 0-3
   * @returns {boolean}
   */
  swapToQuickSlot(slot) {
    const weaponId = this.quickSlots[slot];
    if (weaponId) {
      return this.startSwap(weaponId);
    }
    return false;
  }

  /**
   * Cycle to next unlocked weapon
   * @param {number} direction - 1 for next, -1 for previous
   * @returns {boolean} - True if swap started
   */
  cycleWeapon(direction = 1) {
    const weapons = this.getUnlockedWeapons();
    if (weapons.length <= 1) return false;

    const currentIndex = weapons.indexOf(this.equippedWeapon?.id);
    let nextIndex = (currentIndex + direction + weapons.length) % weapons.length;

    return this.startSwap(weapons[nextIndex]);
  }

  /**
   * Get current equipped weapon
   * @returns {Weapon|null}
   */
  getEquippedWeapon() {
    return this.equippedWeapon;
  }

  /**
   * Get swap progress (0-1)
   * @returns {number}
   */
  get swapProgress() {
    return this.swapTimer;
  }
}
