import { Weapon, AttackData } from './Weapon.js';
import { registerWeapon } from './WeaponRegistry.js';

/**
 * Fists - The starting weapon
 * Fast rushdown with rapid combos and launcher uppercut
 */
export const FistsWeapon = new Weapon({
  id: 'fists',
  name: 'Fists',
  description: 'Your bare hands. Fast combos, constant pressure.',

  trailColor: 0xffffff,

  attacks: {
    light1: new AttackData({
      startupTime: 60,
      activeTime: 80,
      recoveryTime: 120,
      damage: 8,
      knockback: { x: 150, y: -30 },
      hitstun: 150,
      hitstop: 30,
      hitbox: { width: 45, height: 35, offsetX: 30, offsetY: 0 },
      canComboInto: ['light2', 'heavy'],
      cancelWindow: 0.7,
      meterGain: 2,
    }),

    light2: new AttackData({
      startupTime: 50,
      activeTime: 80,
      recoveryTime: 130,
      damage: 10,
      knockback: { x: 180, y: -50 },
      hitstun: 180,
      hitstop: 40,
      hitbox: { width: 50, height: 38, offsetX: 32, offsetY: 0 },
      canComboInto: ['light3', 'heavy'],
      cancelWindow: 0.65,
      meterGain: 3,
    }),

    light3: new AttackData({
      startupTime: 80,
      activeTime: 100,
      recoveryTime: 200,
      damage: 15,
      knockback: { x: 350, y: -150 },
      hitstun: 300,
      hitstop: 70,
      hitbox: { width: 55, height: 45, offsetX: 35, offsetY: -5 },
      launches: true,
      canComboInto: [],
      cancelWindow: 0.5,
      meterGain: 5,
    }),

    heavy: new AttackData({
      startupTime: 150,
      activeTime: 100,
      recoveryTime: 250,
      damage: 25,
      knockback: { x: 200, y: -300 },
      hitstun: 400,
      hitstop: 90,
      hitbox: { width: 50, height: 55, offsetX: 30, offsetY: -10 },
      launches: true,
      canComboInto: [],
      cancelWindow: 0.4,
      meterGain: 8,
    }),

    air: new AttackData({
      startupTime: 50,
      activeTime: 100,
      recoveryTime: 150,
      damage: 12,
      knockback: { x: 100, y: 150 },
      hitstun: 200,
      hitstop: 50,
      hitbox: { width: 45, height: 50, offsetX: 25, offsetY: 10 },
      canComboInto: [],
      cancelWindow: 0.6,
      meterGain: 4,
    }),

    spin: new AttackData({
      // Spin active tick damage - hits both sides
      startupTime: 0,
      activeTime: 150, // Per tick
      recoveryTime: 0,
      damage: 5,
      knockback: { x: 80, y: -30 },
      hitstun: 80,
      hitstop: 15,
      hitbox: { width: 55, height: 55, offsetX: 40, offsetY: 0 }, // Offset for dual hitbox
      meterGain: 1,
    }),

    special: new AttackData({
      // Spin release/finisher - hits both sides
      startupTime: 0,
      activeTime: 150,
      recoveryTime: 200,
      damage: 25,
      knockback: { x: 350, y: -300 },
      hitstun: 400,
      hitstop: 80,
      hitbox: { width: 70, height: 70, offsetX: 50, offsetY: 0 }, // Offset for dual hitbox
      launches: true,
      meterGain: 10,
    }),
  },

  // Fists use default movement (no modifications)
  movementMods: {
    flip: null,
    blink: null,
    spin: null,
    dive: null,
  },

  mechanics: {
    // Fists have no special mechanics
  },
});

// Register weapon
registerWeapon(FistsWeapon);

export default FistsWeapon;
