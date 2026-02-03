import { Skeleton } from '../Skeleton.js';

/**
 * Humanoid skeleton bone hierarchy:
 *
 *                     HEAD
 *                      │
 *                    NECK
 *                      │
 *     UPPER_ARM_L ── TORSO ── UPPER_ARM_R
 *          │           │           │
 *     LOWER_ARM_L   PELVIS   LOWER_ARM_R
 *          │        /    \         │
 *        HAND_L  THIGH_L  THIGH_R  HAND_R
 *                  │        │
 *               SHIN_L    SHIN_R
 *                  │        │
 *               FOOT_L    FOOT_R
 *
 * Total: 16 bones
 * Root: pelvis (length 0, at character origin)
 *
 * Angles are in degrees, measured counter-clockwise from positive X axis.
 * -90 = pointing up, 90 = pointing down, 0 = pointing right, 180 = pointing left
 */

/**
 * Create a new humanoid skeleton instance.
 * @returns {Skeleton} A new humanoid skeleton
 */
export function createHumanoidSkeleton() {
  return new Skeleton({
    id: 'humanoid',
    rootBoneId: 'pelvis',
    bones: [
      // Root - pelvis at character origin
      {
        id: 'pelvis',
        parentId: null,
        length: 0,
        baseAngle: 0,
        constraints: { min: -90, max: 90 }
      },

      // Spine - torso points upward from pelvis
      {
        id: 'torso',
        parentId: 'pelvis',
        length: 24,
        baseAngle: -90,
        constraints: { min: -90, max: 90 }
      },
      {
        id: 'neck',
        parentId: 'torso',
        length: 6,
        baseAngle: 0,
        constraints: { min: -45, max: 45 }
      },
      {
        id: 'head',
        parentId: 'neck',
        length: 8,
        baseAngle: 0,
        constraints: { min: -45, max: 45 }
      },

      // Left arm - attaches near top of torso, angles down-left
      // World angle = torso(-90) + 210 = 120° (down-left)
      {
        id: 'upperArmL',
        parentId: 'torso',
        length: 16,
        baseAngle: 210,
        anchor: { x: 0, y: 0.95 },
        constraints: { min: -90, max: 90 }
      },
      {
        id: 'lowerArmL',
        parentId: 'upperArmL',
        length: 14,
        baseAngle: 20,
        constraints: { min: 0, max: 150 } // Elbow doesn't bend backward
      },
      {
        id: 'handL',
        parentId: 'lowerArmL',
        length: 6,
        baseAngle: 0,
        constraints: { min: -90, max: 90 }
      },

      // Right arm - attaches near top of torso, angles down-right
      // World angle = torso(-90) + 150 = 60° (down-right)
      {
        id: 'upperArmR',
        parentId: 'torso',
        length: 16,
        baseAngle: 150,
        anchor: { x: 0, y: 0.95 },
        constraints: { min: -90, max: 90 }
      },
      {
        id: 'lowerArmR',
        parentId: 'upperArmR',
        length: 14,
        baseAngle: -20,
        constraints: { min: 0, max: 150 } // Elbow doesn't bend backward
      },
      {
        id: 'handR',
        parentId: 'lowerArmR',
        length: 6,
        baseAngle: 0,
        constraints: { min: -90, max: 90 }
      },

      // Left leg - attaches at pelvis, offset left
      {
        id: 'thighL',
        parentId: 'pelvis',
        length: 20,
        baseAngle: 100,
        anchor: { x: -0.3, y: 0 },
        constraints: { min: -90, max: 90 }
      },
      {
        id: 'shinL',
        parentId: 'thighL',
        length: 18,
        baseAngle: 10,
        constraints: { min: 0, max: 150 } // Knee doesn't bend backward
      },
      {
        id: 'footL',
        parentId: 'shinL',
        length: 8,
        baseAngle: 70,
        constraints: { min: -45, max: 45 }
      },

      // Right leg - attaches at pelvis, offset right
      {
        id: 'thighR',
        parentId: 'pelvis',
        length: 20,
        baseAngle: 80,
        anchor: { x: 0.3, y: 0 },
        constraints: { min: -90, max: 90 }
      },
      {
        id: 'shinR',
        parentId: 'thighR',
        length: 18,
        baseAngle: -10,
        constraints: { min: 0, max: 150 } // Knee doesn't bend backward
      },
      {
        id: 'footR',
        parentId: 'shinR',
        length: 8,
        baseAngle: -70,
        constraints: { min: -45, max: 45 }
      },
    ]
  });
}
