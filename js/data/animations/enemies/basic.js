import { Pose, Animation } from '../../../skeleton/poses/index.js';

/**
 * Basic Enemy Animations
 * Simple idle, patrol walk, and attack for standard enemies
 */

// ============================================
// IDLE - Slight sway
// ============================================
const enemyIdlePose1 = new Pose({
  id: 'enemy_idle_1',
  boneAngles: {
    torso: 0,
    neck: 0,
    head: 5,
    upperArmL: 30,
    lowerArmL: 20,
    handL: 0,
    upperArmR: -30,
    lowerArmR: -20,
    handR: 0,
    thighL: 5,
    shinL: 0,
    footL: 0,
    thighR: -5,
    shinR: 0,
    footR: 0,
  }
});

const enemyIdlePose2 = new Pose({
  id: 'enemy_idle_2',
  boneAngles: {
    torso: 3,
    neck: -2,
    head: 0,
    upperArmL: 32,
    lowerArmL: 22,
    handL: 0,
    upperArmR: -28,
    lowerArmR: -18,
    handR: 0,
    thighL: 5,
    shinL: 0,
    footL: 0,
    thighR: -5,
    shinR: 0,
    footR: 0,
  }
});

export const enemyIdleAnimation = new Animation({
  id: 'enemy_idle',
  loop: true,
  keyframes: [
    { time: 0, pose: enemyIdlePose1, easing: 'easeInOut' },
    { time: 800, pose: enemyIdlePose2, easing: 'easeInOut' },
    { time: 1600, pose: enemyIdlePose1, easing: 'easeInOut' },
  ]
});

// ============================================
// WALK - Slow patrol walk
// ============================================
const enemyWalkPose1 = new Pose({
  id: 'enemy_walk_1',
  boneAngles: {
    torso: 5,
    neck: 0,
    head: 0,
    upperArmL: 10,
    lowerArmL: 25,
    handL: 0,
    upperArmR: -40,
    lowerArmR: -15,
    handR: 0,
    thighL: -20,
    shinL: 30,
    footL: -10,
    thighR: 30,
    shinR: -25,
    footR: 10,
  }
});

const enemyWalkPose2 = new Pose({
  id: 'enemy_walk_2',
  boneAngles: {
    torso: 5,
    neck: 0,
    head: 0,
    upperArmL: -40,
    lowerArmL: 15,
    handL: 0,
    upperArmR: 10,
    lowerArmR: -25,
    handR: 0,
    thighL: 30,
    shinL: -25,
    footL: 10,
    thighR: -20,
    shinR: 30,
    footR: -10,
  }
});

export const enemyWalkAnimation = new Animation({
  id: 'enemy_walk',
  loop: true,
  keyframes: [
    { time: 0, pose: enemyWalkPose1, easing: 'easeInOut' },
    { time: 400, pose: enemyWalkPose2, easing: 'easeInOut' },
    { time: 800, pose: enemyWalkPose1, easing: 'easeInOut' },
  ]
});

// ============================================
// ATTACK - Simple lunge attack
// ============================================
const enemyAttackWindup = new Pose({
  id: 'enemy_attack_windup',
  boneAngles: {
    torso: -15,
    neck: 10,
    head: 15,
    upperArmL: 40,
    lowerArmL: 30,
    handL: 0,
    upperArmR: -100,
    lowerArmR: -40,
    handR: -20,
    thighL: 20,
    shinL: -30,
    footL: 10,
    thighR: -10,
    shinR: 20,
    footR: -5,
  }
});

const enemyAttackSwing = new Pose({
  id: 'enemy_attack_swing',
  boneAngles: {
    torso: 25,
    neck: -5,
    head: -10,
    upperArmL: -20,
    lowerArmL: 35,
    handL: 0,
    upperArmR: 70,
    lowerArmR: 20,
    handR: 30,
    thighL: 30,
    shinL: -40,
    footL: 15,
    thighR: -20,
    shinR: 30,
    footR: -10,
  },
  events: [
    { type: 'hitbox_on', data: { attack: 'enemy_basic' } }
  ]
});

const enemyAttackRecover = new Pose({
  id: 'enemy_attack_recover',
  boneAngles: {
    torso: 10,
    neck: 0,
    head: 0,
    upperArmL: 30,
    lowerArmL: 20,
    handL: 0,
    upperArmR: -30,
    lowerArmR: -20,
    handR: 0,
    thighL: 5,
    shinL: 0,
    footL: 0,
    thighR: -5,
    shinR: 0,
    footR: 0,
  },
  events: [
    { type: 'hitbox_off', data: {} }
  ]
});

export const enemyAttackAnimation = new Animation({
  id: 'enemy_attack',
  loop: false,
  keyframes: [
    { time: 0, pose: enemyAttackWindup, easing: 'easeOut' },
    { time: 300, pose: enemyAttackSwing, easing: 'easeIn' },
    { time: 400, pose: enemyAttackRecover, easing: 'easeOut' },
    { time: 600, pose: enemyIdlePose1, easing: 'easeOut' },
  ]
});

// ============================================
// HITSTUN - Recoil pose
// ============================================
const enemyHitstunPose = new Pose({
  id: 'enemy_hitstun',
  boneAngles: {
    torso: -20,
    neck: 15,
    head: 20,
    upperArmL: 60,
    lowerArmL: 40,
    handL: 10,
    upperArmR: -60,
    lowerArmR: -40,
    handR: -10,
    thighL: 15,
    shinL: -20,
    footL: 5,
    thighR: -15,
    shinR: 20,
    footR: -5,
  }
});

export const enemyHitstunAnimation = new Animation({
  id: 'enemy_hitstun',
  loop: false,
  keyframes: [
    { time: 0, pose: enemyHitstunPose, easing: 'easeOut' },
    { time: 200, pose: enemyIdlePose1, easing: 'easeOut' },
  ]
});

// ============================================
// Export all
// ============================================
export const BasicEnemyAnimations = {
  idle: enemyIdleAnimation,
  walk: enemyWalkAnimation,
  attack: enemyAttackAnimation,
  hitstun: enemyHitstunAnimation,
};
