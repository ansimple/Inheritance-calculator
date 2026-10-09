import { InheritancePolicy } from './InheritancePolicy';
import { PersonNode } from '../models/Person';
import { BigFraction } from '../math/BigFraction';

export class Policy2024PostCC implements InheritancePolicy {
  readonly version = '2024_POST_CC';
  readonly nameKo = '2024년 4월 25일 ~ 2026년 3월 16일 법률 정책 (헌재 결정 후)';
  readonly descriptionKo = '헌법재판소 전원재판부 2020헌가4 결정(2024.4.25)에 따라 형제자매 유류분이 즉시 무효화되었으며, 기여보상 증여의 특별수익 제외가 소급 적용됩니다.';

  readonly isSiblingReserveValid = false;
  readonly excludeSpouseOfDisqualifiedFromRepresentation = false;
  readonly excludeContributionCompensationFromSpecialBenefits = true;
  readonly isMonetaryReserveReturnMandatory = false;

  getReserveRate(
    _person: PersonNode,
    statutoryShareRate: BigFraction,
    heirOrder: '1ST' | '2ND' | '3RD' | 'SPOUSE'
  ): BigFraction {
    if (heirOrder === '1ST' || heirOrder === 'SPOUSE') {
      return statutoryShareRate.mul(new BigFraction(1, 2));
    }
    if (heirOrder === '2ND') {
      return statutoryShareRate.mul(new BigFraction(1, 3));
    }
    // Sibling reserve share is completely void (0)
    return new BigFraction(0, 1);
  }
}
