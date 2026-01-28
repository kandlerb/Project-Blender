# Project Blender

> *"Be the boss fight."*

A 2D action Metroidvania built with Phaser 3.

## Play

**[Play on GitHub Pages](https://kandlerb.github.io/project-blender/)**

## Local Development

No build step required. Just serve the files with any static HTTP server:

### Option 1: VS Code Live Server
1. Install "Live Server" extension
2. Right-click `index.html` → "Open with Live Server"

### Option 2: Python
```bash
python -m http.server 8000
# Then open http://localhost:8000
```

### Option 3: Any static server
Use whatever you have - the game is just static files.

**Note:** Opening `index.html` directly as a file (`file:///`) won't work due to browser security restrictions on ES modules. You need an HTTP server.

## Project Structure

```
js/
├── main.js         # Game initialization
├── scenes/         # Phaser scenes
├── entities/       # Player, enemies, bosses
├── systems/        # Combat, progression, physics
├── weapons/        # Weapon definitions
├── ui/             # HUD, menus
├── utils/          # Helpers, constants
└── data/           # Game configs
```

## Deployment

Just push to GitHub and enable GitHub Pages (Settings → Pages → Source: main branch, / root).

No build step. No CI/CD config. It just works.

---

*In active development*
