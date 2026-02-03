import { Pose, Animation } from '../../../skeleton/poses/index.js';

/**
 * Player Locomotion Animations
 * Basic movement: idle, run, jump, fall, land
 */

// ============================================
// IDLE - Subtle breathing motion
// ============================================
const idlePose1 = new Pose({
  id: 'idle_1',
  boneAngles: {
    // Relaxed standing pose
    torso: 0,
    neck: 0,
    head: 0,
    upperArmL: 25,    // Arms slightly forward and down
    lowerArmL: 15,
    handL: 0,
    upperArmR: -25,
    lowerArmR: -15,
    handR: 0,
    thighL: 5,        // Legs straight
    shinL: 0,
    footL: 0,
    thighR: -5,
    shinR: 0,
    footR: 0,
  }
});

const idlePose2 = new Pose({
  id: 'idle_2',
  boneAngles: {
    // Slight inhale - shoulders up slightly
    torso: -2,
    neck: 0,
    head: 2,
    upperArmL: 23,
    lowerArmL: 15,
    handL: 0,
    upperArmR: -23,
    lowerArmR: -15,
    handR: 0,
    thighL: 5,
    shinL: 0,
    footL: 0,
    thighR: -5,
    shinR: 0,
    footR: 0,
  }
});

export const idleAnimation = new Animation({
  id: 'idle',
  loop: true,
  keyframes: [
    { time: 0, pose: idlePose1, easing: 'easeInOut' },
    { time: 1500, pose: idlePose2, easing: 'easeInOut' },
    { time: 3000, pose: idlePose1, easing: 'easeInOut' },
  ]
});

// ============================================
// RUN - Dynamic run cycle
// ============================================
const runContact = new Pose({
  id: 'run_contact',
  boneAngles: {
    torso: 8,         // Lean forward
    neck: -5,
    head: -3,
    upperArmL: -45,   // Left arm back
    lowerArmL: 45,
    handL: 0,
    upperArmR: 60,    // Right arm forward
    lowerArmR: 30,
    handR: 0,
    thighL: -30,      // Left leg back
    shinL: 45,
    footL: -20,
    thighR: 45,       // Right leg forward
    shinR: -40,
    footR: 15,
  }
});

const runPassing = new Pose({
  id: 'run_passing',
  boneAngles: {
    torso: 5,
    neck: -3,
    head: -2,
    upperArmL: 10,    // Arms at sides
    lowerArmL: 35,
    handL: 0,
    upperArmR: -10,
    lowerArmR: 35,
    handR: 0,
    thighL: 10,       // Legs passing
    shinL: 30,
    footL: 0,
    thighR: -10,
    shinR: 30,
    footR: 0,
  }
});

const runContactAlt = new Pose({
  id: 'run_contact_alt',
  boneAngles: {
    torso: 8,
    neck: -5,
    head: -3,
    upperArmL: 60,    // Left arm forward (opposite of runContact)
    lowerArmL: 30,
    handL: 0,
    upperArmR: -45,   // Right arm back
    lowerArmR: 45,
    handR: 0,
    thighL: 45,       // Left leg forward
    shinL: -40,
    footL: 15,
    thighR: -30,      // Right leg back
    shinR: 45,
    footR: -20,
  }
});

export const runAnimation = new Animation({
  id: 'run',
  loop: true,
  keyframes: [
    { time: 0, pose: runContact, easing: 'easeInOut' },
    { time: 150, pose: runPassing, easing: 'easeInOut' },
    { time: 300, pose: runContactAlt, easing: 'easeInOut' },
    { time: 450, pose: runPassing, easing: 'easeInOut' },
    { time: 600, pose: runContact, easing: 'easeInOut' },
  ]
});

// ============================================
// JUMP - Anticipation and airborne poses
// ============================================
const jumpAnticipation = new Pose({
  id: 'jump_antic',
  boneAngles: {
    torso: 15,        // Crouch
    neck: 10,
    head: 5,
    upperArmL: 40,    // Arms back
    lowerArmL: 30,
    handL: 0,
    upperArmR: -40,
    lowerArmR: -30,
    handR: 0,
    thighL: 40,       // Legs bent
    shinL: -60,
    footL: 20,
    thighR: -40,
    shinR: 60,
    footR: -20,
  }
});

const jumpRising = new Pose({
  id: 'jump_rise',
  boneAngles: {
    torso: -10,       // Stretch upward
    neck: -5,
    head: -10,
    upperArmL: 70,    // Arms up
    lowerArmL: 20,
    handL: 0,
    upperArmR: -70,
    lowerArmR: -20,
    handR: 0,
    thighL: 20,       // Legs extending
    shinL: 15,
    footL: -30,
    thighR: -20,
    shinR: -15,
    footR: 30,
  }
});

export const jumpAnimation = new Animation({
  id: 'jump',
  loop: false,
  keyframes: [
    { time: 0, pose: jumpAnticipation, easing: 'easeOut' },
    { time: 150, pose: jumpRising, easing: 'easeOut' },
  ]
});

// ============================================
// FALL - Airborne descending pose
// ============================================
const fallPose = new Pose({
  id: 'fall',
  boneAngles: {
    torso: 5,
    neck: 5,
    head: 10,
    upperArmL: 50,    // Arms slightly up for balance
    lowerArmL: 25,
    handL: 10,
    upperArmR: -50,
    lowerArmR: -25,
    handR: -10,
    thighL: 25,       // Legs slightly bent, ready to land
    shinL: -30,
    footL: 10,
    thighR: -25,
    shinR: 30,
    footR: -10,
  }
});

export const fallAnimation = new Animation({
  id: 'fall',
  loop: true,
  keyframes: [
    { time: 0, pose: fallPose, easing: 'linear' },
  ]
});

// ============================================
// LAND - Impact recovery
// ============================================
const landImpact = new Pose({
  id: 'land_impact',
  boneAngles: {
    torso: 20,        // Crouch on impact
    neck: 15,
    head: 10,
    upperArmL: 30,
    lowerArmL: 40,
    handL: 0,
    upperArmR: -30,
    lowerArmR: -40,
    handR: 0,
    thighL: 50,       // Deep knee bend
    shinL: -70,
    footL: 20,
    thighR: -50,
    shinR: 70,
    footR: -20,
  }
});

const landRecover = new Pose({
  id: 'land_recover',
  boneAngles: {
    torso: 5,
    neck: 0,
    head: 0,
    upperArmL: 25,
    lowerArmL: 15,
    handL: 0,
    upperArmR: -25,
    lowerArmR: -15,
    handR: 0,
    thighL: 10,
    shinL: -10,
    footL: 0,
    thighR: -10,
    shinR: 10,
    footR: 0,
  }
});

export const landAnimation = new Animation({
  id: 'land',
  loop: false,
  keyframes: [
    { time: 0, pose: landImpact, easing: 'easeOut' },
    { time: 150, pose: landRecover, easing: 'easeOut' },
  ]
});

// ============================================
// Export all locomotion animations
// ============================================
export const PlayerLocomotionAnimations = {
  idle: idleAnimation,
  run: runAnimation,
  jump: jumpAnimation,
  fall: fallAnimation,
  land: landAnimation,
};
