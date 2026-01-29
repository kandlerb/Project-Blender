import { BaseScene } from './BaseScene.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { CombatManager } from '../systems/CombatManager.js';
import { TimeManager } from '../systems/TimeManager.js';
import { EffectsManager } from '../systems/EffectsManager.js';
import { HUD } from '../ui/HUD.js';
import { ACTIONS } from '../systems/InputManager.js';
import { COMBAT } from '../utils/combat.js';

// Import weapons module to register all weapons
import '../weapons/index.js';

/**
 * Development testing arena
 * Flat ground, platforms, for testing player mechanics
 */
export class TestArenaScene extends BaseScene {
  constructor() {
    super('TestArena');
    this.player = null;
    this.enemies = [];
    this.ground = null;
    this.platforms = null;
    this.debugText = null;
    this.combatManager = null;
    this.timeManager = null;
    this.effectsManager = null;
    this.hud = null;
    this.showCombatDebug = false;
  }

  onCreate() {
    // Physics debug
    this.physics.world.drawDebug = false;

    // Create managers BEFORE entities
    this.timeManager = new TimeManager(this);
    this.combatManager = new CombatManager(this);
    this.combatManager.setTimeManager(this.timeManager);
    this.effectsManager = new EffectsManager(this);

    // Create HUD
    this.hud = new HUD(this);

    // Create arena
    this.createArena();

    // Create player
    this.player = new Player(this, 300, 400);
    this.player.addCollider(this.ground);
    this.player.addCollider(this.platforms);

    // Spawn initial enemies
    this.spawnEnemies();

    // Create debug HUD
    this.createDebugHUD();

    // Input handlers
    this.setupInputHandlers();

    // Event listeners
    this.events.on('combat:hit', (hitData) => {
      // Determine hit intensity based on damage
      let intensity = 'light';
      if (hitData.damage >= 30) intensity = 'heavy';
      else if (hitData.damage >= 15) intensity = 'medium';

      // Get hit position (defender's position)
      const defenderSprite = hitData.defender.sprite || hitData.defender;
      const x = defenderSprite.x;
      const y = defenderSprite.y;

      // Determine direction based on attacker facing
      const attackerSprite = hitData.attacker.sprite || hitData.attacker;
      const direction = attackerSprite.flipX ? -1 : 1;

      // Spawn effects
      this.effectsManager.hitEffect(x, y, intensity, direction);
      this.effectsManager.damageNumber(x, y - 20, hitData.damage);
    });

    this.events.on('enemy:killed', (data) => {
      // Grant ultimate meter
      if (this.player) {
        this.player.addUltimateMeter(COMBAT.ULTIMATE.GAIN_PER_KILL);
      }

      // HUD handles kill count display

      // Death effect
      this.effectsManager.deathEffect(data.enemy.sprite.x, data.enemy.sprite.y);

      // Remove from array
      const index = this.enemies.indexOf(data.enemy);
      if (index > -1) {
        this.enemies.splice(index, 1);
      }
    });

    console.log('TestArena ready');
    console.log('Controls: WASD=Move, Space=Jump, J=Light Attack, K=Heavy Attack');
    console.log('Press ` for physics debug, C for combat debug, R to respawn enemies');
  }

  setupInputHandlers() {
    // Physics debug toggle
    this.input.keyboard.on('keydown-BACKQUOTE', () => {
      this.physics.world.drawDebug = !this.physics.world.drawDebug;
      if (!this.physics.world.drawDebug) {
        this.physics.world.debugGraphic.clear();
      }
    });

    // Combat debug toggle
    this.input.keyboard.on('keydown-C', () => {
      this.showCombatDebug = !this.showCombatDebug;
      this.player.setCombatDebug(this.showCombatDebug);
      for (const enemy of this.enemies) {
        enemy.setCombatDebug(this.showCombatDebug);
      }
      console.log(`Combat debug: ${this.showCombatDebug}`);
    });

    // Respawn enemies
    this.input.keyboard.on('keydown-R', () => {
      this.spawnEnemies();
    });

    // Test damage
    this.input.keyboard.on('keydown-T', () => {
      this.player.takeDamage(10);
    });
  }

  spawnEnemies() {
    // Clear existing enemies
    for (const enemy of this.enemies) {
      enemy.destroy();
    }
    this.enemies = [];

    // Spawn positions with enemy types
    const spawnPoints = [
      { x: 600, y: 400, type: 'SWARMER' },
      { x: 800, y: 400, type: 'SWARMER' },
      { x: 1000, y: 400, type: 'BRUTE' },
      { x: 700, y: 200, type: 'SWARMER' },  // On platform
      { x: 1100, y: 100, type: 'BRUTE' },   // On high platform
    ];

    for (const pos of spawnPoints) {
      const enemy = new Enemy(this, pos.x, pos.y, { type: pos.type });
      enemy.addCollider(this.ground);
      enemy.addCollider(this.platforms);
      enemy.setTarget(this.player);

      if (this.showCombatDebug) {
        enemy.setCombatDebug(true);
      }

      this.enemies.push(enemy);
    }

    console.log(`Spawned ${this.enemies.length} enemies`);
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

    // Side walls (start above ground to avoid collision overlap)
    const wallHeight = 20;
    for (let i = 1; i <= wallHeight; i++) {
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
    // Update time manager first
    this.timeManager.update(delta);

    // Get scaled delta for gameplay
    const scaledDelta = this.timeManager.getScaledDelta(delta);

    // Skip updates during hitstop
    if (!this.timeManager.isFrozen()) {
      // Update player
      this.player.update(time, scaledDelta);

      // Update enemies
      for (const enemy of this.enemies) {
        enemy.update(time, scaledDelta);
      }

      // Update combat manager
      this.combatManager.update(time, scaledDelta);
    }

    // Update HUD
    this.hud.update(time, delta, this.player);

    // Always update debug HUD
    this.updateDebugHUD();
  }

  updateDebugHUD() {
    const pDebug = this.player.getDebugInfo();
    const timeDebug = this.timeManager.getDebugInfo();
    const hudStats = this.hud.getStats();

    const lines = [
      'PROJECT BLENDER - Test Arena',
      '─'.repeat(35),
      `State: ${pDebug.state} (${pDebug.stateTime}ms)`,
      `Position: ${pDebug.position}`,
      `Velocity: ${pDebug.velocity}`,
      '',
      `Combo: ${hudStats.combo}`,
      `Kills: ${hudStats.kills}`,
      `Enemies: ${this.enemies.length}`,
      '',
      `Hitstop: ${timeDebug.hitstop}ms`,
      '',
      'R - Respawn | C - Combat Debug',
    ];

    this.debugText.setText(lines.join('\n'));
  }

  shutdown() {
    super.shutdown();

    // Clean up enemies
    for (const enemy of this.enemies) {
      enemy.destroy();
    }
    this.enemies = [];

    // Clean up player
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }

    // Clean up HUD
    if (this.hud) {
      this.hud.destroy();
      this.hud = null;
    }

    // Clean up managers
    if (this.combatManager) {
      this.combatManager.destroy();
      this.combatManager = null;
    }
    if (this.effectsManager) {
      this.effectsManager.destroy();
      this.effectsManager = null;
    }
  }
}
