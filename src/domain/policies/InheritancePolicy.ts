import { PersonNode } from '../models/Person';
import { BigFraction } from '../math/BigFraction';

export type PolicyVersion = '2000_TO_2024' | '2024_POST_CC' | '2026_NEW_CIVIL';

export interface InheritancePolicy {
  readonly version: PolicyVersion;
  readonly nameKo: string;
  readonly descriptionKo: string;

  /**
   * Whether sibling reserved share is legally valid.
   * - 2000 ~ 2024.04.24: true (1/3)
   * - 2024.04.25 ~: false (0, Unconstitutional by Constitutional Court 2020Heon-Ga4)
   */
  readonly isSiblingReserveValid: boolean;

  /**
   * Whether spouse of a disqualified/deprived person is excluded from representative succession.
   * - Civil Act Art. 1003 para 2 revised (enforced 2026.03.17, Law No. 21454)
   */
  readonly excludeSpouseOfDisqualifiedFromRepresentation: boolean;

  /**
   * Whether gifts given as compensation for special contribution are excluded from special benefits.
   * - Civil Act Art. 1008 proviso (retroactively applied to successions after 2024.04.25)
   */
  readonly excludeContributionCompensationFromSpecialBenefits: boolean;

  /**
   * Whether legal reserve return is strictly monetary (cash compensation).
   * - Civil Act Art. 1115 para 1 revised (enforced 2026.03.17, Law No. 21454)
   */
  readonly isMonetaryReserveReturnMandatory: boolean;

  /**
   * Calculates the statutory reserve rate fraction for a given person.
   */
  getReserveRate(person: PersonNode, statutoryShareRate: BigFraction, heirOrder: '1ST' | '2ND' | '3RD' | 'SPOUSE'): BigFraction;
}
