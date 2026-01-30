import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CombatManager } from '../../js/systems/CombatManager.js';
import { BOX_TYPE, TEAM } from '../../js/systems/CombatBox.js';

// Mock CombatBox for testing
function createMockBox(config) {
  return {
    type: config.type || BOX_TYPE.HITBOX,
    team: config.team || TEAM.PLAYER,
    owner: config.owner || { id: 'owner1' },
    active: config.active !== undefined ? config.active : true,
    zone: {
      x: config.x || 0,
      y: config.y || 0,
    },
    width: config.width || 50,
    height: config.height || 50,
    damage: config.damage || 10,
    knockback: config.knockback || { x: 200, y: -100 },
    hitstun: config.hitstun || 200,
    hitstop: config.hitstop || 50,
    hasHit: new Set(),
    hasAlreadyHit(target) {
      return this.hasHit.has(target);
    },
    markHit(target) {
      this.hasHit.add(target);
    },
    updatePosition: vi.fn(),
  };
}

// Mock scene for CombatManager
function createMockScene() {
  return {
    events: {
      emit: vi.fn(),
    },
  };
}

describe('CombatManager', () => {
  let scene;
  let cm;

  beforeEach(() => {
    scene = createMockScene();
    cm = new CombatManager(scene);
  });

  describe('constructor', () => {
    it('should initialize with empty box sets', () => {
      expect(cm.hitboxes.size).toBe(0);
      expect(cm.hurtboxes.size).toBe(0);
    });

    it('should store scene reference', () => {
      expect(cm.scene).toBe(scene);
    });

    it('should initialize empty callback array', () => {
      expect(cm.onHitCallbacks).toEqual([]);
    });
  });

  describe('register/unregister', () => {
    it('should register hitbox in hitboxes set', () => {
      const hitbox = createMockBox({ type: BOX_TYPE.HITBOX });
      cm.register(hitbox);
      expect(cm.hitboxes.has(hitbox)).toBe(true);
      expect(cm.hurtboxes.has(hitbox)).toBe(false);
    });

    it('should register hurtbox in hurtboxes set', () => {
      const hurtbox = createMockBox({ type: BOX_TYPE.HURTBOX });
      cm.register(hurtbox);
      expect(cm.hurtboxes.has(hurtbox)).toBe(true);
      expect(cm.hitboxes.has(hurtbox)).toBe(false);
    });

    it('should unregister hitbox', () => {
      const hitbox = createMockBox({ type: BOX_TYPE.HITBOX });
      cm.register(hitbox);
      cm.unregister(hitbox);
      expect(cm.hitboxes.has(hitbox)).toBe(false);
    });

    it('should unregister hurtbox', () => {
      const hurtbox = createMockBox({ type: BOX_TYPE.HURTBOX });
      cm.register(hurtbox);
      cm.unregister(hurtbox);
      expect(cm.hurtboxes.has(hurtbox)).toBe(false);
    });
  });

  describe('boxesOverlap', () => {
    it('should detect overlapping boxes', () => {
      const boxA = createMockBox({ x: 100, y: 100, width: 50, height: 50 });
      const boxB = createMockBox({ x: 120, y: 120, width: 50, height: 50 });
      expect(cm.boxesOverlap(boxA, boxB)).toBe(true);
    });

    it('should not detect non-overlapping boxes (separated horizontally)', () => {
      const boxA = createMockBox({ x: 0, y: 100, width: 50, height: 50 });
      const boxB = createMockBox({ x: 100, y: 100, width: 50, height: 50 });
      expect(cm.boxesOverlap(boxA, boxB)).toBe(false);
    });

    it('should not detect non-overlapping boxes (separated vertically)', () => {
      const boxA = createMockBox({ x: 100, y: 0, width: 50, height: 50 });
      const boxB = createMockBox({ x: 100, y: 100, width: 50, height: 50 });
      expect(cm.boxesOverlap(boxA, boxB)).toBe(false);
    });

    it('should detect edge-touching boxes as non-overlapping', () => {
      // Boxes exactly touching at edges should NOT overlap (using strict < >)
      const boxA = createMockBox({ x: 50, y: 100, width: 50, height: 50 });
      const boxB = createMockBox({ x: 100, y: 100, width: 50, height: 50 });
      // boxA right edge = 50 + 25 = 75
      // boxB left edge = 100 - 25 = 75
      // 75 > 75 is false, so no overlap
      expect(cm.boxesOverlap(boxA, boxB)).toBe(false);
    });

    it('should handle boxes of different sizes', () => {
      const small = createMockBox({ x: 100, y: 100, width: 20, height: 20 });
      const large = createMockBox({ x: 100, y: 100, width: 100, height: 100 });
      expect(cm.boxesOverlap(small, large)).toBe(true);
    });

    it('should handle box fully inside another', () => {
      const inner = createMockBox({ x: 100, y: 100, width: 10, height: 10 });
      const outer = createMockBox({ x: 100, y: 100, width: 100, height: 100 });
      expect(cm.boxesOverlap(inner, outer)).toBe(true);
    });
  });

  describe('checkCollisions', () => {
    it('should skip inactive hitboxes', () => {
      const hitbox = createMockBox({
        type: BOX_TYPE.HITBOX,
        team: TEAM.PLAYER,
        active: false,
        x: 100,
        y: 100,
      });
      const hurtbox = createMockBox({
        type: BOX_TYPE.HURTBOX,
        team: TEAM.ENEMY,
        owner: { id: 'enemy1' },
        x: 100,
        y: 100,
      });

      cm.register(hitbox);
      cm.register(hurtbox);
      cm.checkCollisions();

      expect(scene.events.emit).not.toHaveBeenCalled();
    });

    it('should skip inactive hurtboxes', () => {
      const hitbox = createMockBox({
        type: BOX_TYPE.HITBOX,
        team: TEAM.PLAYER,
        x: 100,
        y: 100,
      });
      const hurtbox = createMockBox({
        type: BOX_TYPE.HURTBOX,
        team: TEAM.ENEMY,
        owner: { id: 'enemy1' },
        active: false,
        x: 100,
        y: 100,
      });

      cm.register(hitbox);
      cm.register(hurtbox);
      cm.checkCollisions();

      expect(scene.events.emit).not.toHaveBeenCalled();
    });

    it('should skip same team collisions', () => {
      const hitbox = createMockBox({
        type: BOX_TYPE.HITBOX,
        team: TEAM.PLAYER,
        x: 100,
        y: 100,
      });
      const hurtbox = createMockBox({
        type: BOX_TYPE.HURTBOX,
        team: TEAM.PLAYER,
        owner: { id: 'player2' },
        x: 100,
        y: 100,
      });

      cm.register(hitbox);
      cm.register(hurtbox);
      cm.checkCollisions();

      expect(scene.events.emit).not.toHaveBeenCalled();
    });

    it('should skip same owner collisions', () => {
      const sharedOwner = { id: 'player1' };
      const hitbox = createMockBox({
        type: BOX_TYPE.HITBOX,
        team: TEAM.PLAYER,
        owner: sharedOwner,
        x: 100,
        y: 100,
      });
      const hurtbox = createMockBox({
        type: BOX_TYPE.HURTBOX,
        team: TEAM.ENEMY, // Different team, but same owner
        owner: sharedOwner,
        x: 100,
        y: 100,
      });

      cm.register(hitbox);
      cm.register(hurtbox);
      cm.checkCollisions();

      expect(scene.events.emit).not.toHaveBeenCalled();
    });

    it('should skip already hit targets', () => {
      const hitbox = createMockBox({
        type: BOX_TYPE.HITBOX,
        team: TEAM.PLAYER,
        x: 100,
        y: 100,
      });
      const enemyOwner = { id: 'enemy1' };
      const hurtbox = createMockBox({
        type: BOX_TYPE.HURTBOX,
        team: TEAM.ENEMY,
        owner: enemyOwner,
        x: 100,
        y: 100,
      });

      // Mark as already hit
      hitbox.markHit(enemyOwner);

      cm.register(hitbox);
      cm.register(hurtbox);
      cm.checkCollisions();

      expect(scene.events.emit).not.toHaveBeenCalled();
    });

    it('should detect valid hit between opposing teams', () => {
      const hitbox = createMockBox({
        type: BOX_TYPE.HITBOX,
        team: TEAM.PLAYER,
        owner: { id: 'player1', sprite: { flipX: false } },
        x: 100,
        y: 100,
      });
      const hurtbox = createMockBox({
        type: BOX_TYPE.HURTBOX,
        team: TEAM.ENEMY,
        owner: { id: 'enemy1' },
        x: 100,
        y: 100,
      });

      cm.register(hitbox);
      cm.register(hurtbox);
      cm.checkCollisions();

      expect(scene.events.emit).toHaveBeenCalledWith('combat:hit', expect.objectContaining({
        attacker: hitbox.owner,
        defender: hurtbox.owner,
        damage: hitbox.damage,
      }));
    });
  });

  describe('resolveHit', () => {
    it('should mark target as hit', () => {
      const hitbox = createMockBox({
        type: BOX_TYPE.HITBOX,
        team: TEAM.PLAYER,
        owner: { id: 'player1', sprite: { flipX: false } },
      });
      const enemyOwner = { id: 'enemy1' };
      const hurtbox = createMockBox({
        type: BOX_TYPE.HURTBOX,
        team: TEAM.ENEMY,
        owner: enemyOwner,
      });

      cm.resolveHit(hitbox, hurtbox);

      expect(hitbox.hasAlreadyHit(enemyOwner)).toBe(true);
    });

    it('should emit combat:hit event', () => {
      const hitbox = createMockBox({
        type: BOX_TYPE.HITBOX,
        team: TEAM.PLAYER,
        owner: { id: 'player1', sprite: { flipX: false } },
        damage: 25,
      });
      const hurtbox = createMockBox({
        type: BOX_TYPE.HURTBOX,
        team: TEAM.ENEMY,
        owner: { id: 'enemy1' },
      });

      cm.resolveHit(hitbox, hurtbox);

      expect(scene.events.emit).toHaveBeenCalledWith('combat:hit', expect.objectContaining({
        damage: 25,
      }));
    });

    it('should call takeDamage on defender if available', () => {
      const hitbox = createMockBox({
        type: BOX_TYPE.HITBOX,
        team: TEAM.PLAYER,
        owner: { id: 'player1', sprite: { flipX: false } },
        damage: 15,
      });
      const defender = {
        id: 'enemy1',
        takeDamage: vi.fn(),
      };
      const hurtbox = createMockBox({
        type: BOX_TYPE.HURTBOX,
        team: TEAM.ENEMY,
        owner: defender,
      });

      cm.resolveHit(hitbox, hurtbox);

      expect(defender.takeDamage).toHaveBeenCalledWith(15, expect.any(Object));
    });

    it('should apply positive knockback when attacker facing right', () => {
      const hitbox = createMockBox({
        type: BOX_TYPE.HITBOX,
        team: TEAM.PLAYER,
        owner: { id: 'player1', sprite: { flipX: false } },
        knockback: { x: 300, y: -150 },
      });
      const hurtbox = createMockBox({
        type: BOX_TYPE.HURTBOX,
        team: TEAM.ENEMY,
        owner: { id: 'enemy1' },
      });

      cm.resolveHit(hitbox, hurtbox);

      const hitData = scene.events.emit.mock.calls[0][1];
      expect(hitData.knockback.x).toBe(300);
    });

    it('should apply negative knockback when attacker facing left', () => {
      const hitbox = createMockBox({
        type: BOX_TYPE.HITBOX,
        team: TEAM.PLAYER,
        owner: { id: 'player1', sprite: { flipX: true } },
        knockback: { x: 300, y: -150 },
      });
      const hurtbox = createMockBox({
        type: BOX_TYPE.HURTBOX,
        team: TEAM.ENEMY,
        owner: { id: 'enemy1' },
      });

      cm.resolveHit(hitbox, hurtbox);

      const hitData = scene.events.emit.mock.calls[0][1];
      expect(hitData.knockback.x).toBe(-300);
    });

    it('should apply hitstop when timeManager is set', () => {
      const timeManager = {
        applyHitstop: vi.fn(),
      };
      cm.setTimeManager(timeManager);

      const hitbox = createMockBox({
        type: BOX_TYPE.HITBOX,
        team: TEAM.PLAYER,
        owner: { id: 'player1', sprite: { flipX: false } },
        hitstop: 80,
      });
      const hurtbox = createMockBox({
        type: BOX_TYPE.HURTBOX,
        team: TEAM.ENEMY,
        owner: { id: 'enemy1' },
      });

      cm.resolveHit(hitbox, hurtbox);

      expect(timeManager.applyHitstop).toHaveBeenCalledWith(80);
    });

    it('should call registered onHit callbacks', () => {
      const callback = vi.fn();
      cm.onHit(callback);

      const hitbox = createMockBox({
        type: BOX_TYPE.HITBOX,
        team: TEAM.PLAYER,
        owner: { id: 'player1', sprite: { flipX: false } },
      });
      const hurtbox = createMockBox({
        type: BOX_TYPE.HURTBOX,
        team: TEAM.ENEMY,
        owner: { id: 'enemy1' },
      });

      cm.resolveHit(hitbox, hurtbox);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        attacker: hitbox.owner,
        defender: hurtbox.owner,
      }));
    });

    it('should apply velocity to defender body if available', () => {
      const hitbox = createMockBox({
        type: BOX_TYPE.HITBOX,
        team: TEAM.PLAYER,
        owner: { id: 'player1', sprite: { flipX: false } },
        knockback: { x: 400, y: -200 },
      });
      const defenderSprite = {
        body: {
          setVelocity: vi.fn(),
        },
      };
      const hurtbox = createMockBox({
        type: BOX_TYPE.HURTBOX,
        team: TEAM.ENEMY,
        owner: { id: 'enemy1', sprite: defenderSprite },
      });

      cm.resolveHit(hitbox, hurtbox);

      expect(defenderSprite.body.setVelocity).toHaveBeenCalledWith(400, -200);
    });
  });

  describe('update', () => {
    it('should update positions of active boxes', () => {
      const hitbox = createMockBox({ type: BOX_TYPE.HITBOX, active: true });
      const hurtbox = createMockBox({ type: BOX_TYPE.HURTBOX, active: true });

      cm.register(hitbox);
      cm.register(hurtbox);
      cm.update(1000, 16);

      expect(hitbox.updatePosition).toHaveBeenCalled();
      expect(hurtbox.updatePosition).toHaveBeenCalled();
    });

    it('should not update positions of inactive boxes', () => {
      const hitbox = createMockBox({ type: BOX_TYPE.HITBOX, active: false });
      const hurtbox = createMockBox({ type: BOX_TYPE.HURTBOX, active: false });

      cm.register(hitbox);
      cm.register(hurtbox);
      cm.update(1000, 16);

      expect(hitbox.updatePosition).not.toHaveBeenCalled();
      expect(hurtbox.updatePosition).not.toHaveBeenCalled();
    });
  });

  describe('onHit callback registration', () => {
    it('should register callback', () => {
      const callback = vi.fn();
      cm.onHit(callback);
      expect(cm.onHitCallbacks).toContain(callback);
    });

    it('should support multiple callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      cm.onHit(callback1);
      cm.onHit(callback2);
      expect(cm.onHitCallbacks).toHaveLength(2);
    });
  });

  describe('destroy', () => {
    it('should clear all boxes and callbacks', () => {
      const hitbox = createMockBox({ type: BOX_TYPE.HITBOX });
      hitbox.destroy = vi.fn();
      const hurtbox = createMockBox({ type: BOX_TYPE.HURTBOX });
      hurtbox.destroy = vi.fn();

      cm.register(hitbox);
      cm.register(hurtbox);
      cm.onHit(() => {});
      cm.destroy();

      expect(hitbox.destroy).toHaveBeenCalled();
      expect(hurtbox.destroy).toHaveBeenCalled();
      expect(cm.hitboxes.size).toBe(0);
      expect(cm.hurtboxes.size).toBe(0);
      expect(cm.onHitCallbacks).toEqual([]);
    });
  });
});
