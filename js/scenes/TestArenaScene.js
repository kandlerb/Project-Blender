import { BaseScene } from './BaseScene.js';
import { PHYSICS } from '../utils/physics.js';
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
    // Enable physics debug in this scene (toggle with backtick)
    this.physics.world.drawDebug = false;
    this.debugGraphics = this.physics.world.debugGraphic;

    // Create the arena
    this.createArena();

    // Create player
    this.createPlayer();

    // Create debug HUD
    this.createDebugHUD();

    // Debug toggle
    this.input.keyboard.on('keydown-BACKQUOTE', () => {
      this.physics.world.drawDebug = !this.physics.world.drawDebug;
      if (!this.physics.world.drawDebug) {
        this.physics.world.debugGraphic.clear();
      }
    });

    console.log('TestArena ready');
    console.log('Controls: WASD/Arrows = Move, Space = Jump');
    console.log('Press ` (backtick) to toggle physics debug');
  }

  createArena() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const groundY = height - 64;

    // Ground - static physics group
    this.ground = this.physics.add.staticGroup();

    // Floor tiles
    const tileSize = 32;
    const tilesNeeded = Math.ceil(width / tileSize) + 1;

    for (let i = 0; i < tilesNeeded; i++) {
      // Two rows of ground for thickness
      this.ground.create(i * tileSize + 16, groundY, 'ground_placeholder');
      this.ground.create(i * tileSize + 16, groundY + 32, 'ground_placeholder');
    }

    // Platforms at various heights
    this.platforms = this.physics.add.staticGroup();

    // Platform 1 - low left
    this.platforms.create(300, groundY - 150, 'platform_placeholder');

    // Platform 2 - mid center
    this.platforms.create(700, groundY - 280, 'platform_placeholder');

    // Platform 3 - high right
    this.platforms.create(1100, groundY - 400, 'platform_placeholder');

    // Platform 4 - mid left (for wall bounce testing later)
    this.platforms.create(200, groundY - 450, 'platform_placeholder');

    // Walls on sides
    const wallHeight = 20;
    for (let i = 0; i < wallHeight; i++) {
      this.ground.create(16, groundY - (i * 32), 'ground_placeholder');
      this.ground.create(width - 16, groundY - (i * 32), 'ground_placeholder');
    }
  }

  createPlayer() {
    // Spawn player in center-left
    this.player = this.physics.add.sprite(300, 400, 'player_placeholder');

    // Physics body setup
    this.player.setCollideWorldBounds(true);
    this.player.setBounce(0);
    this.player.setDragX(0); // We'll handle deceleration manually if needed

    // Set gravity for player (world gravity is 0, per-body gravity)
    this.player.body.setGravityY(PHYSICS.GRAVITY);

    // Max velocity (terminal velocity)
    this.player.body.setMaxVelocityY(PHYSICS.TERMINAL_VELOCITY);

    // Collisions
    this.physics.add.collider(this.player, this.ground);
    this.physics.add.collider(this.player, this.platforms);

    // Track grounded state for coyote time (future)
    this.player.wasOnFloor = false;
    this.player.leftGroundTime = 0;
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
    this.handlePlayerMovement(time);
    this.updateDebugHUD();
  }

  handlePlayerMovement(time) {
    const onFloor = this.player.body.onFloor();
    const horizontal = this.inputManager.getHorizontalAxis();

    // Track when player leaves ground (for coyote time later)
    if (this.player.wasOnFloor && !onFloor) {
      this.player.leftGroundTime = time;
    }
    this.player.wasOnFloor = onFloor;

    // Horizontal movement
    const speed = PHYSICS.PLAYER.RUN_SPEED;
    const airControl = onFloor ? 1 : PHYSICS.PLAYER.AIR_CONTROL;

    if (horizontal !== 0) {
      this.player.setVelocityX(horizontal * speed * airControl);
      // Flip sprite based on direction
      this.player.setFlipX(horizontal < 0);
    } else {
      // Stop horizontal movement (instant stop for now, can add friction later)
      this.player.setVelocityX(0);
    }

    // Jumping
    const canJump = onFloor || this.canCoyoteJump(time);
    const jumpPressed = this.inputManager.justPressed(ACTIONS.JUMP);
    const jumpBuffered = this.inputManager.consumeBuffered(ACTIONS.JUMP, time, PHYSICS.PLAYER.JUMP_BUFFER);

    if ((jumpPressed || jumpBuffered) && canJump) {
      this.player.setVelocityY(-PHYSICS.PLAYER.JUMP_FORCE);
      this.player.leftGroundTime = 0; // Reset coyote time
    }

    // Buffer jump if pressed while in air
    if (jumpPressed && !canJump) {
      this.inputManager.bufferAction(ACTIONS.JUMP, time);
    }

    // Variable jump height - release early for short hop
    if (this.inputManager.justReleased(ACTIONS.JUMP) && this.player.body.velocity.y < 0) {
      this.player.setVelocityY(this.player.body.velocity.y * 0.5);
    }
  }

  /**
   * Check if player can still jump after leaving ground (coyote time)
   */
  canCoyoteJump(time) {
    if (this.player.leftGroundTime === 0) return false;
    return (time - this.player.leftGroundTime) <= PHYSICS.PLAYER.COYOTE_TIME;
  }

  updateDebugHUD() {
    const onFloor = this.player.body.onFloor();
    const velX = Math.round(this.player.body.velocity.x);
    const velY = Math.round(this.player.body.velocity.y);
    const posX = Math.round(this.player.x);
    const posY = Math.round(this.player.y);

    const lines = [
      'PROJECT BLENDER - Test Arena',
      '─'.repeat(30),
      `Position: ${posX}, ${posY}`,
      `Velocity: ${velX}, ${velY}`,
      `On Floor: ${onFloor}`,
      `Horizontal Input: ${this.inputManager.getHorizontalAxis()}`,
      '',
      'Controls:',
      '  WASD / Arrows - Move',
      '  Space / W / Up - Jump',
      '  ` - Toggle physics debug',
    ];

    this.debugText.setText(lines.join('\n'));
  }
}
