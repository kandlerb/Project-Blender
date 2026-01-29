import { SOUNDS, MUSIC } from '../utils/audio.js';

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

    // Load audio assets
    this.loadAudio();

    // Simulate loading time for testing loading bar
    // Remove this when you have real assets
    for (let i = 0; i < 100; i++) {
      this.load.image(`dummy${i}`, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    }

    // Handle load errors gracefully (audio files may not exist yet)
    this.load.on('loaderror', (file) => {
      // Silently ignore missing audio files during development
      if (file.type === 'audio') {
        console.debug(`Audio not found (expected during dev): ${file.key}`);
      } else {
        console.warn(`Failed to load: ${file.key}`);
      }
    });
  }

  /**
   * Load all audio assets
   * Files may not exist yet - errors handled gracefully
   */
  loadAudio() {
    // Combat sounds
    this.load.audio(SOUNDS.SWING_LIGHT, 'assets/audio/sfx/swing_light.wav');
    this.load.audio(SOUNDS.SWING_HEAVY, 'assets/audio/sfx/swing_heavy.wav');
    this.load.audio(SOUNDS.HIT_LIGHT, 'assets/audio/sfx/hit_light.wav');
    this.load.audio(SOUNDS.HIT_HEAVY, 'assets/audio/sfx/hit_heavy.wav');
    this.load.audio(SOUNDS.HIT_CRITICAL, 'assets/audio/sfx/hit_critical.wav');
    this.load.audio(SOUNDS.PARRY, 'assets/audio/sfx/parry.wav');
    this.load.audio(SOUNDS.BLOCK, 'assets/audio/sfx/block.wav');

    // Movement sounds
    this.load.audio(SOUNDS.JUMP, 'assets/audio/sfx/jump.wav');
    this.load.audio(SOUNDS.LAND, 'assets/audio/sfx/land.wav');
    this.load.audio(SOUNDS.FOOTSTEP, 'assets/audio/sfx/footstep.wav');
    this.load.audio(SOUNDS.DODGE, 'assets/audio/sfx/dodge.wav');
    this.load.audio(SOUNDS.BLINK, 'assets/audio/sfx/blink.wav');
    this.load.audio(SOUNDS.GRAPPLE_FIRE, 'assets/audio/sfx/grapple_fire.wav');
    this.load.audio(SOUNDS.GRAPPLE_HIT, 'assets/audio/sfx/grapple_hit.wav');

    // Player sounds
    this.load.audio(SOUNDS.HURT, 'assets/audio/sfx/player_hurt.wav');
    this.load.audio(SOUNDS.DEATH, 'assets/audio/sfx/player_death.wav');
    this.load.audio(SOUNDS.HEAL, 'assets/audio/sfx/heal.wav');

    // Enemy sounds
    this.load.audio(SOUNDS.ENEMY_HURT, 'assets/audio/sfx/enemy_hurt.wav');
    this.load.audio(SOUNDS.ENEMY_DEATH, 'assets/audio/sfx/enemy_death.wav');
    this.load.audio(SOUNDS.ENEMY_ALERT, 'assets/audio/sfx/enemy_alert.wav');

    // Boss sounds
    this.load.audio(SOUNDS.BOSS_INTRO, 'assets/audio/sfx/boss_intro.wav');
    this.load.audio(SOUNDS.BOSS_PHASE, 'assets/audio/sfx/boss_phase.wav');
    this.load.audio(SOUNDS.BOSS_DEATH, 'assets/audio/sfx/boss_death.wav');

    // UI sounds
    this.load.audio(SOUNDS.MENU_SELECT, 'assets/audio/sfx/menu_select.wav');
    this.load.audio(SOUNDS.MENU_CONFIRM, 'assets/audio/sfx/menu_confirm.wav');
    this.load.audio(SOUNDS.MENU_BACK, 'assets/audio/sfx/menu_back.wav');
    this.load.audio(SOUNDS.COMBO_MILESTONE, 'assets/audio/sfx/combo_milestone.wav');
    this.load.audio(SOUNDS.WEAPON_SWAP, 'assets/audio/sfx/weapon_swap.wav');
    this.load.audio(SOUNDS.ULTIMATE_READY, 'assets/audio/sfx/ultimate_ready.wav');
    this.load.audio(SOUNDS.ULTIMATE_ACTIVATE, 'assets/audio/sfx/ultimate_activate.wav');

    // Ambient sounds
    this.load.audio(SOUNDS.EXPLOSION, 'assets/audio/sfx/explosion.wav');

    // Music tracks
    this.load.audio(MUSIC.MENU, 'assets/audio/music/menu.ogg');
    this.load.audio(MUSIC.EXPLORATION, 'assets/audio/music/exploration.ogg');
    this.load.audio(MUSIC.COMBAT, 'assets/audio/music/combat.ogg');
    this.load.audio(MUSIC.BOSS, 'assets/audio/music/boss.ogg');
    this.load.audio(MUSIC.VICTORY, 'assets/audio/music/victory.ogg');
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

    // Boss placeholder (64x80 white square - tinted by Boss class)
    const bossGfx = this.make.graphics({ x: 0, y: 0, add: false });
    bossGfx.fillStyle(0xffffff, 1);
    bossGfx.fillRect(0, 0, 64, 80);
    bossGfx.generateTexture('boss_placeholder', 64, 80);
    bossGfx.destroy();

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
