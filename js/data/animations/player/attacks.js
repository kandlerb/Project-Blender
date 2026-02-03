import { Pose, Animation } from '../../../skeleton/poses/index.js';

/**
 * Player Attack Animations
 * Light combo (3 hits), heavy attack, air attack, spin attack
 */

// ============================================
// LIGHT ATTACK 1 - Quick horizontal slash
// ============================================
const light1Windup = new Pose({
  id: 'light1_windup',
  boneAngles: {
    torso: -15,       // Wind up, rotate back
    neck: 5,
    head: 10,
    upperArmR: -120,  // Arm pulled back (weapon arm)
    lowerArmR: -60,
    handR: -20,
    upperArmL: 30,    // Off-hand forward for balance
    lowerArmL: 20,
    handL: 0,
  },
  events: []
});

const light1Swing = new Pose({
  id: 'light1_swing',
  boneAngles: {
    torso: 20,        // Rotate into swing
    neck: -5,
    head: -5,
    upperArmR: 60,    // Arm swings across
    lowerArmR: 20,
    handR: 30,
    upperArmL: -20,   // Off-hand pulls back
    lowerArmL: 30,
    handL: 0,
  },
  events: [
    { type: 'hitbox_on', data: { attack: 'light1' } }
  ]
});

const light1Follow = new Pose({
  id: 'light1_follow',
  boneAngles: {
    torso: 25,        // Follow through
    neck: -5,
    head: -10,
    upperArmR: 100,   // Arm continues past
    lowerArmR: 10,
    handR: 20,
    upperArmL: -30,
    lowerArmL: 35,
    handL: 0,
  },
  events: [
    { type: 'hitbox_off', data: {} }
  ]
});

const light1Recover = new Pose({
  id: 'light1_recover',
  boneAngles: {
    torso: 5,
    neck: 0,
    head: 0,
    upperArmR: -25,
    lowerArmR: -15,
    handR: 0,
    upperArmL: 25,
    lowerArmL: 15,
    handL: 0,
  },
  events: []
});

export const lightAttack1Animation = new Animation({
  id: 'attack_light_1',
  loop: false,
  keyframes: [
    { time: 0, pose: light1Windup, easing: 'easeOut' },
    { time: 80, pose: light1Swing, easing: 'linear' },      // Hitbox ON
    { time: 160, pose: light1Follow, easing: 'easeOut' },   // Hitbox OFF
    { time: 280, pose: light1Recover, easing: 'easeOut' },
  ]
});

// ============================================
// LIGHT ATTACK 2 - Reverse slash
// ============================================
const light2Windup = new Pose({
  id: 'light2_windup',
  boneAngles: {
    torso: 25,        // Already rotated from light1, wind opposite
    neck: -5,
    head: -5,
    upperArmR: 90,    // Arm on far side
    lowerArmR: 30,
    handR: 10,
    upperArmL: -40,
    lowerArmL: 25,
    handL: 0,
  }
});

const light2Swing = new Pose({
  id: 'light2_swing',
  boneAngles: {
    torso: -20,       // Rotate back the other way
    neck: 5,
    head: 5,
    upperArmR: -80,   // Backhand swing
    lowerArmR: -40,
    handR: -30,
    upperArmL: 40,
    lowerArmL: 15,
    handL: 0,
  },
  events: [
    { type: 'hitbox_on', data: { attack: 'light2' } }
  ]
});

const light2Follow = new Pose({
  id: 'light2_follow',
  boneAngles: {
    torso: -25,
    neck: 10,
    head: 10,
    upperArmR: -110,
    lowerArmR: -50,
    handR: -20,
    upperArmL: 50,
    lowerArmL: 10,
    handL: 0,
  },
  events: [
    { type: 'hitbox_off', data: {} }
  ]
});

export const lightAttack2Animation = new Animation({
  id: 'attack_light_2',
  loop: false,
  keyframes: [
    { time: 0, pose: light2Windup, easing: 'easeOut' },
    { time: 80, pose: light2Swing, easing: 'linear' },
    { time: 160, pose: light2Follow, easing: 'easeOut' },
    { time: 280, pose: light1Recover, easing: 'easeOut' },  // Reuse recover
  ]
});

// ============================================
// LIGHT ATTACK 3 - Downward finisher
// ============================================
const light3Windup = new Pose({
  id: 'light3_windup',
  boneAngles: {
    torso: -10,
    neck: -10,
    head: -20,        // Look up at raised arm
    upperArmR: -160,  // Arm raised high
    lowerArmR: -30,
    handR: -10,
    upperArmL: 20,
    lowerArmL: 40,
    handL: 0,
    thighL: 10,       // Slight stance adjustment
    thighR: -10,
  }
});

const light3Swing = new Pose({
  id: 'light3_swing',
  boneAngles: {
    torso: 30,        // Lean into strike
    neck: 10,
    head: 15,
    upperArmR: 80,    // Arm swings down
    lowerArmR: 40,
    handR: 30,
    upperArmL: -20,
    lowerArmL: 30,
    handL: 0,
    thighL: 20,
    shinL: -20,
    thighR: -20,
    shinR: 20,
  },
  events: [
    { type: 'hitbox_on', data: { attack: 'light3' } }
  ]
});

const light3Impact = new Pose({
  id: 'light3_impact',
  boneAngles: {
    torso: 35,
    neck: 15,
    head: 20,
    upperArmR: 120,   // Arm follows through down
    lowerArmR: 20,
    handR: 40,
    upperArmL: -30,
    lowerArmL: 35,
    handL: 0,
    thighL: 30,
    shinL: -40,
    thighR: -30,
    shinR: 40,
  },
  events: [
    { type: 'hitbox_off', data: {} }
  ]
});

export const lightAttack3Animation = new Animation({
  id: 'attack_light_3',
  loop: false,
  keyframes: [
    { time: 0, pose: light3Windup, easing: 'easeOut' },
    { time: 120, pose: light3Swing, easing: 'linear' },
    { time: 200, pose: light3Impact, easing: 'easeOut' },
    { time: 400, pose: light1Recover, easing: 'easeOut' },
  ]
});

// ============================================
// HEAVY ATTACK - Powerful overhead
// ============================================
const heavyWindup = new Pose({
  id: 'heavy_windup',
  boneAngles: {
    torso: -20,
    neck: -15,
    head: -30,
    upperArmR: -170,  // Arm way back
    lowerArmR: -20,
    handR: 0,
    upperArmL: -150,  // Both arms for two-handed feel
    lowerArmL: -30,
    handL: 0,
    thighL: 15,
    shinL: -30,
    thighR: -15,
    shinR: 30,
  }
});

const heavySwing = new Pose({
  id: 'heavy_swing',
  boneAngles: {
    torso: 40,
    neck: 20,
    head: 25,
    upperArmR: 90,
    lowerArmR: 30,
    handR: 40,
    upperArmL: 70,
    lowerArmL: 40,
    handL: 30,
    thighL: 35,
    shinL: -50,
    thighR: -35,
    shinR: 50,
  },
  events: [
    { type: 'hitbox_on', data: { attack: 'heavy' } }
  ]
});

const heavyImpact = new Pose({
  id: 'heavy_impact',
  boneAngles: {
    torso: 50,
    neck: 25,
    head: 30,
    upperArmR: 130,
    lowerArmR: 15,
    handR: 50,
    upperArmL: 110,
    lowerArmL: 25,
    handL: 40,
    thighL: 45,
    shinL: -60,
    thighR: -45,
    shinR: 60,
  },
  events: [
    { type: 'hitbox_off', data: {} }
  ]
});

export const heavyAttackAnimation = new Animation({
  id: 'attack_heavy',
  loop: false,
  keyframes: [
    { time: 0, pose: heavyWindup, easing: 'easeOut' },
    { time: 250, pose: heavySwing, easing: 'easeIn' },
    { time: 350, pose: heavyImpact, easing: 'easeOut' },
    { time: 600, pose: light1Recover, easing: 'easeOut' },
  ]
});

// ============================================
// AIR ATTACK - Aerial slash
// ============================================
const airWindup = new Pose({
  id: 'air_windup',
  boneAngles: {
    torso: -10,
    neck: 0,
    head: -10,
    upperArmR: -100,
    lowerArmR: -50,
    handR: -10,
    upperArmL: 60,
    lowerArmL: 30,
    handL: 0,
    thighL: 30,       // Legs tucked
    shinL: -50,
    thighR: -30,
    shinR: 50,
  }
});

const airSwing = new Pose({
  id: 'air_swing',
  boneAngles: {
    torso: 15,
    neck: 5,
    head: 5,
    upperArmR: 80,
    lowerArmR: 20,
    handR: 30,
    upperArmL: -40,
    lowerArmL: 40,
    handL: 0,
    thighL: 45,
    shinL: -30,
    thighR: -45,
    shinR: 30,
  },
  events: [
    { type: 'hitbox_on', data: { attack: 'air' } }
  ]
});

const airFollow = new Pose({
  id: 'air_follow',
  boneAngles: {
    torso: 20,
    neck: 10,
    head: 10,
    upperArmR: 110,
    lowerArmR: 10,
    handR: 20,
    upperArmL: -50,
    lowerArmL: 35,
    handL: 0,
    thighL: 35,
    shinL: -20,
    thighR: -35,
    shinR: 20,
  },
  events: [
    { type: 'hitbox_off', data: {} }
  ]
});

export const airAttackAnimation = new Animation({
  id: 'attack_air',
  loop: false,
  keyframes: [
    { time: 0, pose: airWindup, easing: 'easeOut' },
    { time: 100, pose: airSwing, easing: 'linear' },
    { time: 180, pose: airFollow, easing: 'easeOut' },
    { time: 300, pose: airFollow, easing: 'linear' },  // Hold in air
  ]
});

// ============================================
// SPIN ATTACK - 360 spin slash
// ============================================
const spinStart = new Pose({
  id: 'spin_start',
  boneAngles: {
    torso: -30,
    neck: -10,
    head: -15,
    upperArmR: -90,
    lowerArmR: -30,
    handR: 0,
    upperArmL: -70,
    lowerArmL: -40,
    handL: 0,
    thighL: 10,
    shinL: -15,
    thighR: -10,
    shinR: 15,
  }
});

const spinMid = new Pose({
  id: 'spin_mid',
  boneAngles: {
    torso: 0,
    neck: 0,
    head: 0,
    upperArmR: 0,     // Arms out for spin
    lowerArmR: 0,
    handR: 0,
    upperArmL: 0,
    lowerArmL: 0,
    handL: 0,
    thighL: 5,
    shinL: 0,
    thighR: -5,
    shinR: 0,
  },
  events: [
    { type: 'hitbox_on', data: { attack: 'spin' } }
  ]
});

const spinEnd = new Pose({
  id: 'spin_end',
  boneAngles: {
    torso: 30,
    neck: 10,
    head: 15,
    upperArmR: 90,
    lowerArmR: 30,
    handR: 0,
    upperArmL: 70,
    lowerArmL: 40,
    handL: 0,
    thighL: 10,
    shinL: -15,
    thighR: -10,
    shinR: 15,
  },
  events: [
    { type: 'hitbox_off', data: {} }
  ]
});

export const spinAttackAnimation = new Animation({
  id: 'attack_spin',
  loop: false,
  keyframes: [
    { time: 0, pose: spinStart, easing: 'easeIn' },
    { time: 150, pose: spinMid, easing: 'linear' },
    { time: 400, pose: spinEnd, easing: 'easeOut' },
    { time: 550, pose: light1Recover, easing: 'easeOut' },
  ]
});

// ============================================
// Export all attack animations
// ============================================
export const PlayerAttackAnimations = {
  light1: lightAttack1Animation,
  light2: lightAttack2Animation,
  light3: lightAttack3Animation,
  heavy: heavyAttackAnimation,
  air: airAttackAnimation,
  spin: spinAttackAnimation,
};
