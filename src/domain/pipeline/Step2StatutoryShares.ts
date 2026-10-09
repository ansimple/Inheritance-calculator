import { BigFraction } from '../math/BigFraction';
import { PersonNode, RelationshipEdge, HeirStatus } from '../models/Person';
import { StepTraceCollector } from './StepTraceCollector';

export interface Step2Input {
  deceased: PersonNode;
  heirStatuses: Map<string, HeirStatus>;
  representativeMap: Map<string, string[]>; // Predeceased ID -> Representative Heir IDs
  allPersons: Map<string, PersonNode>;
  relationships: RelationshipEdge[];
  trace: StepTraceCollector;
}

export function calculateStatutoryShareRates(input: Step2Input): Map<string, BigFraction> {
  const resultRates = new Map<string, BigFraction>();
  const deceasedId = input.deceased.id;

  // 1. Identify primary branches originating directly from the deceased
  // A branch is either a VALID_HEIR directly, or a predeceased person whose representatives are inheriting.
  interface PrimaryBranch {
    id: string;
    isSpouse: boolean;
    weight: bigint; // 3 for spouse (1.5), 2 for others (1.0)
    isRepresentativeGroup: boolean;
    representativeIds?: string[];
  }

  const primaryBranches: PrimaryBranch[] = [];

  // Check legal spouse
  const spouseEdge = input.relationships.find(
    r => r.type === 'SPOUSE' && (r.fromId === deceasedId || r.toId === deceasedId) && !r.isDivorced
  );
  const spouseId = spouseEdge
    ? (spouseEdge.fromId === deceasedId ? spouseEdge.toId : spouseEdge.fromId)
    : undefined;

  if (spouseId && input.heirStatuses.get(spouseId) === 'VALID_HEIR') {
    primaryBranches.push({
      id: spouseId,
      isSpouse: true,
      weight: 3n,
      isRepresentativeGroup: false,
    });
  }

  // Check valid non-spouse primary heirs
  for (const [id, status] of input.heirStatuses) {
    if (status === 'VALID_HEIR' && id !== spouseId) {
      primaryBranches.push({
        id,
        isSpouse: false,
        weight: 2n,
        isRepresentativeGroup: false,
      });
    }
  }

  // Check representative groups (predeceased ancestors of reps)
  for (const [predeceasedId, repIds] of input.representativeMap) {
    if (repIds.length > 0) {
      primaryBranches.push({
        id: predeceasedId,
        isSpouse: false,
        weight: 2n,
        isRepresentativeGroup: true,
        representativeIds: repIds,
      });
    }
  }

  // Calculate sum of primary branch weights
  let totalPrimaryWeight = 0n;
  for (const branch of primaryBranches) {
    totalPrimaryWeight += branch.weight;
  }

  if (totalPrimaryWeight === 0n) {
    return resultRates;
  }

  // Assign share rates to each branch
  for (const branch of primaryBranches) {
    const branchShare = new BigFraction(branch.weight, totalPrimaryWeight);

    if (!branch.isRepresentativeGroup) {
      resultRates.set(branch.id, branchShare);
      const person = input.allPersons.get(branch.id);
      input.trace.log({
        stepId: 'STEP2',
        titleKo: `${person?.name ?? branch.id} 법정상속분율 산정`,
        articleRefs: ['민법 제1009조 제1항', '제2항'],
        descriptionKo: `${person?.name}의 법정상속분율은 ${branchShare.toFractionString()} (${(Number(branchShare.numerator) / Number(branchShare.denominator) * 100).toFixed(2)}%)입니다.`,
        formulaText: `${branch.weight} / ${totalPrimaryWeight}`,
        metadata: { personId: branch.id, rate: branchShare.toFractionString() },
      });
    } else {
      // Subdivide the branch share among representatives according to their relative weights
      // (Spouse of predeceased gets 1.5 [weight 3], children get 1.0 [weight 2])
      const repIds = branch.representativeIds!;
      let totalRepWeight = 0n;
      const repWeights = new Map<string, bigint>();

      for (const rId of repIds) {
        // Check if this representative is the spouse of the predeceased
        const isRepSpouse = input.relationships.some(
          rel => rel.type === 'SPOUSE' && (rel.fromId === branch.id || rel.toId === branch.id) &&
                 (rel.fromId === rId || rel.toId === rId) && !rel.isDivorced
        );
        const weight = isRepSpouse ? 3n : 2n;
        repWeights.set(rId, weight);
        totalRepWeight += weight;
      }

      for (const rId of repIds) {
        const weight = repWeights.get(rId)!;
        const relativeRatio = new BigFraction(weight, totalRepWeight);
        const finalRepShare = branchShare.mul(relativeRatio);
        resultRates.set(rId, finalRepShare);

        const person = input.allPersons.get(rId);
        const predeceasedPerson = input.allPersons.get(branch.id);
        input.trace.log({
          stepId: 'STEP2',
          titleKo: `${person?.name ?? rId} 대습상속분율 승계 분할`,
          articleRefs: ['민법 제1010조'],
          descriptionKo: `피대습인 ${predeceasedPerson?.name}의 지분(${branchShare.toFractionString()})을 승계하여 ${person?.name}의 최종 법정지분율은 ${finalRepShare.toFractionString()}로 결정되었습니다.`,
          formulaText: `${branchShare.toFractionString()} × (${weight}/${totalRepWeight}) = ${finalRepShare.toFractionString()}`,
          metadata: { personId: rId, finalRate: finalRepShare.toFractionString() },
        });
      }
    }
  }

  return resultRates;
}
