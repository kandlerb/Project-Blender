/**
 * MatterPhysics - Utility layer for Matter.js in Project Blender
 *
 * Provides helper methods and collision category management
 * to simplify Matter.js usage across the codebase.
 */

// Collision categories (bitmask)
export const CollisionCategories = Object.freeze({
  DEFAULT:    0x0001,
  PLAYER:     0x0002,
  ENEMY:      0x0004,
  GROUND:     0x0008,
  PLATFORM:   0x0010,
  CORPSE:     0x0020,
  HITBOX:     0x0040,
  HURTBOX:    0x0080,
  SENSOR:     0x0100,
  BOSS:       0x0200,
});

// Pre-built collision masks
export const CollisionMasks = Object.freeze({
  // Player collides with ground, platforms, corpses, enemy hitboxes
  PLAYER: CollisionCategories.GROUND |
          CollisionCategories.PLATFORM |
          CollisionCategories.CORPSE |
          CollisionCategories.HITBOX,

  // Enemies collide with ground, platforms, corpses, player hitbox
  ENEMY:  CollisionCategories.GROUND |
          CollisionCategories.PLATFORM |
          CollisionCategories.CORPSE |
          CollisionCategories.HITBOX,

  // Boss collides with ground, platforms, player hitbox
  BOSS:   CollisionCategories.GROUND |
          CollisionCategories.PLATFORM |
          CollisionCategories.HITBOX,

  // Ground collides with everything physical
  GROUND: CollisionCategories.PLAYER |
          CollisionCategories.ENEMY |
          CollisionCategories.BOSS |
          CollisionCategories.CORPSE,

  // Corpses collide with ground, platforms, other corpses, player, enemies
  CORPSE: CollisionCategories.GROUND |
          CollisionCategories.PLATFORM |
          CollisionCategories.CORPSE |
          CollisionCategories.PLAYER |
          CollisionCategories.ENEMY,

  // Hitboxes only detect hurtboxes (sensors)
  HITBOX: CollisionCategories.HURTBOX,

  // Hurtboxes only detect hitboxes (sensors)
  HURTBOX: CollisionCategories.HITBOX,
});

/**
 * Create a player body configuration
 * @param {number} width - Body width
 * @param {number} height - Body height
 * @returns {object} Matter.js body config
 */
export function createPlayerBodyConfig(width, height) {
  return {
    label: 'player',
    friction: 0.001,        // Low ground friction for responsive movement
    frictionAir: 0.02,      // Air resistance
    frictionStatic: 0.5,
    restitution: 0,         // No bounce
    collisionFilter: {
      category: CollisionCategories.PLAYER,
      mask: CollisionMasks.PLAYER,
    },
    // Prevent rotation (player stays upright)
    inertia: Infinity,
    inverseInertia: 0,
  };
}

/**
 * Create an enemy body configuration
 * @param {number} width - Body width
 * @param {number} height - Body height
 * @returns {object} Matter.js body config
 */
export function createEnemyBodyConfig(width, height) {
  return {
    label: 'enemy',
    friction: 0.001,
    frictionAir: 0.02,
    frictionStatic: 0.5,
    restitution: 0,
    collisionFilter: {
      category: CollisionCategories.ENEMY,
      mask: CollisionMasks.ENEMY,
    },
    inertia: Infinity,
    inverseInertia: 0,
  };
}

/**
 * Create a static ground/platform body configuration
 * @returns {object} Matter.js body config
 */
export function createGroundBodyConfig() {
  return {
    label: 'ground',
    isStatic: true,
    friction: 0.8,
    collisionFilter: {
      category: CollisionCategories.GROUND,
      mask: CollisionMasks.GROUND,
    },
  };
}

/**
 * Create a platform body configuration
 * @returns {object} Matter.js body config
 */
export function createPlatformBodyConfig() {
  return {
    label: 'platform',
    isStatic: true,
    friction: 0.8,
    collisionFilter: {
      category: CollisionCategories.PLATFORM,
      mask: CollisionMasks.GROUND, // Same collision behavior as ground
    },
  };
}

/**
 * Create a corpse body configuration
 * @returns {object} Matter.js body config
 */
export function createCorpseBodyConfig() {
  return {
    label: 'corpse',
    isStatic: true,
    friction: 0.8,
    collisionFilter: {
      category: CollisionCategories.CORPSE,
      mask: CollisionMasks.CORPSE,
    },
  };
}

/**
 * Create a boss body configuration
 * @param {number} width - Body width
 * @param {number} height - Body height
 * @returns {object} Matter.js body config
 */
export function createBossBodyConfig(width, height) {
  return {
    label: 'boss',
    friction: 0.001,
    frictionAir: 0.02,
    frictionStatic: 0.5,
    restitution: 0,
    collisionFilter: {
      category: CollisionCategories.BOSS,
      mask: CollisionMasks.BOSS,
    },
    inertia: Infinity,
    inverseInertia: 0,
  };
}

/**
 * Create a sensor (non-physical trigger) configuration
 * @param {string} label - Body label
 * @param {number} category - Collision category
 * @param {number} mask - Collision mask
 * @returns {object} Matter.js body config
 */
export function createSensorConfig(label, category, mask) {
  return {
    label: label,
    isSensor: true,
    collisionFilter: {
      category: category,
      mask: mask,
    },
  };
}

/**
 * Create a hitbox sensor configuration
 * @param {string} label - Body label (e.g., 'player_hitbox', 'enemy_hitbox')
 * @returns {object} Matter.js body config
 */
export function createHitboxConfig(label = 'hitbox') {
  return {
    label: label,
    isSensor: true,
    collisionFilter: {
      category: CollisionCategories.HITBOX,
      mask: CollisionMasks.HITBOX,
    },
  };
}

/**
 * Create a hurtbox sensor configuration
 * @param {string} label - Body label (e.g., 'player_hurtbox', 'enemy_hurtbox')
 * @returns {object} Matter.js body config
 */
export function createHurtboxConfig(label = 'hurtbox') {
  return {
    label: label,
    isSensor: true,
    collisionFilter: {
      category: CollisionCategories.HURTBOX,
      mask: CollisionMasks.HURTBOX,
    },
  };
}

/**
 * MatterPhysicsHelper - Attached to scene for easy access
 * Provides convenience methods for common physics operations
 */
export class MatterPhysicsHelper {
  /**
   * @param {Phaser.Scene} scene - The scene this helper belongs to
   */
  constructor(scene) {
    this.scene = scene;
    this.matter = scene.matter;
  }

  /**
   * Check if a body is on the ground using ray cast
   * @param {MatterJS.BodyType} body - The body to check
   * @returns {boolean} True if on ground
   */
  isOnGround(body) {
    // Check for collision with ground category below the body
    const halfHeight = (body.bounds.max.y - body.bounds.min.y) / 2;
    const start = { x: body.position.x, y: body.position.y };
    const end = { x: body.position.x, y: body.position.y + halfHeight + 5 };

    const collisions = this.matter.query.ray(
      this.matter.world.engine.world.bodies,
      start,
      end
    );

    for (const collision of collisions) {
      if (collision.body === body) continue;
      const category = collision.body.collisionFilter.category;
      if (category & (CollisionCategories.GROUND | CollisionCategories.PLATFORM | CollisionCategories.CORPSE)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Alternative ground check using collision events
   * Call this in update with the body's touching data
   * @param {MatterJS.BodyType} body - The body to check
   * @returns {boolean} True if touching ground below
   */
  isTouchingDown(body) {
    if (!body) return false;

    // Matter.js stores collision pairs, check if any are below
    const pairs = this.matter.world.engine?.pairs?.list;
    if (!pairs) return false;

    for (const pair of pairs) {
      if (!pair?.isActive) continue;

      // Guard against missing bodies (may have been removed)
      if (!pair.bodyA || !pair.bodyB) continue;

      const isBodyA = pair.bodyA === body;
      const isBodyB = pair.bodyB === body;
      if (!isBodyA && !isBodyB) continue;

      const other = isBodyA ? pair.bodyB : pair.bodyA;

      // Guard against missing collision filter
      const category = other?.collisionFilter?.category || 0;

      // Check if colliding with ground-like surface
      if (category & (CollisionCategories.GROUND | CollisionCategories.PLATFORM | CollisionCategories.CORPSE)) {
        // Check if collision normal points up (we're on top)
        const normal = pair.collision?.normal;
        if (!normal) continue;

        // Normal points from A to B, adjust based on which body we are
        const ny = isBodyA ? normal.y : -normal.y;
        if (ny < -0.5) {  // Normal points upward relative to our body
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Set velocity with clamping
   * @param {MatterJS.BodyType} body - The body to modify
   * @param {number} vx - X velocity
   * @param {number} vy - Y velocity
   * @param {number} maxSpeed - Maximum speed (default 500)
   */
  setVelocity(body, vx, vy, maxSpeed = 500) {
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      vx *= scale;
      vy *= scale;
    }
    this.matter.body.setVelocity(body, { x: vx, y: vy });
  }

  /**
   * Apply horizontal movement while preserving vertical velocity
   * @param {MatterJS.BodyType} body - The body to modify
   * @param {number} vx - X velocity
   */
  setVelocityX(body, vx) {
    this.matter.body.setVelocity(body, { x: vx, y: body.velocity.y });
  }

  /**
   * Apply vertical movement while preserving horizontal velocity
   * @param {MatterJS.BodyType} body - The body to modify
   * @param {number} vy - Y velocity
   */
  setVelocityY(body, vy) {
    this.matter.body.setVelocity(body, { x: body.velocity.x, y: vy });
  }

  /**
   * Apply impulse (instant velocity change)
   * @param {MatterJS.BodyType} body - The body to apply impulse to
   * @param {object} impulse - {x, y} impulse vector
   */
  applyImpulse(body, impulse) {
    this.matter.body.applyForce(body, body.position, impulse);
  }

  /**
   * Set body position directly
   * @param {MatterJS.BodyType} body - The body to move
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  setPosition(body, x, y) {
    this.matter.body.setPosition(body, { x, y });
  }
}
