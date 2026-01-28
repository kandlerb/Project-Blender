import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { TestArenaScene } from './scenes/TestArenaScene.js';

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

  // Physics
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 }, // We handle gravity per-body
      debug: false,
    },
  },

  // Scene sequence
  scene: [BootScene, PreloadScene, TestArenaScene],
};

// Create game instance
const game = new Phaser.Game(config);

console.log('Project Blender starting...');
