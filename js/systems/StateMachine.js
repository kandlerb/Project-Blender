/**
 * Individual state definition
 * Extend this class for each state (IdleState, RunState, etc.)
 */
export class State {
  /**
   * @param {string} name - Unique state identifier
   * @param {StateMachine} stateMachine - Parent state machine
   */
  constructor(name, stateMachine) {
    this.name = name;
    this.stateMachine = stateMachine;
  }

  /**
   * Get the entity this state controls
   * @returns {*} The entity (Player, Enemy, etc.)
   */
  get entity() {
    return this.stateMachine.owner;
  }

  /**
   * Called when entering this state
   * @param {object} prevState - The state we're coming from (or null)
   * @param {object} params - Optional parameters passed during transition
   */
  enter(prevState, params = {}) {
    // Override in subclass
  }

  /**
   * Called every frame while in this state
   * @param {number} time - Total elapsed time in ms
   * @param {number} delta - Time since last frame in ms
   * @returns {string|null} - Return state name to transition, or null to stay
   */
  update(time, delta) {
    // Override in subclass
    return null;
  }

  /**
   * Called when exiting this state
   * @param {object} nextState - The state we're going to
   */
  exit(nextState) {
    // Override in subclass
  }

  /**
   * Check if this state can be interrupted by another state
   * @param {string} nextStateName - The state trying to interrupt
   * @returns {boolean}
   */
  canBeInterrupted(nextStateName) {
    return true; // Override for states that shouldn't be interrupted
  }

  /**
   * Handle taking damage while in this state
   * @param {number} damage
   * @param {object} source - What dealt the damage
   * @returns {string|null} - State to transition to, or null
   */
  onDamage(damage, source) {
    return null; // Override to handle damage reactions
  }
}

/**
 * State Machine - Manages state transitions and updates
 */
export class StateMachine {
  /**
   * @param {*} owner - The entity this state machine controls
   * @param {string} initialStateName - Starting state name
   */
  constructor(owner, initialStateName = null) {
    this.owner = owner;
    this.states = new Map();
    this.currentState = null;
    this.previousState = null;
    this.stateTime = 0; // Time spent in current state
    this.initialStateName = initialStateName;

    // State history for debugging
    this.history = [];
    this.maxHistory = 10;
  }

  /**
   * Register a state with the machine
   * @param {State} state - State instance to register
   * @returns {StateMachine} - For chaining
   */
  addState(state) {
    this.states.set(state.name, state);
    return this;
  }

  /**
   * Register multiple states at once
   * @param {State[]} states - Array of state instances
   * @returns {StateMachine} - For chaining
   */
  addStates(states) {
    states.forEach(state => this.addState(state));
    return this;
  }

  /**
   * Start the state machine (call after adding all states)
   * @param {string} stateName - Optional override for initial state
   * @param {object} params - Optional params for initial state
   */
  start(stateName = null, params = {}) {
    const startState = stateName || this.initialStateName;
    if (!startState) {
      console.error('StateMachine: No initial state specified');
      return;
    }
    this.transition(startState, params);
  }

  /**
   * Transition to a new state
   * @param {string} stateName - Name of state to transition to
   * @param {object} params - Optional parameters for the new state
   * @param {boolean} force - Force transition even if current state refuses
   * @returns {boolean} - Whether transition occurred
   */
  transition(stateName, params = {}, force = false) {
    const nextState = this.states.get(stateName);

    if (!nextState) {
      console.warn(`StateMachine: Unknown state "${stateName}"`);
      return false;
    }

    // Check if current state allows interruption
    if (this.currentState && !force) {
      if (!this.currentState.canBeInterrupted(stateName)) {
        return false;
      }
    }

    // Exit current state
    if (this.currentState) {
      this.currentState.exit(nextState);
      this.previousState = this.currentState;

      // Track history
      this.history.push(this.currentState.name);
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }
    }

    // Enter new state
    this.currentState = nextState;
    this.stateTime = 0;
    this.currentState.enter(this.previousState, params);

    return true;
  }

  /**
   * Update the current state
   * @param {number} time - Total elapsed time in ms
   * @param {number} delta - Time since last frame in ms
   */
  update(time, delta) {
    if (!this.currentState) return;

    this.stateTime += delta;

    // Let state run its update, check if it wants to transition
    const nextStateName = this.currentState.update(time, delta);

    if (nextStateName && nextStateName !== this.currentState.name) {
      // Force the transition since the state is voluntarily exiting
      // (canBeInterrupted is for external interrupts, not self-transitions)
      this.transition(nextStateName, {}, true);
    }
  }

  /**
   * Get current state name
   * @returns {string|null}
   */
  getCurrentStateName() {
    return this.currentState ? this.currentState.name : null;
  }

  /**
   * Get previous state name
   * @returns {string|null}
   */
  getPreviousStateName() {
    return this.previousState ? this.previousState.name : null;
  }

  /**
   * Check if currently in a specific state
   * @param {string} stateName
   * @returns {boolean}
   */
  isInState(stateName) {
    return this.currentState && this.currentState.name === stateName;
  }

  /**
   * Check if currently in any of the specified states
   * @param {string[]} stateNames
   * @returns {boolean}
   */
  isInAnyState(stateNames) {
    return this.currentState && stateNames.includes(this.currentState.name);
  }

  /**
   * Get time spent in current state (ms)
   * @returns {number}
   */
  getStateTime() {
    return this.stateTime;
  }

  /**
   * Forward damage event to current state
   * @param {number} damage
   * @param {object} source
   */
  onDamage(damage, source) {
    if (!this.currentState) return;

    const nextStateName = this.currentState.onDamage(damage, source);
    if (nextStateName) {
      this.transition(nextStateName, { damage, source }, true);
    }
  }

  /**
   * Debug: Get state history as string
   * @returns {string}
   */
  getHistoryString() {
    const current = this.currentState ? this.currentState.name : 'none';
    return `${this.history.join(' → ')} → [${current}]`;
  }
}
