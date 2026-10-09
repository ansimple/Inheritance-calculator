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

  // Find node at world coordinate
  const findNodeAt = (worldX: number, worldY: number): string | null => {
    const nodeW = CANVAS_CONSTANTS.NODE_WIDTH;
    const nodeH = CANVAS_CONSTANTS.NODE_HEIGHT;

    for (const p of allPersons.values()) {
      if (
        worldX >= p.canvasX &&
        worldX <= p.canvasX + nodeW &&
        worldY >= p.canvasY &&
        worldY <= p.canvasY + nodeH
      ) {
        return p.id;
      }
    }
    return null;
  };

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

      // 5px Grid Magnet Snap
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

      setActiveGuidelinesLocal({ horizontalY: guideH, verticalX: guideV });
      setGuidelines({ horizontalY: guideH, verticalX: guideV });

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
        className={`w-full h-full block ${
          dragState.type === 'PAN' ? 'cursor-grab' : dragState.type === 'NODE' ? 'cursor-grabbing' : 'cursor-default'
        }`}
      />
    </div>
  );
};
