import { createHumanoidSkeleton } from './humanoid.js';
import { BONE_GROUPS, getBonesExcept } from './boneGroups.js';
import { SkeletonInstance } from '../SkeletonInstance.js';

console.log('=== Testing Humanoid Skeleton ===\n');

const skeleton = createHumanoidSkeleton();

// Test 1: Skeleton structure
console.log('Test 1 - Skeleton created:');
console.log('  ID: ' + skeleton.id);
console.log('  Root: ' + skeleton.rootBoneId);
console.log('  Bone count: ' + skeleton.bones.size);
console.log('  ' + (skeleton.bones.size === 16 ? '✓ PASS' : '✗ FAIL (expected 16 bones)'));

// Test 2: Hierarchy integrity
console.log('\nTest 2 - Hierarchy:');
const torsoChildren = skeleton.getChildren('torso');
console.log('  Torso children: ' + torsoChildren.join(', '));
const hasNeckAndArms = torsoChildren.includes('neck') &&
                       torsoChildren.includes('upperArmL') &&
                       torsoChildren.includes('upperArmR');
console.log('  ' + (hasNeckAndArms ? '✓ PASS' : '✗ FAIL'));

// Test 3: Instance creation and T-pose
console.log('\nTest 3 - T-Pose rendering check:');
const instance = new SkeletonInstance(skeleton, {
  position: { x: 200, y: 300 }
});

const head = instance.getBoneWorldPosition('head');
const handL = instance.getBoneWorldPosition('handL');
const handR = instance.getBoneWorldPosition('handR');
const footL = instance.getBoneWorldPosition('footL');
const footR = instance.getBoneWorldPosition('footR');

console.log('  Head end Y: ' + Math.round(head.endY) + ' (should be above 300)');
console.log('  HandL end X: ' + Math.round(handL.endX) + ' (should be left of 200)');
console.log('  HandR end X: ' + Math.round(handR.endX) + ' (should be right of 200)');
console.log('  FootL end Y: ' + Math.round(footL.endY) + ' (should be below 300)');
console.log('  FootR end Y: ' + Math.round(footR.endY) + ' (should be below 300)');

const poseCorrect = head.endY < 300 &&
                    handL.endX < 200 &&
                    handR.endX > 200 &&
                    footL.endY > 300 &&
                    footR.endY > 300;
console.log('  ' + (poseCorrect ? '✓ PASS' : '✗ FAIL'));

// Test 4: Bone groups
console.log('\nTest 4 - Bone groups:');
console.log('  upperBody count: ' + BONE_GROUPS.upperBody.length);
console.log('  lowerBody count: ' + BONE_GROUPS.lowerBody.length);
console.log('  arms count: ' + BONE_GROUPS.arms.length);
const groupsValid = BONE_GROUPS.upperBody.length === 9 &&
                    BONE_GROUPS.lowerBody.length === 7 &&
                    BONE_GROUPS.arms.length === 6;
console.log('  ' + (groupsValid ? '✓ PASS' : '✗ FAIL'));

// Test 5: getBonesExcept
console.log('\nTest 5 - getBonesExcept:');
const notArms = getBonesExcept('arms');
console.log('  Bones except arms: ' + notArms.length);
console.log('  Contains torso: ' + notArms.includes('torso'));
console.log('  Contains handL: ' + notArms.includes('handL'));
const exceptWorks = notArms.includes('torso') && !notArms.includes('handL');
console.log('  ' + (exceptWorks ? '✓ PASS' : '✗ FAIL'));

console.log('\n=== Tests Complete ===');
