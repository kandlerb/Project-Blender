// Import scenes (will add more as we build them)
import { PlaceholderScene } from './scenes/PlaceholderScene.js';

// Phaser game configuration
const config = {
  type: Phaser.AUTO,
  width: 1920,
  height: 1080,
  parent: 'game-container',

  // Pixel art rendering
  pixelArt: true,
  roundPixels: true,

  // Scale to fit window
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },

  // Physics (will configure properly later)
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },

  // Scenes
  scene: [PlaceholderScene],
};

// Create game instance
const game = new Phaser.Game(config);

console.log('Project Blender initialized');
