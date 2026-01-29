# Project Blender

A fast-paced 2D action Metroidvania blending Hollow Knight's weighty combat with fluid stick-figure animation aesthetics.

---

## Current Status

🚧 **In Development** — Core systems complete, placeholder art

### Implemented Systems

| Category | Features |
|----------|----------|
| **Core** | Phaser 3 game loop, scene management, state machines |
| **Movement** | Run, jump, wall slide, wall jump, coyote time |
| **Combat** | Hitbox/hurtbox system, combos, hitstun, hitstop |
| **Attacks** | 3-hit light combo, heavy launcher, air attack, dive kick |
| **Abilities** | Flip/dodge (i-frames), spin attack, blink teleport, grappling hook |
| **Weapons** | Data-driven weapon system, weapon swapping |
| **Enemies** | 6 enemy types with distinct AI behaviors |
| **Bosses** | Phase-based boss system with attack patterns |
| **Audio** | SFX pools, music with crossfade, volume controls |
| **Effects** | Hit sparks, screen shake, damage numbers, trails |
| **UI** | Health bar, combo counter, kill tracker, ultimate meter, boss health bar |

---

## Weapons

| Weapon | Style | Special |
|--------|-------|---------|
| **Fists** | Fast rushdown | Rapid combos, constant pressure |
| **Tonfas** | Defensive | Parry → Counter attack |
| **Chain Whip** | Zone control | Extended range, multi-pull grapple |

*More weapons unlock from defeating bosses.*

---

## Enemies

| Type | Behavior | Counter Strategy |
|------|----------|------------------|
| **Swarmer** | Fast rushdown, low HP | Crowd control, spin attack |
| **Brute** | Slow tank, heavy hits | Bait attacks, punish recovery |
| **Lunger** | Telegraphed charge | Dodge the charge, punish |
| **Shield Bearer** | Frontal block | Flank or guard break with heavy |
| **Lobber** | Ranged, keeps distance | Close gap quickly, pressure |
| **Detonator** | Suicide bomber, chains | Keep distance, use against groups |

---

## Bosses

### The Tonfa Warden
*"Built to punish your aggression"*

- **Phases:** 3 (100%, 66%, 33% HP)
- **Mechanic:** Defensive stance parries your attacks and counters
- **Strategy:** Bait the counter, punish recovery windows
- **Drops:** Tonfas weapon

---

## Controls

### Movement
| Action | Key |
|--------|-----|
| Move | WASD / Arrow Keys |
| Jump | Space |
| Wall Jump | Space (while wall sliding) |

### Combat
| Action | Key |
|--------|-----|
| Light Attack | J |
| Heavy Attack | K |
| Spin Attack | L (hold to charge) |
| Flip/Dodge | Shift |
| Blink | I |
| Grapple | U |
| Weapon Special | O |
| Ultimate | F (when meter full) |

### Weapons
| Action | Key |
|--------|-----|
| Previous Weapon | Q |
| Next Weapon | E |

### Debug
| Action | Key |
|--------|-----|
| Respawn Enemies | R |
| Spawn Boss | B |
| Combat Debug | C |
| Physics Debug | ` |

---

## Combat Mechanics

### Combo System
- Chain light attacks: J → J → J
- Cancel into heavy: J → K
- Air combo: Jump → J
- Dive kick: Flip (descending) → J

### Movement Abilities
- **Flip/Dodge:** I-frames during animation, can dive kick
- **Blink:** Short teleport with afterimage
- **Wall Slide:** Hold toward wall while falling
- **Grapple:** Pull enemies to you, or zip to surfaces

### Weapon Swapping
- Swap weapons mid-combat with Q/E
- Brief vulnerability during swap
- Cancel swap with Shift (flip)

### Ultimate Attack
- Meter fills from dealing damage and kills
- Press F when full for devastating area attack
- Invulnerable during ultimate

---

## Running Locally

### Prerequisites
- Static file server (Python, Node, or any HTTP server)
- Modern browser with ES6 module support

### Quick Start
```bash
# Clone the repository
git clone https://github.com/kandlerb/project-blender.git
cd project-blender

# Start a local server
python -m http.server 8000
# or
npx serve .

# Open browser
open http://localhost:8000
```

---

## Project Structure
```
project-blender/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── main.js
│   ├── entities/
│   │   ├── Player.js
│   │   ├── Enemy.js
│   │   ├── Boss.js
│   │   └── bosses/
│   │       └── TonfaWarden.js
│   ├── scenes/
│   │   ├── BaseScene.js
│   │   ├── BootScene.js
│   │   ├── PreloadScene.js
│   │   └── TestArenaScene.js
│   ├── systems/
│   │   ├── InputManager.js
│   │   ├── StateMachine.js
│   │   ├── PlayerStates.js
│   │   ├── CombatBox.js
│   │   ├── CombatManager.js
│   │   ├── EffectsManager.js
│   │   ├── TimeManager.js
│   │   └── AudioManager.js
│   ├── weapons/
│   │   ├── Weapon.js
│   │   ├── WeaponManager.js
│   │   ├── WeaponRegistry.js
│   │   ├── FistsWeapon.js
│   │   ├── TonfasWeapon.js
│   │   └── ChainWhipWeapon.js
│   ├── ui/
│   │   └── HUD.js
│   └── utils/
│       ├── constants.js
│       ├── physics.js
│       ├── combat.js
│       ├── timing.js
│       └── audio.js
└── assets/
    └── audio/
        ├── sfx/
        └── music/
```

---

## Architecture

### State Machine Pattern
Player and enemies use a generic state machine with discrete states for each behavior. States handle enter/exit transitions and can be interrupted by higher-priority states.

### Combat System
- **Hitboxes** attach to attackers, deal damage on overlap
- **Hurtboxes** attach to defenders, receive damage
- **CombatManager** resolves collisions each frame
- Damage includes knockback, hitstun, and hitstop

### Weapon System
- Weapons define attack data (timing, damage, hitboxes)
- Attack states read from equipped weapon
- Swapping weapons changes all attack properties

### Boss System
- Phases triggered by health thresholds
- Attack patterns with cooldowns
- Invulnerability during phase transitions
- Weapon drops on defeat

### Audio System
- Sound pools for frequent effects
- Music with crossfade between tracks
- Category-based volume controls

---

## Tech Stack

- **Engine:** Phaser 3.70+
- **Language:** Vanilla JavaScript (ES6 modules)
- **Build:** None required (runs directly in browser)
- **Deployment:** GitHub Pages

---

## Roadmap

### Completed
- [x] Core movement and physics
- [x] Combat system with combos
- [x] Movement abilities (flip, blink, grapple, wall mechanics)
- [x] Weapon system with 3 weapons
- [x] 6 enemy types
- [x] Boss system with first boss
- [x] Audio system
- [x] Visual effects and juice

### Planned
- [ ] Additional bosses (7 more)
- [ ] Additional weapons (5 more)
- [ ] Level design and interconnected world
- [ ] Save/load system
- [ ] Menu screens
- [ ] Actual sprite art
- [ ] Sound effects and music tracks
- [ ] Controller support

---

## Credits

**Design & Development:** Kandler

**Inspired by:**
- Hollow Knight (Team Cherry)
- Stick figure animation community
- Devil May Cry series (Capcom)

---

*Project Blender — Be the boss fight.*
