# Audio Assets

This folder contains audio files for the game. The AudioManager handles missing files gracefully.

## Directory Structure

```
audio/
├── sfx/           # Sound effects (.wav recommended)
└── music/         # Music tracks (.ogg recommended)
```

## Required Sound Effects (sfx/)

### Combat
- `swing_light.wav` - Light attack swing
- `swing_heavy.wav` - Heavy attack swing
- `hit_light.wav` - Light hit impact
- `hit_heavy.wav` - Heavy hit impact
- `hit_critical.wav` - Critical hit
- `parry.wav` - Parry/block success
- `block.wav` - Shield block

### Movement
- `jump.wav` - Player jump
- `land.wav` - Landing on ground
- `footstep.wav` - Footstep (pooled, varied pitch)
- `dodge.wav` - Dodge/flip
- `blink.wav` - Teleport blink
- `grapple_fire.wav` - Grapple hook launch
- `grapple_hit.wav` - Grapple hook connect

### Player
- `player_hurt.wav` - Player takes damage
- `player_death.wav` - Player death
- `heal.wav` - Health restored

### Enemy
- `enemy_hurt.wav` - Enemy hit
- `enemy_death.wav` - Enemy killed
- `enemy_alert.wav` - Enemy spots player

### Boss
- `boss_intro.wav` - Boss entrance
- `boss_phase.wav` - Boss phase transition
- `boss_death.wav` - Boss defeated

### UI
- `menu_select.wav` - Menu navigation
- `menu_confirm.wav` - Menu selection
- `menu_back.wav` - Menu back
- `combo_milestone.wav` - Combo counter milestone
- `weapon_swap.wav` - Weapon switched
- `ultimate_ready.wav` - Ultimate meter full
- `ultimate_activate.wav` - Ultimate activated

### Ambient
- `explosion.wav` - Detonator explosion

## Required Music Tracks (music/)

- `menu.ogg` - Main menu theme
- `exploration.ogg` - Exploration/ambient
- `combat.ogg` - Regular combat
- `boss.ogg` - Boss fight
- `victory.ogg` - Victory fanfare

## Recommended Sources (Free)

- [freesound.org](https://freesound.org)
- [opengameart.org](https://opengameart.org)
- [kenney.nl/assets](https://kenney.nl/assets)

## Audio Guidelines

- SFX: 44.1kHz, 16-bit WAV, mono
- Music: OGG Vorbis, stereo, ~192kbps
- Keep SFX short (<1 second for combat)
- Normalize audio levels
