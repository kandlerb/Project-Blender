# Project Blender

> *"Be the boss fight."*

A fast-paced 2D action Metroidvania where fluid movement and aggressive combat combine to create stick-figure-animation-style fights.

**[Play the Latest Build](https://kandlerb.github.io/Project-Blender/)**

---

## About

Project Blender is a passion project blending:
- **Hollow Knight's** tight, weighty combat
- **Stick figure animations'** fluid, dramatic movement
- **Devil May Cry's** combo depth and player expression

You play as a legendary warrior—a nameless one-man army—fighting through an enemy nation that spent years preparing for you.

---

## Current Status

🚧 **In Development** — Core systems functional, placeholder art

### Implemented Features

| System | Status | Description |
|--------|--------|-------------|
| Core Loop | ✅ | Phaser 3 game loop with scene management |
| Player Movement | ✅ | Run, jump, fall, land with physics |
| Combat System | ✅ | Hitbox/hurtbox collision, damage, hitstun |
| Attack Combos | ✅ | 3-hit light combo, heavy attack, air attack |
| Flip/Dodge | ✅ | I-frame dodge with dive kick option |
| Spin Attack | ✅ | Hold to charge, continuous damage, launch finisher |
| Blink | ✅ | Short teleport with afterimage |
| Grappling Hook | ✅ | Pull enemies to player |
| Wall Slide | ✅ | Slow descent on walls |
| Wall Jump | ✅ | Kick off walls while sliding |
| Enemy AI | ✅ | Patrol, chase, attack behaviors |
| Hit Effects | ✅ | Particles, screen shake, damage numbers |
| HUD | ✅ | Health, combo counter, kill tracker, ultimate meter |
| Time System | ✅ | Hitstop on hits, slow-motion support |

### Coming Soon

- [ ] Grapple to surfaces (pull player to walls/ceilings)
- [ ] Weapon system (8 weapons from bosses)
- [ ] Ultimate attack
- [ ] Boss encounters
- [ ] Actual sprite art
- [ ] Sound effects
- [ ] Level design

---

## Controls

### Keyboard

| Action | Key |
|--------|-----|
| Move | WASD or Arrow Keys |
| Jump | Space |
| Light Attack | J |
| Heavy Attack | K |
| Spin Attack | L (hold to charge, release to finish) |
| Flip/Dodge | Shift |
| Blink | I |
| Grapple | U |

### Combat Actions

| Move | Input | Notes |
|------|-------|-------|
| 3-Hit Combo | J, J, J | Chain light attacks |
| Launcher | K | Heavy attack launches enemies |
| Air Attack | J (in air) | Attack while airborne |
| Dive Kick | J during flip descent | Spike enemies downward |
| Spin Attack | Hold L, release | Continuous damage, launch on release |
| Dodge | Shift | I-frames during flip |
| Teleport | I | Short blink with afterimage |
| Pull Enemy | U on enemy | Grapple pulls enemy to you |
| Wall Jump | Space while wall sliding | Kick off walls |

### Debug Controls

| Action | Key |
|--------|-----|
| Respawn Enemies | R |
| Toggle Combat Debug | C |
| Toggle Physics Debug | ` (backtick) |

---

## Running Locally

### Prerequisites
- A static file server (Python, Node, or any HTTP server)
- Modern browser with ES6 module support

### Quick Start
```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/project-blender.git
cd project-blender

# Start a local server (Python 3)
python -m http.server 8000

# Or with Node.js
npx serve .

# Open in browser
open http://localhost:8000
```

### Project Structure
````
project-blender/
├── index.html              # Entry point
├── css/
│   └── style.css           # Game styling
├── js/
│   ├── main.js             # Phaser configuration
│   ├── entities/
│   │   ├── Player.js       # Player entity
│   │   └── Enemy.js        # Enemy entity with AI
│   ├── scenes/
│   │   ├── BaseScene.js    # Scene template
│   │   ├── BootScene.js    # Asset loading setup
│   │   ├── PreloadScene.js # Asset loading
│   │   └── TestArenaScene.js # Main test level
│   ├── systems/
│   │   ├── InputManager.js # Input handling & buffering
│   │   ├── StateMachine.js # Generic state machine
│   │   ├── PlayerStates.js # All player states
│   │   ├── CombatBox.js    # Hitbox/hurtbox system
│   │   ├── CombatManager.js # Combat resolution
│   │   ├── EffectsManager.js # Particles & screen effects
│   │   └── TimeManager.js  # Hitstop & slow-motion
│   ├── ui/
│   │   └── HUD.js          # Health, combo, kills display
│   └── utils/
│       ├── constants.js    # Game constants
│       ├── physics.js      # Physics values
│       ├── combat.js       # Combat values
│       └── timing.js       # Timing values
└── assets/
    └── (placeholder assets)
````

---

## Architecture

### Zero-Build Setup
No bundler required. Uses ES6 modules loaded directly in browser. Phaser 3 loaded from CDN.

### State Machine Pattern
Player and enemies use a generic state machine (`StateMachine.js`) with discrete states for each behavior (idle, run, attack, hitstun, etc.).

### Combat System
- **Hitboxes** deal damage, attached to attackers
- **Hurtboxes** receive damage, attached to defenders
- **CombatManager** checks overlaps each frame
- Damage resolution includes knockback, hitstun, hitstop

### Event-Driven Communication
Systems communicate via Phaser's event emitter:
- `combat:hit` — When damage is dealt
- `enemy:killed` — When enemy dies
- `combo:milestone` — At combo thresholds (10, 25, 50, 100)

---

## Development

### Tech Stack
- **Engine:** Phaser 3.70+
- **Language:** Vanilla JavaScript (ES6 modules)
- **Deployment:** GitHub Pages

### Design Documents
See the `/docs` folder (if present) or project files for:
- Game Design Document
- Technical Design Document

### Contributing
This is a solo passion project, but feedback is welcome! Open an issue for bugs or suggestions.

---

## Credits

**Design & Development:** [Your Name]

**Inspired by:**
- Hollow Knight (Team Cherry)
- Stick figure animation community
- Devil May Cry series (Capcom)

---

## License

[Choose your license - MIT, GPL, or proprietary]

---

*Project Blender — Be the boss fight.*
````
