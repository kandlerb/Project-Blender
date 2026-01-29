import { Weapon, AttackData } from './Weapon.js';
import { registerWeapon } from './WeaponRegistry.js';

/**
 * Chain Whip - Zone control, crowd management
 * Long range sweeps, multi-pull grapple
 */
export const ChainWhipWeapon = new Weapon({
  id: 'chain_whip',
  name: 'Chain Whip',
  description: 'Extended range. Sweeping attacks. Control the battlefield.',

  trailColor: 0x888888,

  attacks: {
    light1: new AttackData({
      startupTime: 80,
      activeTime: 120,
      recoveryTime: 150,
      damage: 6,
      knockback: { x: 100, y: -10 },
      hitstun: 100,
      hitstop: 20,
      // Extended horizontal hitbox
      hitbox: { width: 100, height: 30, offsetX: 55, offsetY: 0 },
      canComboInto: ['light2', 'heavy'],
      cancelWindow: 0.6,
      meterGain: 2,
    }),

    light2: new AttackData({
      startupTime: 70,
      activeTime: 130,
      recoveryTime: 160,
      damage: 7,
      knockback: { x: 120, y: -30 },
      hitstun: 120,
      hitstop: 25,
      hitbox: { width: 110, height: 35, offsetX: 60, offsetY: -5 },
      canComboInto: ['light3', 'heavy'],
      cancelWindow: 0.55,
      meterGain: 2,
    }),

    light3: new AttackData({
      startupTime: 100,
      activeTime: 150,
      recoveryTime: 200,
      damage: 10,
      knockback: { x: 200, y: -80 },
      hitstun: 200,
      hitstop: 45,
      // Wide sweep
      hitbox: { width: 130, height: 50, offsetX: 65, offsetY: 0 },
      launches: false,
      canComboInto: [],
      cancelWindow: 0.5,
      meterGain: 4,
    }),

    heavy: new AttackData({
      startupTime: 180,
      activeTime: 140,
      recoveryTime: 280,
      damage: 18,
      knockback: { x: 300, y: -150 },
      hitstun: 350,
      hitstop: 75,
      // Overhead slam - tall hitbox
      hitbox: { width: 80, height: 80, offsetX: 50, offsetY: -30 },
      launches: true,
      canComboInto: [],
      cancelWindow: 0.4,
      meterGain: 7,
    }),

    air: new AttackData({
      startupTime: 60,
      activeTime: 140,
      recoveryTime: 160,
      damage: 9,
      knockback: { x: 80, y: 180 },
      hitstun: 180,
      hitstop: 40,
      // Downward sweep
      hitbox: { width: 100, height: 60, offsetX: 40, offsetY: 20 },
      canComboInto: [],
      cancelWindow: 0.55,
      meterGain: 3,
    }),

    spin: new AttackData({
      // Chain whip spin has massive range - hits both sides
      startupTime: 0,
      activeTime: 180,
      recoveryTime: 0,
      damage: 4,
      knockback: { x: 50, y: -10 },
      hitstun: 50,
      hitstop: 10,
      hitbox: { width: 80, height: 80, offsetX: 60, offsetY: 0 }, // Offset for dual hitbox
      meterGain: 1,
    }),

    special: new AttackData({
      // Spin release - wide horizontal sweep - hits both sides
      startupTime: 0,
      activeTime: 180,
      recoveryTime: 220,
      damage: 20,
      knockback: { x: 400, y: -100 },
      hitstun: 350,
      hitstop: 70,
      hitbox: { width: 100, height: 70, offsetX: 75, offsetY: 0 }, // Offset for dual hitbox
      launches: false,
      meterGain: 8,
    }),
  },

  movementMods: {
    flip: null,
    blink: null,
    spin: {
      // Bigger spin radius
      hitboxScale: 1.5,
    },
    dive: null,
    grapple: {
      // Chain whip can pull multiple enemies
      multiPull: true,
      maxTargets: 3,
      range: 500, // Extended grapple range
    },
  },

  mechanics: {
    // No special activation mechanic, just extended range
    extendedRange: true,
  },
});

registerWeapon(ChainWhipWeapon);

export default ChainWhipWeapon;
