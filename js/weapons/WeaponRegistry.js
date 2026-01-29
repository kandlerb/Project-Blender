import { Weapon, AttackData } from './Weapon.js';

/**
 * Registry of all weapons in the game
 * Weapons are added here as they're implemented
 */
export const WEAPONS = {};

/**
 * Register a weapon in the registry
 * @param {Weapon} weapon
 */
export function registerWeapon(weapon) {
  WEAPONS[weapon.id] = weapon;
}

/**
 * Get a weapon by ID
 * @param {string} id
 * @returns {Weapon|null}
 */
export function getWeapon(id) {
  return WEAPONS[id] || null;
}

/**
 * Get all registered weapon IDs
 * @returns {string[]}
 */
export function getAllWeaponIds() {
  return Object.keys(WEAPONS);
}
