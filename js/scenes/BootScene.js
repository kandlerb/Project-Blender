/**
 * First scene - minimal setup before loading assets
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // Could load a tiny loading bar sprite here if needed
    console.log('Boot: Starting...');
  }

  create() {
    console.log('Boot: Complete. Starting Preload...');
    this.scene.start('Preload');
  }
}
