import React, { useRef, useEffect, useState, useCallback } from 'react';
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
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);

  const miniW = 180;
  const miniH = 100;

  // Compute bounding box strictly based on all persons nodes (Outer Virtual Rect)
  const getLayout = useCallback(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    if (persons.size > 0) {
      for (const p of persons.values()) {
        minX = Math.min(minX, p.canvasX);
        minY = Math.min(minY, p.canvasY);
        maxX = Math.max(maxX, p.canvasX + CANVAS_CONSTANTS.NODE_WIDTH);
        maxY = Math.max(maxY, p.canvasY + CANVAS_CONSTANTS.NODE_HEIGHT);
      }
    } else {
      minX = 0;
      minY = 0;
      maxX = 800;
      maxY = 600;
    }

    const boundsW = Math.max(CANVAS_CONSTANTS.NODE_WIDTH, maxX - minX);
    const boundsH = Math.max(CANVAS_CONSTANTS.NODE_HEIGHT, maxY - minY);

    // Margin padding inside minimap canvas (in minimap pixels)
    const padding = 12;
    const availW = Math.max(10, miniW - padding * 2);
    const availH = Math.max(10, miniH - padding * 2);

    // Uniform scale to fit the entire bounding box inside minimap
    const scale = Math.min(availW / boundsW, availH / boundsH);

    // Center the entire bounding box inside the minimap
    const offsetX = (miniW - boundsW * scale) / 2;
    const offsetY = (miniH - boundsH * scale) / 2;

    return { minX, minY, boundsW, boundsH, scale, offsetX, offsetY };
  }, [persons]);

  // Render Minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, miniW, miniH);

    const { minX, minY, scale, offsetX, offsetY } = getLayout();

    // Render all person nodes centered in minimap (Soft toned-down white)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    for (const p of persons.values()) {
      const mx = offsetX + (p.canvasX - minX) * scale;
      const my = offsetY + (p.canvasY - minY) * scale;
      const mw = Math.max(CANVAS_CONSTANTS.NODE_WIDTH * scale, 5);
      const mh = Math.max(CANVAS_CONSTANTS.NODE_HEIGHT * scale, 3);

      ctx.fillRect(mx, my, mw, mh);
    }
  }, [getLayout, miniW, miniH, persons]);

  // Handle pan from minimap mouse coordinate
  const panToMinimapCoord = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;

      const { minX, minY, scale, offsetX, offsetY } = getLayout();

      const targetWorldX = minX + (clickX - offsetX) / scale;
      const targetWorldY = minY + (clickY - offsetY) / scale;

      const newPanX = canvasWidth / (2 * viewport.zoom) - targetWorldX;
      const newPanY = canvasHeight / (2 * viewport.zoom) - targetWorldY;

      onPanChange(newPanX, newPanY);
    },
    [canvasHeight, canvasWidth, getLayout, onPanChange, viewport.zoom]
  );

  // Mouse Drag handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    panToMinimapCoord(e.clientX, e.clientY);

    const handleMouseMove = (moveEv: MouseEvent) => {
      if (!isDraggingRef.current) return;
      panToMinimapCoord(moveEv.clientX, moveEv.clientY);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Touch Drag handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      setIsDragging(true);
      panToMinimapCoord(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current && e.touches.length === 1) {
      panToMinimapCoord(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  return (
    <div className="hidden sm:block absolute bottom-4 left-4 z-10 bg-brown-900/90 backdrop-blur border border-brown-800 rounded-xl p-2 shadow-2xl select-none">
      <div className="text-[10px] text-stone-400 font-medium mb-1 px-1">미니맵</div>
      <canvas
        ref={canvasRef}
        width={miniW}
        height={miniH}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`rounded bg-brown-950 border border-brown-800/80 ${
          isDragging ? 'cursor-grabbing' : 'cursor-crosshair'
        }`}
      />
    </div>
  );
};
