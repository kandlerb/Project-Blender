/**
 * Grid configuration for corpse settling
 */
export const GRID_CONFIG = Object.freeze({
  CELL_WIDTH: 24,      // Width of each cell in pixels
  CELL_HEIGHT: 20,     // Height (slightly shorter for overlap look)
  ROW_OFFSET: 0.5,     // Odd rows offset by this fraction of CELL_WIDTH
});

/**
 * Debug flag for verbose settling search logging
 * Set to true to trace why corpses can't find stable positions
 */
const DEBUG_SETTLING = true;

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
   * Get cells that would have (col, row) as a support cell
   * This is the inverse of getSupportCells - used for cascade notification
   *
   * In a staggered brick pattern:
   * - If row-1 is EVEN: cells (col, row-1) and (col+1, row-1) depend on us
   * - If row-1 is ODD: cells (col-1, row-1) and (col, row-1) depend on us
   *
   * @param {number} col - Column index
   * @param {number} row - Row index
   * @returns {Array<{ col: number, row: number }>}
   */
  getCellsAbove(col, row) {
    const rowAbove = row - 1;
    if (rowAbove < 0) return [];

    if (rowAbove % 2 === 0) {
      // Even row above: cells (col, row-1) and (col+1, row-1) have us as support
      return [
        { col: col, row: rowAbove },
        { col: col + 1, row: rowAbove },
      ];
    } else {
      // Odd row above: cells (col-1, row-1) and (col, row-1) have us as support
      return [
        { col: col - 1, row: rowAbove },
        { col: col, row: rowAbove },
      ];
    }
  }

  /**
   * Notify that a cell changed (occupied or cleared)
   * Marks dependent cells above for stability re-check
   * @param {number} col - Column index of changed cell
   * @param {number} row - Row index of changed cell
   */
  notifyNeighborChange(col, row) {
    const dependentCells = this.getCellsAbove(col, row);

    for (const cell of dependentCells) {
      const key = this.getCellKey(cell.col, cell.row);
      const corpseData = this.occupiedCells.get(key);
      if (corpseData) {
        corpseData.needsStabilityCheck = true;
      }
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
   * Check if a cell WOULD BE stable if a corpse settled there
   *
   * Stable if:
   * 1. Directly above ground (isGroundBelow returns true) - corpse rests on ground tiles
   * 2. BOTH support cells are OCCUPIED by other corpses
   *
   * Note: Empty cells provide NO support, even if they're at ground level.
   * Only the ground itself (checked via isGroundBelow) or occupied corpses provide support.
   *
   * @param {number} col - Column index
   * @param {number} row - Row index
   * @returns {boolean}
   */
  wouldBeStable(col, row) {
    // Don't settle in cells that overlap with ground (prevents clipping)
    if (this.isGroundAt(col, row)) {
      return false;
    }

    // Case 1: Ground directly below = always stable
    // (This cell rests on actual ground tiles)
    if (this.isGroundBelow(col, row)) {
      return true;
    }

    // Case 2: Not on ground - need BOTH support cells to be OCCUPIED
    // Empty cells provide no support, even at ground level
    const supportCells = this.getSupportCells(col, row);

    for (const support of supportCells) {
      if (!this.isOccupied(support.col, support.row)) {
        // This support position is empty = no support
        return false;
      }
    }

    // Both support cells are occupied
    return true;
  }

  /**
   * Check if a cell has support (ground below OR BOTH support cells occupied)
   * A cell has support if ANY of these conditions are true:
   * 1. The row below is ground (tilemap collision)
   * 2. BOTH of the two supporting cells below are occupied OR are ground
   *
   * IMPORTANT: Returns false if the cell itself overlaps with ground (prevents clipping)
   * NOTE: Requires DUAL support to prevent infinite cascade loops
   *
   * @param {number} col - Column index
   * @param {number} row - Row index
   * @returns {boolean}
   */
  hasSupport(col, row) {
    // Don't settle in cells that overlap with ground (prevents clipping)
    if (this.isGroundAt(col, row)) {
      return false;
    }

    // Check for ground collision directly below this cell
    if (this.isGroundBelow(col, row)) {
      return true;
    }

    // Get the two support cells based on row parity
    const supportCells = this.getSupportCells(col, row);

    // Require BOTH support cells to be occupied or on ground for stability
    // This ensures corpses only settle in truly stable positions
    for (const cell of supportCells) {
      const cellHasSupport = this.isOccupied(cell.col, cell.row) || this.isGroundAt(cell.col, cell.row);
      if (!cellHasSupport) {
        return false; // Missing support on one side - not stable
      }
    }

    return true; // Both supports present - stable
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
    // Notify cells above that their support may have changed
    this.notifyNeighborChange(col, row);
  }

  /**
   * DEBUG: Print all occupied cells as ASCII grid
   */
  debugPrintOccupiedCells() {
    if (this.occupiedCells.size === 0) {
      console.log('  [no occupied cells]');
      return;
    }

    // Find bounds
    let minCol = Infinity, maxCol = -Infinity;
    let minRow = Infinity, maxRow = -Infinity;
    for (const key of this.occupiedCells.keys()) {
      const { col, row } = this.parseCellKey(key);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
    }

    // Print grid
    console.log(`  Occupied cells (cols ${minCol}-${maxCol}, rows ${minRow}-${maxRow}):`);
    for (let row = minRow; row <= maxRow; row++) {
      let line = `  row ${row.toString().padStart(2)}: `;
      for (let col = minCol; col <= maxCol; col++) {
        if (this.isOccupied(col, row)) {
          line += '[X]';
        } else {
          line += ' . ';
        }
      }
      line += `  (${row % 2 === 0 ? 'even' : 'odd '})`;
      console.log(line);
    }
  }

  /**
   * DEBUG: Dump comprehensive grid state with support visualization
   * Shows occupied cells, cells with support, and empty cells
   */
  dumpGridState() {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║         CORPSE GRID STATE DUMP         ║');
    console.log('╚════════════════════════════════════════╝');

    if (this.occupiedCells.size === 0) {
      console.log('No occupied cells');
      return { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 };
    }

    // Find bounds of occupied cells
    let minCol = Infinity, maxCol = -Infinity;
    let minRow = Infinity, maxRow = -Infinity;

    for (const key of this.occupiedCells.keys()) {
      const { col, row } = this.parseCellKey(key);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
    }

    // Extend bounds to show potential stacking area above
    const displayMinRow = Math.max(0, minRow - 3);
    const displayMaxRow = maxRow + 1;
    const displayMinCol = minCol - 2;
    const displayMaxCol = maxCol + 2;

    console.log(`Grid bounds: cols ${minCol}-${maxCol}, rows ${minRow}-${maxRow}`);
    console.log(`Display area: cols ${displayMinCol}-${displayMaxCol}, rows ${displayMinRow}-${displayMaxRow}`);
    console.log('');
    console.log('Legend: [X]=occupied  [_]=has support (empty)  . =no support');
    console.log('');

    // Print column headers
    let header = '       ';
    if (displayMinRow % 2 === 1) header += '  '; // Offset for odd first row
    for (let col = displayMinCol; col <= displayMaxCol; col++) {
      header += col.toString().padStart(3);
    }
    console.log(header);

    // Print grid rows
    for (let row = displayMinRow; row <= displayMaxRow; row++) {
      const parity = row % 2 === 0 ? 'E' : 'O';
      let line = `Row ${row.toString().padStart(2)} (${parity}): `;

      // Add offset spacing for odd rows to show stagger visually
      if (row % 2 === 1) {
        line += '  '; // Half cell offset visual (approximation)
      }

      for (let col = displayMinCol; col <= displayMaxCol; col++) {
        if (this.isOccupied(col, row)) {
          line += '[X]';
        } else if (this.hasSupport(col, row)) {
          line += '[_]'; // Empty but has support (could be filled)
        } else {
          line += ' . '; // No support
        }
      }
      console.log(line);
    }

    console.log('');

    // List all occupied cells with their world positions
    console.log('Occupied cells detail:');
    for (const [key, corpseData] of this.occupiedCells) {
      const { col, row } = this.parseCellKey(key);
      const worldPos = this.gridToWorld(col, row);
      const corpseId = corpseData?.id || '?';
      console.log(`  Cell (${col}, ${row}) -> world (${worldPos.x.toFixed(0)}, ${worldPos.y.toFixed(0)}) [Corpse #${corpseId}]`);
    }

    console.log('════════════════════════════════════════\n');

    return { minCol, maxCol, minRow, maxRow };
  }

  /**
   * Diagnose grid state - log all occupied cells and their support status
   * Uses wouldBeStable() for consistency with settling/cascade logic
   * Call with: this.scene.corpseManager.grid.diagnoseGrid()
   */
  diagnoseGrid() {
    console.log('=== CORPSE GRID DIAGNOSIS ===');
    console.log(`Total occupied cells: ${this.occupiedCells.size}`);

    const unstable = [];
    const stable = [];

    for (const [key, corpseData] of this.occupiedCells) {
      const [col, row] = key.split(',').map(Number);
      const supportCells = this.getSupportCells(col, row);

      // Analyze each support cell
      const supportStatus = supportCells.map(cell => ({
        col: cell.col,
        row: cell.row,
        occupied: this.isOccupied(cell.col, cell.row),
        atGroundLevel: this.isGroundBelow(cell.col, cell.row),
      }));

      // A support is valid ONLY if occupied (empty cells provide no support)
      const validSupports = supportStatus.filter(s => s.occupied).length;
      const hasDirectGround = this.isGroundBelow(col, row);
      const isStable = this.wouldBeStable(col, row);

      const worldPos = this.gridToWorld(col, row);
      const cellInfo = {
        col,
        row,
        worldPos,
        supportStatus,
        validSupports,
        hasDirectGround,
        isStable,
        corpseId: corpseData?.id || '?',
      };

      if (cellInfo.isStable) {
        stable.push(cellInfo);
      } else {
        unstable.push(cellInfo);
      }
    }

    console.log(`\nSTABLE cells (${stable.length}):`);
    stable.forEach(c => {
      const reason = c.hasDirectGround
        ? 'direct ground'
        : `${c.validSupports}/2 corpse supports`;
      const supportDetail = c.supportStatus.map(s => {
        if (s.occupied) return `(${s.col},${s.row}):corpse`;
        if (s.atGroundLevel) return `(${s.col},${s.row}):EMPTY(ground-level)`;
        return `(${s.col},${s.row}):EMPTY`;
      }).join(', ');
      console.log(`  (${c.col},${c.row}) [#${c.corpseId}] - ${reason} [${supportDetail}]`);
    });

    console.log(`\nUNSTABLE cells (${unstable.length}):`);
    unstable.forEach(c => {
      const supportDetail = c.supportStatus.map(s => {
        if (s.occupied) return `(${s.col},${s.row}):corpse`;
        if (s.atGroundLevel) return `(${s.col},${s.row}):EMPTY(ground-level)`;
        return `(${s.col},${s.row}):EMPTY`;
      }).join(', ');
      console.log(`  (${c.col},${c.row}) [#${c.corpseId}] - ${c.validSupports}/2 corpse supports [${supportDetail}]`);
    });

    if (unstable.length > 0) {
      console.log('\n⚠️ UNSTABLE CORPSES - will cascade when support changes');
      console.log('Press O to trigger cascade on unstable corpses');
    } else if (stable.length > 0) {
      console.log('\n✓ All corpses are stable (on ground or have valid supports)');
    }

    console.log('=== END DIAGNOSIS ===\n');

    return { stable, unstable };
  }

  /**
   * Find all occupied cells that are unstable (should cascade)
   * Uses wouldBeStable() for consistency - only counts occupied corpses as support
   * @returns {Array<{col, row, corpse, occupiedSupports, supportCells}>}
   */
  findUnstableCells() {
    const unstable = [];

    for (const [key, corpseData] of this.occupiedCells) {
      const [col, row] = key.split(',').map(Number);

      // Use wouldBeStable for consistency
      if (!this.wouldBeStable(col, row)) {
        const supportCells = this.getSupportCells(col, row);
        let occupiedSupports = 0;

        for (const cell of supportCells) {
          if (this.isOccupied(cell.col, cell.row)) {
            occupiedSupports++;
          }
        }

        unstable.push({
          col,
          row,
          corpse: corpseData,
          occupiedSupports,
          supportCells,
        });
      }
    }

    return unstable;
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
    // Notify cells above that their support may have changed (they might cascade)
    this.notifyNeighborChange(col, row);
  }

  /**
   * Find the best STABLE cell for a falling corpse near position (x, y)
   * Searches DOWNWARD from corpse position to find the lowest valid cell nearby.
   * Returns null if no stable position exists - corpse should keep falling.
   *
   * @param {number} worldX - World X position
   * @param {number} worldY - World Y position
   * @returns {{ col: number, row: number, worldX: number, worldY: number } | null}
   */
  findSettlingCell(worldX, worldY) {
    const { col: startCol, row: startRow } = this.worldToGrid(worldX, worldY);
    const groundRow = this.getGroundRow(startCol);

    if (DEBUG_SETTLING) {
      console.group(`findSettlingCell: world(${Math.round(worldX)},${Math.round(worldY)}) → grid(${startCol},${startRow}), groundRow=${groundRow}`);
    }

    // PHASE 1: Search DOWNWARD from corpse position to ground
    // This finds the lowest valid position near the corpse
    for (let row = startRow; row <= groundRow; row++) {
      // Use wider search for ground level (more valid positions, corpse will reach it)
      // Use narrow search for upper rows (corpses fall down, not sideways)
      const maxOffset = (row === groundRow) ? 15 : 4;
      const cell = this.findValidCellAtRow(startCol, row, DEBUG_SETTLING, maxOffset);
      if (cell) {
        if (DEBUG_SETTLING) {
          console.log(`✓ FOUND: (${cell.col},${cell.row})`);
          console.groupEnd();
        }
        return cell;
      }
    }

    // PHASE 2: If nothing found below, search upward (rare edge case - pile above corpse)
    for (let row = startRow - 1; row >= Math.max(0, startRow - 20); row--) {
      const cell = this.findValidCellAtRow(startCol, row, DEBUG_SETTLING, 4);
      if (cell) {
        if (DEBUG_SETTLING) {
          console.log(`✓ FOUND (upward): (${cell.col},${cell.row})`);
          console.groupEnd();
        }
        return cell;
      }
    }

    if (DEBUG_SETTLING) {
      console.log(`✗ NO VALID CELL FOUND`);
      this.logGridState(startCol, groundRow);
      console.groupEnd();
    }

    // No valid position found
    return null;
  }

  /**
   * Find a valid (unoccupied + stable) cell at a specific row, searching outward from startCol
   * @param {number} startCol - Column to start searching from
   * @param {number} row - Row to search
   * @param {boolean} debug - Whether to log detailed info (default false)
   * @param {number} maxOffset - Maximum horizontal offset to search (default 4 for reachable distance)
   * @returns {{ col: number, row: number, worldX: number, worldY: number } | null}
   */
  findValidCellAtRow(startCol, row, debug = false, maxOffset = 4) {
    const checked = [];

    // Search outward from startCol: 0, then -1/+1, then -2/+2, etc.
    for (let offset = 0; offset <= maxOffset; offset++) {
      const colsToCheck = offset === 0
        ? [startCol]
        : [startCol - offset, startCol + offset];

      for (const col of colsToCheck) {
        if (col < 0) continue; // Skip invalid columns

        const occupied = this.isOccupied(col, row);
        const groundAt = this.isGroundAt(col, row);
        const stable = !occupied && !groundAt && this.wouldBeStable(col, row);

        if (debug) {
          let reason = '';
          if (occupied) {
            reason = 'occupied';
          } else if (groundAt) {
            reason = 'ground-clip';
          } else if (!stable) {
            reason = this.getInstabilityReason(col, row);
          } else {
            reason = 'VALID';
          }
          checked.push(`(${col},${row}):${reason}`);
        }

        if (!occupied && !groundAt && stable) {
          if (debug && checked.length > 0) {
            console.log(`  Row ${row}: ${checked.join(', ')}`);
          }
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

    if (debug && checked.length > 0) {
      console.log(`  Row ${row}: ${checked.join(', ')}`);
    }

    return null; // No valid cell at this row
  }

  /**
   * Get the ground row for a column (with caching)
   * @param {number} col - Column to check
   * @returns {number} Row index at ground level
   */
  getGroundRow(col) {
    // Use cached value if available
    if (this._groundRowCache !== undefined) {
      return this._groundRowCache;
    }

    // Search downward to find ground
    const groundRow = this.findGroundRow(col, 0);
    this._groundRowCache = groundRow;
    return groundRow;
  }

  /**
   * Get human-readable reason why a cell is unstable (for debug logging)
   * @param {number} col - Column index
   * @param {number} row - Row index
   * @returns {string} Reason string
   */
  getInstabilityReason(col, row) {
    if (this.isGroundBelow(col, row)) {
      return 'stable(ground)'; // Shouldn't happen if we got here
    }

    const supports = this.getSupportCells(col, row);
    const supportStatus = supports.map(s => {
      const occ = this.isOccupied(s.col, s.row);
      return `${s.col},${s.row}:${occ ? '✓' : '✗'}`;
    });

    return `needs[${supportStatus.join(' ')}]`;
  }

  /**
   * Log the current grid state around a position (for debugging failures)
   * @param {number} centerCol - Center column for the display
   * @param {number} groundRow - Ground row level
   */
  logGridState(centerCol, groundRow) {
    console.log('--- Grid state around search area ---');

    // Show rows from groundRow-5 to groundRow
    for (let row = groundRow - 5; row <= groundRow; row++) {
      const cells = [];
      for (let col = centerCol - 5; col <= centerCol + 5; col++) {
        if (this.isOccupied(col, row)) {
          cells.push('[C]');
        } else if (this.isGroundAt(col, row)) {
          cells.push('[#]'); // Ground geometry (can't settle here)
        } else if (this.isGroundBelow(col, row)) {
          cells.push('[G]'); // Ground level, empty (can settle)
        } else {
          cells.push('[ ]'); // Empty, not ground
        }
      }
      const rowLabel = row === groundRow ? ' ← ground' : '';
      console.log(`Row ${row.toString().padStart(2)}: ${cells.join('')}${rowLabel}`);
    }

    // Count stats
    const stats = this.countGroundCells(centerCol, groundRow);
    console.log(`Total occupied: ${this.occupiedCells.size}, Ground cells in range: ${stats.total}, empty: ${stats.empty}`);
  }

  /**
   * Count ground cells in search range (for debug stats)
   * @param {number} centerCol - Center column
   * @param {number} groundRow - Ground row level
   * @returns {{ total: number, empty: number }}
   */
  countGroundCells(centerCol, groundRow) {
    let total = 0;
    let empty = 0;
    for (let col = centerCol - 10; col <= centerCol + 10; col++) {
      if (this.isGroundBelow(col, groundRow) && !this.isGroundAt(col, groundRow)) {
        total++;
        if (!this.isOccupied(col, groundRow)) {
          empty++;
        }
      }
    }
    return { total, empty };
  }

  /**
   * Search upward from a position to find a STABLE cell at the top of a pile
   * Used when a corpse spawns inside an existing pile
   * Only returns cells that are truly stable (on ground OR dual support)
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
      if (!this.isOccupied(col, checkRow) &&
          !this.isGroundAt(col, checkRow) &&
          this.wouldBeStable(col, checkRow)) {
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
        if (!this.isOccupied(checkCol, checkRow) &&
            !this.isGroundAt(checkCol, checkRow) &&
            this.wouldBeStable(checkCol, checkRow)) {
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
   * Find the nearest STABLE cell in any direction
   * Last resort search that expands outward in a spiral pattern
   * Only returns cells that are truly stable (on ground OR dual support)
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

          // Skip if occupied or overlaps ground
          if (this.isOccupied(checkCol, checkRow)) continue;
          if (this.isGroundAt(checkCol, checkRow)) continue;

          // Check if would be stable
          if (this.wouldBeStable(checkCol, checkRow)) {
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

  /**
   * Count how many of the support cells are occupied or on ground
   * Used for pyramid shape preference (dual support = 2, single = 1, none = 0)
   * @param {number} col - Column index
   * @param {number} row - Row index
   * @returns {number} 0, 1, or 2
   */
  countSupportCells(col, row) {
    // Ground directly below counts as 2 (full support)
    if (this.isGroundBelow(col, row)) {
      return 2;
    }

    const supportCells = this.getSupportCells(col, row);
    let count = 0;

    for (const cell of supportCells) {
      if (this.isOccupied(cell.col, cell.row) || this.isGroundAt(cell.col, cell.row)) {
        count++;
      }
    }

    return count;
  }

  /**
   * Find the ground row for a given column area
   * Searches downward to find where ground begins
   * @param {number} col - Column to check
   * @param {number} startRow - Row to start searching from (default 0)
   * @param {number} maxRows - Maximum rows to search (default 100)
   * @returns {number} Row index just above ground level
   */
  findGroundRow(col, startRow = 0, maxRows = 100) {
    // Search downward from startRow to find ground
    for (let row = startRow; row < startRow + maxRows; row++) {
      if (this.isGroundBelow(col, row)) {
        return row; // This row is just above ground
      }
    }

    // Fallback: assume ground is at row 50 (roughly center of screen)
    return 50;
  }

  /**
   * Find the lowest valid cell for settling, searching from ground level upward
   * This ensures corpses always settle at the lowest possible position,
   * creating natural pyramids that are wide at the bottom and narrow at the top.
   *
   * @param {number} targetCol - Target column (near spawn X)
   * @param {number} groundRow - Row at ground level
   * @param {number} maxHeight - Maximum rows to search upward (default 50)
   * @param {number} maxColOffset - Maximum columns to search sideways (default 15)
   * @returns {{ col: number, row: number, worldX: number, worldY: number } | null}
   */
  findLowestValidCell(targetCol, groundRow, maxHeight = 50, maxColOffset = 15) {
    // Search from ground level UPWARD (decreasing row numbers = higher up)
    for (let row = groundRow; row >= groundRow - maxHeight; row--) {
      const candidates = [];

      // Collect all valid cells at this row within horizontal range
      for (let colOffset = 0; colOffset <= maxColOffset; colOffset++) {
        const cols = colOffset === 0 ? [targetCol] : [targetCol - colOffset, targetCol + colOffset];

        for (const col of cols) {
          // Skip if already occupied
          if (this.isOccupied(col, row)) continue;

          // Check if this cell has support
          if (this.hasSupport(col, row)) {
            const supportCount = this.countSupportCells(col, row);
            candidates.push({
              col,
              row,
              supportCount,
              distance: Math.abs(col - targetCol),
            });
          }
        }
      }

      // If we found valid cells at this row, pick the best one
      if (candidates.length > 0) {
        // Sort: prefer dual support first, then by distance to target
        candidates.sort((a, b) => {
          // First priority: more support cells = more stable (pyramid shape)
          if (b.supportCount !== a.supportCount) {
            return b.supportCount - a.supportCount;
          }
          // Second priority: closer to target column
          return a.distance - b.distance;
        });

        const best = candidates[0];
        const worldPos = this.gridToWorld(best.col, best.row);
        return {
          col: best.col,
          row: best.row,
          worldX: worldPos.x,
          worldY: worldPos.y,
        };
      }

      // No valid cells at this row - continue searching upward
    }

    return null;
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
