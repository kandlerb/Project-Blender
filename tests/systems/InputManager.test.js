import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ACTIONS } from '../../js/systems/InputManager.js';

// We can't easily test the full InputManager without Phaser,
// but we can test the buffer logic by extracting it or testing
// a simplified version that mimics the buffer behavior.

// For the actual InputManager, we'll test what we can mock
// and focus on the buffer algorithm.

describe('ACTIONS enum', () => {
  it('should define movement actions', () => {
    expect(ACTIONS.MOVE_LEFT).toBe('move_left');
    expect(ACTIONS.MOVE_RIGHT).toBe('move_right');
    expect(ACTIONS.JUMP).toBe('jump');
    expect(ACTIONS.CROUCH).toBe('crouch');
  });

  it('should define combat actions', () => {
    expect(ACTIONS.ATTACK_LIGHT).toBe('attack_light');
    expect(ACTIONS.ATTACK_HEAVY).toBe('attack_heavy');
    expect(ACTIONS.SPIN).toBe('spin');
    expect(ACTIONS.SPECIAL).toBe('special');
    expect(ACTIONS.ULTIMATE).toBe('ultimate');
  });

  it('should define ability actions', () => {
    expect(ACTIONS.FLIP).toBe('flip');
    expect(ACTIONS.BLINK).toBe('blink');
    expect(ACTIONS.GRAPPLE).toBe('grapple');
  });

  it('should define weapon actions', () => {
    expect(ACTIONS.WEAPON_SWAP).toBe('weapon_swap');
    expect(ACTIONS.WEAPON_NEXT).toBe('weapon_next');
    expect(ACTIONS.WEAPON_PREV).toBe('weapon_prev');
  });

  it('should be frozen', () => {
    expect(Object.isFrozen(ACTIONS)).toBe(true);
  });
});

// Test the buffer logic in isolation
describe('InputBuffer logic', () => {
  // Simplified buffer implementation matching InputManager
  class TestInputBuffer {
    constructor() {
      this.buffer = [];
    }

    bufferAction(action, time) {
      this.buffer.push({ action, timestamp: time });
    }

    consumeBuffered(action, currentTime, windowMs = 100) {
      const index = this.buffer.findIndex(entry =>
        entry.action === action &&
        (currentTime - entry.timestamp) <= windowMs
      );

      if (index !== -1) {
        this.buffer.splice(index, 1);
        return true;
      }
      return false;
    }

    isBuffered(action, currentTime, windowMs = 100) {
      return this.buffer.some(entry =>
        entry.action === action &&
        (currentTime - entry.timestamp) <= windowMs
      );
    }

    update(time, maxAge = 200) {
      this.buffer = this.buffer.filter(entry =>
        (time - entry.timestamp) <= maxAge
      );
    }

    clearBuffer() {
      this.buffer = [];
    }
  }

  let inputBuffer;

  beforeEach(() => {
    inputBuffer = new TestInputBuffer();
  });

  describe('bufferAction', () => {
    it('should add action to buffer with timestamp', () => {
      inputBuffer.bufferAction('jump', 1000);
      expect(inputBuffer.buffer).toHaveLength(1);
      expect(inputBuffer.buffer[0]).toEqual({ action: 'jump', timestamp: 1000 });
    });

    it('should allow multiple buffered actions', () => {
      inputBuffer.bufferAction('jump', 1000);
      inputBuffer.bufferAction('attack', 1050);
      expect(inputBuffer.buffer).toHaveLength(2);
    });

    it('should allow same action buffered multiple times', () => {
      inputBuffer.bufferAction('jump', 1000);
      inputBuffer.bufferAction('jump', 1050);
      expect(inputBuffer.buffer).toHaveLength(2);
    });
  });

  describe('consumeBuffered', () => {
    it('should return true and remove action if within window', () => {
      inputBuffer.bufferAction('jump', 1000);
      const result = inputBuffer.consumeBuffered('jump', 1050, 100);
      expect(result).toBe(true);
      expect(inputBuffer.buffer).toHaveLength(0);
    });

    it('should return false if action not in buffer', () => {
      inputBuffer.bufferAction('attack', 1000);
      const result = inputBuffer.consumeBuffered('jump', 1050, 100);
      expect(result).toBe(false);
      expect(inputBuffer.buffer).toHaveLength(1); // attack still there
    });

    it('should return false if action outside window', () => {
      inputBuffer.bufferAction('jump', 1000);
      const result = inputBuffer.consumeBuffered('jump', 1200, 100);
      expect(result).toBe(false);
      expect(inputBuffer.buffer).toHaveLength(1); // jump still there
    });

    it('should consume at exactly window boundary', () => {
      inputBuffer.bufferAction('jump', 1000);
      const result = inputBuffer.consumeBuffered('jump', 1100, 100);
      expect(result).toBe(true);
    });

    it('should only consume one entry if multiple exist', () => {
      inputBuffer.bufferAction('jump', 1000);
      inputBuffer.bufferAction('jump', 1050);

      const result = inputBuffer.consumeBuffered('jump', 1060, 100);
      expect(result).toBe(true);
      expect(inputBuffer.buffer).toHaveLength(1);
    });

    it('should use default window of 100ms', () => {
      inputBuffer.bufferAction('jump', 1000);

      // Within default 100ms window
      expect(inputBuffer.consumeBuffered('jump', 1080)).toBe(true);

      inputBuffer.bufferAction('attack', 1000);
      // Outside default 100ms window
      expect(inputBuffer.consumeBuffered('attack', 1150)).toBe(false);
    });
  });

  describe('isBuffered', () => {
    it('should return true if action is in buffer within window', () => {
      inputBuffer.bufferAction('jump', 1000);
      expect(inputBuffer.isBuffered('jump', 1050, 100)).toBe(true);
    });

    it('should return false if action not in buffer', () => {
      inputBuffer.bufferAction('attack', 1000);
      expect(inputBuffer.isBuffered('jump', 1050, 100)).toBe(false);
    });

    it('should return false if action outside window', () => {
      inputBuffer.bufferAction('jump', 1000);
      expect(inputBuffer.isBuffered('jump', 1200, 100)).toBe(false);
    });

    it('should NOT consume the action (unlike consumeBuffered)', () => {
      inputBuffer.bufferAction('jump', 1000);
      inputBuffer.isBuffered('jump', 1050, 100);
      expect(inputBuffer.buffer).toHaveLength(1);
    });
  });

  describe('update (buffer cleanup)', () => {
    it('should remove entries older than maxAge', () => {
      inputBuffer.bufferAction('jump', 1000);
      inputBuffer.bufferAction('attack', 1100);
      inputBuffer.update(1250, 200);

      // jump at 1000 is 250ms old, should be removed
      // attack at 1100 is 150ms old, should remain
      expect(inputBuffer.buffer).toHaveLength(1);
      expect(inputBuffer.buffer[0].action).toBe('attack');
    });

    it('should keep entries at exactly maxAge', () => {
      inputBuffer.bufferAction('jump', 1000);
      inputBuffer.update(1200, 200);
      expect(inputBuffer.buffer).toHaveLength(1);
    });

    it('should use default maxAge of 200ms', () => {
      inputBuffer.bufferAction('jump', 1000);
      inputBuffer.update(1250); // default maxAge
      expect(inputBuffer.buffer).toHaveLength(0);
    });

    it('should handle empty buffer', () => {
      expect(() => inputBuffer.update(1000)).not.toThrow();
      expect(inputBuffer.buffer).toHaveLength(0);
    });
  });

  describe('clearBuffer', () => {
    it('should remove all entries', () => {
      inputBuffer.bufferAction('jump', 1000);
      inputBuffer.bufferAction('attack', 1050);
      inputBuffer.clearBuffer();
      expect(inputBuffer.buffer).toHaveLength(0);
    });
  });
});

// Test axis calculation logic
describe('Axis calculation logic', () => {
  // Simplified axis calculation matching InputManager
  function getHorizontalAxis(leftDown, rightDown) {
    const left = leftDown ? -1 : 0;
    const right = rightDown ? 1 : 0;
    return left + right;
  }

  function getVerticalAxis(upDown, downDown) {
    const up = upDown ? -1 : 0;
    const down = downDown ? 1 : 0;
    return up + down;
  }

  describe('getHorizontalAxis', () => {
    it('should return -1 when only left is pressed', () => {
      expect(getHorizontalAxis(true, false)).toBe(-1);
    });

    it('should return 1 when only right is pressed', () => {
      expect(getHorizontalAxis(false, true)).toBe(1);
    });

    it('should return 0 when neither is pressed', () => {
      expect(getHorizontalAxis(false, false)).toBe(0);
    });

    it('should return 0 when both are pressed (cancel out)', () => {
      expect(getHorizontalAxis(true, true)).toBe(0);
    });
  });

  describe('getVerticalAxis', () => {
    it('should return -1 when only up is pressed', () => {
      expect(getVerticalAxis(true, false)).toBe(-1);
    });

    it('should return 1 when only down is pressed', () => {
      expect(getVerticalAxis(false, true)).toBe(1);
    });

    it('should return 0 when neither is pressed', () => {
      expect(getVerticalAxis(false, false)).toBe(0);
    });

    it('should return 0 when both are pressed (cancel out)', () => {
      expect(getVerticalAxis(true, true)).toBe(0);
    });
  });
});
