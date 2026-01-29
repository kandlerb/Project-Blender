import { Weapon, AttackData } from './Weapon.js';
import { registerWeapon } from './WeaponRegistry.js';

/**
 * Tonfas - Defensive counter-fighter
 * Special: Parry (block with counter window on perfect timing)
 */
export const TonfasWeapon = new Weapon({
  id: 'tonfas',
  name: 'Tonfas',
  description: 'Defensive parry weapon. Block attacks and counter with precision.',

  trailColor: 0x88aaff,

  attacks: {
    light1: new AttackData({
      startupTime: 50,
      activeTime: 70,
      recoveryTime: 100,
      damage: 7,
      knockback: { x: 120, y: -20 },
      hitstun: 120,
      hitstop: 25,
      hitbox: { width: 40, height: 30, offsetX: 28, offsetY: 0 },
      canComboInto: ['light2', 'heavy'],
      cancelWindow: 0.75,
      meterGain: 2,
    }),

    light2: new AttackData({
      startupTime: 45,
      activeTime: 70,
      recoveryTime: 110,
      damage: 8,
      knockback: { x: 140, y: -40 },
      hitstun: 140,
      hitstop: 30,
      hitbox: { width: 42, height: 32, offsetX: 30, offsetY: 0 },
      canComboInto: ['light3', 'heavy'],
      cancelWindow: 0.7,
      meterGain: 2,
    }),

    light3: new AttackData({
      startupTime: 60,
      activeTime: 90,
      recoveryTime: 160,
      damage: 12,
      knockback: { x: 280, y: -120 },
      hitstun: 250,
      hitstop: 55,
      hitbox: { width: 48, height: 40, offsetX: 32, offsetY: -5 },
      launches: false, // Tonfas don't launch, they stagger
      canComboInto: [],
      cancelWindow: 0.5,
      meterGain: 4,
    }),

    heavy: new AttackData({
      startupTime: 120,
      activeTime: 80,
      recoveryTime: 200,
      damage: 20,
      knockback: { x: 250, y: -100 },
      hitstun: 350,
      hitstop: 70,
      hitbox: { width: 45, height: 45, offsetX: 28, offsetY: -5 },
      launches: false,
      canComboInto: [],
      cancelWindow: 0.45,
      meterGain: 6,
    }),

    air: new AttackData({
      startupTime: 40,
      activeTime: 80,
      recoveryTime: 120,
      damage: 10,
      knockback: { x: 80, y: 120 },
      hitstun: 180,
      hitstop: 40,
      hitbox: { width: 40, height: 45, offsetX: 22, offsetY: 8 },
      canComboInto: [],
      cancelWindow: 0.6,
      meterGain: 3,
    }),

    spin: new AttackData({
      // Tonfas spin is faster but weaker per hit - hits both sides
      startupTime: 0,
      activeTime: 100, // Faster ticks
      recoveryTime: 0,
      damage: 4,
      knockback: { x: 60, y: -20 },
      hitstun: 60,
      hitstop: 10,
      hitbox: { width: 50, height: 50, offsetX: 38, offsetY: 0 }, // Offset for dual hitbox
      meterGain: 1,
    }),

    special: new AttackData({
      // Counter attack (after perfect parry) - hits both sides
      startupTime: 30, // Very fast
      activeTime: 100,
      recoveryTime: 150,
      damage: 35, // High counter damage
      knockback: { x: 400, y: -200 },
      hitstun: 450,
      hitstop: 100,
      hitbox: { width: 50, height: 50, offsetX: 40, offsetY: 0 }, // Offset for dual hitbox
      launches: true,
      meterGain: 15,
    }),
  },

  movementMods: {
    flip: null,
    blink: null,
    spin: {
      // Tonfas spin lasts longer
      maxDuration: 2500,
      speedMultiplier: 1.2,
    },
    dive: null,
  },

  mechanics: {
    // Parry mechanic data
    parry: {
      windowTime: 200,        // Total parry window
      perfectWindow: 80,      // Perfect parry window (first frames)
      blockReduction: 0.5,    // Damage reduction on normal block
      perfectReduction: 1.0,  // Full block on perfect
      counterWindowTime: 400, // Time to input counter after perfect parry
      stunOnParry: 200,       // Stun applied to attacker on perfect parry
    },
  },
});

registerWeapon(TonfasWeapon);

export default TonfasWeapon;
