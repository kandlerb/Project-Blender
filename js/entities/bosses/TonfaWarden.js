import { Boss } from '../Boss.js';

/**
 * The Tonfa Warden - First Boss
 * "Built to punish your aggression"
 *
 * Mechanics:
 * - Defensive stance that auto-parries attacks
 * - Counter-attacks after successful parry
 * - Teaches players to bait and punish
 */
export class TonfaWarden extends Boss {
  constructor(scene, x, y) {
    super(scene, x, y, {
      id: 'tonfa_warden',
      name: 'The Tonfa Warden',
      weaponDrop: 'tonfas',

      maxHealth: 500,
      damage: 15,

      width: 50,
      height: 70,
      color: 0x4488ff,

      hitstunResistance: 0.2,
      minGlobalCooldown: 400,

      phases: [
        {
          threshold: 1.0,
          attacks: ['quick_jab', 'defensive_stance', 'sweep'],
        },
        {
          threshold: 0.66,
          attacks: ['quick_jab', 'defensive_stance', 'sweep', 'combo_rush'],
        },
        {
          threshold: 0.33,
          attacks: ['quick_jab', 'defensive_stance', 'sweep', 'combo_rush', 'desperation_spin'],
        },
      ],

      attackPatterns: {
        // Quick forward jab
        quick_jab: {
          duration: 600,
          cooldown: 1500,
          damage: 12,
          range: 100,
          onStart: function() {
            this.attackPhase = 'windup';
            this.sprite.setTint(0x6699ff);
          },
          onUpdate: function(timer, delta) {
            switch (this.attackPhase) {
              case 'windup':
                this.body.setVelocityX(0);
                if (timer >= 150) {
                  this.attackPhase = 'strike';
                  // Dash forward
                  this.body.setVelocityX(this.facingDirection * 400);
                  this.activateAttackHitbox({
                    damage: 12,
                    width: 50,
                    height: 40,
                    offsetX: this.facingDirection * 30,
                    knockback: { x: this.facingDirection * 250, y: -50 },
                  });
                }
                break;
              case 'strike':
                if (timer >= 350) {
                  this.attackPhase = 'recovery';
                  this.body.setVelocityX(0);
                  this.deactivateHitbox();
                }
                break;
              case 'recovery':
                if (timer >= 600) {
                  this.sprite.setTint(this.config.color);
                  return 'complete';
                }
                break;
            }
            return null;
          },
        },

        // Defensive stance - parries attacks, counters
        defensive_stance: {
          duration: 2000,
          cooldown: 3000,
          onStart: function() {
            this.attackPhase = 'stance';
            this.isDefending = true;
            this.hasCountered = false;
            this.sprite.setTint(0x88aaff);
            this.body.setVelocityX(0);

            // Visual indicator
            this.defenseIndicator = this.scene.add.circle(
              this.sprite.x,
              this.sprite.y,
              60,
              0x88aaff,
              0.3
            );
          },
          onUpdate: function(timer, delta) {
            // Update indicator position
            if (this.defenseIndicator) {
              this.defenseIndicator.setPosition(this.sprite.x, this.sprite.y);
            }

            if (this.attackPhase === 'counter') {
              // Executing counter attack
              if (timer - this.counterStartTime >= 300) {
                this.deactivateHitbox();
                return 'complete';
              }
              return null;
            }

            if (timer >= 2000) {
              // Stance expired without being triggered
              if (this.defenseIndicator) {
                this.defenseIndicator.destroy();
                this.defenseIndicator = null;
              }
              this.isDefending = false;
              this.sprite.setTint(this.config.color);
              return 'complete';
            }

            return null;
          },
          onEnd: function() {
            if (this.defenseIndicator) {
              this.defenseIndicator.destroy();
              this.defenseIndicator = null;
            }
            this.isDefending = false;
            this.sprite.setTint(this.config.color);
          },
        },

        // Low sweep attack
        sweep: {
          duration: 800,
          cooldown: 2000,
          damage: 10,
          onStart: function() {
            this.attackPhase = 'windup';
            this.sprite.setTint(0xff8844);
          },
          onUpdate: function(timer, delta) {
            switch (this.attackPhase) {
              case 'windup':
                // Crouch down
                this.body.setVelocityX(0);
                if (timer >= 250) {
                  this.attackPhase = 'sweep';
                  this.activateAttackHitbox({
                    damage: 10,
                    width: 80,
                    height: 30,
                    offsetX: this.facingDirection * 40,
                    offsetY: 25, // Low hit
                    knockback: { x: this.facingDirection * 200, y: -150 },
                  });
                }
                break;
              case 'sweep':
                // Slide forward while sweeping
                this.body.setVelocityX(this.facingDirection * 200);
                if (timer >= 500) {
                  this.attackPhase = 'recovery';
                  this.deactivateHitbox();
                  this.body.setVelocityX(0);
                }
                break;
              case 'recovery':
                if (timer >= 800) {
                  this.sprite.setTint(this.config.color);
                  return 'complete';
                }
                break;
            }
            return null;
          },
        },

        // Phase 2: Combo rush
        combo_rush: {
          duration: 1200,
          cooldown: 4000,
          damage: 8,
          onStart: function() {
            this.attackPhase = 'windup';
            this.comboCount = 0;
            this.sprite.setTint(0xff6644);
          },
          onUpdate: function(timer, delta) {
            switch (this.attackPhase) {
              case 'windup':
                this.body.setVelocityX(0);
                if (timer >= 200) {
                  this.attackPhase = 'combo';
                  this.lastHitTime = timer;
                }
                break;
              case 'combo':
                // 4-hit combo with forward movement
                const hitInterval = 200;
                if (timer - this.lastHitTime >= hitInterval && this.comboCount < 4) {
                  this.comboCount++;
                  this.lastHitTime = timer;

                  // Alternate hitbox sides
                  const side = this.comboCount % 2 === 0 ? 1 : -1;
                  this.body.setVelocityX(this.facingDirection * 150);

                  this.activateAttackHitbox({
                    damage: 8,
                    width: 45,
                    height: 35,
                    offsetX: this.facingDirection * 25 + (side * 10),
                    knockback: {
                      x: this.facingDirection * 100,
                      y: this.comboCount === 4 ? -200 : -30,
                    },
                  });

                  // Deactivate hitbox after brief window
                  this.scene.time.delayedCall(80, () => this.deactivateHitbox());
                }

                if (this.comboCount >= 4 && timer - this.lastHitTime >= hitInterval) {
                  this.attackPhase = 'recovery';
                  this.body.setVelocityX(0);
                }
                break;
              case 'recovery':
                if (timer >= 1200) {
                  this.sprite.setTint(this.config.color);
                  return 'complete';
                }
                break;
            }
            return null;
          },
        },

        // Phase 3: Desperation spin
        desperation_spin: {
          duration: 2500,
          cooldown: 6000,
          damage: 5,
          onStart: function() {
            this.attackPhase = 'windup';
            this.sprite.setTint(0xff3333);
            this.spinSpeed = 0;

            if (this.scene.effectsManager) {
              this.scene.effectsManager.screenShake(3, 500);
            }
          },
          onUpdate: function(timer, delta) {
            switch (this.attackPhase) {
              case 'windup':
                this.body.setVelocityX(0);
                // Charge up
                this.spinSpeed = Math.min(1500, this.spinSpeed + delta * 3);
                this.sprite.rotation += delta * 0.01 * (this.spinSpeed / 500);

                if (timer >= 700) {
                  this.attackPhase = 'spin';
                  this.activateAttackHitbox({
                    damage: 5,
                    width: 90,
                    height: 70,
                    offsetX: 0,
                    knockback: { x: 0, y: -100 },
                  });
                }
                break;
              case 'spin':
                // Spin and move toward player
                this.sprite.rotation += delta * 0.03;

                if (this.scene.player) {
                  const dx = this.scene.player.sprite.x - this.sprite.x;
                  this.body.setVelocityX(Math.sign(dx) * 250);
                }

                // Continuous damage ticks
                if (Math.random() < 0.3) {
                  this.activateAttackHitbox({
                    damage: 5,
                    width: 90,
                    height: 70,
                    offsetX: 0,
                    knockback: { x: this.facingDirection * 150, y: -100 },
                  });
                }

                if (timer >= 2000) {
                  this.attackPhase = 'recovery';
                  this.deactivateHitbox();
                  this.body.setVelocityX(0);
                }
                break;
              case 'recovery':
                // Slow down rotation
                this.sprite.rotation *= 0.9;
                if (Math.abs(this.sprite.rotation) < 0.1) {
                  this.sprite.rotation = 0;
                }

                if (timer >= 2500) {
                  this.sprite.rotation = 0;
                  this.sprite.setTint(this.config.color);
                  return 'complete';
                }
                break;
            }
            return null;
          },
        },
      },
    });

    // Warden-specific properties
    this.isDefending = false;
    this.defenseIndicator = null;
    this.attackPhase = null;
    this.comboCount = 0;
    this.lastHitTime = 0;
    this.spinSpeed = 0;
    this.counterStartTime = 0;
    this.hasCountered = false;
    this.currentHitbox = null;
  }

  /**
   * Override takeDamage to handle defensive stance
   */
  takeDamage(amount, hitData = null) {
    if (!this.isAlive || this.isInvulnerable) return;

    // Check if defending
    if (this.isDefending && !this.hasCountered) {
      // Parry! Counter attack
      this.triggerCounter(hitData);
      return;
    }

    // Normal damage
    super.takeDamage(amount, hitData);
  }

  /**
   * Trigger counter attack from parry
   */
  triggerCounter(hitData) {
    this.hasCountered = true;
    this.isDefending = false;

    // Clean up defense indicator
    if (this.defenseIndicator) {
      this.defenseIndicator.destroy();
      this.defenseIndicator = null;
    }

    // Visual feedback
    this.sprite.setTint(0xffff00);

    if (this.scene.effectsManager) {
      this.scene.effectsManager.screenFlash(0xffff00, 100, 0.3);
      this.scene.effectsManager.hitSparks(
        this.sprite.x,
        this.sprite.y,
        8,
        this.facingDirection
      );
    }

    if (this.scene.timeManager) {
      this.scene.timeManager.applySlowmo(200, 0.2);
    }

    // Counter attack
    this.attackPhase = 'counter';
    this.counterStartTime = this.attackTimer;

    // Face the attacker
    if (hitData?.attacker?.sprite) {
      this.facingDirection = hitData.attacker.sprite.x < this.sprite.x ? -1 : 1;
      this.sprite.setFlipX(this.facingDirection < 0);
    }

    // Dash and strike
    this.body.setVelocityX(this.facingDirection * 500);
    this.activateAttackHitbox({
      damage: 25,
      width: 60,
      height: 50,
      offsetX: this.facingDirection * 35,
      knockback: { x: this.facingDirection * 350, y: -150 },
    });
  }

  /**
   * Override selectAttack for smarter AI
   */
  selectAttack(availableAttacks) {
    const player = this.scene.player;
    if (!player) return availableAttacks[0];

    const dx = Math.abs(player.sprite.x - this.sprite.x);

    // Distance-based selection
    if (dx < 80) {
      // Close range - sweep or defend
      const closeAttacks = availableAttacks.filter(a =>
        a === 'sweep' || a === 'defensive_stance'
      );
      if (closeAttacks.length > 0) {
        return closeAttacks[Math.floor(Math.random() * closeAttacks.length)];
      }
    } else if (dx < 200) {
      // Medium range - jab or combo
      const midAttacks = availableAttacks.filter(a =>
        a === 'quick_jab' || a === 'combo_rush'
      );
      if (midAttacks.length > 0) {
        return midAttacks[Math.floor(Math.random() * midAttacks.length)];
      }
    }

    // Default random
    return availableAttacks[Math.floor(Math.random() * availableAttacks.length)];
  }

  /**
   * Override intro for dramatic entrance
   */
  updateIntro(time, delta) {
    if (this.stateTimer < 500) {
      // Rise from below or dramatic pose
      this.sprite.setAlpha(this.stateTimer / 500);
    } else if (this.stateTimer >= 1500) {
      this.showHealthBar();
      this.setState('IDLE');
    }
  }

  /**
   * Activate hitbox using simple bounds
   */
  activateAttackHitbox(config) {
    this.currentHitbox = {
      x: this.sprite.x + (config.offsetX || 0),
      y: this.sprite.y + (config.offsetY || 0),
      width: config.width,
      height: config.height,
      damage: config.damage,
      knockback: config.knockback,
      active: true,
    };
  }

  /**
   * Deactivate hitbox
   */
  deactivateHitbox() {
    this.currentHitbox = null;
  }

  /**
   * Check hitbox collision (called by scene)
   */
  checkHitboxCollision(player) {
    if (!this.currentHitbox || !this.currentHitbox.active || !player || !player.isAlive) {
      return false;
    }

    const hb = this.currentHitbox;
    // Update hitbox position to follow boss
    hb.x = this.sprite.x + (this.currentAttack?.offsetX || 0);
    hb.y = this.sprite.y + (this.currentAttack?.offsetY || 0);

    const ps = player.sprite;
    const playerHalfW = 20;
    const playerHalfH = 30;

    // Simple AABB collision
    const hit = !(
      ps.x - playerHalfW > hb.x + hb.width / 2 ||
      ps.x + playerHalfW < hb.x - hb.width / 2 ||
      ps.y - playerHalfH > hb.y + hb.height / 2 ||
      ps.y + playerHalfH < hb.y - hb.height / 2
    );

    if (hit) {
      player.takeDamage(hb.damage, {
        attacker: this,
        knockback: hb.knockback,
        hitstun: 200,
      });
      this.currentHitbox.active = false; // Only hit once per attack
    }

    return hit;
  }

  /**
   * Override update to update hitbox position
   */
  update(time, delta) {
    super.update(time, delta);

    // Update hitbox position if active
    if (this.currentHitbox && this.currentHitbox.active) {
      // Hitbox follows boss movement
      if (this.currentAttack) {
        const offsetX = this.facingDirection * Math.abs(this.currentHitbox.width / 2);
        this.currentHitbox.x = this.sprite.x + offsetX;
        this.currentHitbox.y = this.sprite.y + (this.currentHitbox.offsetY || 0);
      }
    }
  }

  /**
   * Clean up
   */
  destroy() {
    if (this.defenseIndicator) {
      this.defenseIndicator.destroy();
      this.defenseIndicator = null;
    }
    super.destroy();
  }
}
