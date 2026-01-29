/**
 * Audio key constants
 * Match these to actual loaded sound files
 */
export const SOUNDS = Object.freeze({
  // Combat
  SWING_LIGHT: 'swing_light',
  SWING_HEAVY: 'swing_heavy',
  HIT_LIGHT: 'hit_light',
  HIT_HEAVY: 'hit_heavy',
  HIT_CRITICAL: 'hit_critical',
  PARRY: 'parry',
  BLOCK: 'block',

  // Movement
  JUMP: 'jump',
  LAND: 'land',
  FOOTSTEP: 'footstep',
  DODGE: 'dodge',
  BLINK: 'blink',
  GRAPPLE_FIRE: 'grapple_fire',
  GRAPPLE_HIT: 'grapple_hit',
  WALL_SLIDE: 'wall_slide',

  // Player
  HURT: 'player_hurt',
  DEATH: 'player_death',
  HEAL: 'heal',

  // Enemy
  ENEMY_HURT: 'enemy_hurt',
  ENEMY_DEATH: 'enemy_death',
  ENEMY_ALERT: 'enemy_alert',

  // Boss
  BOSS_INTRO: 'boss_intro',
  BOSS_PHASE: 'boss_phase',
  BOSS_DEATH: 'boss_death',

  // UI
  MENU_SELECT: 'menu_select',
  MENU_CONFIRM: 'menu_confirm',
  MENU_BACK: 'menu_back',
  COMBO_MILESTONE: 'combo_milestone',
  WEAPON_SWAP: 'weapon_swap',
  ULTIMATE_READY: 'ultimate_ready',
  ULTIMATE_ACTIVATE: 'ultimate_activate',

  // Ambient
  EXPLOSION: 'explosion',
});

export const MUSIC = Object.freeze({
  MENU: 'music_menu',
  EXPLORATION: 'music_exploration',
  COMBAT: 'music_combat',
  BOSS: 'music_boss',
  VICTORY: 'music_victory',
});
