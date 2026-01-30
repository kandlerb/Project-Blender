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
import { PHYSICS } from '../utils/physics.js';

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

    // Collider references for cleanup/reset
    this.enemyEnemyCollider = null;
    this.playerEnemyCollider = null;
    this.enemyCorpseCollider = null;
  }

  onCreate() {
    // Physics debug - start with debug hidden (debug enabled in config for toggling)
    this.physics.world.drawDebug = false;
    if (this.physics.world.debugGraphic) {
      this.physics.world.debugGraphic.setVisible(false);
    }

    // Create managers BEFORE entities
    this.timeManager = new TimeManager(this);
    this.combatManager = new CombatManager(this);
    this.combatManager.setTimeManager(this.timeManager);
    this.effectsManager = new EffectsManager(this);
    this.audioManager = new AudioManager(this);

    // Create HUD
    this.hud = new HUD(this);

    // Create arena first (needed for platformLayer)
    this.createArena();

    // Create corpse manager with platform layer for grid ground detection
    this.corpseManager = new CorpseManager(this, {
      platformLayer: this.ground,
      maxCorpses: Infinity,
      cleanupMode: 'none',
      decayEnabled: false,
    });

    // Set terrain for corpse-platform collision during falling
    this.corpseManager.setTerrain(this.ground, this.platforms);

    // Note: Corpse-to-corpse collision is now handled by grid snapping
    // No physics-based corpse stacking needed

    // Create enemy group for collision handling
    // runChildUpdate: false prevents group from interfering with enemy updates
    this.enemyGroup = this.physics.add.group({
      runChildUpdate: false,
    });

    // Create player
    this.player = new Player(this, 300, 400);
    this.player.addCollider(this.ground);
    this.player.addCollider(this.platforms);

    // Player-corpse collision with step-up handling
    this.playerStepUpHeight = 32; // Generous height for smooth traversal
    this.isPlayerSteppingUp = false;
    this.physics.add.collider(
      this.player.sprite,
      this.corpseManager.corpseGroup,
      this.handlePlayerCorpseCollision,
      this.shouldPlayerCollideWithCorpse,
      this
    );

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
    console.log('Debug: ` physics, C combat, G grid, R respawn, B boss, 8 corpse, 9 dump, 0 mute');
  }

  setupInputHandlers() {
    // Physics debug toggle
    this.input.keyboard.on('keydown-BACKTICK', () => {
      this.physics.world.drawDebug = !this.physics.world.drawDebug;

      if (this.physics.world.debugGraphic) {
        this.physics.world.debugGraphic.setVisible(this.physics.world.drawDebug);
        if (!this.physics.world.drawDebug) {
          this.physics.world.debugGraphic.clear();
        }
      }

      console.log('Physics debug:', this.physics.world.drawDebug);
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

    // Spawn test corpse at player position (8 key - avoids conflict with P=PAUSE gameplay key)
    this.input.keyboard.on('keydown-EIGHT', () => {
      const pos = this.player.getPosition();
      // Spawn slightly above player so it falls
      this.corpseManager.spawn(pos.x, pos.y - 20, 'TEST', {
        width: 24,
        height: 16,
      });
      console.log(`Corpses: ${this.corpseManager.getCount()}`);
    });

    // Toggle grid debug visualization
    this.input.keyboard.on('keydown-G', () => {
      const enabled = this.corpseManager.toggleGridDebug();
      console.log(`Corpse grid debug: ${enabled ? 'ON' : 'OFF'}`);
    });

    // Dump grid state (9 key - avoids conflict with D=MOVE_RIGHT gameplay key)
    this.input.keyboard.on('keydown-NINE', () => {
      const grid = this.corpseManager.grid;
      const corpses = this.corpseManager.corpses || [];

      // Count states and mismatches
      let settled = 0, falling = 0, snapping = 0, mismatches = 0;
      const mismatchDetails = [];

      for (const corpse of corpses) {
        if (!corpse.sprite || !corpse.sprite.active) continue;

        if (corpse.state === 'settled') settled++;
        else if (corpse.state === 'falling') falling++;
        else if (corpse.state === 'snapping') snapping++;

        // Check for position mismatches (only for settled corpses)
        if (corpse.state === 'settled' && corpse.gridCell && grid) {
          const actualGridPos = grid.worldToGrid(corpse.sprite.x, corpse.sprite.y);
          if (actualGridPos.col !== corpse.gridCell.col || actualGridPos.row !== corpse.gridCell.row) {
            mismatches++;
            mismatchDetails.push(`  #${corpse.id}: at (${actualGridPos.col},${actualGridPos.row}) claimed (${corpse.gridCell.col},${corpse.gridCell.row})`);
          }
        }
      }

      // Compact output
      console.log(`\n=== Corpse Grid Dump ===`);
      console.log(`Corpses: ${corpses.length} (settled:${settled} falling:${falling} snapping:${snapping})`);
      console.log(`Grid cells: ${grid ? grid.getOccupiedCount() : 0}`);

      if (mismatches > 0) {
        console.log(`⚠️ MISMATCHES: ${mismatches}`);
        mismatchDetails.forEach(d => console.log(d));
      }

      // Print compact ASCII grid
      if (grid && grid.getOccupiedCount() > 0) {
        grid.debugPrintOccupiedCells();
      }

      console.log('');
    });

    // AI debug dump (I key)
    this.input.keyboard.on('keydown-I', () => {
      console.log('--- ENEMY AI DEBUG ---');
      for (const enemy of this.enemies) {
        enemy.debugAI();
      }
      if (this.currentBoss && this.currentBoss.isAlive) {
        console.log(`[BOSS] HP: ${this.currentBoss.health}/${this.currentBoss.maxHealth}`);
      }
      console.log('----------------------');
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

    // Add boss to enemy group for collision with player, other enemies, and corpses
    if (this.currentBoss.sprite && this.enemyGroup) {
      this.enemyGroup.add(this.currentBoss.sprite);

      // Re-apply physics settings that group may have overwritten
      this.currentBoss.sprite.body.setAllowGravity(true);
      this.currentBoss.sprite.body.setGravityY(PHYSICS.GRAVITY);
      this.currentBoss.sprite.body.setCollideWorldBounds(true);
    }

    // Apply combat debug if currently enabled
    if (this.showCombatDebug && this.currentBoss.setCombatDebug) {
      this.currentBoss.setCombatDebug(true);
    }

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
    // Swarmers spawn in groups to test pack behavior
    const spawnPoints = [
      // Left swarmer pack (4 swarmers)
      { x: 500, y: 400, type: 'SWARMER' },
      { x: 540, y: 400, type: 'SWARMER' },
      { x: 580, y: 400, type: 'SWARMER' },
      { x: 620, y: 400, type: 'SWARMER' },
      // Right swarmer pack (3 swarmers)
      { x: 1000, y: 400, type: 'SWARMER' },
      { x: 1040, y: 400, type: 'SWARMER' },
      { x: 1080, y: 400, type: 'SWARMER' },
      // Other enemy types
      { x: 800, y: 400, type: 'LUNGER' },
      { x: 1200, y: 400, type: 'SHIELD_BEARER' },
      { x: 1400, y: 400, type: 'LOBBER' },
      { x: 1500, y: 400, type: 'DETONATOR' },
    ];

    for (const pos of spawnPoints) {
      const enemy = new Enemy(this, pos.x, pos.y, { type: pos.type });
      enemy.addCollider(this.ground);
      enemy.addCollider(this.platforms);
      enemy.setTarget(this.player);

      // Add to enemy group for corpse collision
      this.enemyGroup.add(enemy.sprite);

      // Re-apply enemy physics settings that group may have overwritten
      // World gravity is 0, so we must set per-body gravity
      enemy.sprite.body.setAllowGravity(true);
      enemy.sprite.body.setGravityY(PHYSICS.GRAVITY);
      enemy.sprite.body.setCollideWorldBounds(true);

      if (this.showCombatDebug) {
        enemy.setCombatDebug(true);
      }

      this.enemies.push(enemy);
    }

    console.log(`Spawned 11 enemies (total: ${this.enemies.length}) - Swarmer x7 (2 packs), Lunger, Shield Bearer, Lobber, Detonator`);
  }

  /**
   * Set up all enemy-related collision handlers
   * Called after spawnEnemies() and when respawning
   */
  setupColliders() {
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

    // Enemy-enemy collision (solid collision between all enemies)
    // Mass-based physics: heavier enemies push lighter ones
    this.enemyEnemyCollider = this.physics.add.collider(
      this.enemyGroup,
      this.enemyGroup,
      null, // no callback needed for basic collision
      null, // no process callback
      this
    );

    // Player-enemy collision (player and enemies cannot walk through each other)
    // Player mass = 2, swarmers = 1 (player pushes), brutes = 5 (push player)
    this.playerEnemyCollider = this.physics.add.collider(
      this.player.sprite,
      this.enemyGroup,
      null, // no callback needed for basic collision
      null, // no process callback
      this
    );

    // Enemy-corpse collision
    // Process callback prevents physics from moving corpses - only step-up/destroy logic applies
    this.enemyCorpseCollider = this.physics.add.collider(
      this.enemyGroup,
      this.corpseManager.corpseGroup,
      this.handleEnemyCorpseCollision,
      this.shouldEnemyCollideWithCorpse,
      this
    );

    console.log('Colliders setup. Enemy count:', this.enemies.length);
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
   * Called after collision resolution
   * @param {Phaser.Physics.Arcade.Sprite} enemySprite
   * @param {Phaser.Physics.Arcade.Sprite} corpseSprite
   */
  handleEnemyCorpseCollision(enemySprite, corpseSprite) {
    const enemy = enemySprite.getData('owner');
    const corpse = corpseSprite.getData('owner');

    if (!enemy || !corpse || corpse.state !== 'settled') return;

    // Brutes destroy corpses on contact
    if (enemy.corpseInteraction === CORPSE_INTERACTION.DESTROY) {
      this.destroyCorpseWithForce(enemy, corpse);
      return;
    }

    // For climbing/blocking enemies, handle standing on corpse
    const enemyBody = enemySprite.body;
    const corpseBody = corpseSprite.body;

    const enemyBottom = enemyBody.bottom;
    const corpseTop = corpseBody.top;
    const isStandingOn = enemyBottom >= corpseTop - 4 && enemyBottom <= corpseTop + 6;

    if (isStandingOn && enemyBody.velocity.y >= 0) {
      // Snap enemy to stand on top of corpse
      enemySprite.y = corpseTop - enemyBody.halfHeight;
      enemyBody.velocity.y = 0;

      // Mark enemy as grounded for AI/movement purposes
      enemyBody.blocked.down = true;
    }
  }

  /**
   * Process callback for enemy-corpse collision
   * Handles step-up positioning for climbing enemies
   * @param {Phaser.Physics.Arcade.Sprite} enemySprite
   * @param {Phaser.Physics.Arcade.Sprite} corpseSprite
   * @returns {boolean} Whether to apply collision physics
   */
  shouldEnemyCollideWithCorpse(enemySprite, corpseSprite) {
    const enemy = enemySprite.getData('owner');
    const corpse = corpseSprite.getData('owner');

    // Only collide with settled corpses (they have static platform bodies)
    if (!corpse || corpse.state !== 'settled') {
      return false;
    }

    if (!enemy) return true;

    const enemyBody = enemySprite.body;
    const corpseBody = corpseSprite.body;
    const enemyBottom = enemyBody.bottom;
    const corpseTop = corpseBody.top;
    const heightDiff = enemyBottom - corpseTop;

    // Brutes destroy corpses on contact
    if (enemy.corpseInteraction === CORPSE_INTERACTION.DESTROY) {
      return true; // Collision triggers destruction in handler
    }

    // Blocking enemies are fully blocked by corpses
    if (enemy.corpseInteraction === CORPSE_INTERACTION.BLOCK) {
      // Don't collide if too far below (prevents getting stuck on sides)
      if (heightDiff > 16) {
        return false;
      }
      return true;
    }

    // Climbing enemies (CORPSE_INTERACTION.CLIMB)
    const stepUpHeight = enemy.stepUpHeight || 32;

    // Enemy is above or at corpse top - normal collision for standing/landing
    if (enemyBottom <= corpseTop + 4) {
      return true;
    }

    // Enemy below corpse top but within step-up range - assist step-up
    const canStepUp = heightDiff > 0 && heightDiff <= stepUpHeight;
    const isMoving = Math.abs(enemyBody.velocity.x) > 5 || enemyBody.velocity.y !== 0;

    if (canStepUp && isMoving) {
      // Smoothly step up onto corpse
      const targetY = corpseTop - enemyBody.halfHeight;

      if (enemySprite.y > targetY + 2) {
        // Gradual step-up for smoother movement
        const stepSpeed = 3;
        enemySprite.y -= stepSpeed;

        // Snap to final position when close
        if (enemySprite.y <= targetY + stepSpeed) {
          enemySprite.y = targetY;
        }

        // Neutralize downward velocity during step-up
        if (enemyBody.velocity.y > 0) {
          enemyBody.velocity.y = 0;
        }
      }
      return true;
    }

    // Enemy too far below - don't collide (prevents getting stuck on sides)
    if (heightDiff > stepUpHeight) {
      return false;
    }

    return true;
  }

  /**
   * Destroy a corpse with knockback force (used by Brutes)
   * @param {Enemy} enemy - The enemy destroying the corpse
   * @param {Object} corpse - The corpse being destroyed
   */
  destroyCorpseWithForce(enemy, corpse) {
    // Prevent double-destruction
    if (corpse._beingDestroyed) return;
    corpse._beingDestroyed = true;

    // Determine knockback direction (away from enemy)
    const direction = corpse.sprite.x > enemy.sprite.x ? 1 : -1;
    const force = enemy.corpseDestroyForce || 300;

    // Re-enable corpse body as dynamic for knockback effect
    if (corpse.sprite.body) {
      corpse.sprite.body.enable = true;
      corpse.sprite.body.moves = true;
      corpse.sprite.body.setImmovable(false);
      corpse.sprite.body.setAllowGravity(true);
      // Restore full body size for flying effect
      corpse.sprite.body.setSize(corpse.config.width, corpse.config.height);
      corpse.sprite.body.setOffset(0, 0);
      // Apply knockback force
      corpse.sprite.body.setVelocity(direction * force, -200);
    }

    // Visual feedback - flash red
    corpse.sprite.setTint(0xff4444);

    // Destroy after brief delay (shows the knockback)
    this.time.delayedCall(200, () => {
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

  /**
   * Process callback for player-corpse collision
   * Enables smooth step-up onto corpse piles
   * @param {Phaser.Physics.Arcade.Sprite} playerSprite
   * @param {Phaser.Physics.Arcade.Sprite} corpseSprite
   * @returns {boolean} Whether to apply collision physics
   */
  shouldPlayerCollideWithCorpse(playerSprite, corpseSprite) {
    const corpse = corpseSprite.getData('owner');

    // Only collide with settled corpses (they have static platform bodies)
    if (!corpse || corpse.state !== 'settled') {
      return false;
    }

    const playerBody = playerSprite.body;
    const corpseBody = corpseSprite.body;

    // Corpse body is a thin platform at the top, so corpseBody.top is the walking surface
    const playerBottom = playerBody.bottom;
    const corpseTop = corpseBody.top;
    const heightDiff = playerBottom - corpseTop;

    // Player is above or at the corpse top level - normal collision for standing/landing
    if (playerBottom <= corpseTop + 4) {
      return true;
    }

    // Player is below corpse top but within step-up range
    // Assist by nudging player up onto the platform
    const canStepUp = heightDiff > 0 && heightDiff <= this.playerStepUpHeight;
    const isMoving = Math.abs(playerBody.velocity.x) > 5 || playerBody.velocity.y !== 0;

    if (canStepUp && isMoving) {
      // Smoothly step up: position player on top of corpse
      const targetY = corpseTop - playerBody.halfHeight;

      if (playerSprite.y > targetY + 2) {
        // Gradual step-up for smoother feel
        const stepSpeed = 4;
        playerSprite.y -= stepSpeed;

        // If close enough, snap to final position
        if (playerSprite.y <= targetY + stepSpeed) {
          playerSprite.y = targetY;
        }

        // Neutralize downward velocity during step-up
        if (playerBody.velocity.y > 0) {
          playerBody.velocity.y = 0;
        }
      }
      return true;
    }

    // Player too far below - don't collide (prevents getting stuck on sides)
    if (heightDiff > this.playerStepUpHeight) {
      return false;
    }

    return true;
  }

  /**
   * Handle collision between player and corpse
   * Called after collision resolution
   * @param {Phaser.Physics.Arcade.Sprite} playerSprite
   * @param {Phaser.Physics.Arcade.Sprite} corpseSprite
   */
  handlePlayerCorpseCollision(playerSprite, corpseSprite) {
    const playerBody = playerSprite.body;
    const corpseBody = corpseSprite.body;

    // Check if player is standing on top of this corpse
    const playerBottom = playerBody.bottom;
    const corpseTop = corpseBody.top;
    const isStandingOn = playerBottom >= corpseTop - 4 && playerBottom <= corpseTop + 6;

    if (isStandingOn && playerBody.velocity.y >= 0) {
      // Snap player to stand exactly on top for clean landing
      playerSprite.y = corpseTop - playerBody.halfHeight;
      playerBody.velocity.y = 0;

      // Mark player as touching ground (for jump detection)
      playerBody.blocked.down = true;
    }
  }

  updateDebugHUD() {
    const pDebug = this.player.getDebugInfo();
    const timeDebug = this.timeManager.getDebugInfo();
    const hudStats = this.hud.getStats();
    const corpseStats = this.corpseManager.getStats();

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
      `Corpses: ${corpseStats.total} (F:${corpseStats.falling} S:${corpseStats.snapping} D:${corpseStats.settled})`,
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
    lines.push('R - Respawn | B - Boss | I - AI Debug | G - Grid | 0 - Mute');

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
    if (this.corpseManager) {
      this.corpseManager.destroy();
      this.corpseManager = null;
    }
  }
}
