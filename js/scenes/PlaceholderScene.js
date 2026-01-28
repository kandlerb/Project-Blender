export class PlaceholderScene extends Phaser.Scene {
  constructor() {
    super('Placeholder');
  }

  create() {
    // Dark background
    this.cameras.main.setBackgroundColor('#1a1a2e');

    // Title text
    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;

    this.add.text(centerX, centerY - 50, 'PROJECT BLENDER', {
      fontFamily: 'monospace',
      fontSize: '48px',
      color: '#e94560',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(centerX, centerY + 20, 'Foundation Initialized', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#00ff88',
    }).setOrigin(0.5);

    this.add.text(centerX, centerY + 60, 'Press any key to confirm input works', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#666666',
    }).setOrigin(0.5);

    // Input test
    this.input.keyboard.on('keydown', (event) => {
      console.log(`Key pressed: ${event.key}`);
    });

    console.log('PlaceholderScene loaded');
  }
}
