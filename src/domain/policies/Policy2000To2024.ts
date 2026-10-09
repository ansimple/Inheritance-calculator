import { InheritancePolicy } from './InheritancePolicy';
import { PersonNode } from '../models/Person';
import { BigFraction } from '../math/BigFraction';

export class Policy2000To2024 implements InheritancePolicy {
  readonly version = '2000_TO_2024';
  readonly nameKo = '2000년 ~ 2024년 4월 24일 법률 정책 (구법)';
  readonly descriptionKo = '헌재 위헌 결정 및 2026년 대개정 이전의 구 민법 정책입니다. 형제자매 유류분이 유효하며, 유류분 반환은 원물반환 원칙입니다.';

  readonly isSiblingReserveValid = true;
  readonly excludeSpouseOfDisqualifiedFromRepresentation = false;
  readonly excludeContributionCompensationFromSpecialBenefits = false;
  readonly isMonetaryReserveReturnMandatory = false;

  getReserveRate(
    _person: PersonNode,
    statutoryShareRate: BigFraction,
    heirOrder: '1ST' | '2ND' | '3RD' | 'SPOUSE'
  ): BigFraction {
    if (heirOrder === '1ST' || heirOrder === 'SPOUSE') {
      // 1/2 of statutory share
      return statutoryShareRate.mul(new BigFraction(1, 2));
    }
    if (heirOrder === '2ND' || heirOrder === '3RD') {
      // 1/3 of statutory share (siblings included under past law)
      return statutoryShareRate.mul(new BigFraction(1, 3));
    }
    return new BigFraction(0, 1);
  }
}
