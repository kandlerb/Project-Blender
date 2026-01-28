/**
 * EffectsManager - Handles screen effects, particles, and feedback
 */
export class EffectsManager {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.camera = scene.cameras.main;

    // Create particle emitter manager
    this.particles = {};
    this.setupParticles();
  }

  /**
   * Setup particle textures and emitters
   */
  setupParticles() {
    // Create hit spark texture
    const sparkGfx = this.scene.make.graphics({ x: 0, y: 0, add: false });
    sparkGfx.fillStyle(0xffffff, 1);
    sparkGfx.fillCircle(4, 4, 4);
    sparkGfx.generateTexture('particle_spark', 8, 8);
    sparkGfx.destroy();

    // Create blood/damage particle texture
    const bloodGfx = this.scene.make.graphics({ x: 0, y: 0, add: false });
    bloodGfx.fillStyle(0xff4444, 1);
    bloodGfx.fillRect(0, 0, 6, 6);
    bloodGfx.generateTexture('particle_blood', 6, 6);
    bloodGfx.destroy();

    // Create dust particle texture
    const dustGfx = this.scene.make.graphics({ x: 0, y: 0, add: false });
    dustGfx.fillStyle(0x888888, 1);
    dustGfx.fillCircle(3, 3, 3);
    dustGfx.generateTexture('particle_dust', 6, 6);
    dustGfx.destroy();
  }

  /**
   * Screen shake effect
   * @param {number} intensity - Shake intensity in pixels
   * @param {number} duration - Duration in ms
   */
  screenShake(intensity = 5, duration = 100) {
    this.camera.shake(duration, intensity / 1000);
  }

  /**
   * Flash the screen a color
   * @param {number} color - Hex color
   * @param {number} duration - Duration in ms
   * @param {number} alpha - Max alpha (0-1)
   */
  screenFlash(color = 0xffffff, duration = 50, alpha = 0.3) {
    this.camera.flash(duration,
      (color >> 16) & 0xff,
      (color >> 8) & 0xff,
      color & 0xff,
      false,
      null,
      null
    );
  }

  /**
   * Spawn hit spark particles
   * @param {number} x
   * @param {number} y
   * @param {number} count
   * @param {number} direction - 1 for right, -1 for left
   */
  hitSparks(x, y, count = 8, direction = 1) {
    const particles = this.scene.add.particles(x, y, 'particle_spark', {
      speed: { min: 200, max: 400 },
      angle: direction > 0 ? { min: -45, max: 45 } : { min: 135, max: 225 },
      scale: { start: 1, end: 0 },
      lifespan: 200,
      quantity: count,
      emitting: false,
    });

    particles.explode(count);

    // Clean up after animation
    this.scene.time.delayedCall(300, () => {
      particles.destroy();
    });
  }

  /**
   * Spawn damage particles (blood/impact)
   * @param {number} x
   * @param {number} y
   * @param {number} count
   * @param {number} color
   */
  damageParticles(x, y, count = 6, color = 0xff4444) {
    // Create colored particle texture on the fly
    const key = `particle_damage_${color}`;
    if (!this.scene.textures.exists(key)) {
      const gfx = this.scene.make.graphics({ x: 0, y: 0, add: false });
      gfx.fillStyle(color, 1);
      gfx.fillRect(0, 0, 6, 6);
      gfx.generateTexture(key, 6, 6);
      gfx.destroy();
    }

    const particles = this.scene.add.particles(x, y, key, {
      speed: { min: 100, max: 300 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0.3 },
      lifespan: 400,
      gravityY: 400,
      quantity: count,
      emitting: false,
    });

    particles.explode(count);

    this.scene.time.delayedCall(500, () => {
      particles.destroy();
    });
  }

  /**
   * Spawn dust particles (landing, dashing)
   * @param {number} x
   * @param {number} y
   * @param {number} count
   */
  dustPuff(x, y, count = 4) {
    const particles = this.scene.add.particles(x, y, 'particle_dust', {
      speed: { min: 30, max: 80 },
      angle: { min: -120, max: -60 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 300,
      quantity: count,
      emitting: false,
    });

    particles.explode(count);

    this.scene.time.delayedCall(400, () => {
      particles.destroy();
    });
  }

  /**
   * Hit effect combo - sparks, shake, particles
   * @param {number} x
   * @param {number} y
   * @param {string} intensity - 'light', 'medium', 'heavy'
   * @param {number} direction
   */
  hitEffect(x, y, intensity = 'medium', direction = 1) {
    const config = {
      light: { shake: 3, sparks: 5, blood: 3, flash: false },
      medium: { shake: 6, sparks: 8, blood: 5, flash: false },
      heavy: { shake: 10, sparks: 12, blood: 8, flash: true },
    };

    const c = config[intensity] || config.medium;

    this.screenShake(c.shake, 80);
    this.hitSparks(x, y, c.sparks, direction);
    this.damageParticles(x, y, c.blood);

    if (c.flash) {
      this.screenFlash(0xffffff, 30, 0.2);
    }
  }

  /**
   * Death effect - big explosion of particles
   * @param {number} x
   * @param {number} y
   * @param {number} color
   */
  deathEffect(x, y, color = 0xff4444) {
    this.screenShake(8, 150);
    this.hitSparks(x, y, 15, 1);
    this.hitSparks(x, y, 15, -1);
    this.damageParticles(x, y, 12, color);
  }

  /**
   * Create floating damage number
   * @param {number} x
   * @param {number} y
   * @param {number} damage
   * @param {boolean} isCrit
   */
  damageNumber(x, y, damage, isCrit = false) {
    const color = isCrit ? '#ffff00' : '#ffffff';
    const size = isCrit ? '24px' : '18px';

    const text = this.scene.add.text(x, y, damage.toString(), {
      fontFamily: 'monospace',
      fontSize: size,
      color: color,
      stroke: '#000000',
      strokeThickness: 3,
    });
    text.setOrigin(0.5);
    text.setDepth(1000);

    // Animate upward and fade
    this.scene.tweens.add({
      targets: text,
      y: y - 50,
      alpha: 0,
      scale: isCrit ? 1.5 : 1.2,
      duration: 600,
      ease: 'Power2',
      onComplete: () => {
        text.destroy();
      },
    });
  }

  /**
   * Clean up
   */
  destroy() {
    // Particles auto-cleanup
  }
}
