import { Skeleton, SkeletonInstance } from './index.js';

console.log('=== Testing SkeletonInstance ===\n');

// Simple skeleton: pelvis -> torso (pointing up)
const skeleton = new Skeleton({
  id: 'test',
  rootBoneId: 'pelvis',
  bones: [
    { id: 'pelvis', parentId: null, length: 0, baseAngle: 0 },
    { id: 'torso', parentId: 'pelvis', length: 20, baseAngle: -90 }, // -90 = up
    { id: 'head', parentId: 'torso', length: 10, baseAngle: 0 },
  ]
});

// Create instance at position (100, 200)
const instance = new SkeletonInstance(skeleton, {
  position: { x: 100, y: 200 }
});

// Test 1: Root position
const pelvis = instance.getBoneWorldPosition('pelvis');
console.log('Test 1 - Pelvis at root:');
console.log('  Expected: x=100, y=200');
console.log('  Got: x=' + pelvis.x + ', y=' + pelvis.y);
console.log('  ' + (pelvis.x === 100 && pelvis.y === 200 ? '✓ PASS' : '✗ FAIL'));

// Test 2: Torso extends upward (baseAngle -90)
const torso = instance.getBoneWorldPosition('torso');
console.log('\nTest 2 - Torso points up:');
console.log('  Expected: start=(100,200), end=(100,180)'); // 20px up
console.log('  Got: start=(' + torso.x + ',' + torso.y + '), end=(' + Math.round(torso.endX) + ',' + Math.round(torso.endY) + ')');
const torsoPass = torso.x === 100 && torso.y === 200 && Math.abs(torso.endY - 180) < 0.1;
console.log('  ' + (torsoPass ? '✓ PASS' : '✗ FAIL'));

// Test 3: Head continues from torso end
const head = instance.getBoneWorldPosition('head');
console.log('\nTest 3 - Head continues up from torso:');
console.log('  Expected: start=(100,180), end=(100,170)'); // 10px more up
console.log('  Got: start=(' + Math.round(head.x) + ',' + Math.round(head.y) + '), end=(' + Math.round(head.endX) + ',' + Math.round(head.endY) + ')');
const headPass = Math.abs(head.y - 180) < 0.1 && Math.abs(head.endY - 170) < 0.1;
console.log('  ' + (headPass ? '✓ PASS' : '✗ FAIL'));

// Test 4: Bone angle offset
instance.setBoneAngle('torso', 45); // Rotate torso 45 degrees
const torsoRotated = instance.getBoneWorldPosition('torso');
console.log('\nTest 4 - Torso rotated 45 degrees:');
console.log('  Torso angle (radians): ' + torsoRotated.angle.toFixed(3));
console.log('  Expected angle: ' + ((-90 + 45) * Math.PI / 180).toFixed(3)); // -45 degrees in radians
const anglePass = Math.abs(torsoRotated.angle - (-45 * Math.PI / 180)) < 0.01;
console.log('  ' + (anglePass ? '✓ PASS' : '✗ FAIL'));

// Test 5: Horizontal flip
// Create a skeleton with a bone that has horizontal component to test flip
const flipSkeleton = new Skeleton({
  id: 'flip-test',
  rootBoneId: 'root',
  bones: [
    { id: 'root', parentId: null, length: 0, baseAngle: 0 },
    { id: 'arm', parentId: 'root', length: 20, baseAngle: -45 }, // -45 = up-right
  ]
});
const flipInstance = new SkeletonInstance(flipSkeleton, { position: { x: 100, y: 100 } });

// Without flip, -45° points up-right (endX > 100)
const armNormal = flipInstance.getBoneWorldPosition('arm');
const normalEndX = Math.round(armNormal.endX);

// With flip, should mirror to up-left (endX < 100)
flipInstance.setScale(-1, 1);
const armFlipped = flipInstance.getBoneWorldPosition('arm');
const flippedEndX = Math.round(armFlipped.endX);

console.log('\nTest 5 - Horizontal flip (scale.x = -1):');
console.log('  Normal arm endX: ' + normalEndX + ' (up-right, should be > 100)');
console.log('  Flipped arm endX: ' + flippedEndX + ' (up-left, should be < 100)');
const flipPass = normalEndX > 100 && flippedEndX < 100;
console.log('  ' + (flipPass ? '✓ PASS' : '✗ FAIL'));

console.log('\n=== Tests Complete ===');
