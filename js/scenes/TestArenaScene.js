import { BaseScene } from './BaseScene.js';
import { Player } from '../entities/Player.js';
import { Enemy, CORPSE_INTERACTION } from '../entities/Enemy.js';
import { TonfaWarden } from '../entities/bosses/TonfaWarden.js';
import { CombatManager } from '../systems/CombatManager.js';
import { TimeManager } from '../systems/TimeManager.js';
import { EffectsManager } from '../systems/EffectsManager.js';
import { AudioManager } from '../systems/AudioManager.js';
import { CorpseManager } from '../systems/CorpseManager.js';
import { HUD } from '../ui/HUD.js';
import { ACTIONS } from '../systems/InputManager.js';
import { COMBAT } from '../utils/combat.js';
import { SOUNDS, MUSIC } from '../utils/audio.js';

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
    this.corpseManager = null;
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
    this.audioManager = new AudioManager(this);

    // Create HUD
    this.hud = new HUD(this);

    // Create arena
    this.createArena();

    // Create corpse manager
    this.corpseManager = new CorpseManager(this, {
      maxCorpses: 30,
      cleanupMode: 'oldest',
      decayEnabled: false,
    });

    // Corpse collisions with world geometry
    this.physics.add.collider(this.corpseManager.corpseGroup, this.ground);
    this.physics.add.collider(this.corpseManager.corpseGroup, this.platforms);

    // Corpses can stack on each other
    this.physics.add.collider(this.corpseManager.corpseGroup, this.corpseManager.corpseGroup);

    // Create enemy group for collision handling
    // runChildUpdate: false prevents group from interfering with enemy updates
    this.enemyGroup = this.physics.add.group({
      runChildUpdate: false,
    });

    // Create player
    this.player = new Player(this, 300, 400);
    this.player.addCollider(this.ground);
    this.player.addCollider(this.platforms);
    this.player.addCollider(this.corpseManager.corpseGroup);

    // Expose for console debugging
    window.player = this.player;
    window.scene = this;

    // Spawn initial enemies
    this.spawnEnemies();

    // Set up enemy-corpse collision (after enemies are spawned)
    this.physics.add.collider(
      this.enemyGroup,
      this.corpseManager.corpseGroup,
      this.handleEnemyCorpseCollision,
      null,
      this
    );

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

      // Remove from array and enemy group
      const index = this.enemies.indexOf(data.enemy);
      if (index > -1) {
        this.enemies.splice(index, 1);
      }
      if (data.enemy.sprite && this.enemyGroup.contains(data.enemy.sprite)) {
        this.enemyGroup.remove(data.enemy.sprite, true, true);
      }
    });

    // Spawn corpse when enemy dies
    this.events.on('enemy:died', (data) => {
      this.corpseManager.spawn(data.x, data.y, data.enemyType, {
        width: data.width,
        height: data.height || 16,
      });
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
    console.log('Press ` for physics debug, C for combat debug, R to respawn enemies, B to spawn boss, P to spawn corpse');
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

    // Spawn boss
    this.input.keyboard.on('keydown-B', () => {
      this.spawnBoss();
    });

    // Mute audio toggle
    this.input.keyboard.on('keydown-M', () => {
      if (this.audioManager) {
        const muted = this.audioManager.toggleMute('master');
        console.log(`Audio ${muted ? 'muted' : 'unmuted'}`);
      }
    });

    // Spawn test corpse at player position
    this.input.keyboard.on('keydown-P', () => {
      const pos = this.player.getPosition();
      // Spawn slightly above player so it falls
      this.corpseManager.spawn(pos.x, pos.y - 20, 'TEST', {
        width: 24,
        height: 16,
      });
      console.log(`Corpses: ${this.corpseManager.getCount()}/${this.corpseManager.config.maxCorpses}`);
    });
  }

  /**
   * Spawn the Tonfa Warden boss
   */
  spawnBoss() {
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

    // Spawn boss in center-right of arena
    this.currentBoss = new TonfaWarden(this, 800, 450);
    this.currentBoss.addCollider(this.ground);
    this.currentBoss.addCollider(this.platforms);

    console.log('Boss spawned: The Tonfa Warden');
    console.log('Tip: Attack during blue circle = parried! Bait the defensive stance.');
  }

  spawnEnemies() {
    // NOTE: No longer clearing existing enemies - R key spawns additional enemies
    // Clear existing projectiles to avoid stale references
    if (this.enemyProjectiles) {
      for (const proj of this.enemyProjectiles) {
        if (proj.sprite && proj.sprite.active) {
          proj.sprite.destroy();
        }
      }
    }
    this.enemyProjectiles = [];

    // Spawn a variety of enemy types
    const spawnPoints = [
      { x: 500, y: 400, type: 'SWARMER' },
      { x: 600, y: 400, type: 'SWARMER' },
      { x: 700, y: 400, type: 'SWARMER' },
      { x: 800, y: 400, type: 'LUNGER' },
      { x: 900, y: 400, type: 'SHIELD_BEARER' },
      { x: 1000, y: 400, type: 'LOBBER' },
      { x: 1100, y: 400, type: 'DETONATOR' },
    ];

    for (const pos of spawnPoints) {
      const enemy = new Enemy(this, pos.x, pos.y, { type: pos.type });
      enemy.addCollider(this.ground);
      enemy.addCollider(this.platforms);
      enemy.setTarget(this.player);

      // Add to enemy group for corpse collision
      this.enemyGroup.add(enemy.sprite);

      // Re-apply enemy physics settings that group may have overwritten
      enemy.sprite.body.setAllowGravity(true);
      enemy.sprite.body.setCollideWorldBounds(true);

      if (this.showCombatDebug) {
        enemy.setCombatDebug(true);
      }

      this.enemies.push(enemy);
    }

    console.log(`Spawned 7 enemies (total: ${this.enemies.length}) - Swarmer x3, Lunger, Shield Bearer, Lobber, Detonator`);
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

      // Update corpse manager
      this.corpseManager.update(time, scaledDelta);
      this.corpseManager.setReferencePosition(this.player.sprite.x, this.player.sprite.y);

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
   * Handle collision between enemy and corpse
   * @param {Phaser.Physics.Arcade.Sprite} enemySprite
   * @param {Phaser.Physics.Arcade.Sprite} corpseSprite
   */
  handleEnemyCorpseCollision(enemySprite, corpseSprite) {
    const enemy = enemySprite.getData('owner');
    const corpse = corpseSprite.getData('owner');

    if (!enemy || !corpse) return;

    // Brutes destroy corpses on contact
    if (enemy.corpseInteraction === CORPSE_INTERACTION.DESTROY) {
      this.destroyCorpseWithForce(enemy, corpse);
    }
    // CLIMB handling will be added in future prompt
  }

  /**
   * Destroy a corpse with knockback force (used by Brutes)
   * @param {Enemy} enemy - The enemy destroying the corpse
   * @param {Object} corpse - The corpse being destroyed
   */
  destroyCorpseWithForce(enemy, corpse) {
    // Determine knockback direction (away from enemy)
    const direction = corpse.sprite.x > enemy.sprite.x ? 1 : -1;
    const force = enemy.corpseDestroyForce || 300;

    // Apply force to corpse (brief moment of movement before destroy)
    corpse.sprite.body.setImmovable(false);
    corpse.sprite.body.setVelocity(direction * force, -150);

    // Visual feedback
    corpse.sprite.setTint(0xff4444);

    // Destroy after brief delay (shows the knockback)
    this.time.delayedCall(150, () => {
      // Emit particles at corpse position if EffectsManager exists
      if (this.effectsManager) {
        this.effectsManager.createImpact(
          corpse.sprite.x,
          corpse.sprite.y,
          { color: 0x666666, count: 5 }
        );
      }
      this.corpseManager.remove(corpse);
    });
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
      `Corpses: ${this.corpseManager.getCount()}/${this.corpseManager.config.maxCorpses}`,
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
    lines.push('R - Respawn | B - Boss | P - Corpse | M - Mute');

    this.debugText.setText(lines.join('\n'));
  }

  shutdown() {
    super.shutdown();

    // Clean up global debug references
    window.player = null;
    window.scene = null;

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
    if (this.corpseManager) {
      this.corpseManager.destroy();
      this.corpseManager = null;
    }
  }
}
