/**
 * PauseMenuScene - Overlay scene for pausing gameplay
 * Displays pause menu with resume button and controls reference
 */
export class PauseMenuScene extends Phaser.Scene {
  constructor() {
    super('PauseMenu');
    this.pausedSceneKey = null;
  }

  /**
   * Initialize with data from the launching scene
   * @param {object} data - { pausedScene: sceneKey }
   */
  init(data) {
    this.pausedSceneKey = data.pausedScene || 'TestArena';
  }

  /**
   * Create the pause menu UI
   */
  create() {
    const { width, height } = this.cameras.main;

    // Pause the gameplay scene
    if (this.pausedSceneKey) {
      this.scene.pause(this.pausedSceneKey);
    }

    // Create UI elements
    this.createBackground(width, height);
    this.createTitle(width);
    this.createResumeButton(width, height);
    this.createControlsList(width, height);
    this.setupInputHandlers();
  }

  /**
   * Create semi-transparent dark background overlay
   */
  createBackground(width, height) {
    this.overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85);
    this.overlay.setScrollFactor(0);
  }

  /**
   * Create "PAUSED" title at top center
   */
  createTitle(width) {
    this.titleText = this.add.text(width / 2, 100, 'PAUSED', {
      fontFamily: 'monospace',
      fontSize: '64px',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 4,
    });
    this.titleText.setOrigin(0.5);
    this.titleText.setScrollFactor(0);
  }

  /**
   * Create the RESUME button in center of screen
   */
  createResumeButton(width, height) {
    // Button background
    this.resumeButtonBg = this.add.rectangle(width / 2, height / 2, 300, 80, 0x333333);
    this.resumeButtonBg.setStrokeStyle(4, 0xffcc00);
    this.resumeButtonBg.setScrollFactor(0);
    this.resumeButtonBg.setInteractive({ useHandCursor: true });

    // Button text
    this.resumeButtonText = this.add.text(width / 2, height / 2, 'RESUME', {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: '#ffffff',
    });
    this.resumeButtonText.setOrigin(0.5);
    this.resumeButtonText.setScrollFactor(0);

    // Hover effects
    this.resumeButtonBg.on('pointerover', () => {
      this.resumeButtonBg.setFillStyle(0x444444);
      this.resumeButtonBg.setStrokeStyle(4, 0xffffff);
      this.resumeButtonText.setColor('#ffcc00');
      this.tweens.add({
        targets: [this.resumeButtonBg, this.resumeButtonText],
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
        ease: 'Power2',
      });
    });

    this.resumeButtonBg.on('pointerout', () => {
      this.resumeButtonBg.setFillStyle(0x333333);
      this.resumeButtonBg.setStrokeStyle(4, 0xffcc00);
      this.resumeButtonText.setColor('#ffffff');
      this.tweens.add({
        targets: [this.resumeButtonBg, this.resumeButtonText],
        scaleX: 1,
        scaleY: 1,
        duration: 100,
        ease: 'Power2',
      });
    });

    // Click handler
    this.resumeButtonBg.on('pointerdown', () => {
      this.resumeGame();
    });

    // Hint text below button
    this.resumeHint = this.add.text(width / 2, height / 2 + 60, 'Press ESC, ENTER, or SPACE', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#888888',
    });
    this.resumeHint.setOrigin(0.5);
    this.resumeHint.setScrollFactor(0);
  }

  /**
   * Create the controls/moves list on the right side
   */
  createControlsList(width, height) {
    const rightPadding = 200;
    const startX = width - rightPadding;
    const startY = 180;
    const lineHeight = 28;

    // Container for controls list
    this.controlsContainer = this.add.container(0, 0);
    this.controlsContainer.setScrollFactor(0);

    // Header
    const header = this.add.text(startX, startY, 'CONTROLS', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffcc00',
    });
    header.setOrigin(1, 0);
    this.controlsContainer.add(header);

    // Control entries
    const controls = [
      { section: 'MOVEMENT', items: [
        { action: 'Move', keys: 'WASD / Arrows' },
        { action: 'Jump', keys: 'Space' },
      ]},
      { section: 'COMBAT', items: [
        { action: 'Light Attack', keys: 'J' },
        { action: 'Heavy Attack', keys: 'K' },
        { action: 'Spin Attack', keys: 'L (hold)' },
      ]},
      { section: 'ABILITIES', items: [
        { action: 'Flip/Dodge', keys: 'Shift' },
        { action: 'Blink', keys: 'I' },
        { action: 'Grapple', keys: 'U' },
      ]},
      { section: 'SYSTEM', items: [
        { action: 'Pause', keys: 'ESC' },
      ]},
    ];

    let currentY = startY + 50;

    controls.forEach((section) => {
      // Section header
      const sectionHeader = this.add.text(startX, currentY, section.section, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffcc00',
        lineSpacing: 8,
      });
      sectionHeader.setOrigin(1, 0);
      this.controlsContainer.add(sectionHeader);
      currentY += lineHeight;

      // Section items
      section.items.forEach((item) => {
        const controlLine = this.formatControlLine(item.action, item.keys);
        const lineText = this.add.text(startX, currentY, controlLine, {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#ffffff',
          lineSpacing: 8,
        });
        lineText.setOrigin(1, 0);
        this.controlsContainer.add(lineText);
        currentY += lineHeight;
      });

      currentY += 10; // Extra spacing between sections
    });

    // Add COMBOS section below controls
    currentY += 40; // Gap between controls and combos

    // Combos header
    const combosHeader = this.add.text(startX, currentY, 'COMBOS', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffcc00',
    });
    combosHeader.setOrigin(1, 0);
    this.controlsContainer.add(combosHeader);
    currentY += 40;

    // Combo entries
    const combos = [
      { name: 'Basic Combo', input: 'J, J, J' },
      { name: 'Launcher', input: 'J, J, K' },
      { name: 'Air Combo', input: 'Jump + J' },
      { name: 'Dive Kick', input: 'Flip + S/Down' },
      { name: 'Spin Attack', input: 'Hold L, Release' },
      { name: 'Grapple Pull', input: 'U (aim with WASD)' },
      { name: 'Blink Strike', input: 'I + Direction' },
    ];

    combos.forEach((combo) => {
      const comboLine = this.formatControlLine(combo.name, combo.input);
      const lineText = this.add.text(startX, currentY, comboLine, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
        lineSpacing: 8,
      });
      lineText.setOrigin(1, 0);
      this.controlsContainer.add(lineText);
      currentY += lineHeight;
    });
  }

  /**
   * Format a control line with dots for alignment
   * @param {string} action - The action name
   * @param {string} keys - The key binding
   * @returns {string} Formatted line
   */
  formatControlLine(action, keys) {
    const totalWidth = 30;
    const dotsNeeded = totalWidth - action.length - keys.length;
    const dots = '.'.repeat(Math.max(2, dotsNeeded));
    return `${action} ${dots} ${keys}`;
  }

  /**
   * Setup keyboard input handlers
   */
  setupInputHandlers() {
    // ESC key
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.escKey.on('down', () => {
      this.resumeGame();
    });

    // P key
    this.pKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.pKey.on('down', () => {
      this.resumeGame();
    });

    // ENTER key
    this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.enterKey.on('down', () => {
      this.resumeGame();
    });

    // SPACE key
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.spaceKey.on('down', () => {
      this.resumeGame();
    });
  }

  /**
   * Resume the paused scene and close this menu
   */
  resumeGame() {
    // Resume the paused scene
    if (this.pausedSceneKey) {
      this.scene.resume(this.pausedSceneKey);
    }

    // Stop this scene
    this.scene.stop();
  }
}
