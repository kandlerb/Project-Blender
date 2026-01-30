/**
 * Grid configuration for corpse settling
 */
export const GRID_CONFIG = Object.freeze({
  CELL_WIDTH: 24,      // Width of each cell in pixels
  CELL_HEIGHT: 20,     // Height (slightly shorter for overlap look)
  ROW_OFFSET: 0.5,     // Odd rows offset by this fraction of CELL_WIDTH
});

/**
 * CorpseGrid - Manages a 2D staggered grid for corpse settling
 *
 * Uses a "brick pattern" where odd rows are offset by half a cell width,
 * causing corpses to naturally nest into pyramid shapes.
 *
 * Grid is sparse - only occupied cells are stored in memory.
 */
export class CorpseGrid {
  /**
   * @param {Phaser.Scene} scene - The scene this grid belongs to
   * @param {Phaser.Physics.Arcade.StaticGroup} platformLayer - The platform/ground static group for collision checks
   */
  constructor(scene, platformLayer) {
    this.scene = scene;
    this.platformLayer = platformLayer;

    // Sparse storage for occupied cells: Map<"col,row", corpseData>
    this.occupiedCells = new Map();

    // Cache grid config for quick access
    this.cellWidth = GRID_CONFIG.CELL_WIDTH;
    this.cellHeight = GRID_CONFIG.CELL_HEIGHT;
    this.rowOffset = GRID_CONFIG.ROW_OFFSET;

    // Debug visualization
    this.debugEnabled = false;
    this.debugGraphics = null;
  }

  /**
   * Enable or disable debug visualization
   * @param {boolean} enabled - Whether to show debug overlay
   */
  setDebug(enabled) {
    this.debugEnabled = enabled;

    if (enabled) {
      if (!this.debugGraphics) {
        this.debugGraphics = this.scene.add.graphics();
        this.debugGraphics.setDepth(999);
      }
    } else {
      if (this.debugGraphics) {
        this.debugGraphics.clear();
      }
    }
  }

  /**
   * Generate a unique key for a cell position
   * @param {number} col - Column index
   * @param {number} row - Row index
   * @returns {string} Key in format "col,row"
   */
  getCellKey(col, row) {
    return `${col},${row}`;
  }

  /**
   * Parse a cell key back into col/row
   * @param {string} key - Key in format "col,row"
   * @returns {{ col: number, row: number }}
   */
  parseCellKey(key) {
    const [col, row] = key.split(',').map(Number);
    return { col, row };
  }

  /**
   * Convert world coordinates to grid cell
   * Accounts for staggered row offset
   * @param {number} worldX - World X position
   * @param {number} worldY - World Y position
   * @returns {{ col: number, row: number }}
   */
  worldToGrid(worldX, worldY) {
    // Calculate row first (simple division)
    const row = Math.floor(worldY / this.cellHeight);

    // For odd rows, un-offset the X before calculating column
    let adjustedX = worldX;
    if (row % 2 === 1) {
      adjustedX -= this.cellWidth * this.rowOffset;
    }

    const col = Math.floor(adjustedX / this.cellWidth);

    return { col, row };
  }

  /**
   * Convert grid cell to world coordinates (center of cell)
   * Accounts for staggered row offset
   * @param {number} col - Column index
   * @param {number} row - Row index
   * @returns {{ x: number, y: number }}
   */
  gridToWorld(col, row) {
    // Base position: center of cell
    let x = (col + 0.5) * this.cellWidth;
    let y = (row + 0.5) * this.cellHeight;

    // Apply offset for odd rows
    if (row % 2 === 1) {
      x += this.cellWidth * this.rowOffset;
    }

    return { x, y };
  }

  /**
   * Check if a cell is occupied
   * @param {number} col - Column index
   * @param {number} row - Row index
   * @returns {boolean}
   */
  isOccupied(col, row) {
    return this.occupiedCells.has(this.getCellKey(col, row));
  }

  /**
   * Get the corpse data stored in a cell
   * @param {number} col - Column index
   * @param {number} row - Row index
   * @returns {*} The stored corpse data, or undefined
   */
  getCellData(col, row) {
    return this.occupiedCells.get(this.getCellKey(col, row));
  }

  /**
   * Check if there's solid ground below a cell position
   * @param {number} col - Column index
   * @param {number} row - Row index
   * @returns {boolean}
   */
  isGroundBelow(col, row) {
    if (!this.platformLayer) return false;

    // Get the world position of the cell below
    const belowPos = this.gridToWorld(col, row + 1);

    // Check if this position intersects with any platform tiles
    const children = this.platformLayer.getChildren();
    for (const tile of children) {
      if (!tile.body) continue;

      const body = tile.body;

      // Check if the cell position overlaps with this tile
      // We check a small area around the cell center
      const cellLeft = belowPos.x - this.cellWidth * 0.4;
      const cellRight = belowPos.x + this.cellWidth * 0.4;
      const cellTop = belowPos.y - this.cellHeight * 0.4;
      const cellBottom = belowPos.y + this.cellHeight * 0.4;

      const horizontalOverlap = cellRight > body.left && cellLeft < body.right;
      const verticalOverlap = cellBottom > body.top && cellTop < body.bottom;

      if (horizontalOverlap && verticalOverlap) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a cell has support (ground below OR occupied cell(s) below)
   * For staggered grid, "below" depends on row parity:
   * - Even rows: check cell directly below (col, row+1)
   * - Odd rows: check two cells below (col, row+1) and (col+1, row+1)
   *
   * @param {number} col - Column index
   * @param {number} row - Row index
   * @returns {boolean}
   */
  hasSupport(col, row) {
    // First check for ground collision at this position
    if (this.isGroundBelow(col, row)) {
      return true;
    }

    // Check for supporting cells based on row parity
    if (row % 2 === 0) {
      // Even row: sits on top of odd row below
      // In brick pattern, even rows are supported by two cells in odd row below
      // Check (col-1, row+1) and (col, row+1) in the staggered pattern
      const supportLeft = this.isOccupied(col - 1, row + 1);
      const supportRight = this.isOccupied(col, row + 1);

      // Need at least one support, but ideally both for stability
      // For now, require at least one
      return supportLeft || supportRight;
    } else {
      // Odd row: sits on top of even row below
      // In brick pattern, odd rows are supported by two cells in even row below
      // Check (col, row+1) and (col+1, row+1) in the staggered pattern
      const supportLeft = this.isOccupied(col, row + 1);
      const supportRight = this.isOccupied(col + 1, row + 1);

      return supportLeft || supportRight;
    }
  }

  /**
   * Claim a cell (mark as occupied)
   * @param {number} col - Column index
   * @param {number} row - Row index
   * @param {*} corpseData - Data to associate with this cell (e.g., corpse reference)
   */
  occupyCell(col, row, corpseData) {
    this.occupiedCells.set(this.getCellKey(col, row), corpseData);
  }

  /**
   * Clear a cell (mark as unoccupied)
   * @param {number} col - Column index
   * @param {number} row - Row index
   */
  clearCell(col, row) {
    this.occupiedCells.delete(this.getCellKey(col, row));
  }

  /**
   * Find the best valid cell for a falling corpse near position (x, y)
   * Searches downward and sideways to find a cell with support
   * @param {number} worldX - World X position
   * @param {number} worldY - World Y position
   * @returns {{ col: number, row: number, worldX: number, worldY: number } | null}
   */
  findSettlingCell(worldX, worldY) {
    // Convert to grid coordinates
    const { col: startCol, row: startRow } = this.worldToGrid(worldX, worldY);

    // Search parameters
    const maxSearchRows = 100; // How far down to search
    const maxSearchCols = 10; // How far sideways to search

    // Start from current position and search downward
    for (let rowOffset = 0; rowOffset < maxSearchRows; rowOffset++) {
      const row = startRow + rowOffset;

      // Search horizontally, starting from center and expanding outward
      for (let colOffset = 0; colOffset <= maxSearchCols; colOffset++) {
        // Try both left and right at each offset
        const colsToTry = colOffset === 0 ? [startCol] : [startCol - colOffset, startCol + colOffset];

        for (const col of colsToTry) {
          // Skip if already occupied
          if (this.isOccupied(col, row)) {
            continue;
          }

          // Check if this cell has support
          if (this.hasSupport(col, row)) {
            const worldPos = this.gridToWorld(col, row);
            return {
              col,
              row,
              worldX: worldPos.x,
              worldY: worldPos.y,
            };
          }
        }
      }
    }

    // No valid position found (shouldn't happen normally)
    return null;
  }

  /**
   * Find a settling cell that prefers stacking in pyramid formation
   * Tries to find cells that would create natural pile shapes
   * @param {number} worldX - World X position
   * @param {number} worldY - World Y position
   * @returns {{ col: number, row: number, worldX: number, worldY: number } | null}
   */
  findStackingCell(worldX, worldY) {
    // First, find the basic settling cell
    const basicCell = this.findSettlingCell(worldX, worldY);
    if (!basicCell) return null;

    // Check if we can stack on top of existing corpses
    // Look for cells that have two supporting cells below (more stable)
    const { col: startCol, row: startRow } = this.worldToGrid(worldX, worldY);

    // Search for ideal stacking positions (cells with two supports)
    for (let rowOffset = 0; rowOffset < 50; rowOffset++) {
      const row = startRow + rowOffset;

      for (let colOffset = 0; colOffset <= 5; colOffset++) {
        const colsToTry = colOffset === 0 ? [startCol] : [startCol - colOffset, startCol + colOffset];

        for (const col of colsToTry) {
          if (this.isOccupied(col, row)) continue;

          // Check if has dual support (more stable for pyramid stacking)
          const hasDualSupport = this.hasDualSupport(col, row);
          const hasAnySupport = this.hasSupport(col, row);

          if (hasDualSupport) {
            const worldPos = this.gridToWorld(col, row);
            return {
              col,
              row,
              worldX: worldPos.x,
              worldY: worldPos.y,
            };
          }

          // If we've searched far enough, accept single support
          if (hasAnySupport && rowOffset > 5) {
            const worldPos = this.gridToWorld(col, row);
            return {
              col,
              row,
              worldX: worldPos.x,
              worldY: worldPos.y,
            };
          }
        }
      }
    }

    // Fall back to basic settling
    return basicCell;
  }

  /**
   * Check if a cell has dual support (both supporting cells occupied)
   * This creates more stable pyramid formations
   * @param {number} col - Column index
   * @param {number} row - Row index
   * @returns {boolean}
   */
  hasDualSupport(col, row) {
    // Ground always counts as dual support
    if (this.isGroundBelow(col, row)) {
      return true;
    }

    if (row % 2 === 0) {
      // Even row needs both (col-1, row+1) and (col, row+1)
      return this.isOccupied(col - 1, row + 1) && this.isOccupied(col, row + 1);
    } else {
      // Odd row needs both (col, row+1) and (col+1, row+1)
      return this.isOccupied(col, row + 1) && this.isOccupied(col + 1, row + 1);
    }
  }

  /**
   * Get all occupied cells in a region
   * @param {number} minCol - Minimum column
   * @param {number} maxCol - Maximum column
   * @param {number} minRow - Minimum row
   * @param {number} maxRow - Maximum row
   * @returns {Array<{ col: number, row: number, data: * }>}
   */
  getCellsInRegion(minCol, maxCol, minRow, maxRow) {
    const cells = [];

    for (const [key, data] of this.occupiedCells) {
      const { col, row } = this.parseCellKey(key);

      if (col >= minCol && col <= maxCol && row >= minRow && row <= maxRow) {
        cells.push({ col, row, data });
      }
    }

    return cells;
  }

  /**
   * Get count of occupied cells
   * @returns {number}
   */
  getOccupiedCount() {
    return this.occupiedCells.size;
  }

  /**
   * Clear all occupied cells
   */
  clearAll() {
    this.occupiedCells.clear();
  }

  /**
   * Get statistics about the grid
   * @returns {{ occupied: number, bounds: { minCol: number, maxCol: number, minRow: number, maxRow: number } | null }}
   */
  getStats() {
    if (this.occupiedCells.size === 0) {
      return { occupied: 0, bounds: null };
    }

    let minCol = Infinity;
    let maxCol = -Infinity;
    let minRow = Infinity;
    let maxRow = -Infinity;

    for (const key of this.occupiedCells.keys()) {
      const { col, row } = this.parseCellKey(key);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
    }

    return {
      occupied: this.occupiedCells.size,
      bounds: { minCol, maxCol, minRow, maxRow },
    };
  }

  /**
   * Draw debug visualization using internal graphics
   * Call this each frame when debug is enabled
   */
  drawDebug() {
    if (!this.debugEnabled || !this.debugGraphics) return;

    const camera = this.scene.cameras.main;
    const viewMinX = camera.scrollX;
    const viewMaxX = camera.scrollX + camera.width;
    const viewMinY = camera.scrollY;
    const viewMaxY = camera.scrollY + camera.height;

    this.debugDraw(this.debugGraphics, viewMinX, viewMaxX, viewMinY, viewMaxY);
  }

  /**
   * Debug visualization - draw the grid and occupied cells
   * @param {Phaser.GameObjects.Graphics} graphics - Graphics object to draw with
   * @param {number} viewMinX - Minimum X of view area
   * @param {number} viewMaxX - Maximum X of view area
   * @param {number} viewMinY - Minimum Y of view area
   * @param {number} viewMaxY - Maximum Y of view area
   */
  debugDraw(graphics, viewMinX, viewMaxX, viewMinY, viewMaxY) {
    graphics.clear();

    // Convert view bounds to grid cells
    const { col: minCol, row: minRow } = this.worldToGrid(viewMinX, viewMinY);
    const { col: maxCol, row: maxRow } = this.worldToGrid(viewMaxX, viewMaxY);

    // Draw grid cells with different colors for even/odd rows
    for (let row = minRow - 1; row <= maxRow + 1; row++) {
      const isOddRow = row % 2 === 1;

      for (let col = minCol - 2; col <= maxCol + 2; col++) {
        const { x, y } = this.gridToWorld(col, row);
        const halfW = this.cellWidth / 2;
        const halfH = this.cellHeight / 2;

        // Different outline color for even/odd rows to show stagger
        if (isOddRow) {
          graphics.lineStyle(1, 0x00aaff, 0.4); // Blue for odd (staggered)
        } else {
          graphics.lineStyle(1, 0x888888, 0.3); // Gray for even
        }

        // Draw cell outline
        graphics.strokeRect(x - halfW, y - halfH, this.cellWidth, this.cellHeight);

        // Draw stagger offset marker on odd rows (small triangle at left edge)
        if (isOddRow && col === minCol - 1) {
          graphics.fillStyle(0x00aaff, 0.5);
          const offsetX = this.cellWidth * this.rowOffset;
          graphics.fillTriangle(
            x - halfW, y - 4,
            x - halfW, y + 4,
            x - halfW + 8, y
          );
        }
      }
    }

    // Draw occupied cells with red fill
    graphics.fillStyle(0xff4444, 0.5);
    for (const key of this.occupiedCells.keys()) {
      const { col, row } = this.parseCellKey(key);
      const { x, y } = this.gridToWorld(col, row);
      const halfW = this.cellWidth / 2;
      const halfH = this.cellHeight / 2;

      graphics.fillRect(x - halfW + 1, y - halfH + 1, this.cellWidth - 2, this.cellHeight - 2);

      // Draw cell coordinates
      graphics.lineStyle(1, 0xffffff, 0.8);
      // Small dot in center
      graphics.fillStyle(0xffffff, 0.8);
      graphics.fillCircle(x, y, 2);
    }

    // Draw legend in top-left
    const legendX = viewMinX + 10;
    const legendY = viewMinY + 60;

    graphics.fillStyle(0x000000, 0.7);
    graphics.fillRect(legendX, legendY, 140, 50);

    graphics.lineStyle(1, 0x888888, 0.8);
    graphics.strokeRect(legendX + 5, legendY + 5, 12, 10);
    graphics.lineStyle(1, 0x00aaff, 0.8);
    graphics.strokeRect(legendX + 5, legendY + 20, 12, 10);
    graphics.fillStyle(0xff4444, 0.8);
    graphics.fillRect(legendX + 5, legendY + 35, 12, 10);
  }

  /**
   * Draw a snap indicator from corpse position to target cell
   * @param {Phaser.GameObjects.Graphics} graphics - Graphics object
   * @param {number} fromX - Current X position
   * @param {number} fromY - Current Y position
   * @param {number} toX - Target X position
   * @param {number} toY - Target Y position
   * @param {number} progress - Snap progress 0-1
   */
  drawSnapIndicator(graphics, fromX, fromY, toX, toY, progress) {
    // Draw line from current to target
    graphics.lineStyle(2, 0xffff00, 0.8);
    graphics.beginPath();
    graphics.moveTo(fromX, fromY);
    graphics.lineTo(toX, toY);
    graphics.strokePath();

    // Draw target cell outline
    const halfW = this.cellWidth / 2;
    const halfH = this.cellHeight / 2;
    graphics.lineStyle(2, 0xffff00, 0.6);
    graphics.strokeRect(toX - halfW, toY - halfH, this.cellWidth, this.cellHeight);

    // Draw progress arc around target
    graphics.lineStyle(3, 0x00ff00, 0.8);
    graphics.beginPath();
    graphics.arc(toX, toY, 12, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    graphics.strokePath();
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.debugGraphics) {
      this.debugGraphics.destroy();
      this.debugGraphics = null;
    }
    this.occupiedCells.clear();
    this.platformLayer = null;
    this.scene = null;
  }
}
