import { CANVAS_CONSTANTS } from './CanvasViewport';
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
  static routeEdges(
    persons: Map<string, PersonNode>,
    relationships: RelationshipEdge[]
  ): RoutedDiagramEdges {
    const spouseLines: SpouseLineSegment[] = [];
    const familyBuses: ParentChildTreeSegment[] = [];

    const nodeW = CANVAS_CONSTANTS.NODE_WIDTH;
    const nodeH = CANVAS_CONSTANTS.NODE_HEIGHT;

    // 1. Process spouse lines
    const spouseEdges = relationships.filter(r => r.type === 'SPOUSE');
    const processedSpousePairs = new Set<string>();

    for (const edge of spouseEdges) {
      const p1 = persons.get(edge.fromId);
      const p2 = persons.get(edge.toId);
      if (!p1 || !p2) continue;

      const pairKey = [p1.id, p2.id].sort().join('::');
      if (processedSpousePairs.has(pairKey)) continue;
      processedSpousePairs.add(pairKey);

      // Determine left and right
      const [leftP, rightP] = p1.canvasX <= p2.canvasX ? [p1, p2] : [p2, p1];

      const start: Point2D = {
        x: leftP.canvasX + nodeW,
        y: leftP.canvasY + nodeH / 2,
      };
      const end: Point2D = {
        x: rightP.canvasX,
        y: rightP.canvasY + nodeH / 2,
      };
      const center: Point2D = {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      };

      spouseLines.push({
        edgeId: edge.id,
        fromPersonId: leftP.id,
        toPersonId: rightP.id,
        start,
        end,
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
          dropStartX = (p1.canvasX + p2.canvasX + nodeW) / 2;
          dropStartY = Math.max(p1.canvasY, p2.canvasY) + nodeH / 2;
        } else if (p1) {
          dropStartX = p1.canvasX + nodeW / 2;
          dropStartY = p1.canvasY + nodeH;
        }
      } else if (parentIds.length === 1) {
        const p1 = persons.get(parentIds[0]);
        if (p1) {
          dropStartX = p1.canvasX + nodeW / 2;
          dropStartY = p1.canvasY + nodeH;
        }
      }

      if (dropStartX === 0 && dropStartY === 0) continue;

      const childrenNodes = childrenIds
        .map(id => persons.get(id))
        .filter((c): c is PersonNode => c !== undefined)
        .sort((a, b) => a.canvasX - b.canvasX);

      if (childrenNodes.length === 0) continue;

      // Bus line Y coordinate is halfway between parent bottom and child top
      const minChildY = Math.min(...childrenNodes.map(c => c.canvasY));
      const busY = Math.max(dropStartY + 25, dropStartY + (minChildY - dropStartY) / 2);

      const verticalDropStart: Point2D = { x: dropStartX, y: dropStartY };
      const verticalDropEnd: Point2D = { x: dropStartX, y: busY };

      const minChildCenterX = childrenNodes[0].canvasX + nodeW / 2;
      const maxChildCenterX = childrenNodes[childrenNodes.length - 1].canvasX + nodeW / 2;

      const busStartX = Math.min(dropStartX, minChildCenterX);
      const busEndX = Math.max(dropStartX, maxChildCenterX);

      const horizontalBusStart: Point2D = { x: busStartX, y: busY };
      const horizontalBusEnd: Point2D = { x: busEndX, y: busY };

      const childEntries = childrenNodes.map(c => ({
        childId: c.id,
        start: { x: c.canvasX + nodeW / 2, y: busY },
        end: { x: c.canvasX + nodeW / 2, y: c.canvasY },
      }));

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
