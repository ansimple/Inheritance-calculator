import { PersonNode, RelationshipEdge } from '../../domain/models/Person';
import { CANVAS_CONSTANTS } from '../core/CanvasViewport';

export class GenerationalTreeLayout {
  /**
   * Automatically computes hierarchical generational layout coordinates for all persons.
   * Returns a map of personId -> { canvasX, canvasY }
   */
  static computeLayout(
    deceasedId: string,
    allPersons: Map<string, PersonNode>,
    relationships: RelationshipEdge[]
  ): Map<string, { canvasX: number; canvasY: number }> {
    const layout = new Map<string, { canvasX: number; canvasY: number }>();
    if (!allPersons.has(deceasedId)) return layout;

    // 1. Assign generational levels relative to deceased (level 0)
    // Deceased = 0, Parents = -1, Children = 1, Grandchildren = 2, Siblings = 0
    const levels = new Map<string, number>();
    levels.set(deceasedId, 0);

    // BFS / DFS to assign generational level
    const parentChildEdges = relationships.filter(r => r.type === 'PARENT_CHILD');
    const spouseEdges = relationships.filter(r => r.type === 'SPOUSE');

    let changed = true;
    let iterations = 0;
    while (changed && iterations < 20) {
      changed = false;
      iterations++;

      // Spouses are on the same level
      for (const edge of spouseEdges) {
        const lvlFrom = levels.get(edge.fromId);
        const lvlTo = levels.get(edge.toId);
        if (lvlFrom !== undefined && lvlTo === undefined) {
          levels.set(edge.toId, lvlFrom);
          changed = true;
        } else if (lvlTo !== undefined && lvlFrom === undefined) {
          levels.set(edge.fromId, lvlTo);
          changed = true;
        }
      }

      // Parent -> Child (+1 level)
      for (const edge of parentChildEdges) {
        const lvlParent = levels.get(edge.fromId);
        const lvlChild = levels.get(edge.toId);
        if (lvlParent !== undefined && lvlChild === undefined) {
          levels.set(edge.toId, lvlParent + 1);
          changed = true;
        } else if (lvlChild !== undefined && lvlParent === undefined) {
          levels.set(edge.fromId, lvlChild - 1);
          changed = true;
        }
      }
    }

    // Default any disconnected persons to level 0
    for (const [id] of allPersons) {
      if (!levels.has(id)) {
        levels.set(id, 0);
      }
    }

    // 2. Base Y per generation
    const baseY = 240; // Deceased level 0 starts at Y=240
    const nodeW = CANVAS_CONSTANTS.NODE_WIDTH;
    const spouseGap = CANVAS_CONSTANTS.SPOUSE_SPACING;
    const siblingGap = CANVAS_CONSTANTS.SIBLING_SPACING;

    // 3. Place Generation -1 (Parents)
    const parents = Array.from(allPersons.values()).filter(p => levels.get(p.id) === -1);
    const parentY = baseY - CANVAS_CONSTANTS.GEN_LEVEL_HEIGHT;
    let currentParentX = 300;
    for (const parent of parents) {
      layout.set(parent.id, { canvasX: currentParentX, canvasY: parentY });
      currentParentX += nodeW + siblingGap;
    }

    // 4. Place Generation 0 (Deceased and Spouse, plus Siblings)
    const deceasedX = 340;
    layout.set(deceasedId, { canvasX: deceasedX, canvasY: baseY });

    // Deceased Spouse
    const deceasedSpouseEdge = spouseEdges.find(
      r => (r.fromId === deceasedId || r.toId === deceasedId) && !r.isDivorced
    );
    let rightBoundGen0 = deceasedX + nodeW;

    if (deceasedSpouseEdge) {
      const spouseId = deceasedSpouseEdge.fromId === deceasedId ? deceasedSpouseEdge.toId : deceasedSpouseEdge.fromId;
      const spouseX = deceasedX + nodeW + spouseGap;
      layout.set(spouseId, { canvasX: spouseX, canvasY: baseY });
      rightBoundGen0 = spouseX + nodeW;
    }

    // Siblings (at Gen 0, placed to the left or right of deceased group)
    const siblings = Array.from(allPersons.values()).filter(
      p => levels.get(p.id) === 0 && p.id !== deceasedId && p.id !== deceasedSpouseEdge?.fromId && p.id !== deceasedSpouseEdge?.toId
    );

    let nextSiblingX = rightBoundGen0 + siblingGap * 2;
    for (const sib of siblings) {
      layout.set(sib.id, { canvasX: nextSiblingX, canvasY: baseY });
      nextSiblingX += nodeW + siblingGap;
    }

    // 5. Place Generation 1 (Children of deceased)
    const children = Array.from(allPersons.values()).filter(p => levels.get(p.id) === 1);
    const childY = baseY + CANVAS_CONSTANTS.GEN_LEVEL_HEIGHT;

    // Center children under the deceased/spouse union
    const unionCenterX = (deceasedX + rightBoundGen0) / 2;
    const totalChildrenWidth = children.length * nodeW + Math.max(0, children.length - 1) * siblingGap;
    let startChildX = unionCenterX - totalChildrenWidth / 2;
    // Align with 5px grid
    startChildX = Math.round(startChildX / 5) * 5;

    let curChildX = Math.max(80, startChildX);

    for (const child of children) {
      // Check if child has a spouse
      const childSpouseEdge = spouseEdges.find(
        r => (r.fromId === child.id || r.toId === child.id) && !r.isDivorced
      );

      layout.set(child.id, { canvasX: curChildX, canvasY: childY });
      curChildX += nodeW;

      if (childSpouseEdge) {
        const spouseId = childSpouseEdge.fromId === child.id ? childSpouseEdge.toId : childSpouseEdge.fromId;
        curChildX += spouseGap;
        layout.set(spouseId, { canvasX: curChildX, canvasY: childY });
        curChildX += nodeW;
      }

      curChildX += siblingGap;
    }

    // 6. Place Generation 2 (Grandchildren)
    const grandChildren = Array.from(allPersons.values()).filter(p => levels.get(p.id) === 2);
    const grandChildY = childY + CANVAS_CONSTANTS.GEN_LEVEL_HEIGHT;
    let curGcX = Math.max(80, startChildX);

    for (const gc of grandChildren) {
      layout.set(gc.id, { canvasX: curGcX, canvasY: grandChildY });
      curGcX += nodeW + siblingGap;
    }

    return layout;
  }
}
