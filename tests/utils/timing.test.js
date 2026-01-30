import { describe, it, expect } from 'vitest';
import { TIMING } from '../../js/utils/timing.js';

describe('TIMING utilities', () => {
  describe('framesToMs', () => {
    it('should convert 1 frame to ~16.67ms at 60fps', () => {
      const result = TIMING.framesToMs(1);
      expect(result).toBeCloseTo(1000 / 60, 2);
    });

    it('should convert 60 frames to 1000ms', () => {
      const result = TIMING.framesToMs(60);
      expect(result).toBeCloseTo(1000, 5);
    });

    it('should convert 0 frames to 0ms', () => {
      const result = TIMING.framesToMs(0);
      expect(result).toBe(0);
    });

    it('should handle fractional frames', () => {
      const result = TIMING.framesToMs(0.5);
      expect(result).toBeCloseTo(1000 / 120, 2);
    });
  });

  describe('msToFrames', () => {
    it('should convert 1000ms to 60 frames', () => {
      const result = TIMING.msToFrames(1000);
      expect(result).toBe(60);
    });

    it('should convert ~16.67ms to 1 frame', () => {
      const result = TIMING.msToFrames(1000 / 60);
      expect(result).toBe(1);
    });

    it('should convert 0ms to 0 frames', () => {
      const result = TIMING.msToFrames(0);
      expect(result).toBe(0);
    });

    it('should round to nearest frame', () => {
      // 25ms is 1.5 frames, should round to 2
      const result = TIMING.msToFrames(25);
      expect(result).toBe(2);
    });
  });

  describe('hasElapsed', () => {
    it('should return true when duration has passed', () => {
      const startTime = 1000;
      const duration = 500;
      const currentTime = 1600;
      expect(TIMING.hasElapsed(startTime, duration, currentTime)).toBe(true);
    });

    it('should return false when duration has not passed', () => {
      const startTime = 1000;
      const duration = 500;
      const currentTime = 1200;
      expect(TIMING.hasElapsed(startTime, duration, currentTime)).toBe(false);
    });

    it('should return true when exactly at duration boundary', () => {
      const startTime = 1000;
      const duration = 500;
      const currentTime = 1500;
      expect(TIMING.hasElapsed(startTime, duration, currentTime)).toBe(true);
    });

    it('should handle zero duration', () => {
      const startTime = 1000;
      const duration = 0;
      const currentTime = 1000;
      expect(TIMING.hasElapsed(startTime, duration, currentTime)).toBe(true);
    });
  });
});
