import { BaseScene } from './BaseScene.js';
import { Player } from '../entities/Player.js';
import { Enemy, CORPSE_INTERACTION } from '../entities/Enemy.js';
import { TonfaWarden } from '../entities/bosses/TonfaWarden.js';
import { CombatManagerMatter } from '../systems/CombatManagerMatter.js';
import { TimeManager } from '../systems/TimeManager.js';
import { EffectsManager } from '../systems/EffectsManager.js';
import { AudioManager } from '../systems/AudioManager.js';
import { CorpseTerrainManager } from '../systems/CorpseTerrainManager.js';
import { CorpseRenderer } from '../systems/CorpseRenderer.js';
import { MatterWorldManager } from '../systems/MatterWorldManager.js';
import { HUD } from '../ui/HUD.js';
import { ACTIONS } from '../systems/InputManager.js';
import { COMBAT } from '../utils/combat.js';
import { SOUNDS, MUSIC } from '../utils/audio.js';
import { PHYSICS } from '../utils/physics.js';
import {
  CollisionCategories,
  CollisionMasks,
  createGroundBodyConfig,
  createPlatformBodyConfig
} from '../systems/MatterPhysics.js';

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
    this.enemyGroup = null;
    this.enemyProjectiles = [];
    this.currentBoss = null;
    this.ground = null;
    this.platforms = null;
    this.debugText = null;
    this.combatManager = null;
    this.timeManager = null;
    this.effectsManager = null;
    this.audioManager = null;
    this.corpseTerrainManager = null;
    this.corpseRenderer = null;
    this.worldManager = null;
    this.hud = null;
    this.showCombatDebug = false;
    this._showCorpseDebug = false;

    // Collider references for cleanup/reset
    this.enemyEnemyCollider = null;
    this.playerEnemyCollider = null;
    this.enemyCorpseCollider = null;
  }

  onCreate() {
    // Matter.js physics debug - start with debug hidden
    this.matter.world.drawDebug = false;

    // Create world manager FIRST - handles safe body addition/removal
    this.worldManager = new MatterWorldManager(this);

    // Create managers BEFORE entities
    this.timeManager = new TimeManager(this);
    this.combatManager = new CombatManagerMatter(this);
    this.combatManager.setTimeManager(this.timeManager);
    this.effectsManager = new EffectsManager(this);
    this.audioManager = new AudioManager(this);

    // Create HUD
    this.hud = new HUD(this);

    // Create arena first (needed for platformLayer)
    this.createArena();

    // Create corpse systems (Matter.js based)
    this.corpseTerrainManager = new CorpseTerrainManager(this);
    this.corpseRenderer = new CorpseRenderer(this);

    // Create player
    this.player = new Player(this, 300, 400);
    // Matter.js collisions are automatic via collision categories - no addCollider needed

    // Expose for console debugging
    window.player = this.player;
    window.scene = this;

    // Spawn initial enemies
    this.spawnEnemies();

    // Set up all enemy-related colliders
    this.setupColliders();

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

      // Play hit sound
      if (this.audioManager) {
        this.audioManager.playHit(hitData.damage, hitData.isCritical);
      }
    });

    this.events.on('enemy:killed', (data) => {
      // Grant ultimate meter
      if (this.player) {
        this.player.addUltimateMeter(COMBAT.ULTIMATE.GAIN_PER_KILL);
      }

      // HUD handles kill count display

      // Death effect
      this.effectsManager.deathEffect(data.enemy.sprite.x, data.enemy.sprite.y);

      // Play death sound
      if (this.audioManager) {
        this.audioManager.playSFX(SOUNDS.ENEMY_DEATH);
      }

      // Remove from array
      const index = this.enemies.indexOf(data.enemy);
      if (index > -1) {
        this.enemies.splice(index, 1);
      }
    });

    // Enemy death is handled by Enemy.js which creates MatterRagdoll
    // The CorpseTerrainManager listens for 'corpse:ready' events from ragdolls
    this.events.on('enemy:died', (data) => {
      // Death handling (ragdoll creation) is done in Enemy.die()
      // No additional action needed here - CorpseTerrainManager handles terrain
    });

    // Boss events
    this.events.on('boss:defeated', (data) => {
      console.log(`Boss defeated! Unlocked weapon: ${data.weaponDrop}`);
      if (this.audioManager) {
        this.audioManager.playSFX(SOUNDS.BOSS_DEATH);
      }
      this.currentBoss = null;
    });

    this.events.on('boss:phaseChange', (data) => {
      console.log(`Boss entered phase ${data.phase + 1}!`);
      if (this.audioManager) {
        this.audioManager.playSFX(SOUNDS.BOSS_PHASE);
      }
    });

    // Additional audio events
    this.events.on('combo:milestone', (data) => {
      if (this.audioManager) {
        this.audioManager.playComboMilestone(data.combo);
      }
    });

    this.events.on('weapon:equipped', () => {
      if (this.audioManager) {
        this.audioManager.playSFX(SOUNDS.WEAPON_SWAP);
      }
    });

    this.events.on('ultimate:ready', () => {
      if (this.audioManager) {
        this.audioManager.playSFX(SOUNDS.ULTIMATE_READY);
      }
    });

    this.events.on('ultimate:activated', () => {
      if (this.audioManager) {
        this.audioManager.playSFX(SOUNDS.ULTIMATE_ACTIVATE);
      }
    });

    console.log('TestArena ready');
    console.log('Controls: WASD=Move, Space=Jump, J=Light Attack, K=Heavy Attack');
    console.log('Debug: ` physics, C combat, G grid, R respawn, B boss, 8 corpse, 9 dump, 0 mute');
  }

  setupInputHandlers() {
    // Matter.js physics debug toggle
    this.input.keyboard.on('keydown-BACKTICK', () => {
      this.matter.world.drawDebug = !this.matter.world.drawDebug;

      if (!this.matter.world.debugGraphic) {
        this.matter.world.createDebugGraphic();
      }
      this.matter.world.debugGraphic.setVisible(this.matter.world.drawDebug);

      console.log('Physics debug:', this.matter.world.drawDebug);
    });

    // Combat debug toggle
    this.input.keyboard.on('keydown-C', () => {
      this.showCombatDebug = !this.showCombatDebug;
      this.player.setCombatDebug(this.showCombatDebug);
      for (const enemy of this.enemies) {
        enemy.setCombatDebug(this.showCombatDebug);
      }
      // Include boss in combat debug toggle
      if (this.currentBoss && this.currentBoss.setCombatDebug) {
        this.currentBoss.setCombatDebug(this.showCombatDebug);
      }
      console.log(`Combat debug: ${this.showCombatDebug}`);
    });

    // Respawn enemies
    this.input.keyboard.on('keydown-R', () => {
      this.spawnEnemies();
      // Recreate colliders to ensure new enemies are included
      this.setupColliders();
    });

    // Test damage
    this.input.keyboard.on('keydown-T', () => {
      this.player.takeDamage(10);
    });

    // Spawn boss
    this.input.keyboard.on('keydown-B', () => {
      this.spawnBoss();
    });

    // Mute audio toggle (0 key - avoids conflict with M=MAP gameplay key)
    this.input.keyboard.on('keydown-ZERO', () => {
      if (this.audioManager) {
        const muted = this.audioManager.toggleMute('master');
        console.log(`Audio ${muted ? 'muted' : 'unmuted'}`);
      }
    });

    // Toggle corpse terrain debug (7 key)
    this.input.keyboard.on('keydown-SEVEN', () => {
      this._showCorpseDebug = !this._showCorpseDebug;
      if (this._showCorpseDebug && this.corpseTerrainManager) {
        this.corpseTerrainManager.debugHighlightTerrain(0xff0000, 0.3);
      } else if (this.corpseTerrainManager) {
        this.corpseTerrainManager.clearDebugGraphics();
      }
      console.log('Corpse terrain debug:', this._showCorpseDebug);
    });

    // Clear all corpses (8 key)
    this.input.keyboard.on('keydown-EIGHT', () => {
      if (this.corpseTerrainManager) {
        this.corpseTerrainManager.clearAllCorpses();
      }
      if (this.corpseRenderer) {
        this.corpseRenderer.clear();
      }
      console.log('Cleared all corpses');
    });

    // Toggle grid debug visualization (G key - now shows Matter.js physics debug)
    this.input.keyboard.on('keydown-G', () => {
      // G now just shows info about corpses
      if (this.corpseTerrainManager) {
        console.log(`Corpse count: ${this.corpseTerrainManager.getCorpseCount()}`);
        console.log(`Terrain bodies: ${this.corpseTerrainManager.getTerrainBodyCount()}`);
      }
    });

    // AI debug dump (9 key)
    this.input.keyboard.on('keydown-NINE', () => {
      console.log('--- ENEMY AI DEBUG ---');
      for (const enemy of this.enemies) {
        enemy.debugAI();
      }
      if (this.currentBoss && this.currentBoss.isAlive) {
        console.log(`[BOSS] HP: ${this.currentBoss.health}/${this.currentBoss.maxHealth}`);
      }
      if (this.corpseTerrainManager) {
        console.log(`Corpses: ${this.corpseTerrainManager.getCorpseCount()}`);
        console.log(`Terrain bodies: ${this.corpseTerrainManager.getTerrainBodyCount()}`);
      }
      console.log('----------------------');
    });

    // Pause menu (ESC and P keys)
    this.input.keyboard.on('keydown-ESC', () => {
      this.openPauseMenu();
    });
    this.input.keyboard.on('keydown-P', () => {
      this.openPauseMenu();
    });
  }

  /**
   * Open the pause menu overlay
   */
  openPauseMenu() {
    // Prevent opening if pause menu is already active
    if (this.scene.isActive('PauseMenu')) {
      return;
    }

    // Launch pause menu as overlay, passing this scene's key
    this.scene.launch('PauseMenu', { pausedScene: this.scene.key });
  }

  /**
   * Spawn the Tonfa Warden boss
   */
  spawnBoss() {
    // TODO: Boss needs Matter.js migration - temporarily disabled
    console.log('Boss spawning disabled - requires Matter.js migration');

    // Clear existing boss
    if (this.currentBoss) {
      this.currentBoss.destroy();
      this.currentBoss = null;
    }

    // Clear regular enemies
    for (const enemy of this.enemies) {
      enemy.destroy();
    }
    this.enemies = [];

    // Clear projectiles
    if (this.enemyProjectiles) {
      for (const proj of this.enemyProjectiles) {
        if (proj.sprite && proj.sprite.active) {
          proj.sprite.destroy();
        }
      }
    }
    this.enemyProjectiles = [];

    // NOTE: Boss spawning disabled until Boss class is migrated to Matter.js
    /*
    this.currentBoss = new TonfaWarden(this, 800, 450);
    this.currentBoss.addCollider(this.ground);
    this.currentBoss.addCollider(this.platforms);
    // ... boss setup
    */
  }

  spawnEnemies() {
    // Clear existing projectiles to avoid stale references
    if (this.enemyProjectiles) {
      for (const proj of this.enemyProjectiles) {
        if (proj.sprite && proj.sprite.active) {
          proj.sprite.destroy();
        }
      }
    }
    this.enemyProjectiles = [];

    // Spawn points for initial enemies
    const spawnPoints = [
      { x: 500, y: 400, type: 'SWARMER' },
      { x: 600, y: 400, type: 'SWARMER' },
      { x: 700, y: 400, type: 'SWARMER' },
      { x: 900, y: 400, type: 'BRUTE' },
    ];

    for (const pos of spawnPoints) {
      const enemy = new Enemy(this, pos.x, pos.y, { type: pos.type });
      enemy.setTarget(this.player);
      this.enemies.push(enemy);
    }

    console.log(`Spawned ${this.enemies.length} enemies`);
  }

  /**
   * Set up all enemy-related collision handlers
   * Called after spawnEnemies() and when respawning
   */
  setupColliders() {
    // TODO: Colliders need Matter.js migration - temporarily disabled
    // Matter.js uses collision categories instead of explicit colliders

    // Destroy existing colliders if any (for respawn scenarios)
    if (this.enemyEnemyCollider) {
      this.enemyEnemyCollider.destroy();
      this.enemyEnemyCollider = null;
    }
    if (this.playerEnemyCollider) {
      this.playerEnemyCollider.destroy();
      this.playerEnemyCollider = null;
    }
    if (this.enemyCorpseCollider) {
      this.enemyCorpseCollider.destroy();
      this.enemyCorpseCollider = null;
    }

    console.log('Collider setup skipped - Matter.js uses collision categories');
  }

  createArena() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const groundY = height - 64;

    // Store ground bodies for reference
    this.groundBodies = [];
    this.platformBodies = [];
    this.groundVisuals = [];
    this.platformVisuals = [];

    // Create main ground - single large rectangle
    const groundHeight = 64;
    const groundBody = this.matter.add.rectangle(
      width / 2,
      groundY + groundHeight / 2,
      width,
      groundHeight,
      createGroundBodyConfig()
    );
    this.groundBodies.push(groundBody);

    // Ground visual
    const groundVisual = this.add.rectangle(
      width / 2,
      groundY + groundHeight / 2,
      width,
      groundHeight,
      0x333333
    );
    groundVisual.setDepth(0);
    this.groundVisuals.push(groundVisual);

    // Platforms - Matter.js static rectangles
    const platformConfigs = [
      { x: 300, y: groundY - 150, w: 128, h: 20 },
      { x: 700, y: groundY - 280, w: 128, h: 20 },
      { x: 1100, y: groundY - 400, w: 128, h: 20 },
      { x: 200, y: groundY - 450, w: 128, h: 20 },
    ];

    for (const plat of platformConfigs) {
      const platBody = this.matter.add.rectangle(
        plat.x, plat.y, plat.w, plat.h,
        createPlatformBodyConfig()
      );
      this.platformBodies.push(platBody);

      // Platform visual
      const platVisual = this.add.rectangle(plat.x, plat.y, plat.w, plat.h, 0x444444);
      platVisual.setDepth(0);
      this.platformVisuals.push(platVisual);
    }

    // Side walls - Matter.js static rectangles
    const wallWidth = 32;
    const wallHeight = 700; // Tall walls

    // Left wall
    const leftWall = this.matter.add.rectangle(
      wallWidth / 2,
      height / 2,
      wallWidth,
      wallHeight,
      createGroundBodyConfig()
    );
    this.groundBodies.push(leftWall);
    const leftWallVisual = this.add.rectangle(wallWidth / 2, height / 2, wallWidth, wallHeight, 0x333333);
    leftWallVisual.setDepth(0);
    this.groundVisuals.push(leftWallVisual);

    // Right wall
    const rightWall = this.matter.add.rectangle(
      width - wallWidth / 2,
      height / 2,
      wallWidth,
      wallHeight,
      createGroundBodyConfig()
    );
    this.groundBodies.push(rightWall);
    const rightWallVisual = this.add.rectangle(width - wallWidth / 2, height / 2, wallWidth, wallHeight, 0x333333);
    rightWallVisual.setDepth(0);
    this.groundVisuals.push(rightWallVisual);

    // For backward compatibility with code expecting this.ground and this.platforms
    this.ground = this.groundBodies;
    this.platforms = this.platformBodies;
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

      // Update boss
      if (this.currentBoss && this.currentBoss.isAlive) {
        this.currentBoss.update(time, scaledDelta);

        // Check boss hitbox collision with player
        if (this.player && this.player.isAlive) {
          this.currentBoss.checkHitboxCollision(this.player);
        }
      }

      // Update combat manager
      this.combatManager.update(time, scaledDelta);

      // Update corpse terrain manager
      if (this.corpseTerrainManager) {
        this.corpseTerrainManager.update(time, scaledDelta);
      }

      // Render corpse visuals
      if (this.corpseRenderer) {
        this.corpseRenderer.render();
      }

      // Check enemy projectiles
      this.updateEnemyProjectiles();
    }

    // Update HUD
    this.hud.update(time, delta, this.player);

    // Always update debug HUD
    this.updateDebugHUD();
  }

  /**
   * Handle enemy projectile collisions
   */
  updateEnemyProjectiles() {
    if (!this.enemyProjectiles) return;

    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const proj = this.enemyProjectiles[i];

      if (!proj.sprite || !proj.sprite.active) {
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      // Check collision with player
      if (this.player && this.player.isAlive && Phaser.Geom.Intersects.RectangleToRectangle(
        proj.sprite.getBounds(),
        this.player.sprite.getBounds()
      )) {
        this.player.takeDamage(proj.damage, {
          knockback: { x: 100, y: -100 },
          hitstun: 150,
        });

        proj.sprite.destroy();
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      // Check collision with ground (below arena)
      if (proj.sprite.y > 550) {
        proj.sprite.destroy();
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }

  /**
   * Handle collision between enemy and corpse terrain
   * Note: With Matter.js, corpse terrain collision is automatic via collision categories
   * This method can be used for special behaviors like Brute corpse destruction
   * @param {Enemy} enemy - The enemy
   * @param {MatterJS.Body} terrainBody - The Matter.js terrain body
   */
  handleEnemyCorpseCollision(enemy, terrainBody) {
    // With Matter.js, physical collision is handled automatically via collision masks
    // This method is for special behaviors only

    if (!enemy) return;

    // Brutes destroy corpses on contact
    if (enemy.corpseInteraction === CORPSE_INTERACTION.DESTROY) {
      // Find and remove the corpse from terrain manager
      if (this.corpseTerrainManager) {
        this.corpseTerrainManager.removeTerrainByBody(terrainBody);
      }
    }
  }

  /**
   * Destroy corpse terrain with visual effect
   * @param {Enemy} enemy - The enemy destroying the corpse
   * @param {MatterJS.Body} terrainBody - The terrain body to destroy
   */
  destroyCorpseWithEffect(enemy, terrainBody) {
    if (!terrainBody) return;

    const x = terrainBody.position.x;
    const y = terrainBody.position.y;

    // Visual feedback - particles
    if (this.effectsManager) {
      this.effectsManager.createImpact(x, y, { color: 0x666666, count: 5 });
    }

    // Remove from terrain manager
    if (this.corpseTerrainManager) {
      this.corpseTerrainManager.removeTerrainByBody(terrainBody);
    }
  }

  // Note: Player-corpse and enemy-corpse collisions are handled automatically by Matter.js
  // via collision categories defined in MatterPhysics.js. No manual callbacks needed.

  updateDebugHUD() {
    const pDebug = this.player.getDebugInfo();
    const timeDebug = this.timeManager.getDebugInfo();
    const hudStats = this.hud.getStats();

    // Get corpse stats from terrain manager
    const corpseCount = this.corpseTerrainManager ? this.corpseTerrainManager.getCorpseCount() : 0;
    const terrainBodies = this.corpseTerrainManager ? this.corpseTerrainManager.getTerrainBodyCount() : 0;

    const lines = [
      'PROJECT BLENDER - Test Arena',
      '─'.repeat(35),
      `State: ${pDebug.state} (${pDebug.stateTime}ms)`,
      `Position: ${pDebug.position}`,
      `Velocity: ${pDebug.velocity}`,
      '',
      `Combo: ${hudStats.combo}`,
      `Kills: ${hudStats.kills}`,
      `Enemies: ${this.enemies.filter(e => e.isAlive).length}`,
      `Corpses: ${corpseCount} (terrain: ${terrainBodies})`,
    ];

    // Add boss info if present
    if (this.currentBoss && this.currentBoss.isAlive) {
      const bossDebug = this.currentBoss.getDebugInfo();
      lines.push('');
      lines.push(`Boss: ${bossDebug.name}`);
      lines.push(`HP: ${bossDebug.health} | Phase: ${bossDebug.phase}`);
      lines.push(`State: ${bossDebug.state} | Attack: ${bossDebug.attack}`);
    }

    lines.push('');
    lines.push(`Hitstop: ${timeDebug.hitstop}ms`);
    lines.push('');
    lines.push('R - Respawn | B - Boss | 7 - Corpse Debug | 8 - Clear | 0 - Mute');

    this.debugText.setText(lines.join('\n'));
  }

  shutdown() {
    super.shutdown();

    // Clean up global debug references
    window.player = null;
    window.scene = null;

    // Clean up colliders
    if (this.enemyEnemyCollider) {
      this.enemyEnemyCollider.destroy();
      this.enemyEnemyCollider = null;
    }
    if (this.playerEnemyCollider) {
      this.playerEnemyCollider.destroy();
      this.playerEnemyCollider = null;
    }
    if (this.enemyCorpseCollider) {
      this.enemyCorpseCollider.destroy();
      this.enemyCorpseCollider = null;
    }

    // Clean up projectiles
    if (this.enemyProjectiles) {
      for (const proj of this.enemyProjectiles) {
        if (proj.sprite && proj.sprite.active) {
          proj.sprite.destroy();
        }
      }
      this.enemyProjectiles = [];
    }

    // Clean up boss
    if (this.currentBoss) {
      this.currentBoss.destroy();
      this.currentBoss = null;
    }

    // Clean up enemies
    for (const enemy of this.enemies) {
      enemy.destroy();
    }
    this.enemies = [];

    // Clean up enemy group
    if (this.enemyGroup) {
      this.enemyGroup.destroy(true);
      this.enemyGroup = null;
    }

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
    if (this.audioManager) {
      this.audioManager.destroy();
      this.audioManager = null;
    }
    if (this.corpseTerrainManager) {
      this.corpseTerrainManager.destroy();
      this.corpseTerrainManager = null;
    }
    if (this.corpseRenderer) {
      this.corpseRenderer.destroy();
      this.corpseRenderer = null;
    }
    if (this.worldManager) {
      this.worldManager.destroy();
      this.worldManager = null;
    }
  }
}
