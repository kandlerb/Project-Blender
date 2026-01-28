/**
 * Asset loading scene - loads all game assets and shows progress
 * For now, creates placeholder textures for development
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    this.createLoadingBar();

    // TODO: Load actual assets here
    // this.load.image('player', 'assets/sprites/player.png');
    // this.load.spritesheet('player_run', 'assets/sprites/player_run.png', {...});

    // Simulate loading time for testing loading bar
    // Remove this when you have real assets
    for (let i = 0; i < 100; i++) {
      this.load.image(`dummy${i}`, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    }
  }

  create() {
    // Create placeholder textures for development
    this.createPlaceholderTextures();

    console.log('Preload: Assets ready. Starting TestArena...');
    this.scene.start('TestArena');
  }

  createLoadingBar() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Background
    this.cameras.main.setBackgroundColor('#1a1a2e');

    // Title
    this.add.text(width / 2, height / 2 - 60, 'PROJECT BLENDER', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#e94560',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Loading text
    const loadingText = this.add.text(width / 2, height / 2 + 50, 'Loading...', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#666666',
    }).setOrigin(0.5);

    // Progress bar background
    const barBg = this.add.rectangle(width / 2, height / 2, 400, 20, 0x222222);

    // Progress bar fill
    const barFill = this.add.rectangle(width / 2 - 198, height / 2, 0, 16, 0xe94560);
    barFill.setOrigin(0, 0.5);

    // Update progress bar
    this.load.on('progress', (value) => {
      barFill.width = 396 * value;
      loadingText.setText(`Loading... ${Math.round(value * 100)}%`);
    });
  }

  createPlaceholderTextures() {
    // Player placeholder (32x48 green rectangle)
    const playerGfx = this.make.graphics({ x: 0, y: 0, add: false });
    playerGfx.fillStyle(0x00ff88, 1);
    playerGfx.fillRect(0, 0, 32, 48);
    // Add a "head" to show direction
    playerGfx.fillStyle(0x00cc66, 1);
    playerGfx.fillRect(8, 4, 16, 12);
    playerGfx.generateTexture('player_placeholder', 32, 48);
    playerGfx.destroy();

    // Ground tile placeholder (32x32 dark gray with border)
    const groundGfx = this.make.graphics({ x: 0, y: 0, add: false });
    groundGfx.fillStyle(0x444444, 1);
    groundGfx.fillRect(0, 0, 32, 32);
    groundGfx.lineStyle(1, 0x555555, 1);
    groundGfx.strokeRect(0, 0, 32, 32);
    groundGfx.generateTexture('ground_placeholder', 32, 32);
    groundGfx.destroy();

    // Enemy placeholder (28x28 red square)
    const enemyGfx = this.make.graphics({ x: 0, y: 0, add: false });
    enemyGfx.fillStyle(0xff4444, 1);
    enemyGfx.fillRect(0, 0, 28, 28);
    enemyGfx.generateTexture('enemy_placeholder', 28, 28);
    enemyGfx.destroy();

    // Platform placeholder (wider ground)
    const platGfx = this.make.graphics({ x: 0, y: 0, add: false });
    platGfx.fillStyle(0x555555, 1);
    platGfx.fillRect(0, 0, 160, 32);
    platGfx.lineStyle(2, 0x666666, 1);
    platGfx.strokeRect(0, 0, 160, 32);
    platGfx.generateTexture('platform_placeholder', 160, 32);
    platGfx.destroy();

    console.log('Placeholder textures created');
  }
}
