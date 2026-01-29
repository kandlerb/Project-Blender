/**
 * EffectsManager - Handles screen effects, particles, and visual feedback
 * Enhanced with better game feel effects
 */
export class EffectsManager {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.camera = scene.cameras.main;

    // Effect settings (can be adjusted for performance/preference)
    this.settings = {
      particlesEnabled: true,
      screenShakeEnabled: true,
      screenFlashEnabled: true,
      chromaticEnabled: true,
      trailsEnabled: true,
    };

    // Active effects tracking
    this.activeTrails = [];
    this.activeEffects = [];

    // Setup particle textures
    this.setupParticles();
  }

  /**
   * Setup particle textures and effects
   */
  setupParticles() {
    // Hit spark texture (white circle)
    this.createCircleTexture('particle_spark', 4, 0xffffff);

    // Star spark for criticals
    this.createStarTexture('particle_star', 8, 0xffff00);

    // Blood/damage particle (square)
    this.createSquareTexture('particle_blood', 6, 0xff4444);

    // Dust particle (soft circle)
    this.createCircleTexture('particle_dust', 3, 0x888888);

    // Energy particle (glow)
    this.createGlowTexture('particle_energy', 8, 0x00ffff);

    // Trail segment
    this.createSquareTexture('particle_trail', 4, 0xffffff);

    // Impact line
    this.createLineTexture('particle_line', 32, 3, 0xffffff);

    // Ring texture for spin effects
    this.createRingTexture('particle_ring', 64, 4, 0x00ff88);
  }

  /**
   * Create a circle texture
   */
  createCircleTexture(key, radius, color) {
    if (this.scene.textures.exists(key)) return;
    const gfx = this.scene.make.graphics({ x: 0, y: 0, add: false });
    gfx.fillStyle(color, 1);
    gfx.fillCircle(radius, radius, radius);
    gfx.generateTexture(key, radius * 2, radius * 2);
    gfx.destroy();
  }

  /**
   * Create a square texture
   */
  createSquareTexture(key, size, color) {
    if (this.scene.textures.exists(key)) return;
    const gfx = this.scene.make.graphics({ x: 0, y: 0, add: false });
    gfx.fillStyle(color, 1);
    gfx.fillRect(0, 0, size, size);
    gfx.generateTexture(key, size, size);
    gfx.destroy();
  }

  /**
   * Create a star texture for critical hits
   */
  createStarTexture(key, size, color) {
    if (this.scene.textures.exists(key)) return;
    const gfx = this.scene.make.graphics({ x: 0, y: 0, add: false });
    gfx.fillStyle(color, 1);

    // Simple 4-pointed star
    const center = size / 2;
    const outer = size / 2;
    const inner = size / 5;

    gfx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const radius = i % 2 === 0 ? outer : inner;
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;
      if (i === 0) gfx.moveTo(x, y);
      else gfx.lineTo(x, y);
    }
    gfx.closePath();
    gfx.fillPath();
    gfx.generateTexture(key, size, size);
    gfx.destroy();
  }

  /**
   * Create a glow texture
   */
  createGlowTexture(key, radius, color) {
    if (this.scene.textures.exists(key)) return;
    const gfx = this.scene.make.graphics({ x: 0, y: 0, add: false });

    // Gradient glow effect
    for (let i = radius; i > 0; i--) {
      const alpha = (1 - i / radius) * 0.5;
      gfx.fillStyle(color, alpha);
      gfx.fillCircle(radius, radius, i);
    }
    gfx.generateTexture(key, radius * 2, radius * 2);
    gfx.destroy();
  }

  /**
   * Create a line texture for impact lines
   */
  createLineTexture(key, length, thickness, color) {
    if (this.scene.textures.exists(key)) return;
    const gfx = this.scene.make.graphics({ x: 0, y: 0, add: false });
    gfx.fillStyle(color, 1);
    gfx.fillRect(0, 0, length, thickness);
    gfx.generateTexture(key, length, thickness);
    gfx.destroy();
  }

  /**
   * Create a ring texture
   */
  createRingTexture(key, diameter, thickness, color) {
    if (this.scene.textures.exists(key)) return;
    const gfx = this.scene.make.graphics({ x: 0, y: 0, add: false });
    gfx.lineStyle(thickness, color, 1);
    gfx.strokeCircle(diameter / 2, diameter / 2, diameter / 2 - thickness / 2);
    gfx.generateTexture(key, diameter, diameter);
    gfx.destroy();
  }

  // ==================
  // Screen Effects
  // ==================

  /**
   * Screen shake effect
   * @param {number} intensity - Shake intensity in pixels
   * @param {number} duration - Duration in ms
   */
  screenShake(intensity = 5, duration = 100) {
    if (!this.settings.screenShakeEnabled) return;
    this.camera.shake(duration, intensity / 1000);
  }

  /**
   * Directional screen shake (for knockback feel)
   * @param {number} direction - 1 for right, -1 for left
   * @param {number} intensity
   * @param {number} duration
   */
  directionalShake(direction, intensity = 8, duration = 80) {
    if (!this.settings.screenShakeEnabled) return;

    const startX = this.camera.scrollX;
    const offsetX = direction * intensity;

    this.scene.tweens.add({
      targets: this.camera,
      scrollX: startX + offsetX,
      duration: duration / 2,
      ease: 'Power2',
      yoyo: true,
    });
  }

  /**
   * Flash the screen a color
   * @param {number} color - Hex color
   * @param {number} duration - Duration in ms
   * @param {number} alpha - Max alpha (0-1)
   */
  screenFlash(color = 0xffffff, duration = 50, alpha = 0.3) {
    if (!this.settings.screenFlashEnabled) return;

    this.camera.flash(
      duration,
      (color >> 16) & 0xff,
      (color >> 8) & 0xff,
      color & 0xff,
      false,
      null,
      null
    );
  }

  /**
   * Chromatic aberration effect for heavy hits
   * @param {number} intensity - Pixel offset
   * @param {number} duration - Duration in ms
   */
  chromaticAberration(intensity = 3, duration = 100) {
    if (!this.settings.chromaticEnabled) return;

    // Create red and blue offset layers using camera post-pipeline if available
    // Fallback: simulate with quick camera pan
    const startX = this.camera.scrollX;

    this.scene.tweens.add({
      targets: this.camera,
      scrollX: startX + intensity,
      duration: duration / 4,
      ease: 'Sine.easeOut',
      yoyo: true,
      repeat: 1,
    });
  }

  // ==================
  // Particle Effects
  // ==================

  /**
   * Spawn hit spark particles with directional bias
   * @param {number} x
   * @param {number} y
   * @param {number} count
   * @param {number} direction - 1 for right, -1 for left
   * @param {number} color - Optional tint
   */
  hitSparks(x, y, count = 8, direction = 1, color = 0xffffff) {
    if (!this.settings.particlesEnabled) return;

    const key = this.getColoredParticleKey('particle_spark', color);

    const particles = this.scene.add.particles(x, y, key, {
      speed: { min: 200, max: 500 },
      angle: direction > 0 ? { min: -60, max: 60 } : { min: 120, max: 240 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 1, end: 0.3 },
      lifespan: { min: 150, max: 250 },
      quantity: count,
      emitting: false,
    });

    particles.explode(count);
    this.scheduleDestroy(particles, 350);
  }

  /**
   * Brief flash at hit location
   * @param {number} x
   * @param {number} y
   * @param {number} size
   * @param {number} color
   */
  impactFlash(x, y, size = 30, color = 0xffffff) {
    if (!this.settings.particlesEnabled) return;

    const flash = this.scene.add.circle(x, y, size, color, 0.8);
    flash.setDepth(900);

    this.scene.tweens.add({
      targets: flash,
      scale: 1.5,
      alpha: 0,
      duration: 80,
      ease: 'Power2',
      onComplete: () => flash.destroy(),
    });
  }

  /**
   * Radial lines for heavy impacts
   * @param {number} x
   * @param {number} y
   * @param {number} count
   * @param {number} length
   */
  impactLines(x, y, count = 6, length = 40) {
    if (!this.settings.particlesEnabled) return;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const line = this.scene.add.rectangle(
        x,
        y,
        length,
        2,
        0xffffff,
        0.9
      );
      line.setOrigin(0, 0.5);
      line.setRotation(angle);
      line.setDepth(900);

      this.scene.tweens.add({
        targets: line,
        scaleX: 0,
        alpha: 0,
        duration: 150,
        ease: 'Power2',
        onComplete: () => line.destroy(),
      });
    }
  }

  /**
   * Spawn damage particles
   * @param {number} x
   * @param {number} y
   * @param {number} count
   * @param {number} color
   */
  damageParticles(x, y, count = 6, color = 0xff4444) {
    if (!this.settings.particlesEnabled) return;

    const key = this.getColoredParticleKey('particle_blood', color);

    const particles = this.scene.add.particles(x, y, key, {
      speed: { min: 100, max: 350 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0.2 },
      alpha: { start: 1, end: 0.5 },
      lifespan: { min: 300, max: 500 },
      gravityY: 500,
      quantity: count,
      emitting: false,
    });

    particles.explode(count);
    this.scheduleDestroy(particles, 600);
  }

  /**
   * Star burst for critical hits
   * @param {number} x
   * @param {number} y
   */
  criticalStars(x, y) {
    if (!this.settings.particlesEnabled) return;

    const particles = this.scene.add.particles(x, y, 'particle_star', {
      speed: { min: 150, max: 300 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      rotate: { start: 0, end: 360 },
      lifespan: 400,
      quantity: 8,
      emitting: false,
    });

    particles.explode(8);
    this.scheduleDestroy(particles, 500);
  }

  // ==================
  // Movement Effects
  // ==================

  /**
   * Dust cloud effect
   * @param {number} x
   * @param {number} y
   * @param {number} count
   * @param {number} direction - Direction of movement
   */
  dustCloud(x, y, count = 4, direction = 0) {
    if (!this.settings.particlesEnabled) return;

    const particles = this.scene.add.particles(x, y, 'particle_dust', {
      speed: { min: 30, max: 80 },
      angle: direction !== 0
        ? { min: direction > 0 ? 150 : -30, max: direction > 0 ? 210 : 30 }
        : { min: -150, max: -30 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 300,
      quantity: count,
      emitting: false,
    });

    particles.explode(count);
    this.scheduleDestroy(particles, 400);
  }

  /**
   * Landing impact effect
   * @param {number} x
   * @param {number} y
   * @param {number} intensity - Based on fall velocity
   */
  landingImpact(x, y, intensity = 1) {
    if (!this.settings.particlesEnabled) return;

    const count = Math.floor(4 + intensity * 4);

    // Dust puffs to both sides
    const particles = this.scene.add.particles(x, y, 'particle_dust', {
      speed: { min: 50 * intensity, max: 150 * intensity },
      angle: { min: 150, max: 210 },
      scale: { start: 0.6 + intensity * 0.3, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 350,
      quantity: count,
      emitting: false,
    });

    particles.explode(count);

    // Screen shake for heavy landings
    if (intensity > 0.5) {
      this.screenShake(intensity * 4, 60);
    }

    this.scheduleDestroy(particles, 450);
  }

  /**
   * Jump burst effect
   * @param {number} x
   * @param {number} y
   */
  jumpBurst(x, y) {
    if (!this.settings.particlesEnabled) return;

    // Small dust puff below player
    const particles = this.scene.add.particles(x, y + 10, 'particle_dust', {
      speed: { min: 40, max: 100 },
      angle: { min: -150, max: -30 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.4, end: 0 },
      lifespan: 200,
      quantity: 3,
      emitting: false,
    });

    particles.explode(3);
    this.scheduleDestroy(particles, 300);
  }

  /**
   * Dodge/dash trail effect
   * @param {number} x
   * @param {number} y
   * @param {number} direction
   */
  dodgeTrail(x, y, direction) {
    if (!this.settings.trailsEnabled) return;

    // Create afterimage
    const afterimage = this.scene.add.rectangle(
      x - direction * 20,
      y,
      30,
      45,
      0x00ff88,
      0.4
    );
    afterimage.setDepth(50);

    this.scene.tweens.add({
      targets: afterimage,
      alpha: 0,
      scaleX: 0.5,
      duration: 200,
      ease: 'Power2',
      onComplete: () => afterimage.destroy(),
    });

    // Speed lines
    for (let i = 0; i < 3; i++) {
      const line = this.scene.add.rectangle(
        x - direction * (30 + i * 15),
        y - 10 + i * 15,
        20,
        2,
        0x00ff88,
        0.6
      );
      line.setDepth(50);

      this.scene.tweens.add({
        targets: line,
        alpha: 0,
        scaleX: 0,
        duration: 150,
        delay: i * 20,
        onComplete: () => line.destroy(),
      });
    }
  }

  /**
   * Blink/teleport effect
   * @param {number} fromX
   * @param {number} fromY
   * @param {number} toX
   * @param {number} toY
   */
  blinkEffect(fromX, fromY, toX, toY) {
    if (!this.settings.particlesEnabled) return;

    // Disappear effect at origin
    const disappear = this.scene.add.circle(fromX, fromY, 25, 0x00ffff, 0.8);
    disappear.setDepth(900);

    this.scene.tweens.add({
      targets: disappear,
      scale: 2,
      alpha: 0,
      duration: 150,
      ease: 'Power2',
      onComplete: () => disappear.destroy(),
    });

    // Energy particles at origin
    const originParticles = this.scene.add.particles(fromX, fromY, 'particle_energy', {
      speed: { min: 100, max: 200 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      lifespan: 200,
      quantity: 8,
      emitting: false,
    });
    originParticles.explode(8);
    this.scheduleDestroy(originParticles, 300);

    // Appear effect at destination
    const appear = this.scene.add.circle(toX, toY, 5, 0x00ffff, 0.8);
    appear.setDepth(900);

    this.scene.tweens.add({
      targets: appear,
      scale: 5,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => appear.destroy(),
    });

    // Trail line between points
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const distance = Phaser.Math.Distance.Between(fromX, fromY, toX, toY);

    const trail = this.scene.add.rectangle(
      fromX,
      fromY,
      distance,
      4,
      0x00ffff,
      0.6
    );
    trail.setOrigin(0, 0.5);
    trail.setRotation(angle);
    trail.setDepth(850);

    this.scene.tweens.add({
      targets: trail,
      alpha: 0,
      scaleY: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => trail.destroy(),
    });
  }

  // ==================
  // Attack Effects
  // ==================

  /**
   * Slash trail effect
   * @param {number} x - Start X
   * @param {number} y - Start Y
   * @param {number} angle - Slash angle in degrees
   * @param {number} length - Slash length
   * @param {number} color - Trail color
   * @param {number} duration - Effect duration
   */
  slashTrail(x, y, angle, length = 60, color = 0xffffff, duration = 150) {
    if (!this.settings.trailsEnabled) return;

    // Create slash arc
    const radians = Phaser.Math.DegToRad(angle);
    const endX = x + Math.cos(radians) * length;
    const endY = y + Math.sin(radians) * length;

    // Main slash line
    const slash = this.scene.add.graphics();
    slash.setDepth(850);

    // Draw tapered slash
    slash.lineStyle(8, color, 0.9);
    slash.beginPath();
    slash.moveTo(x, y);
    slash.lineTo(endX, endY);
    slash.strokePath();

    // Add glow line
    slash.lineStyle(16, color, 0.3);
    slash.beginPath();
    slash.moveTo(x, y);
    slash.lineTo(endX, endY);
    slash.strokePath();

    this.scene.tweens.add({
      targets: slash,
      alpha: 0,
      duration: duration,
      ease: 'Power2',
      onComplete: () => slash.destroy(),
    });
  }

  /**
   * Spin attack ring effect
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   */
  spinEffect(x, y, radius = 50) {
    if (!this.settings.particlesEnabled) return;

    // Expanding ring
    const ring = this.scene.add.circle(x, y, radius, 0x00ff88, 0);
    ring.setStrokeStyle(4, 0x00ff88, 0.8);
    ring.setDepth(800);

    this.scene.tweens.add({
      targets: ring,
      scale: 1.5,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => ring.destroy(),
    });

    // Circular particles
    const particles = this.scene.add.particles(x, y, 'particle_spark', {
      speed: { min: 150, max: 250 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      lifespan: 250,
      quantity: 12,
      emitting: false,
      tint: 0x00ff88,
    });

    particles.explode(12);
    this.scheduleDestroy(particles, 350);
  }

  /**
   * Ultimate attack burst effect
   * @param {number} x
   * @param {number} y
   * @param {number} color
   */
  ultimateBurst(x, y, color = 0xffff00) {
    // Screen flash
    this.screenFlash(color, 100, 0.4);

    // Big screen shake
    this.screenShake(15, 200);

    // Multiple expanding rings
    for (let i = 0; i < 3; i++) {
      this.scene.time.delayedCall(i * 80, () => {
        const ring = this.scene.add.circle(x, y, 30 + i * 20, color, 0);
        ring.setStrokeStyle(6 - i * 2, color, 0.8);
        ring.setDepth(900);

        this.scene.tweens.add({
          targets: ring,
          scale: 3,
          alpha: 0,
          duration: 400,
          ease: 'Power2',
          onComplete: () => ring.destroy(),
        });
      });
    }

    // Particle explosion
    const particles = this.scene.add.particles(x, y, 'particle_energy', {
      speed: { min: 200, max: 500 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.5, end: 0 },
      lifespan: 500,
      quantity: 30,
      emitting: false,
      tint: color,
    });

    particles.explode(30);
    this.scheduleDestroy(particles, 600);

    // Chromatic aberration
    this.chromaticAberration(5, 150);
  }

  // ==================
  // Combo Effects
  // ==================

  /**
   * Hit effect with multiple components
   * @param {number} x
   * @param {number} y
   * @param {string} intensity - 'light', 'medium', 'heavy', 'critical'
   * @param {number} direction
   */
  hitEffect(x, y, intensity = 'medium', direction = 1) {
    const config = {
      light: {
        shake: 2,
        shakeTime: 50,
        sparks: 4,
        blood: 2,
        flash: false,
        impactFlash: 15,
        lines: 0,
      },
      medium: {
        shake: 5,
        shakeTime: 70,
        sparks: 8,
        blood: 4,
        flash: false,
        impactFlash: 25,
        lines: 0,
      },
      heavy: {
        shake: 10,
        shakeTime: 100,
        sparks: 14,
        blood: 7,
        flash: true,
        impactFlash: 35,
        lines: 5,
        chromatic: true,
      },
      critical: {
        shake: 14,
        shakeTime: 120,
        sparks: 18,
        blood: 10,
        flash: true,
        impactFlash: 45,
        lines: 8,
        chromatic: true,
        stars: true,
      },
    };

    const c = config[intensity] || config.medium;

    // Screen effects
    this.screenShake(c.shake, c.shakeTime);
    if (c.flash) {
      this.screenFlash(0xffffff, 40, 0.25);
    }
    if (c.chromatic) {
      this.chromaticAberration(3, 80);
    }

    // Particle effects
    this.impactFlash(x, y, c.impactFlash);
    this.hitSparks(x, y, c.sparks, direction);
    this.damageParticles(x, y, c.blood);

    if (c.lines > 0) {
      this.impactLines(x, y, c.lines);
    }
    if (c.stars) {
      this.criticalStars(x, y);
    }

    // Directional shake for extra impact feel
    this.directionalShake(direction, c.shake * 0.5, c.shakeTime / 2);
  }

  /**
   * Death effect - big explosion
   * @param {number} x
   * @param {number} y
   * @param {number} color
   */
  deathEffect(x, y, color = 0xff4444) {
    this.screenShake(12, 200);
    this.screenFlash(color, 60, 0.3);

    // Sparks in all directions
    this.hitSparks(x, y, 20, 1);
    this.hitSparks(x, y, 20, -1);

    // Big particle burst
    this.damageParticles(x, y, 15, color);

    // Impact lines
    this.impactLines(x, y, 8, 50);

    // Expanding ring
    const ring = this.scene.add.circle(x, y, 20, color, 0);
    ring.setStrokeStyle(4, color, 0.8);
    ring.setDepth(800);

    this.scene.tweens.add({
      targets: ring,
      scale: 3,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => ring.destroy(),
    });
  }

  /**
   * Create floating damage number
   * @param {number} x
   * @param {number} y
   * @param {number} damage
   * @param {boolean} isCrit
   * @param {number} color - Optional custom color
   */
  damageNumber(x, y, damage, isCrit = false, color = null) {
    const textColor = color
      ? `#${color.toString(16).padStart(6, '0')}`
      : isCrit
        ? '#ffff00'
        : '#ffffff';

    const fontSize = isCrit ? '28px' : '20px';
    const displayText = isCrit ? `${damage}!` : damage.toString();

    // Slight random offset for multiple hits
    const offsetX = (Math.random() - 0.5) * 30;
    const offsetY = (Math.random() - 0.5) * 10;

    const text = this.scene.add.text(x + offsetX, y + offsetY, displayText, {
      fontFamily: 'monospace',
      fontSize: fontSize,
      fontStyle: isCrit ? 'bold' : 'normal',
      color: textColor,
      stroke: '#000000',
      strokeThickness: 4,
    });
    text.setOrigin(0.5);
    text.setDepth(1000);

    // Scale pop on critical
    if (isCrit) {
      text.setScale(0.5);
      this.scene.tweens.add({
        targets: text,
        scale: 1.3,
        duration: 100,
        ease: 'Back.easeOut',
      });
    }

    // Float up and fade
    this.scene.tweens.add({
      targets: text,
      y: y - 60,
      alpha: 0,
      scale: isCrit ? 1.5 : 1.1,
      duration: 800,
      ease: 'Power2',
      delay: 100,
      onComplete: () => text.destroy(),
    });
  }

  // ==================
  // Utility Methods
  // ==================

  /**
   * Get or create colored particle texture
   * @param {string} baseKey
   * @param {number} color
   * @returns {string}
   */
  getColoredParticleKey(baseKey, color) {
    if (color === 0xffffff) return baseKey;

    const key = `${baseKey}_${color}`;
    if (!this.scene.textures.exists(key)) {
      // Create tinted version
      const size = baseKey.includes('spark') ? 8 : 6;
      const gfx = this.scene.make.graphics({ x: 0, y: 0, add: false });
      gfx.fillStyle(color, 1);
      if (baseKey.includes('spark')) {
        gfx.fillCircle(size / 2, size / 2, size / 2);
      } else {
        gfx.fillRect(0, 0, size, size);
      }
      gfx.generateTexture(key, size, size);
      gfx.destroy();
    }
    return key;
  }

  /**
   * Schedule particle emitter destruction
   * @param {Phaser.GameObjects.Particles.ParticleEmitter} particles
   * @param {number} delay
   */
  scheduleDestroy(particles, delay) {
    this.scene.time.delayedCall(delay, () => {
      if (particles && particles.active) {
        particles.destroy();
      }
    });
  }

  /**
   * Toggle effect settings
   * @param {string} setting
   * @param {boolean} enabled
   */
  setSetting(setting, enabled) {
    if (this.settings.hasOwnProperty(setting)) {
      this.settings[setting] = enabled;
    }
  }

  /**
   * Clean up all active effects
   */
  destroy() {
    for (const trail of this.activeTrails) {
      if (trail && trail.destroy) trail.destroy();
    }
    this.activeTrails = [];

    for (const effect of this.activeEffects) {
      if (effect && effect.destroy) effect.destroy();
    }
    this.activeEffects = [];
  }
}
