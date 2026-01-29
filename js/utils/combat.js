/**
 * Combat system constants
 */
export const COMBAT = Object.freeze({
  COMBO_DECAY_TIME: 2000,     // ms before combo resets
  INPUT_BUFFER: 100,          // ms to buffer attack inputs

  HITSTOP: Object.freeze({
    LIGHT: 50,                // ms - light attacks
    HEAVY: 100,               // ms - heavy attacks
    BOSS: 133,                // ms - hitting bosses
    ULTIMATE: 200,            // ms - ultimate attacks
  }),

  // Perfect timing windows (in ms)
  TIMING_WINDOWS: Object.freeze({
    PERFECT: 83,              // ~5 frames at 60fps
    GOOD: 166,                // ~10 frames
  }),

  // Damage scaling as combo increases
  COMBO_SCALING: Object.freeze([
    { threshold: 5, multiplier: 1.0 },
    { threshold: 10, multiplier: 0.9 },
    { threshold: 20, multiplier: 0.8 },
    { threshold: 50, multiplier: 0.7 },
    { threshold: Infinity, multiplier: 0.6 },
  ]),

  // Ultimate meter settings
  ULTIMATE: Object.freeze({
    MAX_METER: 100,
    METER_DECAY_ON_HIT: 10,    // Lose meter when taking damage

    // Gain rates
    GAIN_PER_LIGHT_HIT: 3,
    GAIN_PER_HEAVY_HIT: 6,
    GAIN_PER_KILL: 10,
    GAIN_PER_PERFECT_TIMING: 5,

    // Attack properties
    DURATION: 2000,           // Total ultimate duration
    DAMAGE: 50,
    INVULNERABLE: true,
  }),
});
