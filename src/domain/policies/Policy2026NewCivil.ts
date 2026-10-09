import { InheritancePolicy } from './InheritancePolicy';
import { PersonNode } from '../models/Person';
import { BigFraction } from '../math/BigFraction';

export class Policy2026NewCivil implements InheritancePolicy {
  readonly version = '2026_NEW_CIVIL';
  readonly nameKo = '2026년 3월 17일 전면 개정 민법 정책 (법률 제21454호)';
  readonly descriptionKo = '구하라법 상속권 상실 선고 제도 정착, 결격자·상속권상실자의 배우자 대습상속 배제, 유류분 전면 가액(금전)반환 전환이 적용된 최신 법률 정책입니다.';

  readonly isSiblingReserveValid = false;
  readonly excludeSpouseOfDisqualifiedFromRepresentation = true;
  readonly excludeContributionCompensationFromSpecialBenefits = true;
  readonly isMonetaryReserveReturnMandatory = true;

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
    return new BigFraction(0, 1);
  }
}
