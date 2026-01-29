import { COMBAT } from '../utils/combat.js';

/**
 * HUD - Heads Up Display for gameplay
 */
export class HUD {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(900);

    // State tracking
    this.currentCombo = 0;
    this.comboTimer = 0;
    this.killCount = 0;
    this.displayedKillCount = 0; // For animation

    // Create HUD elements
    this.createHealthBar();
    this.createComboCounter();
    this.createKillCounter();
    this.createUltimateMeter();
    this.createWeaponDisplay();

    // Weapon swap state
    this.swapProgress = 0;
    this.isSwapping = false;

    // Listen for events
    this.setupEventListeners();
  }

  /**
   * Create player health bar (bottom left)
   */
  createHealthBar() {
    const x = 30;
    const y = this.scene.cameras.main.height - 60;

    // Background
    this.healthBarBg = this.scene.add.rectangle(x, y, 250, 24, 0x222222);
    this.healthBarBg.setOrigin(0, 0.5);
    this.healthBarBg.setStrokeStyle(2, 0x444444);

    // Fill
    this.healthBarFill = this.scene.add.rectangle(x + 2, y, 246, 20, 0xe94560);
    this.healthBarFill.setOrigin(0, 0.5);

    // Text
    this.healthText = this.scene.add.text(x + 125, y, '100/100', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.healthText.setOrigin(0.5);

    // Label
    this.healthLabel = this.scene.add.text(x, y - 20, 'HEALTH', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#888888',
    });
    this.healthLabel.setOrigin(0, 0.5);

    this.container.add([
      this.healthBarBg,
      this.healthBarFill,
      this.healthText,
      this.healthLabel,
    ]);
  }

  /**
   * Create combo counter (right side, center)
   */
  createComboCounter() {
    const x = this.scene.cameras.main.width - 50;
    const y = this.scene.cameras.main.height / 2;

    // Combo number
    this.comboText = this.scene.add.text(x, y, '', {
      fontFamily: 'monospace',
      fontSize: '64px',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 4,
    });
    this.comboText.setOrigin(1, 0.5);
    this.comboText.setAlpha(0);

    // "COMBO" label
    this.comboLabel = this.scene.add.text(x, y + 40, 'COMBO', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.comboLabel.setOrigin(1, 0.5);
    this.comboLabel.setAlpha(0);

    // Timer bar under combo
    this.comboTimerBar = this.scene.add.rectangle(x - 100, y + 65, 100, 4, 0xffcc00);
    this.comboTimerBar.setOrigin(0, 0.5);
    this.comboTimerBar.setAlpha(0);

    this.container.add([this.comboText, this.comboLabel, this.comboTimerBar]);
  }

  /**
   * Create kill counter (top center)
   */
  createKillCounter() {
    const x = this.scene.cameras.main.width / 2;
    const y = 40;

    // Kill count number
    this.killText = this.scene.add.text(x, y, '0', {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.killText.setOrigin(0.5);

    // "KILLS" label
    this.killLabel = this.scene.add.text(x, y + 28, 'KILLS', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#888888',
    });
    this.killLabel.setOrigin(0.5);

    this.container.add([this.killText, this.killLabel]);
  }

  /**
   * Create ultimate meter (bottom right)
   */
  createUltimateMeter() {
    const x = this.scene.cameras.main.width - 280;
    const y = this.scene.cameras.main.height - 60;

    // Background
    this.ultimateBarBg = this.scene.add.rectangle(x, y, 250, 24, 0x222222);
    this.ultimateBarBg.setOrigin(0, 0.5);
    this.ultimateBarBg.setStrokeStyle(2, 0x444444);

    // Fill
    this.ultimateBarFill = this.scene.add.rectangle(x + 2, y, 0, 20, 0x44aaff);
    this.ultimateBarFill.setOrigin(0, 0.5);

    // Label
    this.ultimateLabel = this.scene.add.text(x, y - 20, 'ULTIMATE', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#888888',
    });
    this.ultimateLabel.setOrigin(0, 0.5);

    // Ready indicator
    this.ultimateReady = this.scene.add.text(x + 125, y, 'READY!', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#44aaff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.ultimateReady.setOrigin(0.5);
    this.ultimateReady.setAlpha(0);

    this.container.add([
      this.ultimateBarBg,
      this.ultimateBarFill,
      this.ultimateLabel,
      this.ultimateReady,
    ]);
  }

  /**
   * Create weapon display (bottom center)
   */
  createWeaponDisplay() {
    const x = this.scene.cameras.main.width / 2;
    const y = this.scene.cameras.main.height - 60;

    // Weapon icon background
    this.weaponIconBg = this.scene.add.rectangle(x, y, 60, 60, 0x222222);
    this.weaponIconBg.setStrokeStyle(3, 0x444444);

    // Weapon icon (colored square representing weapon)
    this.weaponIcon = this.scene.add.rectangle(x, y, 40, 40, 0xffffff);

    // Weapon name
    this.weaponName = this.scene.add.text(x, y - 50, 'FISTS', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.weaponName.setOrigin(0.5);

    // Swap hint text
    this.swapHint = this.scene.add.text(x, y + 45, 'Q / E', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#666666',
    });
    this.swapHint.setOrigin(0.5);

    // Swap progress bar (hidden by default)
    this.swapProgressBg = this.scene.add.rectangle(x, y + 35, 60, 6, 0x222222);
    this.swapProgressBg.setAlpha(0);

    this.swapProgressFill = this.scene.add.rectangle(x - 30, y + 35, 0, 6, 0x44ff44);
    this.swapProgressFill.setOrigin(0, 0.5);
    this.swapProgressFill.setAlpha(0);

    // Previous/Next weapon indicators
    this.prevWeaponText = this.scene.add.text(x - 50, y, '<', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#666666',
    });
    this.prevWeaponText.setOrigin(0.5);

    this.nextWeaponText = this.scene.add.text(x + 50, y, '>', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#666666',
    });
    this.nextWeaponText.setOrigin(0.5);

    this.container.add([
      this.weaponIconBg,
      this.weaponIcon,
      this.weaponName,
      this.swapHint,
      this.swapProgressBg,
      this.swapProgressFill,
      this.prevWeaponText,
      this.nextWeaponText,
    ]);
  }

  /**
   * Update weapon display from WeaponManager
   * @param {WeaponManager} weaponManager
   */
  updateWeaponDisplay(weaponManager) {
    if (!weaponManager) return;

    const weapon = weaponManager.getEquippedWeapon();
    if (!weapon) return;

    // Update weapon name
    this.weaponName.setText(weapon.name.toUpperCase());

    // Update icon color based on weapon
    const trailColor = weapon.trailColor || 0xffffff;
    this.weaponIcon.setFillStyle(trailColor);

    // Update swap progress if swapping
    if (weaponManager.isSwapping) {
      const progress = weaponManager.swapProgress / weaponManager.swapTime;
      this.swapProgressBg.setAlpha(1);
      this.swapProgressFill.setAlpha(1);
      this.swapProgressFill.setSize(60 * progress, 6);

      // Flash the icon during swap
      this.weaponIcon.setAlpha(0.5 + Math.sin(Date.now() * 0.02) * 0.3);
    } else {
      this.swapProgressBg.setAlpha(0);
      this.swapProgressFill.setAlpha(0);
      this.weaponIcon.setAlpha(1);
    }

    // Highlight arrows based on available weapons
    const unlockedCount = weaponManager.unlockedWeapons.length;
    const canSwap = unlockedCount > 1;
    this.prevWeaponText.setColor(canSwap ? '#888888' : '#333333');
    this.nextWeaponText.setColor(canSwap ? '#888888' : '#333333');
    this.swapHint.setAlpha(canSwap ? 1 : 0.3);
  }

  /**
   * Play swap animation
   * @param {string} direction - 'next' or 'prev'
   */
  playSwapAnimation(direction) {
    const arrow = direction === 'next' ? this.nextWeaponText : this.prevWeaponText;

    // Flash the arrow
    arrow.setColor('#ffffff');
    this.scene.time.delayedCall(150, () => {
      arrow.setColor('#888888');
    });

    // Scale pop
    this.scene.tweens.add({
      targets: this.weaponIconBg,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 100,
      yoyo: true,
      ease: 'Power2',
    });

    // Name flash
    this.weaponName.setColor('#44ff44');
    this.scene.time.delayedCall(200, () => {
      this.weaponName.setColor('#ffffff');
    });
  }

  /**
   * Setup event listeners for combat events
   */
  setupEventListeners() {
    // Combo hit
    this.scene.events.on('combat:hit', (hitData) => {
      this.incrementCombo();
    });

    // Enemy killed
    this.scene.events.on('enemy:killed', (data) => {
      this.incrementKills();
    });

    // Player damaged
    this.scene.events.on('player:damaged', (data) => {
      this.updateHealth(data.health, data.player.maxHealth);
      // Reset combo on taking damage (optional - remove if unwanted)
      // this.resetCombo();
    });

    // Player healed
    this.scene.events.on('player:healed', (data) => {
      this.updateHealth(data.health, data.player.maxHealth);
    });
  }

  /**
   * Increment combo counter
   */
  incrementCombo() {
    this.currentCombo++;
    this.comboTimer = COMBAT.COMBO_DECAY_TIME;

    // Update display
    this.comboText.setText(this.currentCombo.toString());

    // Show combo UI
    this.comboText.setAlpha(1);
    this.comboLabel.setAlpha(1);
    this.comboTimerBar.setAlpha(1);

    // Scale pop animation
    this.scene.tweens.add({
      targets: this.comboText,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 50,
      yoyo: true,
      ease: 'Power2',
    });

    // Color changes at milestones
    if (this.currentCombo >= 100) {
      this.comboText.setColor('#ff4444');
      this.comboLabel.setColor('#ff4444');
    } else if (this.currentCombo >= 50) {
      this.comboText.setColor('#ff8844');
      this.comboLabel.setColor('#ff8844');
    } else if (this.currentCombo >= 25) {
      this.comboText.setColor('#ffaa00');
      this.comboLabel.setColor('#ffaa00');
    } else if (this.currentCombo >= 10) {
      this.comboText.setColor('#ffcc00');
      this.comboLabel.setColor('#ffcc00');
    }

    // Emit milestone events
    const milestones = [10, 25, 50, 100, 250, 500];
    if (milestones.includes(this.currentCombo)) {
      this.scene.events.emit('combo:milestone', { combo: this.currentCombo });
      this.flashComboMilestone();
    }
  }

  /**
   * Flash effect for combo milestones
   */
  flashComboMilestone() {
    // Big scale
    this.scene.tweens.add({
      targets: this.comboText,
      scaleX: 1.8,
      scaleY: 1.8,
      duration: 100,
      yoyo: true,
      ease: 'Power2',
    });

    // Screen effect
    if (this.scene.effectsManager) {
      this.scene.effectsManager.screenFlash(0xffcc00, 100, 0.2);
    }
  }

  /**
   * Reset combo counter
   */
  resetCombo() {
    if (this.currentCombo > 0) {
      // Fade out combo UI
      this.scene.tweens.add({
        targets: [this.comboText, this.comboLabel, this.comboTimerBar],
        alpha: 0,
        duration: 200,
        ease: 'Power2',
      });
    }

    this.currentCombo = 0;
    this.comboTimer = 0;

    // Reset colors
    this.comboText.setColor('#ffcc00');
    this.comboLabel.setColor('#ffcc00');
  }

  /**
   * Increment kill counter
   */
  incrementKills() {
    this.killCount++;

    // Animate number counting up
    this.scene.tweens.add({
      targets: this,
      displayedKillCount: this.killCount,
      duration: 200,
      ease: 'Power2',
      onUpdate: () => {
        this.killText.setText(Math.round(this.displayedKillCount).toString());
      },
    });

    // Pop animation
    this.scene.tweens.add({
      targets: this.killText,
      scaleX: 1.4,
      scaleY: 1.4,
      duration: 100,
      yoyo: true,
      ease: 'Power2',
    });

    // Color flash
    this.killText.setColor('#00ff88');
    this.scene.time.delayedCall(200, () => {
      this.killText.setColor('#ffffff');
    });
  }

  /**
   * Update health bar
   * @param {number} current
   * @param {number} max
   */
  updateHealth(current, max) {
    const percent = current / max;
    const barWidth = 246 * percent;

    // Animate health bar
    this.scene.tweens.add({
      targets: this.healthBarFill,
      width: barWidth,
      duration: 200,
      ease: 'Power2',
    });

    // Update text
    this.healthText.setText(`${current}/${max}`);

    // Color based on health
    if (percent <= 0.25) {
      this.healthBarFill.setFillStyle(0xff4444);
    } else if (percent <= 0.5) {
      this.healthBarFill.setFillStyle(0xffaa44);
    } else {
      this.healthBarFill.setFillStyle(0xe94560);
    }

    // Flash on damage
    this.scene.tweens.add({
      targets: this.healthBarFill,
      alpha: 0.5,
      duration: 50,
      yoyo: true,
    });
  }

  /**
   * Update ultimate meter
   * @param {number} current
   * @param {number} max
   */
  updateUltimate(current, max) {
    const percent = current / max;
    const barWidth = 246 * percent;

    this.scene.tweens.add({
      targets: this.ultimateBarFill,
      width: barWidth,
      duration: 100,
      ease: 'Linear',
    });

    // Show "READY" when full
    if (percent >= 1) {
      this.ultimateReady.setAlpha(1);
      // Pulse effect
      if (!this.ultimatePulsing) {
        this.ultimatePulsing = true;
        this.scene.tweens.add({
          targets: this.ultimateReady,
          alpha: 0.5,
          duration: 500,
          yoyo: true,
          repeat: -1,
        });
      }
    } else {
      this.ultimateReady.setAlpha(0);
      this.ultimatePulsing = false;
    }
  }

  /**
   * Update HUD - call each frame
   * @param {number} time
   * @param {number} delta
   * @param {Player} player
   */
  update(time, delta, player) {
    // Update combo timer
    if (this.comboTimer > 0) {
      this.comboTimer -= delta;

      // Update timer bar
      const timerPercent = this.comboTimer / COMBAT.COMBO_DECAY_TIME;
      this.comboTimerBar.setScale(timerPercent, 1);

      if (this.comboTimer <= 0) {
        this.resetCombo();
      }
    }

    // Update ultimate meter from player
    if (player) {
      this.updateUltimate(player.ultimateMeter, COMBAT.ULTIMATE.MAX_METER);

      // Update weapon display
      if (player.weaponManager) {
        this.updateWeaponDisplay(player.weaponManager);
      }
    }
  }

  /**
   * Get current stats
   * @returns {object}
   */
  getStats() {
    return {
      combo: this.currentCombo,
      kills: this.killCount,
    };
  }

  /**
   * Clean up
   */
  destroy() {
    this.container.destroy();
  }
}
