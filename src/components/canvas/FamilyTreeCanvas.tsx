import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useInheritanceStore } from '../../state/useInheritanceStore';
import { CanvasViewport, CANVAS_CONSTANTS } from '../../canvas/core/CanvasViewport';
import { CanvasTreeRenderer } from '../../canvas/renderers/CanvasTreeRenderer';
import { CanvasToolbar } from './CanvasToolbar';
import { MinimapView } from './MinimapView';
import { InspectorSidebar } from './InspectorSidebar';

export const FamilyTreeCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const {
    deceasedId,
    allPersons,
    relationships,
    calculationResult,
    calculationMode,
    selectedPersonId,
    selectPerson,
    updatePersonPosition,
    setGuidelines,
  } = useInheritanceStore();

  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const viewportRef = useRef(new CanvasViewport(100, 100, 1.0));
  const [, setViewportTick] = useState(0);

  // Interaction State
  const [dragState, setDragState] = useState<{
    type: 'NONE' | 'PAN' | 'NODE';
    nodeId?: string;
    startScreenX: number;
    startScreenY: number;
    startNodeWorldX?: number;
    startNodeWorldY?: number;
    hasMoved?: boolean;
  }>({ type: 'NONE', startScreenX: 0, startScreenY: 0 });

  const [hoveredPersonId, setHoveredPersonId] = useState<string | null>(null);
  const [activeGuidelines, setActiveGuidelinesLocal] = useState<{
    horizontalY?: number;
    verticalX?: number;
  }>({});

  // Resize Observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Heir Results Map
  const heirResultsMap = calculationResult
    ? new Map(calculationResult.heirResults.map((h) => [h.personId, h]))
    : undefined;

  // Redraw Canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    CanvasTreeRenderer.render(ctx, dimensions.width, dimensions.height, viewportRef.current, {
      deceasedId,
      persons: allPersons,
      relationships,
      heirResults: heirResultsMap,
      selectedPersonId,
      hoveredPersonId,
      calculationMode,
      activeGuidelines,
    });
  }, [
    dimensions,
    deceasedId,
    allPersons,
    relationships,
    heirResultsMap,
    selectedPersonId,
    hoveredPersonId,
    calculationMode,
    activeGuidelines,
  ]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Fit to screen helper
  const handleFitScreen = useCallback(() => {
    if (allPersons.size === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of allPersons.values()) {
      minX = Math.min(minX, p.canvasX);
      minY = Math.min(minY, p.canvasY);
      maxX = Math.max(maxX, p.canvasX);
      maxY = Math.max(maxY, p.canvasY);
    }

    viewportRef.current.fitToBounds(
      { minX, minY, maxX, maxY },
      dimensions.width,
      dimensions.height
    );
    setViewportTick((t) => t + 1);
    redraw();
  }, [allPersons, dimensions, redraw]);

  // Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const nextZoom = viewportRef.current.zoom * zoomFactor;

    viewportRef.current.setZoom(nextZoom, screenX, screenY);
    setViewportTick((t) => t + 1);
    redraw();
  };

  // Find node at world coordinate (with touch tolerance padding)
  const findNodeAt = (worldX: number, worldY: number): string | null => {
    const nodeW = CANVAS_CONSTANTS.NODE_WIDTH;
    const nodeH = CANVAS_CONSTANTS.NODE_HEIGHT;
    const hitPadding = 15; // Touch-friendly margin

    for (const p of allPersons.values()) {
      if (
        worldX >= p.canvasX - hitPadding &&
        worldX <= p.canvasX + nodeW + hitPadding &&
        worldY >= p.canvasY - hitPadding &&
        worldY <= p.canvasY + nodeH + hitPadding
      ) {
        return p.id;
      }
    }
    return null;
  };

  // Touch Interaction State
  const touchInfoRef = useRef<{
    mode: 'NONE' | 'ONE' | 'PINCH';
    initialDistance?: number;
    initialZoom?: number;
    pinchCenter?: { x: number; y: number };
  }>({ mode: 'NONE' });

  // Mouse Down
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPoint = viewportRef.current.screenToWorld(screenX, screenY);

    const hitNodeId = findNodeAt(worldPoint.x, worldPoint.y);

    if (hitNodeId) {
      const p = allPersons.get(hitNodeId)!;
      setDragState({
        type: 'NODE',
        nodeId: hitNodeId,
        startScreenX: screenX,
        startScreenY: screenY,
        startNodeWorldX: p.canvasX,
        startNodeWorldY: p.canvasY,
        hasMoved: false,
      });
    } else {
      setDragState({
        type: 'PAN',
        startScreenX: screenX,
        startScreenY: screenY,
        hasMoved: false,
      });
    }
  };

  // Mouse Move
  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPoint = viewportRef.current.screenToWorld(screenX, screenY);

    if (dragState.type === 'NONE') {
      const hitNodeId = findNodeAt(worldPoint.x, worldPoint.y);
      if (hitNodeId !== hoveredPersonId) {
        setHoveredPersonId(hitNodeId);
        redraw();
      }
      return;
    }

    const deltaScreenX = screenX - dragState.startScreenX;
    const deltaScreenY = screenY - dragState.startScreenY;
    const moveDist = Math.hypot(deltaScreenX, deltaScreenY);

    if (dragState.type === 'PAN') {
      viewportRef.current.panBy(deltaScreenX, deltaScreenY);
      setDragState({
        ...dragState,
        startScreenX: screenX,
        startScreenY: screenY,
        hasMoved: dragState.hasMoved || moveDist > 3,
      });
      setViewportTick((t) => t + 1);
      redraw();
    } else if (dragState.type === 'NODE' && dragState.nodeId) {
      const deltaWorldX = deltaScreenX / viewportRef.current.zoom;
      const deltaWorldY = deltaScreenY / viewportRef.current.zoom;

      let newWorldX = (dragState.startNodeWorldX ?? 0) + deltaWorldX;
      let newWorldY = (dragState.startNodeWorldY ?? 0) + deltaWorldY;

      // 15px Grid Magnet Snap (strictly aligned with background dots)
      newWorldX = CanvasViewport.snapToGrid(newWorldX, CANVAS_CONSTANTS.MAGNET_GRID_STEP);
      newWorldY = CanvasViewport.snapToGrid(newWorldY, CANVAS_CONSTANTS.MAGNET_GRID_STEP);

      // Smart guideline snapping with other nodes
      const nodeW = CANVAS_CONSTANTS.NODE_WIDTH;
      const nodeH = CANVAS_CONSTANTS.NODE_HEIGHT;
      const curCenterX = newWorldX + nodeW / 2;
      const curCenterY = newWorldY + nodeH / 2;

      let guideH: number | undefined;
      let guideV: number | undefined;

      for (const [id, other] of allPersons) {
        if (id === dragState.nodeId) continue;
        const otherCenterX = other.canvasX + nodeW / 2;
        const otherCenterY = other.canvasY + nodeH / 2;

        if (Math.abs(curCenterY - otherCenterY) <= CANVAS_CONSTANTS.GUIDELINE_THRESHOLD) {
          newWorldY = otherCenterY - nodeH / 2;
          guideH = otherCenterY;
        }

        if (Math.abs(curCenterX - otherCenterX) <= CANVAS_CONSTANTS.GUIDELINE_THRESHOLD) {
          newWorldX = otherCenterX - nodeW / 2;
          guideV = otherCenterX;
        }
      }

      // Re-snap to guarantee 15px grid dot alignment at all times
      newWorldX = CanvasViewport.snapToGrid(newWorldX, CANVAS_CONSTANTS.MAGNET_GRID_STEP);
      newWorldY = CanvasViewport.snapToGrid(newWorldY, CANVAS_CONSTANTS.MAGNET_GRID_STEP);
      if (guideH !== undefined) guideH = CanvasViewport.snapToGrid(guideH, CANVAS_CONSTANTS.MAGNET_GRID_STEP);
      if (guideV !== undefined) guideV = CanvasViewport.snapToGrid(guideV, CANVAS_CONSTANTS.MAGNET_GRID_STEP);

      updatePersonPosition(dragState.nodeId, newWorldX, newWorldY);
      setDragState({
        ...dragState,
        hasMoved: dragState.hasMoved || moveDist > 3,
      });
      redraw();
    }
  };

  // Mouse Up
  const handleMouseUp = () => {
    if (dragState.type === 'NODE' && !dragState.hasMoved && dragState.nodeId) {
      // Clicked node -> Select
      selectPerson(dragState.nodeId);
    } else if (dragState.type === 'PAN' && !dragState.hasMoved) {
      // Clicked background -> Deselect
      selectPerson(null);
    }

    setDragState({ type: 'NONE', startScreenX: 0, startScreenY: 0 });
    setActiveGuidelinesLocal({});
    setGuidelines({});
    redraw();
  };

  // Touch Event Handlers (Mobile Navigation, Node Dragging & Pinch-to-Zoom)
  const handleTouchStart = (e: React.TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const screenX = touch.clientX - rect.left;
      const screenY = touch.clientY - rect.top;
      const worldPoint = viewportRef.current.screenToWorld(screenX, screenY);

      const hitNodeId = findNodeAt(worldPoint.x, worldPoint.y);

      if (hitNodeId) {
        const p = allPersons.get(hitNodeId)!;
        setDragState({
          type: 'NODE',
          nodeId: hitNodeId,
          startScreenX: screenX,
          startScreenY: screenY,
          startNodeWorldX: p.canvasX,
          startNodeWorldY: p.canvasY,
          hasMoved: false,
        });
      } else {
        setDragState({
          type: 'PAN',
          startScreenX: screenX,
          startScreenY: screenY,
          hasMoved: false,
        });
      }
      touchInfoRef.current = { mode: 'ONE' };
    } else if (e.touches.length === 2) {
      // Pinch to Zoom init
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const centerX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const centerY = (t1.clientY + t2.clientY) / 2 - rect.top;

      touchInfoRef.current = {
        mode: 'PINCH',
        initialDistance: dist,
        initialZoom: viewportRef.current.zoom,
        pinchCenter: { x: centerX, y: centerY },
      };
      setDragState({ type: 'NONE', startScreenX: 0, startScreenY: 0 });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (e.touches.length === 1 && touchInfoRef.current.mode === 'ONE') {
      const touch = e.touches[0];
      const screenX = touch.clientX - rect.left;
      const screenY = touch.clientY - rect.top;

      const deltaScreenX = screenX - dragState.startScreenX;
      const deltaScreenY = screenY - dragState.startScreenY;
      const moveDist = Math.hypot(deltaScreenX, deltaScreenY);

      if (dragState.type === 'PAN') {
        viewportRef.current.panBy(deltaScreenX, deltaScreenY);
        setDragState({
          ...dragState,
          startScreenX: screenX,
          startScreenY: screenY,
          hasMoved: dragState.hasMoved || moveDist > 5,
        });
        setViewportTick((t) => t + 1);
        redraw();
      } else if (dragState.type === 'NODE' && dragState.nodeId) {
        const deltaWorldX = deltaScreenX / viewportRef.current.zoom;
        const deltaWorldY = deltaScreenY / viewportRef.current.zoom;

        let newWorldX = (dragState.startNodeWorldX ?? 0) + deltaWorldX;
        let newWorldY = (dragState.startNodeWorldY ?? 0) + deltaWorldY;

        newWorldX = CanvasViewport.snapToGrid(newWorldX, CANVAS_CONSTANTS.MAGNET_GRID_STEP);
        newWorldY = CanvasViewport.snapToGrid(newWorldY, CANVAS_CONSTANTS.MAGNET_GRID_STEP);

        updatePersonPosition(dragState.nodeId, newWorldX, newWorldY);
        setDragState({
          ...dragState,
          hasMoved: dragState.hasMoved || moveDist > 5,
        });
        redraw();
      }
    } else if (e.touches.length === 2 && touchInfoRef.current.mode === 'PINCH') {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

      const initDist = touchInfoRef.current.initialDistance || dist;
      const initZoom = touchInfoRef.current.initialZoom || viewportRef.current.zoom;
      const center = touchInfoRef.current.pinchCenter || { x: rect.width / 2, y: rect.height / 2 };

      if (initDist > 0) {
        const factor = dist / initDist;
        viewportRef.current.setZoom(initZoom * factor, center.x, center.y);
        setViewportTick((t) => t + 1);
        redraw();
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchInfoRef.current.mode === 'ONE') {
      if (dragState.type === 'NODE' && !dragState.hasMoved && dragState.nodeId) {
        selectPerson(dragState.nodeId);
      } else if (dragState.type === 'PAN' && !dragState.hasMoved) {
        selectPerson(null);
      }
    }

    touchInfoRef.current = { mode: 'NONE' };
    setDragState({ type: 'NONE', startScreenX: 0, startScreenY: 0 });
    setActiveGuidelinesLocal({});
    setGuidelines({});
    redraw();
  };

  return (
    <div ref={containerRef} className="relative w-full h-full select-none overflow-hidden bg-slate-950">
      <CanvasToolbar
        zoom={viewportRef.current.zoom}
        onZoomIn={() => {
          viewportRef.current.setZoom(viewportRef.current.zoom * 1.2);
          setViewportTick((t) => t + 1);
          redraw();
        }}
        onZoomOut={() => {
          viewportRef.current.setZoom(viewportRef.current.zoom * 0.8);
          setViewportTick((t) => t + 1);
          redraw();
        }}
        onResetZoom={() => {
          viewportRef.current.setZoom(1.0);
          setViewportTick((t) => t + 1);
          redraw();
        }}
        onFitScreen={handleFitScreen}
      />

      <InspectorSidebar />

      <MinimapView
        persons={allPersons}
        viewport={viewportRef.current}
        canvasWidth={dimensions.width}
        canvasHeight={dimensions.height}
        onPanChange={(px, py) => {
          viewportRef.current.panX = px;
          viewportRef.current.panY = py;
          setViewportTick((t) => t + 1);
          redraw();
        }}
      />

      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{ touchAction: 'none' }}
        className={`w-full h-full block touch-none ${
          dragState.type === 'PAN' ? 'cursor-grab' : dragState.type === 'NODE' ? 'cursor-grabbing' : 'cursor-default'
        }`}
      />
    </div>
  );
};
