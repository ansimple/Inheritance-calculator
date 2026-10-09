import React, { useRef, useEffect } from 'react';
import { PersonNode } from '../../domain/models/Person';
import { CanvasViewport, CANVAS_CONSTANTS } from '../../canvas/core/CanvasViewport';

interface MinimapViewProps {
  persons: Map<string, PersonNode>;
  viewport: CanvasViewport;
  canvasWidth: number;
  canvasHeight: number;
  onPanChange: (panX: number, panY: number) => void;
}

export const MinimapView: React.FC<MinimapViewProps> = ({
  persons,
  viewport,
  canvasWidth,
  canvasHeight,
  onPanChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const miniW = 180;
  const miniH = 100;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, miniW, miniH);

    // Calculate world bounding box
    let minX = 0;
    let minY = 0;
    let maxX = 800;
    let maxY = 600;

    if (persons.size > 0) {
      minX = Infinity;
      minY = Infinity;
      maxX = -Infinity;
      maxY = -Infinity;
      for (const p of persons.values()) {
        minX = Math.min(minX, p.canvasX);
        minY = Math.min(minY, p.canvasY);
        maxX = Math.max(maxX, p.canvasX + CANVAS_CONSTANTS.NODE_WIDTH);
        maxY = Math.max(maxY, p.canvasY + CANVAS_CONSTANTS.NODE_HEIGHT);
      }
    }

    // Add margin
    const margin = 80;
    minX -= margin;
    minY -= margin;
    maxX += margin;
    maxY += margin;

    const worldW = maxX - minX;
    const worldH = maxY - minY;

    const scale = Math.min(miniW / worldW, miniH / worldH);

    // Render nodes
    for (const p of persons.values()) {
      const mx = (p.canvasX - minX) * scale;
      const my = (p.canvasY - minY) * scale;
      const mw = CANVAS_CONSTANTS.NODE_WIDTH * scale;
      const mh = CANVAS_CONSTANTS.NODE_HEIGHT * scale;

      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(mx, my, Math.max(mw, 4), Math.max(mh, 3));
    }

    // Render Viewport Radar Box
    const viewWorldMin = viewport.screenToWorld(0, 0);
    const viewWorldMax = viewport.screenToWorld(canvasWidth, canvasHeight);

    const rX = (viewWorldMin.x - minX) * scale;
    const rY = (viewWorldMin.y - minY) * scale;
    const rW = (viewWorldMax.x - viewWorldMin.x) * scale;
    const rH = (viewWorldMax.y - viewWorldMin.y) * scale;

    ctx.strokeStyle = '#06b6d4'; // Cyan
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rX, rY, rW, rH);
    ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
    ctx.fillRect(rX, rY, rW, rH);
  }, [persons, viewport, canvasWidth, canvasHeight]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    let minX = 0;
    let minY = 0;
    let maxX = 800;
    let maxY = 600;

    if (persons.size > 0) {
      minX = Infinity;
      minY = Infinity;
      maxX = -Infinity;
      maxY = -Infinity;
      for (const p of persons.values()) {
        minX = Math.min(minX, p.canvasX);
        minY = Math.min(minY, p.canvasY);
        maxX = Math.max(maxX, p.canvasX + CANVAS_CONSTANTS.NODE_WIDTH);
        maxY = Math.max(maxY, p.canvasY + CANVAS_CONSTANTS.NODE_HEIGHT);
      }
    }

    const margin = 80;
    minX -= margin;
    minY -= margin;
    maxX += margin;
    maxY += margin;

    const worldW = maxX - minX;
    const worldH = maxY - minY;
    const scale = Math.min(miniW / worldW, miniH / worldH);

    const targetWorldX = minX + clickX / scale;
    const targetWorldY = minY + clickY / scale;

    const newPanX = canvasWidth / (2 * viewport.zoom) - targetWorldX;
    const newPanY = canvasHeight / (2 * viewport.zoom) - targetWorldY;

    onPanChange(newPanX, newPanY);
  };

  return (
    <div className="absolute bottom-4 left-4 z-10 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-2 shadow-2xl">
      <div className="text-[10px] text-slate-400 font-medium mb-1 px-1">미니맵</div>
      <canvas
        ref={canvasRef}
        width={miniW}
        height={miniH}
        onClick={handleCanvasClick}
        className="rounded bg-slate-950 border border-slate-800 cursor-crosshair"
      />
    </div>
  );
};
