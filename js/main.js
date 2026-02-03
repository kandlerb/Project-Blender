import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { TestArenaScene } from './scenes/TestArenaScene.js';
import { PauseMenuScene } from './scenes/PauseMenuScene.js';

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

  // Physics - Matter.js for polygon collision support
  physics: {
    default: 'matter',
    matter: {
      gravity: { y: 1 },      // Matter uses 0-1 scale, 1 ≈ normal gravity
      debug: false,           // Toggle with backtick key
      // Performance settings
      positionIterations: 6,  // Default is 6
      velocityIterations: 4,  // Default is 4
    },
  },

  // Scene sequence
  scene: [BootScene, PreloadScene, TestArenaScene, PauseMenuScene],
};

// Create game instance
const game = new Phaser.Game(config);

// Expose game globally for console debugging
window.game = game;

console.log('Project Blender starting...');
