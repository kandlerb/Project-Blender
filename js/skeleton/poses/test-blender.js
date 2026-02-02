import { Pose, Animation, PoseBlender } from './index.js';
import { SkeletonInstance } from '../SkeletonInstance.js';
import { createHumanoidSkeleton } from '../definitions/humanoid.js';
import { BONE_GROUPS } from '../definitions/boneGroups.js';

console.log('=== Testing PoseBlender ===\n');

// Setup
const skeleton = createHumanoidSkeleton();
const instance = new SkeletonInstance(skeleton, { position: { x: 0, y: 0 } });
const blender = new PoseBlender(instance);

// Create test animations
const idlePose = new Pose({ boneAngles: { torso: 0, upperArmL: 0, upperArmR: 0 } });
const raisedArms = new Pose({ boneAngles: { torso: 0, upperArmL: -60, upperArmR: -60 } });
const leanLeft = new Pose({ boneAngles: { torso: -20, upperArmL: 0, upperArmR: 0 } });

const raiseAnim = new Animation({
  id: 'raise_arms',
  loop: false,
  keyframes: [
    { time: 0, pose: idlePose, easing: 'linear' },
    { time: 500, pose: raisedArms, easing: 'easeOut' }
  ]
});

const swayAnim = new Animation({
  id: 'sway',
  loop: true,
  keyframes: [
    { time: 0, pose: idlePose, easing: 'easeInOut' },
    { time: 500, pose: leanLeft, easing: 'easeInOut' },
    { time: 1000, pose: idlePose, easing: 'easeInOut' }
  ]
});

// Test 1: Basic playback
console.log('Test 1 - Basic playback:');
blender.playAnimation(raiseAnim, { layer: 'test' });
blender.update(250); // Halfway
let armAngle = instance.getBoneAngle('upperArmL');
console.log('  At 250ms, upperArmL: ' + armAngle.toFixed(1) + ' (expected ~-30)');
const basicPass = armAngle < -20 && armAngle > -40;
console.log('  ' + (basicPass ? '✓ PASS' : '✗ FAIL'));

// Test 2: Animation completes
console.log('\nTest 2 - Animation completion:');
let completed = false;
blender.stopAllAnimations(0);
blender.playAnimation(raiseAnim, {
  layer: 'test',
  onComplete: () => { completed = true; }
});
blender.update(600); // Past end
console.log('  onComplete called: ' + completed);
console.log('  ' + (completed ? '✓ PASS' : '✗ FAIL'));

// Test 3: Layer masking
console.log('\nTest 3 - Layer masking (upper body only):');
blender.stopAllAnimations(0);
instance.resetPose();

// Play sway on full body
blender.playAnimation(swayAnim, { layer: 'body' });
// Play raise on arms only (should override arms but not torso)
blender.playAnimation(raiseAnim, {
  layer: 'arms',
  boneMask: BONE_GROUPS.arms
});

blender.update(500); // Both at 500ms

const torsoAngle = instance.getBoneAngle('torso');
const armAngleMasked = instance.getBoneAngle('upperArmL');

console.log('  Torso (from sway): ' + torsoAngle.toFixed(1) + ' (expected -20)');
console.log('  UpperArmL (from raise): ' + armAngleMasked.toFixed(1) + ' (expected -60)');

const maskPass = torsoAngle < -15 && torsoAngle > -25 && armAngleMasked < -50;
console.log('  ' + (maskPass ? '✓ PASS' : '✗ FAIL'));

// Test 4: Layer weight
console.log('\nTest 4 - Layer weight blending:');
blender.stopAllAnimations(0);
instance.resetPose();

// Full weight raise
blender.playAnimation(raiseAnim, { layer: 'test', weight: 0.5 });
blender.update(500);

const halfWeight = instance.getBoneAngle('upperArmL');
console.log('  Arms at 50% weight: ' + halfWeight.toFixed(1) + ' (expected ~-30)');
const weightPass = halfWeight > -40 && halfWeight < -20;
console.log('  ' + (weightPass ? '✓ PASS' : '✗ FAIL'));

// Test 5: Looping callback
console.log('\nTest 5 - Loop callback:');
let loopCount = 0;
blender.stopAllAnimations(0);
blender.playAnimation(swayAnim, {
  layer: 'test',
  onLoop: () => { loopCount++; }
});

blender.update(1000); // One loop
blender.update(1000); // Two loops
console.log('  Loops detected: ' + loopCount + ' (expected 2)');
console.log('  ' + (loopCount === 2 ? '✓ PASS' : '✗ FAIL'));

// Test 6: Stop with blend out
console.log('\nTest 6 - Stop layer:');
blender.stopAllAnimations(0);
instance.resetPose();

blender.playAnimation(raiseAnim, { layer: 'test' });
blender.update(500); // Arms up

const beforeStop = instance.getBoneAngle('upperArmL');
blender.stopAnimation('test', 0); // Instant stop
blender.update(0);

// Should remove layer, pose depends on base
console.log('  Before stop: ' + beforeStop.toFixed(1));
console.log('  Layer count after stop: ' + blender.layers.length);
console.log('  ' + (blender.layers.length === 0 ? '✓ PASS' : '✗ FAIL'));

// Test 7: Smooth transition (blend duration)
console.log('\nTest 7 - Smooth transition:');
blender.stopAllAnimations(0);
instance.resetPose();

// Start with raise animation at end (arms up at -60)
blender.playAnimation(raiseAnim, { layer: 'test' });
blender.update(500);
const armsUp = instance.getBoneAngle('upperArmL');
console.log('  Arms up: ' + armsUp.toFixed(1));

// Now play sway with blend - should smoothly transition
blender.playAnimation(swayAnim, { layer: 'test', blendDuration: 200 });
blender.update(100); // Halfway through blend

const midBlend = instance.getBoneAngle('upperArmL');
console.log('  Mid-blend (100ms of 200ms): ' + midBlend.toFixed(1));
// Should be somewhere between -60 (raised) and 0 (sway start)
const blendPass = midBlend > -60 && midBlend < 0;
console.log('  ' + (blendPass ? '✓ PASS' : '✗ FAIL'));

console.log('\n=== Tests Complete ===');
