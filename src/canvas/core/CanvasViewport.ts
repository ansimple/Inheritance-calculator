/**
 * Canvas Viewport Coordinate Transform & Grid Snapping
 */

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface WorldPoint {
  x: number;
  y: number;
}

export interface RectBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const CANVAS_CONSTANTS = {
  NODE_WIDTH: 210, // 15 * 14 (exact multiple of 15px grid dot step)
  NODE_HEIGHT: 90, // 15 * 6 (exact multiple of 15px grid dot step)
  CORNER_RADIUS: 8,
  GEN_LEVEL_HEIGHT: 180, // 15 * 12
  SIBLING_SPACING: 45, // 15 * 3
  SPOUSE_SPACING: 45, // 15 * 3
  MAGNET_GRID_STEP: 15, // Grid dot unit: exactly 15px
  GUIDELINE_THRESHOLD: 10,
  ZOOM_MIN: 0.2,
  ZOOM_MAX: 3.0,
};

export class CanvasViewport {
  panX: number = 0;
  panY: number = 0;
  zoom: number = 1.0;

  constructor(panX: number = 0, panY: number = 0, zoom: number = 1.0) {
    this.panX = panX;
    this.panY = panY;
    this.zoom = Math.max(CANVAS_CONSTANTS.ZOOM_MIN, Math.min(CANVAS_CONSTANTS.ZOOM_MAX, zoom));
  }

  worldToScreen(worldX: number, worldY: number): ScreenPoint {
    return {
      x: (worldX + this.panX) * this.zoom,
      y: (worldY + this.panY) * this.zoom,
    };
  }

  screenToWorld(screenX: number, screenY: number): WorldPoint {
    return {
      x: screenX / this.zoom - this.panX,
      y: screenY / this.zoom - this.panY,
    };
  }

  setZoom(nextZoom: number, focalScreenX?: number, focalScreenY?: number) {
    const clampedZoom = Math.max(CANVAS_CONSTANTS.ZOOM_MIN, Math.min(CANVAS_CONSTANTS.ZOOM_MAX, nextZoom));
    if (focalScreenX !== undefined && focalScreenY !== undefined) {
      // Zoom into focal point
      const worldBefore = this.screenToWorld(focalScreenX, focalScreenY);
      this.zoom = clampedZoom;
      const worldAfter = this.screenToWorld(focalScreenX, focalScreenY);
      this.panX += worldAfter.x - worldBefore.x;
      this.panY += worldAfter.y - worldBefore.y;
    } else {
      this.zoom = clampedZoom;
    }
  }

  panBy(screenDeltaX: number, screenDeltaY: number) {
    this.panX += screenDeltaX / this.zoom;
    this.panY += screenDeltaY / this.zoom;
  }

  static snapToGrid(coord: number, step: number = CANVAS_CONSTANTS.MAGNET_GRID_STEP): number {
    return Math.round(coord / step) * step;
  }

  fitToBounds(bounds: RectBounds, canvasWidth: number, canvasHeight: number, padding: number = 60) {
    const boundW = bounds.maxX - bounds.minX + CANVAS_CONSTANTS.NODE_WIDTH;
    const boundH = bounds.maxY - bounds.minY + CANVAS_CONSTANTS.NODE_HEIGHT;

    if (boundW <= 0 || boundH <= 0 || canvasWidth <= 0 || canvasHeight <= 0) {
      this.panX = canvasWidth / 2 - CANVAS_CONSTANTS.NODE_WIDTH / 2;
      this.panY = 100;
      this.zoom = 1.0;
      return;
    }

    const scaleX = (canvasWidth - padding * 2) / boundW;
    const scaleY = (canvasHeight - padding * 2) / boundH;
    const fitZoom = Math.max(CANVAS_CONSTANTS.ZOOM_MIN, Math.min(1.2, Math.min(scaleX, scaleY)));

    this.zoom = fitZoom;
    const centerX = bounds.minX + boundW / 2;
    const centerY = bounds.minY + boundH / 2;

    this.panX = canvasWidth / (2 * this.zoom) - centerX;
    this.panY = canvasHeight / (2 * this.zoom) - centerY;
  }
}
