# Project Blender

> *"Be the boss fight."*

A 2D action Metroidvania built with Phaser 3.

## Development

### Prerequisites
- Node.js 18+
- npm

### Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Build
```bash
# Production build
npm run build

# Preview production build locally
npm run preview
```

## Project Structure
```
src/
├── scenes/     # Phaser scenes
├── entities/   # Player, enemies, bosses
├── systems/    # Combat, progression, physics
├── weapons/    # Weapon definitions
├── ui/         # HUD, menus
├── utils/      # Helpers, constants
└── data/       # JSON configs
```

## Deployment

Pushing to `main` automatically deploys to GitHub Pages via GitHub Actions.

---

*In active development*
