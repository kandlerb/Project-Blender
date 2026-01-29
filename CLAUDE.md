# CLAUDE.md - AI Assistant Guide for Project Blender

## Project Overview

Project Blender is a 2D action Metroidvania game built with Phaser 3. It features fast-paced combat inspired by Hollow Knight with a stick-figure aesthetic. The game runs directly in the browser using vanilla JavaScript ES6 modules with no build system required.

## Quick Start

```bash
# Start local server
python -m http.server 8000
# or
npx serve .

# Open http://localhost:8000
```

## Tech Stack

- **Engine**: Phaser 3.80+ (loaded via CDN)
- **Language**: Vanilla JavaScript (ES6 modules)
- **Build**: None required - runs directly in browser
- **Deployment**: GitHub Pages

## Project Structure

```
project-blender/
├── index.html              # Entry point, loads Phaser from CDN
├── css/style.css           # Minimal styling for game container
├── js/
│   ├── main.js             # Game configuration and initialization
│   ├── entities/           # Game objects (Player, Enemy, Boss)
│   │   ├── Player.js       # Player entity with state machine
│   │   ├── Enemy.js        # 6 enemy types with AI behaviors
│   │   ├── Boss.js         # Base boss class
│   │   └── bosses/         # Individual boss implementations
│   ├── scenes/             # Phaser scenes
│   │   ├── BaseScene.js    # Common scene functionality
│   │   ├── BootScene.js    # Initial loading
│   │   ├── PreloadScene.js # Asset preloading
│   │   └── TestArenaScene.js # Main test arena
│   ├── systems/            # Core game systems
│   │   ├── StateMachine.js # Generic state machine
│   │   ├── PlayerStates.js # All player states (~40 states)
│   │   ├── InputManager.js # Input handling with buffering
│   │   ├── CombatBox.js    # Hitbox/hurtbox system
│   │   ├── CombatManager.js # Collision resolution
│   │   ├── EffectsManager.js # Visual effects and particles
│   │   ├── TimeManager.js  # Hitstop and time scaling
│   │   └── AudioManager.js # Sound and music
│   ├── weapons/            # Data-driven weapon system
│   │   ├── Weapon.js       # Base weapon class
│   │   ├── WeaponManager.js # Weapon equipping and swapping
│   │   ├── WeaponRegistry.js # Weapon registration
│   │   ├── FistsWeapon.js  # Starting weapon
│   │   ├── TonfasWeapon.js # Parry-focused weapon
│   │   └── ChainWhipWeapon.js # Ranged grapple weapon
│   ├── ui/
│   │   └── HUD.js          # Health bar, combo counter, etc.
│   └── utils/              # Constants and helpers
│       ├── constants.js    # Game dimensions, FPS
│       ├── physics.js      # Gravity, movement speeds
│       ├── combat.js       # Combo timing, damage scaling
│       ├── timing.js       # Frame timing utilities
│       └── audio.js        # Sound effect constants
└── assets/
    └── audio/
        ├── sfx/            # Sound effects
        └── music/          # Background music
```

## Architecture Patterns

### State Machine Pattern (js/systems/StateMachine.js)

The core pattern used for player and enemy behavior. Each entity has discrete states with enter/exit transitions.

```javascript
// State definition
class IdleState extends State {
  enter(prevState, params) { /* setup */ }
  update(time, delta) { return NEXT_STATE_OR_NULL; }
  exit(nextState) { /* cleanup */ }
  canBeInterrupted(nextStateName) { return true; }
}

// Usage
this.stateMachine = new StateMachine(this, INITIAL_STATE);
this.stateMachine.addStates([new IdleState(this.stateMachine), ...]);
this.stateMachine.start();
```

Player states are defined in `js/systems/PlayerStates.js` - there are ~40 states covering movement, combat, and abilities.

### Combat System (js/systems/CombatManager.js, CombatBox.js)

Hitbox/hurtbox collision system:
- **Hitboxes**: Attached to attackers, deal damage on overlap
- **Hurtboxes**: Attached to defenders, receive damage
- **Teams**: PLAYER vs ENEMY prevents friendly fire
- **CombatManager**: Resolves collisions each frame, applies knockback/hitstun/hitstop

```javascript
// Creating a hitbox
this.attackHitbox = new CombatBox(scene, {
  owner: this,
  type: BOX_TYPE.HITBOX,
  team: TEAM.PLAYER,
  width: 50, height: 40,
  offsetX: 35, offsetY: 0,
  damage: 10,
  knockback: { x: 300, y: -150 },
  hitstun: 200,
  hitstop: 50,
});
```

### Weapon System (js/weapons/)

Data-driven weapon definitions. Weapons define attack timings, damage, hitboxes, and optional special mechanics.

```javascript
// Weapon definition
new Weapon({
  id: 'fists',
  name: 'Fists',
  attacks: {
    light1: new AttackData({
      startupTime: 60,    // ms before hitbox activates
      activeTime: 80,     // ms hitbox is active
      recoveryTime: 120,  // ms after hitbox deactivates
      damage: 8,
      knockback: { x: 150, y: -30 },
      hitbox: { width: 45, height: 35, offsetX: 30, offsetY: 0 },
      canComboInto: ['light2', 'heavy'],
    }),
    // light2, light3, heavy, air, spin, special...
  },
  mechanics: { parry: false }, // Weapon-specific mechanics
});
```

### Scene Structure (js/scenes/)

Scenes extend `BaseScene` which provides:
- InputManager initialization
- Camera setup
- `onCreate()` / `onUpdate()` hooks

```javascript
export class MyScene extends BaseScene {
  onCreate() {
    // Setup managers, entities, event listeners
  }
  onUpdate(time, delta) {
    // Game loop logic
  }
}
```

### Event System

The game uses Phaser's built-in event system for decoupled communication:

```javascript
// Emitting events
this.scene.events.emit('combat:hit', hitData);
this.scene.events.emit('enemy:killed', { enemy: this });
this.scene.events.emit('player:damaged', { damage, health });

// Listening
this.events.on('combat:hit', (hitData) => {
  this.effectsManager.hitEffect(x, y, intensity, direction);
});
```

## Key Constants

### Physics (js/utils/physics.js)
- `GRAVITY`: 2400 px/s²
- `TERMINAL_VELOCITY`: 1800 px/s
- `PLAYER.RUN_SPEED`: 600 px/s
- `PLAYER.JUMP_FORCE`: 900 px/s
- `COYOTE_TIME`: 100ms
- `JUMP_BUFFER`: 150ms

### Combat (js/utils/combat.js)
- `COMBO_DECAY_TIME`: 2000ms
- `INPUT_BUFFER`: 100ms
- `HITSTOP.LIGHT`: 50ms
- `HITSTOP.HEAVY`: 100ms
- `ULTIMATE.MAX_METER`: 100

### Game (js/utils/constants.js)
- Resolution: 1920x1080
- Target FPS: 60

## Enemy Types (js/entities/Enemy.js)

| Type | Behavior | Key Properties |
|------|----------|----------------|
| SWARMER | Fast rushdown | 10 HP, speed 250 |
| BRUTE | Slow tank | 60 HP, high damage |
| LUNGER | Telegraphed charge | 600ms windup, 450 charge speed |
| SHIELD_BEARER | Frontal block | Blocks < 30 damage from front |
| LOBBER | Ranged projectiles | Keeps distance, arcing shots |
| DETONATOR | Suicide bomber | Explodes on contact/death, chains |

## Player States Reference

### Movement States
- `idle`, `run`, `jump`, `fall`, `land`
- `wall_slide` - hold toward wall while falling

### Combat States
- `attack_light_1/2/3` - 3-hit combo
- `attack_heavy` - launcher uppercut
- `attack_air` - aerial attack
- `dive_kick` - downward attack from flip

### Ability States
- `flip` - i-frame dodge, can transition to dive_kick
- `blink` - short teleport
- `spin_charge`, `spin_active`, `spin_release` - charged spin attack
- `grapple_fire`, `grapple_travel`, `grapple_pull` - grappling hook

### Weapon States
- `parry`, `counter_attack` - Tonfas weapon
- `weapon_swap` - brief swap animation
- `ultimate` - full meter attack

## Debug Controls

| Key | Action |
|-----|--------|
| ` (backtick) | Toggle physics debug |
| C | Toggle combat debug (hitboxes) |
| R | Respawn enemies |
| B | Spawn boss |
| T | Test damage on player |
| M | Toggle mute |

## Development Guidelines

### Adding a New Enemy Type

1. Add preset to `ENEMY_PRESETS` in `js/entities/Enemy.js`
2. Add behavior update method (e.g., `updateMyEnemyAI`)
3. Route to it in `update()` switch statement
4. Add spawn point in `TestArenaScene.spawnEnemies()`

### Adding a New Weapon

1. Create new file in `js/weapons/` (e.g., `MyWeapon.js`)
2. Define weapon with attacks using `Weapon` and `AttackData` classes
3. Call `registerWeapon(myWeapon)` at end of file
4. Import in `js/weapons/index.js`
5. Add to player's available weapons in `WeaponManager`

### Adding a New Player State

1. Add state name to `PLAYER_STATES` in `js/systems/PlayerStates.js`
2. Create state class extending `PlayerState`
3. Implement `enter()`, `update()`, `exit()`
4. Add to `createPlayerStates()` function
5. Add transitions from relevant existing states

### Adding Visual Effects

Use `EffectsManager` (available as `scene.effectsManager`):

```javascript
// Hit effects
this.effectsManager.hitEffect(x, y, 'light'|'medium'|'heavy'|'critical', direction);
this.effectsManager.damageNumber(x, y, damage, isCrit);

// Movement effects
this.effectsManager.dustCloud(x, y, count, direction);
this.effectsManager.blinkEffect(fromX, fromY, toX, toY);
this.effectsManager.dodgeTrail(x, y, direction);

// Screen effects
this.effectsManager.screenShake(intensity, duration);
this.effectsManager.screenFlash(color, duration, alpha);
```

## Code Style Conventions

- ES6 modules with explicit imports/exports
- Classes use PascalCase, methods use camelCase
- Constants use SCREAMING_SNAKE_CASE in Object.freeze()
- JSDoc comments for public methods
- State names as frozen constant objects
- Composition over inheritance where practical
- Events for cross-system communication

## Common Patterns

### Activating Hitboxes in Attack States

```javascript
enter(prevState, params) {
  const attackData = this.player.getAttackData('light1');
  this.attackData = attackData;
}

update(time, delta) {
  const stateTime = this.stateMachine.getStateTime();

  // Startup phase
  if (stateTime < this.attackData.startupTime) return null;

  // Active phase - activate hitbox
  if (stateTime < this.attackData.startupTime + this.attackData.activeTime) {
    this.player.activateAttackHitbox({
      damage: this.attackData.damage,
      knockback: this.attackData.knockback,
      // ...
    });
    return null;
  }

  // Recovery phase
  this.player.deactivateAttackHitbox();
  // ... handle combo cancels, return next state
}
```

### Checking Input with Buffering

```javascript
// In a state's update method
if (this.input.justPressed(ACTIONS.ATTACK_LIGHT)) {
  return PLAYER_STATES.ATTACK_LIGHT_1;
}

// For buffered inputs (e.g., jump during landing)
if (this.input.consumeBuffered(ACTIONS.JUMP, time, PHYSICS.PLAYER.JUMP_BUFFER)) {
  this.doJump();
  return PLAYER_STATES.JUMP;
}
```

## Testing Changes

1. Start local server
2. Open browser to localhost
3. Use debug keys (`, C) to visualize
4. Press R to respawn enemies, B for boss
5. Check browser console for errors and debug logs

## Known Issues / TODOs

- Currently uses placeholder sprites (colored rectangles)
- No save/load system yet
- No menu screens
- Controller support not implemented
- Additional bosses and weapons planned

## Global Debug Access

In browser console:
- `window.game` - Phaser game instance
- `window.player` - Player entity
- `window.scene` - Current scene
