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

    // Platform bodies for walkable corpse surfaces
    // Map<"row-startCol-endCol", { body, row, startCol, endCol }>
    this.platformBodies = new Map();

    // Callback when platform bodies are created (set by CorpseManager)
    this.onPlatformCreated = null;
    this.onPlatformDestroyed = null;

    // Track which rows need platform rebuilds (batched updates)
    this.dirtyRows = new Set();

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
   * Get the two support cells for a given cell based on row parity
   * In a staggered brick pattern:
   * - Even rows: support comes from (col-1, row+1) and (col, row+1)
   * - Odd rows: support comes from (col, row+1) and (col+1, row+1)
   *
   * @param {number} col - Column index
   * @param {number} row - Row index
   * @returns {Array<{ col: number, row: number }>}
   */
  getSupportCells(col, row) {
    const rowBelow = row + 1;

    if (row % 2 === 0) {
      // Even row: support comes from (col-1, row+1) and (col, row+1)
      return [
        { col: col - 1, row: rowBelow },
        { col: col, row: rowBelow },
      ];
    } else {
      // Odd row: support comes from (col, row+1) and (col+1, row+1)
      return [
        { col: col, row: rowBelow },
        { col: col + 1, row: rowBelow },
      ];
    }
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
   * Check if a specific cell position overlaps with solid ground
   * Unlike isGroundBelow, this checks the cell itself, not the cell below it
   * @param {number} col - Column index
   * @param {number} row - Row index
   * @returns {boolean}
   */
  isGroundAt(col, row) {
    if (!this.platformLayer) return false;

    // Get the world position of this cell
    const cellPos = this.gridToWorld(col, row);

    // Check if this position intersects with any platform tiles
    const children = this.platformLayer.getChildren();
    for (const tile of children) {
      if (!tile.body) continue;

      const body = tile.body;

      // Check if the cell position overlaps with this tile
      const cellLeft = cellPos.x - this.cellWidth * 0.4;
      const cellRight = cellPos.x + this.cellWidth * 0.4;
      const cellTop = cellPos.y - this.cellHeight * 0.4;
      const cellBottom = cellPos.y + this.cellHeight * 0.4;

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
   * A cell has support if ANY of these conditions are true:
   * 1. The row below is ground (tilemap collision)
   * 2. At least ONE of the two supporting cells below is occupied OR is ground
   *
   * @param {number} col - Column index
   * @param {number} row - Row index
   * @returns {boolean}
   */
  hasSupport(col, row) {
    // First check for ground collision directly below this cell
    if (this.isGroundBelow(col, row)) {
      return true;
    }

    // Get the two support cells based on row parity
    const supportCells = this.getSupportCells(col, row);

    // Has support if EITHER support cell is occupied OR is at ground level
    for (const cell of supportCells) {
      if (this.isOccupied(cell.col, cell.row) || this.isGroundAt(cell.col, cell.row)) {
        return true; // ONE support is enough!
      }
    }

    return false;
  }

  /**
   * Claim a cell (mark as occupied)
   * @param {number} col - Column index
   * @param {number} row - Row index
   * @param {*} corpseData - Data to associate with this cell (e.g., corpse reference)
   */
  occupyCell(col, row, corpseData) {
    this.occupiedCells.set(this.getCellKey(col, row), corpseData);
    // Mark row for platform body rebuild
    this.markRowDirty(row);
  }

  /**
   * Clear a cell (mark as unoccupied)
   * @param {number} col - Column index
   * @param {number} row - Row index
   */
  clearCell(col, row) {
    this.occupiedCells.delete(this.getCellKey(col, row));
    // Mark row for platform body rebuild
    this.markRowDirty(row);
  }

  /**
   * Find the best valid cell for a falling corpse near position (x, y)
   * Searches downward first, then upward if spawned inside a pile, then nearest
   * @param {number} worldX - World X position
   * @param {number} worldY - World Y position
   * @returns {{ col: number, row: number, worldX: number, worldY: number } | null}
   */
  findSettlingCell(worldX, worldY) {
    // Convert to grid coordinates
    const { col: startCol, row: startRow } = this.worldToGrid(worldX, worldY);

    // FIRST: Try to find a cell at or below current position
    const cellBelow = this.findCellDownward(startCol, startRow);
    if (cellBelow) return cellBelow;

    // SECOND: If spawned inside a pile, search UPWARD for the top
    const cellAbove = this.findCellUpward(startCol, startRow);
    if (cellAbove) return cellAbove;

    // THIRD: Search in all directions for nearest valid cell
    const cellNearby = this.findNearestValidCell(worldX, worldY);
    if (cellNearby) return cellNearby;

    // No valid position found
    return null;
  }

  /**
   * Search downward and sideways from a position to find a valid cell
   * @param {number} startCol - Starting column
   * @param {number} startRow - Starting row
   * @param {number} maxRows - Maximum rows to search down (default 100)
   * @param {number} maxCols - Maximum columns to search sideways (default 10)
   * @returns {{ col: number, row: number, worldX: number, worldY: number } | null}
   */
  findCellDownward(startCol, startRow, maxRows = 100, maxCols = 10) {
    // Start from current position and search downward
    for (let rowOffset = 0; rowOffset < maxRows; rowOffset++) {
      const row = startRow + rowOffset;

      // Search horizontally, starting from center and expanding outward
      for (let colOffset = 0; colOffset <= maxCols; colOffset++) {
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
   * Search upward from a position to find a valid cell at the top of a pile
   * Used when a corpse spawns inside an existing pile
   * @param {number} col - Starting column
   * @param {number} row - Starting row
   * @param {number} maxRows - Maximum rows to search upward (default 50)
   * @returns {{ col: number, row: number, worldX: number, worldY: number } | null}
   */
  findCellUpward(col, row, maxRows = 50) {
    const minRow = Math.max(0, row - maxRows);

    // Scan upward from current position
    for (let checkRow = row - 1; checkRow >= minRow; checkRow--) {
      // Check this cell directly above
      if (!this.isOccupied(col, checkRow) && this.hasSupport(col, checkRow)) {
        const worldPos = this.gridToWorld(col, checkRow);
        return {
          col,
          row: checkRow,
          worldX: worldPos.x,
          worldY: worldPos.y,
        };
      }

      // Check adjacent columns at this height
      for (const offset of [-1, 1]) {
        const checkCol = col + offset;
        if (!this.isOccupied(checkCol, checkRow) && this.hasSupport(checkCol, checkRow)) {
          const worldPos = this.gridToWorld(checkCol, checkRow);
          return {
            col: checkCol,
            row: checkRow,
            worldX: worldPos.x,
            worldY: worldPos.y,
          };
        }
      }
    }

    return null;
  }

  /**
   * Find the nearest valid cell in any direction
   * Last resort search that expands outward in a spiral pattern
   * @param {number} worldX - World X position
   * @param {number} worldY - World Y position
   * @param {number} maxDistance - Maximum search distance in cells (default 20)
   * @returns {{ col: number, row: number, worldX: number, worldY: number } | null}
   */
  findNearestValidCell(worldX, worldY, maxDistance = 20) {
    const { col: startCol, row: startRow } = this.worldToGrid(worldX, worldY);

    // Spiral outward from center, checking cells in expanding rings
    for (let distance = 1; distance <= maxDistance; distance++) {
      // Check all cells at this distance (ring around center)
      for (let rowOffset = -distance; rowOffset <= distance; rowOffset++) {
        for (let colOffset = -distance; colOffset <= distance; colOffset++) {
          // Only check cells on the edge of this ring
          if (Math.abs(rowOffset) !== distance && Math.abs(colOffset) !== distance) {
            continue;
          }

          const checkCol = startCol + colOffset;
          const checkRow = startRow + rowOffset;

          // Skip if occupied
          if (this.isOccupied(checkCol, checkRow)) continue;

          // Check if has support
          if (this.hasSupport(checkCol, checkRow)) {
            const worldPos = this.gridToWorld(checkCol, checkRow);
            return {
              col: checkCol,
              row: checkRow,
              worldX: worldPos.x,
              worldY: worldPos.y,
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Check if a cell has dual support (both supporting cells occupied or on ground)
   * This creates more stable pyramid formations
   * @param {number} col - Column index
   * @param {number} row - Row index
   * @returns {boolean}
   */
  hasDualSupport(col, row) {
    // Ground directly below always counts as dual support
    if (this.isGroundBelow(col, row)) {
      return true;
    }

    // Get support cells and check if BOTH have support (occupied or ground)
    const supportCells = this.getSupportCells(col, row);

    for (const cell of supportCells) {
      const hasSupport = this.isOccupied(cell.col, cell.row) || this.isGroundAt(cell.col, cell.row);
      if (!hasSupport) {
        return false; // Missing support on one side
      }
    }

    return true; // Both support cells have support
  }

  // ========================================
  // Platform Body Management
  // ========================================

  /**
   * Mark a row as needing platform body rebuild
   * @param {number} row - Row index to mark dirty
   */
  markRowDirty(row) {
    this.dirtyRows.add(row);
  }

  /**
   * Process all dirty rows and rebuild their platform bodies
   * Call this once per frame after corpse updates
   */
  rebuildDirtyPlatforms() {
    for (const row of this.dirtyRows) {
      this.rebuildPlatformForRow(row);
    }
    this.dirtyRows.clear();
  }

  /**
   * Rebuild platform bodies for a specific row
   * Destroys existing platforms and creates new ones based on current occupied cells
   * @param {number} row - Row index to rebuild
   */
  rebuildPlatformForRow(row) {
    // Destroy existing platform bodies for this row
    for (const [key, platform] of this.platformBodies) {
      if (platform.row === row) {
        if (this.onPlatformDestroyed) {
          this.onPlatformDestroyed(platform.body);
        }
        platform.body.destroy();
        this.platformBodies.delete(key);
      }
    }

    // Find all horizontal runs of occupied cells in this row
    const runs = this.findHorizontalRuns(row);

    // Create a platform body for each run
    for (const run of runs) {
      this.createPlatformBody(row, run.startCol, run.endCol);
    }
  }

  /**
   * Find contiguous horizontal runs of occupied cells in a row
   * @param {number} row - Row index to scan
   * @returns {Array<{ startCol: number, endCol: number }>}
   */
  findHorizontalRuns(row) {
    const runs = [];

    // Get bounds of occupied cells to limit search
    const bounds = this.getRowBounds(row);
    if (!bounds) return runs;

    let currentRun = null;

    for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
      if (this.isOccupied(col, row)) {
        if (!currentRun) {
          currentRun = { startCol: col, endCol: col };
        } else {
          currentRun.endCol = col;
        }
      } else {
        if (currentRun) {
          runs.push(currentRun);
          currentRun = null;
        }
      }
    }

    // Don't forget the last run
    if (currentRun) {
      runs.push(currentRun);
    }

    return runs;
  }

  /**
   * Get the column bounds for occupied cells in a specific row
   * @param {number} row - Row index
   * @returns {{ minCol: number, maxCol: number } | null}
   */
  getRowBounds(row) {
    let minCol = Infinity;
    let maxCol = -Infinity;
    let found = false;

    for (const key of this.occupiedCells.keys()) {
      const parsed = this.parseCellKey(key);
      if (parsed.row === row) {
        minCol = Math.min(minCol, parsed.col);
        maxCol = Math.max(maxCol, parsed.col);
        found = true;
      }
    }

    return found ? { minCol, maxCol } : null;
  }

  /**
   * Create a static platform body spanning a horizontal run of corpses
   * @param {number} row - Row index
   * @param {number} startCol - Starting column
   * @param {number} endCol - Ending column
   */
  createPlatformBody(row, startCol, endCol) {
    // Calculate world position for top of this row of corpses
    const startWorld = this.gridToWorld(startCol, row);
    const endWorld = this.gridToWorld(endCol, row);

    const width = (endCol - startCol + 1) * this.cellWidth;
    const height = 8; // Thin collision surface on top of corpses

    // Center X between start and end cells
    const x = (startWorld.x + endWorld.x) / 2;
    // Position at top of corpse cells
    const y = startWorld.y - (this.cellHeight / 2) + 2;

    // Create static body (using a rectangle sprite with no texture)
    const platform = this.scene.add.rectangle(x, y, width, height);
    platform.setVisible(false); // Invisible - just for collision
    this.scene.physics.add.existing(platform, true); // true = static body

    // Store reference
    const key = `${row}-${startCol}-${endCol}`;
    this.platformBodies.set(key, {
      body: platform,
      row,
      startCol,
      endCol,
    });

    // Notify callback for collision setup
    if (this.onPlatformCreated) {
      this.onPlatformCreated(platform);
    }
  }

  /**
   * Get all platform bodies
   * @returns {Map} Map of platform bodies
   */
  getPlatformBodies() {
    return this.platformBodies;
  }

  /**
   * Destroy all platform bodies
   */
  clearPlatformBodies() {
    for (const [key, platform] of this.platformBodies) {
      if (this.onPlatformDestroyed) {
        this.onPlatformDestroyed(platform.body);
      }
      platform.body.destroy();
    }
    this.platformBodies.clear();
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
    this.clearPlatformBodies();
    this.dirtyRows.clear();
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

    // Draw platform bodies (cyan rectangles showing collision surfaces)
    graphics.lineStyle(2, 0x00ffff, 0.8);
    for (const [key, platform] of this.platformBodies) {
      const body = platform.body.body || platform.body;
      if (body && body.position) {
        // For static bodies, position is the center
        const x = body.position.x;
        const y = body.position.y;
        const width = body.width;
        const height = body.height;
        graphics.strokeRect(x, y, width, height);
      } else if (platform.body.x !== undefined) {
        // Fallback for rectangle game objects
        const x = platform.body.x - platform.body.width / 2;
        const y = platform.body.y - platform.body.height / 2;
        graphics.strokeRect(x, y, platform.body.width, platform.body.height);
      }
    }

    // Draw legend in top-left
    const legendX = viewMinX + 10;
    const legendY = viewMinY + 60;

    graphics.fillStyle(0x000000, 0.7);
    graphics.fillRect(legendX, legendY, 140, 65);

    graphics.lineStyle(1, 0x888888, 0.8);
    graphics.strokeRect(legendX + 5, legendY + 5, 12, 10);
    graphics.lineStyle(1, 0x00aaff, 0.8);
    graphics.strokeRect(legendX + 5, legendY + 20, 12, 10);
    graphics.fillStyle(0xff4444, 0.8);
    graphics.fillRect(legendX + 5, legendY + 35, 12, 10);
    graphics.lineStyle(2, 0x00ffff, 0.8);
    graphics.strokeRect(legendX + 5, legendY + 50, 12, 6);
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

    // Clean up platform bodies
    this.clearPlatformBodies();
    this.dirtyRows.clear();

    this.occupiedCells.clear();
    this.platformLayer = null;
    this.onPlatformCreated = null;
    this.onPlatformDestroyed = null;
    this.scene = null;
  }
}
