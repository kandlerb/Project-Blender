import { Pose, Animation } from './index.js';
import { SkeletonInstance } from '../SkeletonInstance.js';
import { createHumanoidSkeleton } from '../definitions/humanoid.js';

console.log('=== Testing Pose & Animation ===\n');

// Test 1: Pose creation and cloning
console.log('Test 1 - Pose basics:');
const pose1 = new Pose({
  id: 'test',
  boneAngles: { torso: 10, upperArmL: 45 }
});
console.log('  Created pose with ' + pose1.boneAngles.size + ' angles');
console.log('  torso angle: ' + pose1.getAngle('torso'));
console.log('  undefined bone: ' + pose1.getAngle('undefined'));

const cloned = pose1.clone();
cloned.setAngle('torso', 99);
console.log('  Original after clone modified: ' + pose1.getAngle('torso'));
const posePass = pose1.getAngle('torso') === 10 && cloned.getAngle('torso') === 99;
console.log('  ' + (posePass ? '✓ PASS' : '✗ FAIL'));

// Test 2: Angle interpolation (shortest path)
console.log('\nTest 2 - Angle interpolation:');
const angle1 = Pose.lerpAngle(350, 10, 0.5);  // Should go through 0, result = 0
const angle2 = Pose.lerpAngle(10, 350, 0.5);  // Should go through 0, result = 0
const angle3 = Pose.lerpAngle(0, 90, 0.5);    // Simple case, result = 45
console.log('  350 to 10 at 0.5: ' + Math.round(angle1) + ' (expected ~0)');
console.log('  10 to 350 at 0.5: ' + Math.round(angle2) + ' (expected ~0)');
console.log('  0 to 90 at 0.5: ' + Math.round(angle3) + ' (expected 45)');
const lerpPass = Math.abs(angle1) < 5 && Math.abs(angle2) < 5 && Math.abs(angle3 - 45) < 1;
console.log('  ' + (lerpPass ? '✓ PASS' : '✗ FAIL'));

// Test 3: Pose interpolation
console.log('\nTest 3 - Pose.lerp:');
const poseA = new Pose({ boneAngles: { torso: 0, upperArmL: 0 } });
const poseB = new Pose({ boneAngles: { torso: 90, upperArmL: -60 } });
const poseMid = Pose.lerp(poseA, poseB, 0.5);
console.log('  Interpolated torso: ' + poseMid.getAngle('torso') + ' (expected 45)');
console.log('  Interpolated upperArmL: ' + poseMid.getAngle('upperArmL') + ' (expected -30)');
const poseLerpPass = Math.abs(poseMid.getAngle('torso') - 45) < 1 &&
                     Math.abs(poseMid.getAngle('upperArmL') - (-30)) < 1;
console.log('  ' + (poseLerpPass ? '✓ PASS' : '✗ FAIL'));

// Test 4: Animation creation
console.log('\nTest 4 - Animation basics:');
const idlePose = new Pose({ boneAngles: { torso: 0 } });
const breatheIn = new Pose({ boneAngles: { torso: -5 } });
const breatheOut = new Pose({ boneAngles: { torso: 5 } });

const breatheAnim = new Animation({
  id: 'breathe',
  loop: true,
  keyframes: [
    { time: 0, pose: idlePose, easing: 'easeInOut' },
    { time: 500, pose: breatheIn, easing: 'easeInOut' },
    { time: 1000, pose: breatheOut, easing: 'easeInOut' },
    { time: 1500, pose: idlePose, easing: 'easeInOut' }
  ]
});
console.log('  Animation id: ' + breatheAnim.id);
console.log('  Duration: ' + breatheAnim.duration + 'ms');
console.log('  Loop: ' + breatheAnim.loop);
console.log('  Keyframes: ' + breatheAnim.keyframes.length);
const animPass = breatheAnim.duration === 1500 && breatheAnim.keyframes.length === 4;
console.log('  ' + (animPass ? '✓ PASS' : '✗ FAIL'));

// Test 5: getPoseAtTime
console.log('\nTest 5 - getPoseAtTime:');
const at0 = breatheAnim.getPoseAtTime(0);
const at250 = breatheAnim.getPoseAtTime(250);
const at500 = breatheAnim.getPoseAtTime(500);
console.log('  At 0ms torso: ' + at0.getAngle('torso') + ' (expected 0)');
console.log('  At 250ms torso: ' + at250.getAngle('torso').toFixed(1) + ' (expected ~-2.5, eased)');
console.log('  At 500ms torso: ' + at500.getAngle('torso') + ' (expected -5)');
const timePass = at0.getAngle('torso') === 0 && at500.getAngle('torso') === -5;
console.log('  ' + (timePass ? '✓ PASS' : '✗ FAIL'));

// Test 6: Looping
console.log('\nTest 6 - Looping:');
const at1500 = breatheAnim.getPoseAtTime(1500); // End = start when looping
const at1750 = breatheAnim.getPoseAtTime(1750); // Same as 250ms
const at3000 = breatheAnim.getPoseAtTime(3000); // Same as 0ms (two full loops)
console.log('  At 1500ms (end): ' + at1500.getAngle('torso') + ' (expected 0)');
console.log('  At 1750ms (loop+250): ' + at1750.getAngle('torso').toFixed(1));
console.log('  At 3000ms (2 loops): ' + at3000.getAngle('torso') + ' (expected 0)');
const loopPass = at1500.getAngle('torso') === 0 && Math.abs(at3000.getAngle('torso')) < 1;
console.log('  ' + (loopPass ? '✓ PASS' : '✗ FAIL'));

// Test 7: Apply to skeleton
console.log('\nTest 7 - Apply pose to skeleton:');
const skeleton = createHumanoidSkeleton();
const instance = new SkeletonInstance(skeleton, { position: { x: 0, y: 0 } });
const testPose = new Pose({ boneAngles: { torso: 25, upperArmR: -45 } });
testPose.applyTo(instance);
console.log('  Skeleton torso angle: ' + instance.getBoneAngle('torso'));
console.log('  Skeleton upperArmR angle: ' + instance.getBoneAngle('upperArmR'));
const applyPass = instance.getBoneAngle('torso') === 25 && instance.getBoneAngle('upperArmR') === -45;
console.log('  ' + (applyPass ? '✓ PASS' : '✗ FAIL'));

console.log('\n=== Tests Complete ===');
