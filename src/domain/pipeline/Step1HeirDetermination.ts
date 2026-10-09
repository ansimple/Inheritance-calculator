import { PersonNode, RelationshipEdge, HeirStatus } from '../models/Person';
import { InheritancePolicy } from '../policies/InheritancePolicy';
import { StepTraceCollector } from './StepTraceCollector';

export interface HeirDeterminationContext {
  deceased: PersonNode;
  allPersons: Map<string, PersonNode>;
  relationships: RelationshipEdge[];
  openingDate: string;
  policy: InheritancePolicy;
  trace: StepTraceCollector;
}

export type HeirOrderCategory = '1ST' | '2ND' | '3RD' | '4TH' | 'SPOUSE_ONLY';

export interface HeirDeterminationResult {
  heirStatuses: Map<string, HeirStatus>;
  heirOrder: HeirOrderCategory;
  representativeMap: Map<string, string[]>; // Predeceased ID -> Representative Heir IDs
}

export function determineHeirs(ctx: HeirDeterminationContext): HeirDeterminationResult {
  const heirStatuses = new Map<string, HeirStatus>();
  const representativeMap = new Map<string, string[]>();
  const deceasedId = ctx.deceased.id;

  // 1. Identify legal spouse (excluding divorced)
  const spouseEdge = ctx.relationships.find(
    r => r.type === 'SPOUSE' && (r.fromId === deceasedId || r.toId === deceasedId) && !r.isDivorced
  );
  const spouse = spouseEdge
    ? ctx.allPersons.get(spouseEdge.fromId === deceasedId ? spouseEdge.toId : spouseEdge.fromId)
    : undefined;

  const isSpouseEligible = spouse && !spouse.isDeceased && !spouse.isDisqualified && !spouse.hasDeprivation && !spouse.hasRenounced;

  // 2. Priority 1: Descendants (Children, Grandchildren)
  const childEdges = ctx.relationships.filter(
    r => r.type === 'PARENT_CHILD' && r.fromId === deceasedId
  );
  const children = childEdges
    .map(e => ctx.allPersons.get(e.toId))
    .filter((p): p is PersonNode => p !== undefined && p.adoptionType !== 'FULL_ADOPTED');

  let hasValidDescendants = false;

  for (const child of children) {
    if (!child.isDeceased && !child.isDisqualified && !child.hasDeprivation && !child.hasRenounced) {
      heirStatuses.set(child.id, 'VALID_HEIR');
      hasValidDescendants = true;
    } else if (child.hasRenounced) {
      heirStatuses.set(child.id, 'RENOUNCED');
      ctx.trace.log({
        stepId: 'STEP1',
        titleKo: `${child.name} 상속포기 처리`,
        articleRefs: ['민법 제1019조'],
        descriptionKo: `${child.name} 상속인이 상속포기 신고를 하여 상속인 자격에서 배제되었습니다.`,
        metadata: { personId: child.id },
      });
    } else if (child.isDeceased || child.isDisqualified || child.hasDeprivation) {
      // Evaluate representation
      const reps = evaluateRepresentation(child, ctx);
      if (reps.length > 0) {
        representativeMap.set(child.id, reps.map(r => r.id));
        for (const rep of reps) {
          heirStatuses.set(rep.id, 'REPRESENTATIVE_HEIR');
        }
        hasValidDescendants = true;
      }
    }
  }

  if (hasValidDescendants) {
    if (isSpouseEligible) {
      heirStatuses.set(spouse!.id, 'VALID_HEIR');
    }
    ctx.trace.log({
      stepId: 'STEP1',
      titleKo: '1순위 상속인(직계비속 및 배우자) 확정',
      articleRefs: ['민법 제1000조 제1항 제1호', '민법 제1003조 제1항'],
      descriptionKo: '선순위 직계비속(자녀/손자녀) 및 법적 배우자가 존재하여 1순위 공동상속인으로 확정되었습니다. 직계존속과 형제자매는 배제됩니다.',
      metadata: { heirCount: heirStatuses.size },
    });
    return {
      heirStatuses,
      heirOrder: '1ST',
      representativeMap,
    };
  }

  // 3. Priority 2: Ascendants (Parents, Grandparents)
  const parentEdges = ctx.relationships.filter(
    r => r.type === 'PARENT_CHILD' && r.toId === deceasedId
  );
  const parents = parentEdges
    .map(e => ctx.allPersons.get(e.fromId))
    .filter((p): p is PersonNode => p !== undefined);

  let hasValidAscendants = false;
  for (const parent of parents) {
    if (!parent.isDeceased && !parent.isDisqualified && !parent.hasDeprivation && !parent.hasRenounced) {
      heirStatuses.set(parent.id, 'VALID_HEIR');
      hasValidAscendants = true;
    } else if (parent.hasRenounced) {
      heirStatuses.set(parent.id, 'RENOUNCED');
    }
  }

  if (hasValidAscendants) {
    if (isSpouseEligible) {
      heirStatuses.set(spouse!.id, 'VALID_HEIR');
    }
    ctx.trace.log({
      stepId: 'STEP1',
      titleKo: '2순위 상속인(직계존속 및 배우자) 확정',
      articleRefs: ['민법 제1000조 제1항 제2호', '민법 제1003조 제1항'],
      descriptionKo: '직계비속이 존재하지 않아 직계존속(부모님)과 법적 배우자가 2순위 공동상속인으로 확정되었습니다.',
      metadata: { heirCount: heirStatuses.size },
    });
    return {
      heirStatuses,
      heirOrder: '2ND',
      representativeMap,
    };
  }

  // 4. Priority 3: Spouse Sole Succession (When no descendants and no ascendants exist)
  if (isSpouseEligible) {
    heirStatuses.set(spouse!.id, 'VALID_HEIR');
    ctx.trace.log({
      stepId: 'STEP1',
      titleKo: '배우자 단독상속 확정',
      articleRefs: ['민법 제1003조 제1항 단서'],
      descriptionKo: '직계비속과 직계존속이 모두 존재하지 않아 법적 배우자가 단독 상속인으로 확정되었습니다.',
      metadata: { spouseId: spouse!.id },
    });
    return {
      heirStatuses,
      heirOrder: 'SPOUSE_ONLY',
      representativeMap,
    };
  }

  // 5. Priority 4: Siblings (Brothers and Sisters)
  // Find persons who share parent(s) with deceased
  const siblingIds = new Set<string>();
  for (const pEdge of parentEdges) {
    const parentId = pEdge.fromId;
    const siblingEdges = ctx.relationships.filter(
      r => r.type === 'PARENT_CHILD' && r.fromId === parentId && r.toId !== deceasedId
    );
    for (const sEdge of siblingEdges) {
      siblingIds.add(sEdge.toId);
    }
  }

  let hasValidSiblings = false;
  for (const sId of siblingIds) {
    const sibling = ctx.allPersons.get(sId);
    if (!sibling) continue;

    if (!sibling.isDeceased && !sibling.isDisqualified && !sibling.hasDeprivation && !sibling.hasRenounced) {
      heirStatuses.set(sibling.id, 'VALID_HEIR');
      hasValidSiblings = true;
    } else if (sibling.isDeceased || sibling.isDisqualified || sibling.hasDeprivation) {
      const reps = evaluateRepresentation(sibling, ctx);
      if (reps.length > 0) {
        representativeMap.set(sibling.id, reps.map(r => r.id));
        for (const rep of reps) {
          heirStatuses.set(rep.id, 'REPRESENTATIVE_HEIR');
        }
        hasValidSiblings = true;
      }
    }
  }

  if (hasValidSiblings) {
    ctx.trace.log({
      stepId: 'STEP1',
      titleKo: '3순위 상속인(형제자매) 확정',
      articleRefs: ['민법 제1000조 제1항 제3호'],
      descriptionKo: '직계비속, 직계존속, 배우자가 모두 존재하지 않아 형제자매가 상속인으로 확정되었습니다.',
      metadata: { heirCount: heirStatuses.size },
    });
    return {
      heirStatuses,
      heirOrder: '3RD',
      representativeMap,
    };
  }

  return {
    heirStatuses,
    heirOrder: '4TH',
    representativeMap,
  };
}

/**
 * Evaluates representative heirs for a deceased, disqualified, or deprived heir.
 */
export function evaluateRepresentation(
  predeceased: PersonNode,
  ctx: HeirDeterminationContext
): PersonNode[] {
  const result: PersonNode[] = [];

  // 1. Predeceased's descendants (Grandchildren, Nephews/Nieces) - Civil Act Art. 1001
  const childEdges = ctx.relationships.filter(
    r => r.type === 'PARENT_CHILD' && r.fromId === predeceased.id
  );
  for (const cEdge of childEdges) {
    const child = ctx.allPersons.get(cEdge.toId);
    if (child && !child.isDeceased && !child.isDisqualified && !child.hasDeprivation && !child.hasRenounced) {
      result.push(child);
      ctx.trace.log({
        stepId: 'STEP1',
        titleKo: `${child.name} 대습상속 자격 인정`,
        articleRefs: ['민법 제1001조'],
        descriptionKo: `피대습인 ${predeceased.name}의 직계비속인 ${child.name}이 대습상속인으로 확정되었습니다.`,
        metadata: { predeceasedId: predeceased.id, repId: child.id },
      });
    }
  }

  // 2. Predeceased's spouse (Son-in-law, Daughter-in-law) - Civil Act Art. 1003 para 2
  const spouseEdge = ctx.relationships.find(
    r => r.type === 'SPOUSE' && (r.fromId === predeceased.id || r.toId === predeceased.id) && !r.isDivorced
  );

  if (spouseEdge) {
    const spouse = ctx.allPersons.get(
      spouseEdge.fromId === predeceased.id ? spouseEdge.toId : spouseEdge.fromId
    );

    if (spouse && !spouse.isDeceased && !spouse.isDisqualified && !spouse.hasDeprivation && !spouse.hasRenounced) {
      // Check Edge Case 1: Remarried before succession opening (Civil Act Art. 775 para 2)
      if (spouse.remarriedBeforeOpening) {
        ctx.trace.log({
          stepId: 'STEP1',
          titleKo: `${spouse.name} 대습상속 배제 (재혼)`,
          articleRefs: ['민법 제775조 제2항', '대법원 판례'],
          descriptionKo: `${spouse.name}은 피대습인 사망 후 재혼하여 인척관계가 종료되었으므로 대습상속권이 소멸되었습니다.`,
          metadata: { spouseId: spouse.id },
        });
        return result;
      }

      // Check Edge Case 2: 2026 Civil Act Art. 1003 para 2 revision
      // If predeceased is disqualified or deprived, spouse is EXCLUDED from representation!
      const isPredeceasedAtFault = predeceased.isDisqualified || predeceased.hasDeprivation;
      if (ctx.policy.excludeSpouseOfDisqualifiedFromRepresentation && isPredeceasedAtFault) {
        ctx.trace.log({
          stepId: 'STEP1',
          titleKo: `${spouse.name} 대습상속 배제 (2026 개정 민법 제1003조 제2항)`,
          articleRefs: ['민법 제1003조 제2항 (법률 제21454호)'],
          descriptionKo: `2026년 개정 민법에 따라 피대습자(${predeceased.name})가 결격 또는 상속권상실인 경우 배우자(${spouse.name})는 대습상속에서 완전히 배제됩니다.`,
          metadata: { spouseId: spouse.id, predeceasedId: predeceased.id },
        });
        return result;
      }

      // If predeceased was simply deceased, or past policy allows, spouse inherits
      result.push(spouse);
      ctx.trace.log({
        stepId: 'STEP1',
        titleKo: `${spouse.name} 배우자 대습상속 인정`,
        articleRefs: ['민법 제1003조 제2항'],
        descriptionKo: `피대습인 ${predeceased.name}의 배우자인 ${spouse.name}이 대습상속인으로 확정되었습니다.`,
        metadata: { predeceasedId: predeceased.id, repId: spouse.id },
      });
    }
  }

  return result;
}
