import { BaseScene } from './BaseScene.js';
import { Player } from '../entities/Player.js';
import { ACTIONS } from '../systems/InputManager.js';

/**
 * Development testing arena
 * Flat ground, platforms, for testing player mechanics
 */
export class TestArenaScene extends BaseScene {
  constructor() {
    super('TestArena');
    this.player = null;
    this.ground = null;
    this.platforms = null;
    this.debugText = null;
  }

  onCreate() {
    // Physics debug (toggle with backtick)
    this.physics.world.drawDebug = false;

    // Create the arena
    this.createArena();

    // Create player entity
    this.player = new Player(this, 300, 400);

    // Add collisions
    this.player.addCollider(this.ground);
    this.player.addCollider(this.platforms);

    // Create debug HUD
    this.createDebugHUD();

    // Debug toggle key
    this.input.keyboard.on('keydown-BACKQUOTE', () => {
      this.physics.world.drawDebug = !this.physics.world.drawDebug;
      if (!this.physics.world.drawDebug) {
        this.physics.world.debugGraphic.clear();
      }
    });

    // Listen for player events
    this.events.on('player:damaged', (data) => {
      console.log(`Player took ${data.damage} damage! Health: ${data.health}`);
    });

    console.log('TestArena ready');
    console.log('Controls: WASD/Arrows = Move, Space = Jump');
    console.log('Press ` to toggle physics debug');
  }

  createArena() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const groundY = height - 64;
    const tileSize = 32;

    // Ground
    this.ground = this.physics.add.staticGroup();

    const tilesNeeded = Math.ceil(width / tileSize) + 1;
    for (let i = 0; i < tilesNeeded; i++) {
      this.ground.create(i * tileSize + 16, groundY, 'ground_placeholder');
      this.ground.create(i * tileSize + 16, groundY + 32, 'ground_placeholder');
    }

    // Platforms
    this.platforms = this.physics.add.staticGroup();
    this.platforms.create(300, groundY - 150, 'platform_placeholder');
    this.platforms.create(700, groundY - 280, 'platform_placeholder');
    this.platforms.create(1100, groundY - 400, 'platform_placeholder');
    this.platforms.create(200, groundY - 450, 'platform_placeholder');

    // Side walls
    const wallHeight = 20;
    for (let i = 0; i < wallHeight; i++) {
      this.ground.create(16, groundY - (i * 32), 'ground_placeholder');
      this.ground.create(width - 16, groundY - (i * 32), 'ground_placeholder');
    }
  }

  createDebugHUD() {
    this.debugText = this.add.text(16, 16, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#00ff88',
      backgroundColor: '#000000aa',
      padding: { x: 8, y: 8 },
    });
    this.debugText.setScrollFactor(0);
    this.debugText.setDepth(1000);
  }

  onUpdate(time, delta) {
    // Update player
    this.player.update(time, delta);

    // Update debug display
    this.updateDebugHUD();

    // Test damage with T key
    if (Phaser.Input.Keyboard.JustDown(this.input.keyboard.addKey('T'))) {
      this.player.takeDamage(10);
    }
  }

  updateDebugHUD() {
    const debug = this.player.getDebugInfo();
    const horizontal = this.inputManager.getHorizontalAxis();

    const lines = [
      'PROJECT BLENDER - Test Arena',
      '─'.repeat(32),
      `State: ${debug.state} (${debug.stateTime}ms)`,
      `Position: ${debug.position}`,
      `Velocity: ${debug.velocity}`,
      `On Ground: ${debug.onGround}`,
      `Facing: ${debug.facing}`,
      `Health: ${debug.health}`,
      `Input H-Axis: ${horizontal}`,
      '',
      'Controls:',
      '  WASD / Arrows - Move',
      '  Space / W / Up - Jump',
      '  T - Test damage',
      '  ` - Toggle physics debug',
    ];

    this.debugText.setText(lines.join('\n'));
  }

  shutdown() {
    super.shutdown();
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
  }
}
