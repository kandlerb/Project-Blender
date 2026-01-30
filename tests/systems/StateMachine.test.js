import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StateMachine, State } from '../../js/systems/StateMachine.js';

// Test state implementations
class TestIdleState extends State {
  constructor(stateMachine) {
    super('idle', stateMachine);
    this.enterCalled = false;
    this.exitCalled = false;
    this.updateCount = 0;
  }

  enter(prevState, params) {
    this.enterCalled = true;
    this.prevState = prevState;
    this.params = params;
  }

  update(time, delta) {
    this.updateCount++;
    return null;
  }

  exit(nextState) {
    this.exitCalled = true;
    this.nextState = nextState;
  }
}

class TestRunState extends State {
  constructor(stateMachine) {
    super('run', stateMachine);
  }
}

class TestAttackState extends State {
  constructor(stateMachine) {
    super('attack', stateMachine);
    this.canInterrupt = false;
  }

  canBeInterrupted(nextStateName) {
    return this.canInterrupt;
  }
}

class AutoTransitionState extends State {
  constructor(stateMachine, transitionTo) {
    super('auto', stateMachine);
    this.transitionTo = transitionTo;
  }

  update(time, delta) {
    return this.transitionTo;
  }
}

class DamageReactState extends State {
  constructor(stateMachine) {
    super('damage_react', stateMachine);
  }

  onDamage(damage, source) {
    if (damage > 10) {
      return 'stagger';
    }
    return null;
  }
}

describe('StateMachine', () => {
  let owner;
  let sm;

  beforeEach(() => {
    owner = { name: 'TestEntity' };
    sm = new StateMachine(owner, 'idle');
  });

  describe('constructor', () => {
    it('should initialize with owner and initial state name', () => {
      expect(sm.owner).toBe(owner);
      expect(sm.initialStateName).toBe('idle');
      expect(sm.currentState).toBeNull();
      expect(sm.previousState).toBeNull();
      expect(sm.stateTime).toBe(0);
    });

    it('should initialize empty state registry', () => {
      expect(sm.states.size).toBe(0);
    });

    it('should initialize empty history', () => {
      expect(sm.history).toEqual([]);
      expect(sm.maxHistory).toBe(10);
    });
  });

  describe('addState', () => {
    it('should register a state', () => {
      const state = new TestIdleState(sm);
      sm.addState(state);
      expect(sm.states.get('idle')).toBe(state);
    });

    it('should return self for chaining', () => {
      const state = new TestIdleState(sm);
      const result = sm.addState(state);
      expect(result).toBe(sm);
    });
  });

  describe('addStates', () => {
    it('should register multiple states', () => {
      const idle = new TestIdleState(sm);
      const run = new TestRunState(sm);
      sm.addStates([idle, run]);
      expect(sm.states.size).toBe(2);
      expect(sm.states.get('idle')).toBe(idle);
      expect(sm.states.get('run')).toBe(run);
    });
  });

  describe('start', () => {
    it('should transition to initial state', () => {
      const idle = new TestIdleState(sm);
      sm.addState(idle);
      sm.start();
      expect(sm.currentState).toBe(idle);
      expect(idle.enterCalled).toBe(true);
    });

    it('should allow override of initial state', () => {
      const idle = new TestIdleState(sm);
      const run = new TestRunState(sm);
      sm.addStates([idle, run]);
      sm.start('run');
      expect(sm.currentState).toBe(run);
    });

    it('should pass params to initial state', () => {
      const idle = new TestIdleState(sm);
      sm.addState(idle);
      sm.start('idle', { foo: 'bar' });
      expect(idle.params).toEqual({ foo: 'bar' });
    });
  });

  describe('transition', () => {
    beforeEach(() => {
      sm.addStates([
        new TestIdleState(sm),
        new TestRunState(sm),
        new TestAttackState(sm),
      ]);
      sm.start();
    });

    it('should transition between states', () => {
      const result = sm.transition('run');
      expect(result).toBe(true);
      expect(sm.currentState.name).toBe('run');
    });

    it('should call exit on previous state', () => {
      const idleState = sm.states.get('idle');
      sm.transition('run');
      expect(idleState.exitCalled).toBe(true);
    });

    it('should call enter on new state with prev state', () => {
      sm.transition('run');
      const runState = sm.states.get('run');
      // Run state doesn't track enter, but we can verify it's current
      expect(sm.previousState.name).toBe('idle');
    });

    it('should reset state time on transition', () => {
      sm.stateTime = 500;
      sm.transition('run');
      expect(sm.stateTime).toBe(0);
    });

    it('should return false for unknown state', () => {
      const result = sm.transition('unknown');
      expect(result).toBe(false);
      expect(sm.currentState.name).toBe('idle');
    });

    it('should respect canBeInterrupted', () => {
      sm.transition('attack');
      const attackState = sm.states.get('attack');
      attackState.canInterrupt = false;

      const result = sm.transition('idle');
      expect(result).toBe(false);
      expect(sm.currentState.name).toBe('attack');
    });

    it('should allow forced transitions', () => {
      sm.transition('attack');
      const attackState = sm.states.get('attack');
      attackState.canInterrupt = false;

      const result = sm.transition('idle', {}, true);
      expect(result).toBe(true);
      expect(sm.currentState.name).toBe('idle');
    });

    it('should track history', () => {
      sm.transition('run');
      sm.transition('attack');
      expect(sm.history).toEqual(['idle', 'run']);
    });

    it('should limit history to maxHistory', () => {
      sm.maxHistory = 3;
      // Starting state 'idle' -> run (history: ['idle'])
      sm.transition('run');
      // run -> attack (history: ['idle', 'run'])
      sm.transition('attack');
      // attack -> idle (force=true since attack blocks interrupts by default)
      sm.transition('idle', {}, true);
      // idle -> run (history will be trimmed to 3)
      sm.transition('run');
      expect(sm.history.length).toBe(3);
      // History: ['idle', 'run', 'attack'] then push 'idle' -> ['idle', 'run', 'attack', 'idle'] -> shift -> ['run', 'attack', 'idle']
      expect(sm.history).toEqual(['run', 'attack', 'idle']);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      sm.addState(new TestIdleState(sm));
      sm.start();
    });

    it('should increment state time', () => {
      sm.update(1000, 16);
      expect(sm.stateTime).toBe(16);
      sm.update(1016, 16);
      expect(sm.stateTime).toBe(32);
    });

    it('should call state update method', () => {
      const idleState = sm.states.get('idle');
      sm.update(1000, 16);
      expect(idleState.updateCount).toBe(1);
    });

    it('should do nothing if no current state', () => {
      const emptySm = new StateMachine(owner);
      expect(() => emptySm.update(1000, 16)).not.toThrow();
    });
  });

  describe('auto-transition from update', () => {
    it('should transition when state update returns new state name', () => {
      sm.addStates([
        new AutoTransitionState(sm, 'idle'),
        new TestIdleState(sm),
      ]);
      sm.start('auto');
      expect(sm.currentState.name).toBe('auto');

      sm.update(1000, 16);
      expect(sm.currentState.name).toBe('idle');
    });

    it('should not transition if update returns same state name', () => {
      const selfState = new AutoTransitionState(sm, 'auto');
      sm.addState(selfState);
      sm.start('auto');

      sm.update(1000, 16);
      expect(sm.currentState.name).toBe('auto');
    });
  });

  describe('state query methods', () => {
    beforeEach(() => {
      sm.addStates([new TestIdleState(sm), new TestRunState(sm)]);
      sm.start();
    });

    it('getCurrentStateName should return current state name', () => {
      expect(sm.getCurrentStateName()).toBe('idle');
      sm.transition('run');
      expect(sm.getCurrentStateName()).toBe('run');
    });

    it('getCurrentStateName should return null if no state', () => {
      const emptySm = new StateMachine(owner);
      expect(emptySm.getCurrentStateName()).toBeNull();
    });

    it('getPreviousStateName should return previous state', () => {
      expect(sm.getPreviousStateName()).toBeNull();
      sm.transition('run');
      expect(sm.getPreviousStateName()).toBe('idle');
    });

    it('isInState should check current state', () => {
      expect(sm.isInState('idle')).toBe(true);
      expect(sm.isInState('run')).toBe(false);
    });

    it('isInAnyState should check against array', () => {
      expect(sm.isInAnyState(['idle', 'run'])).toBe(true);
      expect(sm.isInAnyState(['attack', 'run'])).toBe(false);
    });

    it('getStateTime should return time in current state', () => {
      expect(sm.getStateTime()).toBe(0);
      sm.update(1000, 100);
      expect(sm.getStateTime()).toBe(100);
    });
  });

  describe('onDamage', () => {
    it('should forward damage to current state', () => {
      const reactState = new DamageReactState(sm);
      const staggerState = new State('stagger', sm);
      sm.addStates([reactState, staggerState]);
      sm.start('damage_react');

      sm.onDamage(15, { type: 'enemy' });
      expect(sm.currentState.name).toBe('stagger');
    });

    it('should not transition if state returns null', () => {
      const reactState = new DamageReactState(sm);
      sm.addState(reactState);
      sm.start('damage_react');

      sm.onDamage(5, { type: 'enemy' });
      expect(sm.currentState.name).toBe('damage_react');
    });

    it('should do nothing if no current state', () => {
      const emptySm = new StateMachine(owner);
      expect(() => emptySm.onDamage(10, {})).not.toThrow();
    });
  });

  describe('getHistoryString', () => {
    it('should format history for debugging', () => {
      sm.addStates([new TestIdleState(sm), new TestRunState(sm)]);
      sm.start();
      sm.transition('run');

      const historyStr = sm.getHistoryString();
      expect(historyStr).toBe('idle → [run]');
    });
  });
});

describe('State', () => {
  let sm;
  let state;

  beforeEach(() => {
    sm = new StateMachine({ name: 'TestOwner' });
    state = new State('test', sm);
  });

  it('should store name and state machine reference', () => {
    expect(state.name).toBe('test');
    expect(state.stateMachine).toBe(sm);
  });

  it('entity getter should return owner', () => {
    expect(state.entity).toEqual({ name: 'TestOwner' });
  });

  it('canBeInterrupted should return true by default', () => {
    expect(state.canBeInterrupted('any')).toBe(true);
  });

  it('onDamage should return null by default', () => {
    expect(state.onDamage(10, {})).toBeNull();
  });

  it('update should return null by default', () => {
    expect(state.update(1000, 16)).toBeNull();
  });
});
