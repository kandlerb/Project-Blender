/**
 * CorpseRenderer - Manages visual rendering of corpse pile
 *
 * Separate from terrain physics, handles the visual representation
 * of all settled corpses using their skeleton skins.
 */
export class CorpseRenderer {
  constructor(scene) {
    this.scene = scene;
    this.corpseVisuals = [];  // { skin, ragdoll } pairs
  }

  /**
   * Add a corpse visual
   */
  addCorpse(skin, ragdoll) {
    this.corpseVisuals.push({ skin, ragdoll });
  }

  /**
   * Remove a corpse visual
   */
  removeCorpse(ragdoll) {
    const index = this.corpseVisuals.findIndex(v => v.ragdoll === ragdoll);
    if (index > -1) {
      const visual = this.corpseVisuals[index];
      if (visual.skin) {
        visual.skin.destroy();
      }
      this.corpseVisuals.splice(index, 1);
    }
  }

  /**
   * Render all corpse visuals
   * Call this each frame
   */
  render() {
    for (const { skin, ragdoll } of this.corpseVisuals) {
      if (skin && ragdoll) {
        const positions = ragdoll.getWorldPositions();
        skin.renderFromPositions(positions);
      }
    }
  }

  /**
   * Get visual count
   */
  getCount() {
    return this.corpseVisuals.length;
  }

  /**
   * Clear all visuals
   */
  clear() {
    for (const { skin } of this.corpseVisuals) {
      if (skin) skin.destroy();
    }
    this.corpseVisuals = [];
  }

  /**
   * Clean up
   */
  destroy() {
    this.clear();
  }
}
