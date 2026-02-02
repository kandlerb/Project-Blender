/**
 * Bone group definitions for animation masking.
 * Groups allow animations to target specific parts of the skeleton.
 */

/**
 * Named bone groups for the humanoid skeleton.
 * Use these to mask animations to specific body parts.
 */
export const BONE_GROUPS = Object.freeze({
  /** All bones in the humanoid skeleton */
  all: Object.freeze([
    'pelvis', 'torso', 'neck', 'head',
    'upperArmL', 'lowerArmL', 'handL',
    'upperArmR', 'lowerArmR', 'handR',
    'thighL', 'shinL', 'footL',
    'thighR', 'shinR', 'footR'
  ]),

  /** Upper body: torso, head, and arms */
  upperBody: Object.freeze([
    'torso', 'neck', 'head',
    'upperArmL', 'lowerArmL', 'handL',
    'upperArmR', 'lowerArmR', 'handR'
  ]),

  /** Lower body: pelvis and legs */
  lowerBody: Object.freeze([
    'pelvis',
    'thighL', 'shinL', 'footL',
    'thighR', 'shinR', 'footR'
  ]),

  /** Left arm only */
  leftArm: Object.freeze(['upperArmL', 'lowerArmL', 'handL']),

  /** Right arm only */
  rightArm: Object.freeze(['upperArmR', 'lowerArmR', 'handR']),

  /** Both arms */
  arms: Object.freeze([
    'upperArmL', 'lowerArmL', 'handL',
    'upperArmR', 'lowerArmR', 'handR'
  ]),

  /** Left leg only */
  leftLeg: Object.freeze(['thighL', 'shinL', 'footL']),

  /** Right leg only */
  rightLeg: Object.freeze(['thighR', 'shinR', 'footR']),

  /** Both legs */
  legs: Object.freeze([
    'thighL', 'shinL', 'footL',
    'thighR', 'shinR', 'footR'
  ]),

  /** Central spine: pelvis through head */
  spine: Object.freeze(['pelvis', 'torso', 'neck', 'head']),

  /** Weapon arm (right arm) - useful for attack animations */
  weaponArm: Object.freeze(['upperArmR', 'lowerArmR', 'handR']),
});

/**
 * Get all bones NOT in a specified group (for inverse masking).
 * Useful when you want to animate everything except a certain group.
 *
 * @param {string} groupName - Name of the group to exclude
 * @returns {string[]} Array of bone IDs not in the specified group
 * @throws {Error} If groupName is not found in BONE_GROUPS
 *
 * @example
 * // Get all bones except the arms for a walking animation
 * const walkBones = getBonesExcept('arms');
 */
export function getBonesExcept(groupName) {
  const excludeGroup = BONE_GROUPS[groupName];
  if (!excludeGroup) {
    throw new Error(`Unknown bone group: '${groupName}'`);
  }

  const excludeSet = new Set(excludeGroup);
  return BONE_GROUPS.all.filter(boneId => !excludeSet.has(boneId));
}
