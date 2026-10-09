import { BigFraction } from '../math/BigFraction';
import { PersonNode } from '../models/Person';
import { InheritancePolicy } from '../policies/InheritancePolicy';
import { StepTraceCollector } from './StepTraceCollector';

export interface Step3Input {
  activeEstateWon: bigint;
  passiveDebtWon: bigint;
  heirRates: Map<string, BigFraction>;
  allPersons: Map<string, PersonNode>;
  policy: InheritancePolicy;
  trace: StepTraceCollector;
}

export interface Step3Output {
  concreteSharesWon: Map<string, bigint>;
  allocatedDebtsWon: Map<string, bigint>;
  deemedEstateWon: bigint;
}

export interface HeirAdjustmentState {
  id: string;
  name: string;
  statutoryShareRate: BigFraction;
  tentativeConcreteShare: bigint;
  isExcess: boolean;
  excessAmount: bigint;
  specialBenefitsTotal: bigint;
  contributionAmount: bigint;
}

export function executeStep3ConcreteShares(input: Step3Input): Step3Output {
  // 1. Calculate total bequests
  let totalBequests = 0n;
  for (const [id] of input.heirRates) {
    const p = input.allPersons.get(id);
    if (!p) continue;
    for (const b of p.bequests) {
      totalBequests += b.amountWon;
    }
  }

  // 2. Validate and adjust contribution limit (Civil Act Art. 1008-2 para 2)
  // Limit = activeEstate - totalBequests
  const contributionLimit = input.activeEstateWon > totalBequests ? input.activeEstateWon - totalBequests : 0n;
  let totalDeclaredContributions = 0n;
  for (const [id] of input.heirRates) {
    const p = input.allPersons.get(id);
    if (p) totalDeclaredContributions += p.contributionAmountWon;
  }

  const effectiveContributions = new Map<string, bigint>();
  let totalEffectiveContributions = 0n;

  if (totalDeclaredContributions > contributionLimit) {
    input.trace.log({
      stepId: 'STEP3',
      titleKo: '기여분 법정한도 초과 비례 조정',
      articleRefs: ['민법 제1008조의2 제2항'],
      descriptionKo: `신고된 총 기여분(${totalDeclaredContributions.toLocaleString()}원)이 법정한도(${contributionLimit.toLocaleString()}원)를 초과하여 법정한도 내로 비례 조정되었습니다.`,
      metadata: { originalTotal: totalDeclaredContributions.toString(), limit: contributionLimit.toString() },
    });

    for (const [id] of input.heirRates) {
      const p = input.allPersons.get(id);
      if (p && totalDeclaredContributions > 0n) {
        const adjusted = (p.contributionAmountWon * contributionLimit) / totalDeclaredContributions;
        effectiveContributions.set(id, adjusted);
        totalEffectiveContributions += adjusted;
      } else {
        effectiveContributions.set(id, 0n);
      }
    }
  } else {
    for (const [id] of input.heirRates) {
      const p = input.allPersons.get(id);
      const amt = p?.contributionAmountWon ?? 0n;
      effectiveContributions.set(id, amt);
      totalEffectiveContributions += amt;
    }
  }

  // 3. Calculate special benefits for each heir
  // (Exclude contribution compensation if policy dictates: 2026 Civil Act Art. 1008 proviso)
  const heirSpecialBenefits = new Map<string, bigint>();
  let totalSpecialBenefits = 0n;

  for (const [id] of input.heirRates) {
    const p = input.allPersons.get(id);
    if (!p) {
      heirSpecialBenefits.set(id, 0n);
      continue;
    }

    let personalBenefit = 0n;
    for (const g of p.specialBenefits) {
      if (input.policy.excludeContributionCompensationFromSpecialBenefits && g.isContributionCompensation) {
        input.trace.log({
          stepId: 'STEP3',
          titleKo: `${p.name} 기여보상 증여 특별수익 제외`,
          articleRefs: ['민법 제1008조 단서 (법률 제21454호)'],
          descriptionKo: `${p.name}이 피상속인으로부터 받은 기여보상 증여(${g.amountWon.toLocaleString()}원)는 특별수익 산정에서 제외되었습니다.`,
          metadata: { personId: p.id, giftAmount: g.amountWon.toString() },
        });
        continue;
      }
      personalBenefit += g.amountWon;
    }

    // Bequests are always included in special benefits (Civil Act Art. 1008)
    for (const b of p.bequests) {
      personalBenefit += b.amountWon;
    }

    heirSpecialBenefits.set(id, personalBenefit);
    totalSpecialBenefits += personalBenefit;
  }

  // 4. Calculate deemed active estate (간주상속재산 SP)
  // SP = activeEstate + totalSpecialBenefits - totalContributions
  const deemedEstateWon = input.activeEstateWon + totalSpecialBenefits - totalEffectiveContributions;

  input.trace.log({
    stepId: 'STEP3',
    titleKo: '간주상속재산 산출',
    articleRefs: ['민법 제1008조', '대법원 96스62'],
    descriptionKo: `적극재산(${input.activeEstateWon.toLocaleString()}원) + 특별수익 합계(${totalSpecialBenefits.toLocaleString()}원) - 기여분 합계(${totalEffectiveContributions.toLocaleString()}원) = 간주상속재산 ${deemedEstateWon.toLocaleString()}원으로 산정되었습니다.`,
    formulaText: `${input.activeEstateWon} + ${totalSpecialBenefits} - ${totalEffectiveContributions} = ${deemedEstateWon}`,
    metadata: { deemedEstateWon: deemedEstateWon.toString() },
  });

  // 5. Calculate tentative concrete shares for each heir
  // Tentative = SP * Rate - specialBenefit + contribution
  const heirStates: HeirAdjustmentState[] = [];

  for (const [id, rate] of input.heirRates) {
    const person = input.allPersons.get(id);
    const benefit = heirSpecialBenefits.get(id) ?? 0n;
    const contribution = effectiveContributions.get(id) ?? 0n;

    const shareFromDeemed = (deemedEstateWon * rate.numerator) / rate.denominator;
    const tentative = shareFromDeemed - benefit + contribution;

    heirStates.push({
      id,
      name: person?.name ?? id,
      statutoryShareRate: rate,
      tentativeConcreteShare: tentative,
      isExcess: tentative < 0n,
      excessAmount: tentative < 0n ? -tentative : 0n,
      specialBenefitsTotal: benefit,
      contributionAmount: contribution,
    });
  }

  // 6. Supreme Court 2017Seu98 convergence loop for excess special benefits
  const finalConcreteShares = balanceExcessSpecialBenefits(
    heirStates,
    input.activeEstateWon,
    input.trace
  );

  // 7. Successive statutory allocation of passive estate debts (Supreme Court 97Da8809)
  // Monitary debts are partitioned automatically strictly by statutory share rates!
  const allocatedDebts = new Map<string, bigint>();
  let totalDebtAllocated = 0n;

  for (const [id, rate] of input.heirRates) {
    const debtShare = (input.passiveDebtWon * rate.numerator) / rate.denominator;
    allocatedDebts.set(id, debtShare);
    totalDebtAllocated += debtShare;
  }

  // Adjust 1-won discrepancy for debt allocation to the highest statutory share heir
  if (input.passiveDebtWon > 0n && totalDebtAllocated !== input.passiveDebtWon) {
    const diff = input.passiveDebtWon - totalDebtAllocated;
    const sorted = [...heirStates].sort((a, b) =>
      b.statutoryShareRate.compare(a.statutoryShareRate)
    );
    const topId = sorted[0].id;
    allocatedDebts.set(topId, (allocatedDebts.get(topId) ?? 0n) + diff);
  }

  input.trace.log({
    stepId: 'STEP3',
    titleKo: '상속채무 분할승계 산정',
    articleRefs: ['대법원 97다8809 판결', '민법 제1006조'],
    descriptionKo: `금전채무 총 ${input.passiveDebtWon.toLocaleString()}원은 상속재산분할 대상이 아니므로 각 상속인의 법정상속분율에 따라 승계 분담되었습니다. 초과특별수익자라도 법정비율대로 채무를 전액 부담합니다.`,
    metadata: { totalPassiveDebt: input.passiveDebtWon.toString() },
  });

  return {
    concreteSharesWon: finalConcreteShares,
    allocatedDebtsWon: allocatedDebts,
    deemedEstateWon,
  };
}

/**
 * Supreme Court 2017Seu98 Full Bench Decision Algorithm
 * If excess special benefit heir occurs, fix their share to 0, and apportion excess
 * among remaining non-excess heirs proportionally according to statutory share rates.
 */
export function balanceExcessSpecialBenefits(
  heirStates: HeirAdjustmentState[],
  totalActiveEstate: bigint,
  trace: StepTraceCollector
): Map<string, bigint> {
  const activeHeirs = [...heirStates];
  let loopCount = 0;

  while (loopCount < 20) {
    loopCount++;
    const excessHeirs = activeHeirs.filter(h => h.tentativeConcreteShare < 0n);
    if (excessHeirs.length === 0) {
      break; // All shares converged to >= 0
    }

    let totalExcess = 0n;
    for (const eh of excessHeirs) {
      totalExcess += -eh.tentativeConcreteShare;
      eh.tentativeConcreteShare = 0n;
      eh.isExcess = true;
    }

    const nonExcessHeirs = activeHeirs.filter(h => !h.isExcess);
    if (nonExcessHeirs.length === 0) {
      // All heirs have excess benefits -> all active shares are 0
      trace.log({
        stepId: 'STEP3',
        titleKo: '전체 상속인 초과특별수익 확정',
        articleRefs: ['대법원 2017스98 결정'],
        descriptionKo: '모든 상속인의 특별수익이 법정상속분을 초과하여 적극재산 구체적상속분은 전원 0원으로 확정되었습니다.',
        metadata: { loopCount },
      });
      break;
    }

    let nonExcessRateSum = new BigFraction(0, 1);
    for (const neh of nonExcessHeirs) {
      nonExcessRateSum = nonExcessRateSum.add(neh.statutoryShareRate);
    }

    // Apportion total excess among non-excess heirs
    for (const neh of nonExcessHeirs) {
      const relativeRatio = neh.statutoryShareRate.div(nonExcessRateSum);
      const deduction = (totalExcess * relativeRatio.numerator) / relativeRatio.denominator;
      neh.tentativeConcreteShare -= deduction;
    }

    trace.log({
      stepId: 'STEP3',
      titleKo: `초과특별수익 ${loopCount}차 안분 조정 (대법원 2017스98)`,
      articleRefs: ['대법원 2022. 8. 19.자 2017스98 결정'],
      descriptionKo: `발생한 초과특별수익 ${totalExcess.toLocaleString()}원을 비초과 상속인들의 법정비율에 따라 안분 공제하였습니다.`,
      metadata: { loopCount, totalExcess: totalExcess.toString(), remainingNonExcess: nonExcessHeirs.length },
    });
  }

  // Construct final concrete shares map
  const finalResult = new Map<string, bigint>();
  let assignedTotal = 0n;

  for (const h of heirStates) {
    const val = h.tentativeConcreteShare < 0n ? 0n : h.tentativeConcreteShare;
    finalResult.set(h.id, val);
    assignedTotal += val;
  }

  // If active estate remains and was assigned, adjust 1-won discrepancy to highest share heir
  if (totalActiveEstate > 0n && assignedTotal > 0n && assignedTotal !== totalActiveEstate) {
    const diff = totalActiveEstate - assignedTotal;
    const sorted = [...heirStates].sort((a, b) =>
      b.statutoryShareRate.compare(a.statutoryShareRate)
    );
    const topId = sorted[0].id;
    finalResult.set(topId, (finalResult.get(topId) ?? 0n) + diff);
  }

  return finalResult;
}
