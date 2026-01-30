import { describe, it, expect, beforeEach } from 'vitest';
import { TimeManager } from '../../js/systems/TimeManager.js';

describe('TimeManager', () => {
  let tm;
  let mockScene;

  beforeEach(() => {
    mockScene = {};
    tm = new TimeManager(mockScene);
  });

  describe('constructor', () => {
    it('should initialize with zero hitstop', () => {
      expect(tm.hitstopRemaining).toBe(0);
    });

    it('should initialize with zero slowmo', () => {
      expect(tm.slowmoRemaining).toBe(0);
      expect(tm.slowmoScale).toBe(1);
    });

    it('should initialize not paused', () => {
      expect(tm.isPaused).toBe(false);
    });

    it('should store scene reference', () => {
      expect(tm.scene).toBe(mockScene);
    });
  });

  describe('applyHitstop', () => {
    it('should set hitstop remaining', () => {
      tm.applyHitstop(100);
      expect(tm.hitstopRemaining).toBe(100);
    });

    it('should keep longer duration if already in hitstop', () => {
      tm.applyHitstop(100);
      tm.applyHitstop(50);
      expect(tm.hitstopRemaining).toBe(100);
    });

    it('should extend hitstop if new duration is longer', () => {
      tm.applyHitstop(50);
      tm.applyHitstop(100);
      expect(tm.hitstopRemaining).toBe(100);
    });
  });

  describe('applySlowmo', () => {
    it('should set slowmo remaining and scale', () => {
      tm.applySlowmo(500, 0.5);
      expect(tm.slowmoRemaining).toBe(500);
      expect(tm.slowmoScale).toBe(0.5);
    });

    it('should use default scale of 0.3', () => {
      tm.applySlowmo(500);
      expect(tm.slowmoScale).toBe(0.3);
    });

    it('should replace existing slowmo', () => {
      tm.applySlowmo(500, 0.5);
      tm.applySlowmo(200, 0.8);
      expect(tm.slowmoRemaining).toBe(200);
      expect(tm.slowmoScale).toBe(0.8);
    });
  });

  describe('clearSlowmo', () => {
    it('should immediately clear slowmo effect', () => {
      tm.applySlowmo(500, 0.5);
      tm.clearSlowmo();
      expect(tm.slowmoRemaining).toBe(0);
      expect(tm.slowmoScale).toBe(1);
    });
  });

  describe('isFrozen', () => {
    it('should return true when hitstop is active', () => {
      tm.applyHitstop(100);
      expect(tm.isFrozen()).toBe(true);
    });

    it('should return false when no hitstop', () => {
      expect(tm.isFrozen()).toBe(false);
    });

    it('should return false after hitstop expires', () => {
      tm.applyHitstop(50);
      tm.update(60);
      expect(tm.isFrozen()).toBe(false);
    });
  });

  describe('getTimeScale', () => {
    it('should return 1 when no effects active', () => {
      expect(tm.getTimeScale()).toBe(1);
    });

    it('should return 0 when hitstop is active', () => {
      tm.applyHitstop(100);
      expect(tm.getTimeScale()).toBe(0);
    });

    it('should return slowmo scale when slowmo is active', () => {
      tm.applySlowmo(500, 0.3);
      expect(tm.getTimeScale()).toBe(0.3);
    });

    it('should prioritize hitstop over slowmo', () => {
      tm.applyHitstop(100);
      tm.applySlowmo(500, 0.5);
      expect(tm.getTimeScale()).toBe(0);
    });

    it('should return slowmo scale after hitstop expires', () => {
      tm.applyHitstop(50);
      tm.applySlowmo(500, 0.4);
      tm.update(60);
      expect(tm.getTimeScale()).toBe(0.4);
    });
  });

  describe('getScaledDelta', () => {
    it('should return full delta when no effects', () => {
      const delta = 16;
      expect(tm.getScaledDelta(delta)).toBe(16);
    });

    it('should return 0 during hitstop', () => {
      tm.applyHitstop(100);
      expect(tm.getScaledDelta(16)).toBe(0);
    });

    it('should scale delta during slowmo', () => {
      tm.applySlowmo(500, 0.5);
      expect(tm.getScaledDelta(16)).toBe(8);
    });

    it('should handle very small slowmo scales', () => {
      tm.applySlowmo(500, 0.1);
      expect(tm.getScaledDelta(16)).toBeCloseTo(1.6, 5);
    });
  });

  describe('update', () => {
    describe('hitstop countdown', () => {
      it('should decrease hitstop by delta', () => {
        tm.applyHitstop(100);
        tm.update(30);
        expect(tm.hitstopRemaining).toBe(70);
      });

      it('should not go below zero', () => {
        tm.applyHitstop(50);
        tm.update(100);
        expect(tm.hitstopRemaining).toBe(0);
      });

      it('should count down with real time (not scaled)', () => {
        tm.applyHitstop(100);
        tm.applySlowmo(500, 0.1);
        tm.update(50);
        // Should still subtract 50, not 50 * 0.1
        expect(tm.hitstopRemaining).toBe(50);
      });
    });

    describe('slowmo countdown', () => {
      it('should decrease slowmo by delta', () => {
        tm.applySlowmo(500, 0.5);
        tm.update(100);
        expect(tm.slowmoRemaining).toBe(400);
      });

      it('should not go below zero', () => {
        tm.applySlowmo(50, 0.5);
        tm.update(100);
        expect(tm.slowmoRemaining).toBe(0);
      });

      it('should reset scale to 1 when slowmo expires', () => {
        tm.applySlowmo(50, 0.3);
        tm.update(60);
        expect(tm.slowmoRemaining).toBe(0);
        expect(tm.slowmoScale).toBe(1);
      });

      it('should keep scale during slowmo', () => {
        tm.applySlowmo(100, 0.3);
        tm.update(50);
        expect(tm.slowmoScale).toBe(0.3);
      });
    });

    describe('combined effects', () => {
      it('should count down both simultaneously', () => {
        tm.applyHitstop(100);
        tm.applySlowmo(200, 0.5);

        tm.update(50);
        expect(tm.hitstopRemaining).toBe(50);
        expect(tm.slowmoRemaining).toBe(150);

        tm.update(60);
        expect(tm.hitstopRemaining).toBe(0);
        expect(tm.slowmoRemaining).toBe(90);
      });
    });
  });

  describe('getDebugInfo', () => {
    it('should return formatted debug object', () => {
      tm.applyHitstop(55.5);
      tm.applySlowmo(123.7, 0.333);

      const info = tm.getDebugInfo();

      expect(info.hitstop).toBe(56); // rounded
      expect(info.slowmo).toBe(124); // rounded
      expect(info.timeScale).toBe('0.00'); // hitstop takes priority
    });

    it('should show slowmo scale when no hitstop', () => {
      tm.applySlowmo(100, 0.45);
      const info = tm.getDebugInfo();
      expect(info.timeScale).toBe('0.45');
    });

    it('should show 1.00 when no effects', () => {
      const info = tm.getDebugInfo();
      expect(info.timeScale).toBe('1.00');
    });
  });
});
