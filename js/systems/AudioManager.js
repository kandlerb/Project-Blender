/**
 * AudioManager - Handles all game audio
 * Features:
 * - Sound pools for frequent SFX
 * - Music with crossfade
 * - Category-based volume controls
 * - Spatial audio support
 */
export class AudioManager {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;

    // Volume settings (0-1)
    this.volumes = {
      master: 0.8,
      sfx: 1.0,
      music: 0.6,
      ui: 0.8,
    };

    // Sound pools for frequent effects
    this.soundPools = {};
    this.poolSize = 5;

    // Currently playing music
    this.currentMusic = null;
    this.currentMusicKey = null;

    // Music crossfade
    this.crossfadeDuration = 1000;
    this.isCrossfading = false;

    // Mute states
    this.muted = {
      master: false,
      sfx: false,
      music: false,
    };

    // Initialize pools for common sounds
    this.initSoundPools();
  }

  /**
   * Initialize sound pools for frequent effects
   */
  initSoundPools() {
    // These will be populated when assets are loaded
    // Pool keys match sound keys in PreloadScene
    const pooledSounds = [
      'hit_light',
      'hit_heavy',
      'hit_critical',
      'swing_light',
      'swing_heavy',
      'footstep',
      'jump',
      'land',
      'dodge',
      'parry',
    ];

    pooledSounds.forEach(key => {
      this.createSoundPool(key);
    });
  }

  /**
   * Create a pool of sound instances
   * @param {string} key - Sound key
   */
  createSoundPool(key) {
    // Check if sound exists in cache
    if (!this.scene.cache.audio.exists(key)) {
      // Sound not loaded yet, will be created when played
      this.soundPools[key] = [];
      return;
    }

    this.soundPools[key] = [];
    for (let i = 0; i < this.poolSize; i++) {
      const sound = this.scene.sound.add(key, { volume: 0 });
      this.soundPools[key].push({
        sound,
        inUse: false,
      });
    }
  }

  /**
   * Get an available sound from pool
   * @param {string} key
   * @returns {Phaser.Sound.BaseSound|null}
   */
  getFromPool(key) {
    const pool = this.soundPools[key];
    if (!pool) return null;

    // Find unused sound
    for (const entry of pool) {
      if (!entry.inUse) {
        entry.inUse = true;
        return entry.sound;
      }
    }

    // All in use, reuse oldest (first)
    if (pool.length > 0) {
      pool[0].sound.stop();
      return pool[0].sound;
    }

    return null;
  }

  /**
   * Return sound to pool
   * @param {string} key
   * @param {Phaser.Sound.BaseSound} sound
   */
  returnToPool(key, sound) {
    const pool = this.soundPools[key];
    if (!pool) return;

    const entry = pool.find(e => e.sound === sound);
    if (entry) {
      entry.inUse = false;
    }
  }

  /**
   * Calculate effective volume for a category
   * @param {string} category - 'sfx', 'music', 'ui'
   * @returns {number}
   */
  getEffectiveVolume(category) {
    if (this.muted.master || this.muted[category]) return 0;
    return this.volumes.master * this.volumes[category];
  }

  /**
   * Play a sound effect
   * @param {string} key - Sound key
   * @param {object} config - Optional config
   * @returns {Phaser.Sound.BaseSound|null}
   */
  playSFX(key, config = {}) {
    const volume = this.getEffectiveVolume('sfx') * (config.volume || 1);
    if (volume <= 0) return null;

    // Try pool first
    let sound = this.getFromPool(key);

    if (sound) {
      sound.setVolume(volume);
      if (config.rate) sound.setRate(config.rate);
      if (config.detune) sound.setDetune(config.detune);
      sound.play();

      // Return to pool when done
      sound.once('complete', () => this.returnToPool(key, sound));
    } else {
      // Not pooled or pool empty, play directly
      if (!this.scene.cache.audio.exists(key)) {
        // Sound doesn't exist, fail silently
        return null;
      }

      sound = this.scene.sound.play(key, {
        volume,
        rate: config.rate || 1,
        detune: config.detune || 0,
      });
    }

    return sound;
  }

  /**
   * Play a sound with random pitch variation
   * @param {string} key
   * @param {number} variance - Pitch variance (0-1)
   * @param {object} config
   */
  playSFXVaried(key, variance = 0.1, config = {}) {
    const rate = 1 + (Math.random() - 0.5) * 2 * variance;
    return this.playSFX(key, { ...config, rate });
  }

  /**
   * Play UI sound
   * @param {string} key
   * @param {object} config
   */
  playUI(key, config = {}) {
    const volume = this.getEffectiveVolume('ui') * (config.volume || 1);
    if (volume <= 0) return null;

    if (!this.scene.cache.audio.exists(key)) return null;

    return this.scene.sound.play(key, { volume });
  }

  /**
   * Play music track
   * @param {string} key - Music key
   * @param {boolean} loop - Loop the music
   * @param {boolean} crossfade - Crossfade from current music
   */
  playMusic(key, loop = true, crossfade = true) {
    if (this.currentMusicKey === key) return;

    if (!this.scene.cache.audio.exists(key)) {
      console.warn(`Music track not found: ${key}`);
      return;
    }

    const volume = this.getEffectiveVolume('music');

    if (crossfade && this.currentMusic) {
      this.crossfadeToMusic(key, loop);
    } else {
      // Stop current music
      if (this.currentMusic) {
        this.currentMusic.stop();
      }

      // Start new music
      this.currentMusic = this.scene.sound.add(key, {
        volume,
        loop,
      });
      this.currentMusic.play();
      this.currentMusicKey = key;
    }
  }

  /**
   * Crossfade to new music track
   * @param {string} key
   * @param {boolean} loop
   */
  crossfadeToMusic(key, loop) {
    if (this.isCrossfading) return;
    this.isCrossfading = true;

    const oldMusic = this.currentMusic;
    const targetVolume = this.getEffectiveVolume('music');

    // Create new music at 0 volume
    this.currentMusic = this.scene.sound.add(key, {
      volume: 0,
      loop,
    });
    this.currentMusic.play();
    this.currentMusicKey = key;

    // Fade out old, fade in new
    this.scene.tweens.add({
      targets: oldMusic,
      volume: 0,
      duration: this.crossfadeDuration,
      onComplete: () => {
        oldMusic.stop();
        oldMusic.destroy();
      },
    });

    this.scene.tweens.add({
      targets: this.currentMusic,
      volume: targetVolume,
      duration: this.crossfadeDuration,
      onComplete: () => {
        this.isCrossfading = false;
      },
    });
  }

  /**
   * Stop current music
   * @param {boolean} fade - Fade out
   */
  stopMusic(fade = true) {
    if (!this.currentMusic) return;

    if (fade) {
      this.scene.tweens.add({
        targets: this.currentMusic,
        volume: 0,
        duration: this.crossfadeDuration,
        onComplete: () => {
          if (this.currentMusic) {
            this.currentMusic.stop();
            this.currentMusic.destroy();
            this.currentMusic = null;
            this.currentMusicKey = null;
          }
        },
      });
    } else {
      this.currentMusic.stop();
      this.currentMusic.destroy();
      this.currentMusic = null;
      this.currentMusicKey = null;
    }
  }

  /**
   * Pause music
   */
  pauseMusic() {
    if (this.currentMusic && this.currentMusic.isPlaying) {
      this.currentMusic.pause();
    }
  }

  /**
   * Resume music
   */
  resumeMusic() {
    if (this.currentMusic && this.currentMusic.isPaused) {
      this.currentMusic.resume();
    }
  }

  /**
   * Set volume for a category
   * @param {string} category - 'master', 'sfx', 'music', 'ui'
   * @param {number} volume - 0-1
   */
  setVolume(category, volume) {
    this.volumes[category] = Math.max(0, Math.min(1, volume));

    // Update current music volume
    if (category === 'master' || category === 'music') {
      if (this.currentMusic) {
        this.currentMusic.setVolume(this.getEffectiveVolume('music'));
      }
    }
  }

  /**
   * Toggle mute for a category
   * @param {string} category
   * @returns {boolean} New mute state
   */
  toggleMute(category) {
    this.muted[category] = !this.muted[category];

    // Update music volume
    if (category === 'master' || category === 'music') {
      if (this.currentMusic) {
        this.currentMusic.setVolume(this.getEffectiveVolume('music'));
      }
    }

    return this.muted[category];
  }

  // ==================
  // Combat Sound Helpers
  // ==================

  /**
   * Play attack swing sound
   * @param {string} type - 'light', 'heavy', 'spin'
   */
  playSwing(type = 'light') {
    const key = type === 'heavy' ? 'swing_heavy' : 'swing_light';
    this.playSFXVaried(key, 0.15);
  }

  /**
   * Play hit sound based on damage
   * @param {number} damage
   * @param {boolean} isCritical
   */
  playHit(damage, isCritical = false) {
    if (isCritical) {
      this.playSFX('hit_critical');
    } else if (damage >= 20) {
      this.playSFXVaried('hit_heavy', 0.1);
    } else {
      this.playSFXVaried('hit_light', 0.2);
    }
  }

  /**
   * Play movement sound
   * @param {string} type - 'jump', 'land', 'footstep', 'dodge'
   */
  playMovement(type) {
    switch (type) {
      case 'jump':
        this.playSFX('jump', { volume: 0.7 });
        break;
      case 'land':
        this.playSFXVaried('land', 0.1, { volume: 0.6 });
        break;
      case 'footstep':
        this.playSFXVaried('footstep', 0.2, { volume: 0.3 });
        break;
      case 'dodge':
        this.playSFX('dodge', { volume: 0.8 });
        break;
    }
  }

  /**
   * Play parry sound
   * @param {boolean} isPerfect
   */
  playParry(isPerfect = false) {
    if (isPerfect) {
      this.playSFX('parry', { volume: 1.0, rate: 1.2 });
    } else {
      this.playSFX('parry', { volume: 0.7 });
    }
  }

  /**
   * Play combo milestone sound
   * @param {number} combo
   */
  playComboMilestone(combo) {
    // Higher pitch for higher combos
    const rate = 1 + (Math.min(combo, 100) / 100) * 0.5;
    this.playSFX('combo_milestone', { rate });
  }

  /**
   * Clean up
   */
  destroy() {
    this.stopMusic(false);

    // Clear pools
    for (const key in this.soundPools) {
      this.soundPools[key].forEach(entry => {
        if (entry.sound) {
          entry.sound.destroy();
        }
      });
    }
    this.soundPools = {};
  }
}
