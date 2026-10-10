import { CANVAS_CONSTANTS, CanvasViewport } from './CanvasViewport';
import { PersonNode, RelationshipEdge } from '../../domain/models/Person';

export interface Point2D {
  x: number;
  y: number;
}

export interface SpouseLineSegment {
  edgeId: string;
  fromPersonId: string;
  toPersonId: string;
  start: Point2D;
  end: Point2D;
  points: Point2D[];
  center: Point2D;
  isDivorced: boolean;
}

export interface ParentChildTreeSegment {
  parentId?: string;
  secondParentId?: string;
  verticalDropStart: Point2D;
  verticalDropEnd: Point2D;
  horizontalBusStart: Point2D;
  horizontalBusEnd: Point2D;
  childEntries: {
    childId: string;
    start: Point2D;
    end: Point2D;
  }[];
}

export interface RoutedDiagramEdges {
  spouseLines: SpouseLineSegment[];
  familyBuses: ParentChildTreeSegment[];
}

export class OrthogonalRouter {
  /**
   * Calculates the exact midpoint (50% of total length) along an orthogonal polyline.
   */
  static getPolylineMidpoint(points: Point2D[]): Point2D {
    if (points.length === 0) return { x: 0, y: 0 };
    if (points.length === 1) return { ...points[0] };

    const segmentLengths: number[] = [];
    let totalLength = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      const len = Math.hypot(dx, dy);
      segmentLengths.push(len);
      totalLength += len;
    }

    if (totalLength === 0) return { ...points[0] };

    const targetDist = totalLength / 2;
    let accumulated = 0;

    for (let i = 0; i < segmentLengths.length; i++) {
      const len = segmentLengths[i];
      if (accumulated + len >= targetDist - 1e-6) {
        const remaining = Math.max(0, targetDist - accumulated);
        const ratio = len > 0 ? remaining / len : 0;
        const p1 = points[i];
        const p2 = points[i + 1];

        // Ensure exact on-axis coordinate for orthogonal segments
        let mx: number;
        let my: number;
        if (Math.abs(p1.y - p2.y) < 1e-4) {
          my = p1.y;
          mx = p1.x + (p2.x - p1.x) * ratio;
        } else if (Math.abs(p1.x - p2.x) < 1e-4) {
          mx = p1.x;
          my = p1.y + (p2.y - p1.y) * ratio;
        } else {
          mx = p1.x + (p2.x - p1.x) * ratio;
          my = p1.y + (p2.y - p1.y) * ratio;
        }

        return { x: Math.round(mx), y: Math.round(my) };
      }
      accumulated += len;
    }

    return { ...points[points.length - 1] };
  }

  static routeEdges(
    persons: Map<string, PersonNode>,
    relationships: RelationshipEdge[]
  ): RoutedDiagramEdges {
    const spouseLines: SpouseLineSegment[] = [];
    const familyBuses: ParentChildTreeSegment[] = [];

    const nodeW = CANVAS_CONSTANTS.NODE_WIDTH;
    const nodeH = CANVAS_CONSTANTS.NODE_HEIGHT;

    // 1. Process spouse lines with orthogonal step routing
    const spouseEdges = relationships.filter(r => r.type === 'SPOUSE');
    const processedSpousePairs = new Set<string>();

    for (const edge of spouseEdges) {
      const p1 = persons.get(edge.fromId);
      const p2 = persons.get(edge.toId);
      if (!p1 || !p2) continue;

      const pairKey = [p1.id, p2.id].sort().join('::');
      if (processedSpousePairs.has(pairKey)) continue;
      processedSpousePairs.add(pairKey);

      // Centers of both person boxes
      const c1x = p1.canvasX + nodeW / 2;
      const c1y = p1.canvasY + nodeH / 2;
      const c2x = p2.canvasX + nodeW / 2;
      const c2y = p2.canvasY + nodeH / 2;

      const dx = c2x - c1x;
      const dy = c2y - c1y;

      let rawPoints: Point2D[] = [];

      if (Math.abs(dx) >= Math.abs(dy)) {
        // Primarily horizontal relationship (standard spouse layout)
        const [leftP, rightP] = p1.canvasX <= p2.canvasX ? [p1, p2] : [p2, p1];

        const startAnchor: Point2D = {
          x: CanvasViewport.snapToGrid(leftP.canvasX + nodeW),
          y: CanvasViewport.snapToGrid(leftP.canvasY + nodeH / 2),
        };
        const endAnchor: Point2D = {
          x: CanvasViewport.snapToGrid(rightP.canvasX),
          y: CanvasViewport.snapToGrid(rightP.canvasY + nodeH / 2),
        };

        if (startAnchor.y === endAnchor.y) {
          // Collinear horizontal
          rawPoints = [startAnchor, endAnchor];
        } else if (startAnchor.x < endAnchor.x) {
          // Right-angled step connection: Horizontal -> Vertical -> Horizontal
          const midX = CanvasViewport.snapToGrid((startAnchor.x + endAnchor.x) / 2);
          rawPoints = [
            startAnchor,
            { x: midX, y: startAnchor.y },
            { x: midX, y: endAnchor.y },
            endAnchor,
          ];
        } else {
          // Nodes overlap or are inverted horizontally
          const midY = CanvasViewport.snapToGrid((startAnchor.y + endAnchor.y) / 2);
          rawPoints = [
            startAnchor,
            { x: startAnchor.x + 30, y: startAnchor.y },
            { x: startAnchor.x + 30, y: midY },
            { x: endAnchor.x - 30, y: midY },
            { x: endAnchor.x - 30, y: endAnchor.y },
            endAnchor,
          ];
        }
      } else {
        // Primarily vertical relationship (stacked spouses)
        const [topP, bottomP] = p1.canvasY <= p2.canvasY ? [p1, p2] : [p2, p1];

        const startAnchor: Point2D = {
          x: CanvasViewport.snapToGrid(topP.canvasX + nodeW / 2),
          y: CanvasViewport.snapToGrid(topP.canvasY + nodeH),
        };
        const endAnchor: Point2D = {
          x: CanvasViewport.snapToGrid(bottomP.canvasX + nodeW / 2),
          y: CanvasViewport.snapToGrid(bottomP.canvasY),
        };

        if (startAnchor.x === endAnchor.x) {
          // Collinear vertical
          rawPoints = [startAnchor, endAnchor];
        } else if (startAnchor.y < endAnchor.y) {
          // Right-angled step connection: Vertical -> Horizontal -> Vertical
          const midY = CanvasViewport.snapToGrid((startAnchor.y + endAnchor.y) / 2);
          rawPoints = [
            startAnchor,
            { x: startAnchor.x, y: midY },
            { x: endAnchor.x, y: midY },
            endAnchor,
          ];
        } else {
          rawPoints = [startAnchor, endAnchor];
        }
      }

      // Filter consecutive identical points
      const points: Point2D[] = [];
      for (const pt of rawPoints) {
        if (points.length === 0) {
          points.push(pt);
        } else {
          const last = points[points.length - 1];
          if (Math.hypot(pt.x - last.x, pt.y - last.y) > 0.01) {
            points.push(pt);
          }
        }
      }

      // Middle badge placed exactly at 50% length along the orthogonal polyline
      const center = OrthogonalRouter.getPolylineMidpoint(points);

      spouseLines.push({
        edgeId: edge.id,
        fromPersonId: p1.id,
        toPersonId: p2.id,
        start: points[0],
        end: points[points.length - 1],
        points,
        center,
        isDivorced: !!edge.isDivorced,
      });
    }

    // 2. Group children by parent(s)
    // Find all parent-child edges
    const parentEdges = relationships.filter(r => r.type === 'PARENT_CHILD');
    const childToParents = new Map<string, string[]>();

    for (const pe of parentEdges) {
      const existing = childToParents.get(pe.toId) ?? [];
      if (!existing.includes(pe.fromId)) {
        existing.push(pe.fromId);
      }
      childToParents.set(pe.toId, existing);
    }

    // Group children having identical parent set
    const parentUnionToChildren = new Map<string, string[]>();
    for (const [childId, pList] of childToParents.entries()) {
      const key = [...pList].sort().join('::');
      const existing = parentUnionToChildren.get(key) ?? [];
      existing.push(childId);
      parentUnionToChildren.set(key, existing);
    }

    // Route each family group
    for (const [parentKey, childrenIds] of parentUnionToChildren.entries()) {
      if (!parentKey || childrenIds.length === 0) continue;
      const parentIds = parentKey.split('::');

      let dropStartX = 0;
      let dropStartY = 0;

      if (parentIds.length === 2) {
        const p1 = persons.get(parentIds[0]);
        const p2 = persons.get(parentIds[1]);
        if (p1 && p2) {
          // Check if there is an active spouse edge and start drop from the spouse center badge
          const pairKey = [p1.id, p2.id].sort().join('::');
          const matchingSpouse = spouseLines.find(
            sp => [sp.fromPersonId, sp.toPersonId].sort().join('::') === pairKey
          );

          if (matchingSpouse) {
            dropStartX = CanvasViewport.snapToGrid(matchingSpouse.center.x);
            dropStartY = CanvasViewport.snapToGrid(matchingSpouse.center.y);
          } else {
            dropStartX = CanvasViewport.snapToGrid((p1.canvasX + p2.canvasX + nodeW) / 2);
            dropStartY = CanvasViewport.snapToGrid(Math.max(p1.canvasY, p2.canvasY) + nodeH / 2);
          }
        } else if (p1) {
          dropStartX = CanvasViewport.snapToGrid(p1.canvasX + nodeW / 2);
          dropStartY = CanvasViewport.snapToGrid(p1.canvasY + nodeH);
        }
      } else if (parentIds.length === 1) {
        const p1 = persons.get(parentIds[0]);
        if (p1) {
          dropStartX = CanvasViewport.snapToGrid(p1.canvasX + nodeW / 2);
          dropStartY = CanvasViewport.snapToGrid(p1.canvasY + nodeH);
        }
      }

      if (dropStartX === 0 && dropStartY === 0) continue;

      const childrenNodes = childrenIds
        .map(id => persons.get(id))
        .filter((c): c is PersonNode => c !== undefined)
        .sort((a, b) => a.canvasX - b.canvasX);

      if (childrenNodes.length === 0) continue;

      // Bus line Y coordinate is halfway between parent bottom and child top, aligned to 15px grid
      const minChildY = Math.min(...childrenNodes.map(c => c.canvasY));
      const rawBusY = Math.max(dropStartY + 30, dropStartY + (minChildY - dropStartY) / 2);
      const busY = CanvasViewport.snapToGrid(rawBusY);

      const verticalDropStart: Point2D = { x: dropStartX, y: dropStartY };
      const verticalDropEnd: Point2D = { x: dropStartX, y: busY };

      const minChildCenterX = CanvasViewport.snapToGrid(childrenNodes[0].canvasX + nodeW / 2);
      const maxChildCenterX = CanvasViewport.snapToGrid(childrenNodes[childrenNodes.length - 1].canvasX + nodeW / 2);

      const busStartX = Math.min(dropStartX, minChildCenterX);
      const busEndX = Math.max(dropStartX, maxChildCenterX);

      const horizontalBusStart: Point2D = { x: busStartX, y: busY };
      const horizontalBusEnd: Point2D = { x: busEndX, y: busY };

      const childEntries = childrenNodes.map(c => {
        const childCenterX = CanvasViewport.snapToGrid(c.canvasX + nodeW / 2);
        return {
          childId: c.id,
          start: { x: childCenterX, y: busY },
          end: { x: childCenterX, y: CanvasViewport.snapToGrid(c.canvasY) },
        };
      });

      familyBuses.push({
        parentId: parentIds[0],
        secondParentId: parentIds[1],
        verticalDropStart,
        verticalDropEnd,
        horizontalBusStart,
        horizontalBusEnd,
        childEntries,
      });
    }

    return { spouseLines, familyBuses };
  }
}
