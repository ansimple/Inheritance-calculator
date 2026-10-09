import { BigFraction } from '../math/BigFraction';
import { PersonNode } from '../models/Person';
import { InheritancePolicy } from '../policies/InheritancePolicy';
import { StepTraceCollector } from './StepTraceCollector';
import { HeirOrderCategory } from './Step1HeirDetermination';

export interface Step4Input {
  deceasedId: string;
  spouseId?: string;
  activeEstateWon: bigint;
  passiveDebtWon: bigint;
  statutoryShares: Map<string, BigFraction>;
  concreteShares: Map<string, bigint>;
  allocatedDebts: Map<string, bigint>;
  allPersons: Map<string, PersonNode>;
  heirOrder: HeirOrderCategory;
  policy: InheritancePolicy;
  trace: StepTraceCollector;
}

export interface CompensationFlow {
  fromPersonId: string;
  fromPersonName: string;
  toPersonId: string;
  toPersonName: string;
  amountWon: bigint;
  legalInterestStartDate: string;
  isMonetary: boolean;
}

export interface Step4Output {
  baseEstateWon: bigint;
  reserveShortages: Map<string, bigint>;
  reserveObligations: Map<string, bigint>;
  compensationFlows: CompensationFlow[];
}

export function executeStep4ReserveSettlement(input: Step4Input): Step4Output {
  // 1. Calculate includable gifts for legal reserve base estate (Civil Act Art. 1113)
  // Gifts to co-heirs are included regardless of when they were made (Supreme Court 95Da17885)
  // Contribution compensation gifts are excluded if policy dictates (2026 Civil Act Art. 1008 proviso)
  let totalIncludableGifts = 0n;
  const personalIncludableGifts = new Map<string, bigint>();
  const personalBequests = new Map<string, bigint>();

  for (const [id] of input.statutoryShares) {
    const p = input.allPersons.get(id);
    if (!p) continue;

    let pGifts = 0n;
    for (const g of p.specialBenefits) {
      if (input.policy.excludeContributionCompensationFromSpecialBenefits && g.isContributionCompensation) {
        continue;
      }
      pGifts += g.amountWon;
    }
    personalIncludableGifts.set(id, pGifts);
    totalIncludableGifts += pGifts;

    let pBequests = 0n;
    for (const b of p.bequests) {
      pBequests += b.amountWon;
    }
    personalBequests.set(id, pBequests);
  }

  // Base estate = activeEstate + gifts - passiveDebt
  const rawBase = input.activeEstateWon + totalIncludableGifts - input.passiveDebtWon;
  const baseEstateWon = rawBase > 0n ? rawBase : 0n;

  input.trace.log({
    stepId: 'STEP4',
    titleKo: '유류분 산정 기초재산 확정',
    articleRefs: ['민법 제1113조 제1항'],
    descriptionKo: `적극재산(${input.activeEstateWon.toLocaleString()}원) + 산입증여(${totalIncludableGifts.toLocaleString()}원) - 상속채무(${input.passiveDebtWon.toLocaleString()}원) = 유류분 기초재산 ${baseEstateWon.toLocaleString()}원으로 확정되었습니다.`,
    formulaText: `${input.activeEstateWon} + ${totalIncludableGifts} - ${input.passiveDebtWon} = ${baseEstateWon}`,
    metadata: { baseEstateWon: baseEstateWon.toString() },
  });

  // 2. Calculate reserve shortage for each co-heir
  // NetAcquisition = (gifts + bequests) + concreteShare - allocatedDebt
  // Shortage = max(0, reserveAmount - NetAcquisition)
  const reserveShortages = new Map<string, bigint>();
  let totalShortage = 0n;

  for (const [id, statRate] of input.statutoryShares) {
    const person = input.allPersons.get(id);
    if (!person) continue;

    const isSpouse = id === input.spouseId;
    const category = isSpouse ? 'SPOUSE' :
      input.heirOrder === '1ST' ? '1ST' :
      input.heirOrder === '2ND' ? '2ND' :
      input.heirOrder === '3RD' ? '3RD' : 'SPOUSE';

    const reserveRate = input.policy.getReserveRate(
      person,
      statRate,
      category
    );

    const reserveTargetWon = (baseEstateWon * reserveRate.numerator) / reserveRate.denominator;

    const gifts = personalIncludableGifts.get(id) ?? 0n;
    const bequests = personalBequests.get(id) ?? 0n;
    const concrete = input.concreteShares.get(id) ?? 0n;
    const debt = input.allocatedDebts.get(id) ?? 0n;

    const netAcquisitionWon = gifts + bequests + concrete - debt;
    const shortageWon = reserveTargetWon > netAcquisitionWon ? reserveTargetWon - netAcquisitionWon : 0n;

    reserveShortages.set(id, shortageWon);

    if (shortageWon > 0n) {
      totalShortage += shortageWon;
      input.trace.log({
        stepId: 'STEP4',
        titleKo: `${person.name} 유류분 부족액 발생`,
        articleRefs: ['민법 제1115조 제1항', '대법원 93다11715'],
        descriptionKo: `${person.name}의 유류분액(${reserveTargetWon.toLocaleString()}원) 대비 순수령액(${netAcquisitionWon.toLocaleString()}원)이 부족하여 유류분 반환청구권(${shortageWon.toLocaleString()}원)이 발생하였습니다.`,
        formulaText: `${reserveTargetWon} - ${netAcquisitionWon} = ${shortageWon}`,
        metadata: { personId: person.id, shortageWon: shortageWon.toString() },
      });
    }
  }

  // 3. Determine return obligations in legal order (Civil Act Art. 1115 para 2)
  // 1st priority: Bequests are returned first in proportion to their values.
  // 2nd priority: If bequests are insufficient, Gifts are returned in proportion to their values.
  const reserveObligations = new Map<string, bigint>();
  const compensationFlows: CompensationFlow[] = [];

  for (const [id] of input.statutoryShares) {
    reserveObligations.set(id, 0n);
  }

  if (totalShortage > 0n) {
    let remainingShortageToCover = totalShortage;

    // A. Settle from Bequests first
    let totalAvailableBequests = 0n;
    for (const [, bAmt] of personalBequests) {
      totalAvailableBequests += bAmt;
    }

    const bequestDeductions = new Map<string, bigint>();
    if (totalAvailableBequests > 0n) {
      const bequestDeductionTotal = remainingShortageToCover < totalAvailableBequests ? remainingShortageToCover : totalAvailableBequests;
      for (const [id, bAmt] of personalBequests) {
        if (bAmt > 0n) {
          const portion = (bAmt * bequestDeductionTotal) / totalAvailableBequests;
          bequestDeductions.set(id, portion);
          reserveObligations.set(id, (reserveObligations.get(id) ?? 0n) + portion);
        }
      }
      remainingShortageToCover -= bequestDeductionTotal;
    }

    // B. Settle from Gifts if shortage remains
    if (remainingShortageToCover > 0n) {
      let totalAvailableGifts = 0n;
      for (const [, gAmt] of personalIncludableGifts) {
        totalAvailableGifts += gAmt;
      }

      if (totalAvailableGifts > 0n) {
        const giftDeductionTotal = remainingShortageToCover < totalAvailableGifts ? remainingShortageToCover : totalAvailableGifts;
        for (const [id, gAmt] of personalIncludableGifts) {
          if (gAmt > 0n) {
            const portion = (gAmt * giftDeductionTotal) / totalAvailableGifts;
            reserveObligations.set(id, (reserveObligations.get(id) ?? 0n) + portion);
          }
        }
      }
    }

    // Build compensation flows (mapping obligors to claimants)
    const claimants = [...reserveShortages.entries()].filter(([, amt]) => amt > 0n);
    const obligors = [...reserveObligations.entries()].filter(([, amt]) => amt > 0n);

    for (const [claimantId, claimAmt] of claimants) {
      const claimant = input.allPersons.get(claimantId);
      for (const [obligorId, obligorAmt] of obligors) {
        if (claimantId === obligorId) continue;
        const obligor = input.allPersons.get(obligorId);

        // Portion flow
        const flowAmount = totalShortage > 0n ? (claimAmt * obligorAmt) / totalShortage : 0n;
        if (flowAmount > 0n) {
          compensationFlows.push({
            fromPersonId: obligorId,
            fromPersonName: obligor?.name ?? obligorId,
            toPersonId: claimantId,
            toPersonName: claimant?.name ?? claimantId,
            amountWon: flowAmount,
            legalInterestStartDate: '소장 부본 송달일 다음 날부터 (연 12%)',
            isMonetary: input.policy.isMonetaryReserveReturnMandatory,
          });
        }
      }
    }

    input.trace.log({
      stepId: 'STEP4',
      titleKo: '유류분 가액반환 정산표 확정',
      articleRefs: [
        '민법 제1115조 제1항 (2026.3.17 개정)',
        '소송촉진 등에 관한 특례법 제3조',
      ],
      descriptionKo: input.policy.isMonetaryReserveReturnMandatory
        ? `2026년 개정 민법에 따라 유류분 부족액 전액(${totalShortage.toLocaleString()}원)에 대하여 전면 금전(가액)반환 정산이 완료되었습니다.`
        : `유류분 부족액 ${totalShortage.toLocaleString()}원에 대한 반환 정산표가 도출되었습니다.`,
      metadata: { totalShortage: totalShortage.toString(), flowsCount: compensationFlows.length },
    });
  }

  return {
    baseEstateWon,
    reserveShortages,
    reserveObligations,
    compensationFlows,
  };
}
