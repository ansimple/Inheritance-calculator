import { InheritancePolicy } from './InheritancePolicy';
import { Policy2000To2024 } from './Policy2000To2024';
import { Policy2024PostCC } from './Policy2024PostCC';
import { Policy2026NewCivil } from './Policy2026NewCivil';

export class PolicyRegistry {
  private static readonly policy2000 = new Policy2000To2024();
  private static readonly policy2024 = new Policy2024PostCC();
  private static readonly policy2026 = new Policy2026NewCivil();

  /**
   * Resolves the legal policy matching the succession opening date.
   * @param openingDate Date string in format 'YYYY-MM-DD'
   */
  static getPolicy(openingDate: string): InheritancePolicy {
    // 2026-03-17 and onwards
    if (openingDate >= '2026-03-17') {
      return this.policy2026;
    }
    // 2024-04-25 ~ 2026-03-16
    if (openingDate >= '2024-04-25') {
      return this.policy2024;
    }
    // 2000-01-01 ~ 2024-04-24
    return this.policy2000;
  }
}
