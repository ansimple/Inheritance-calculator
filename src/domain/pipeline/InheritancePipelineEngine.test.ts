import { describe, it, expect } from 'vitest';
import { InheritancePipelineEngine } from './InheritancePipelineEngine';
import { PersonNode, RelationshipEdge } from '../models/Person';
import { EstateData } from '../models/Estate';

describe('InheritancePipelineEngine Full Legal Calculation Tests', () => {
  // Helper to create basic person
  function createPerson(overrides: Partial<PersonNode>): PersonNode {
    return {
      id: overrides.id || 'p_unknown',
      name: overrides.name || 'Unknown',
      gender: overrides.gender || 'MALE',
      isDeceased: overrides.isDeceased ?? false,
      deathDate: overrides.deathDate,
      isDisqualified: overrides.isDisqualified ?? false,
      hasDeprivation: overrides.hasDeprivation ?? false,
      hasRenounced: overrides.hasRenounced ?? false,
      adoptionType: overrides.adoptionType || 'NONE',
      remarriedBeforeOpening: overrides.remarriedBeforeOpening ?? false,
      birthYear: overrides.birthYear || 1980,
      contributionAmountWon: overrides.contributionAmountWon ?? 0n,
      specialBenefits: overrides.specialBenefits || [],
      bequests: overrides.bequests || [],
      canvasX: 0,
      canvasY: 0,
    };
  }

  it('Scenario 1: Standard Succession (Spouse 1.5 : Child 1.0 : Child 1.0)', () => {
    const deceased = createPerson({ id: 'dec', name: '고인', isDeceased: true });
    const spouse = createPerson({ id: 'sp', name: '배우자', gender: 'FEMALE' });
    const child1 = createPerson({ id: 'c1', name: '자녀1' });
    const child2 = createPerson({ id: 'c2', name: '자녀2' });

    const allPersons = new Map<string, PersonNode>([
      ['dec', deceased],
      ['sp', spouse],
      ['c1', child1],
      ['c2', child2],
    ]);

    const relationships: RelationshipEdge[] = [
      { id: 'r1', fromId: 'dec', toId: 'sp', type: 'SPOUSE' },
      { id: 'r2', fromId: 'dec', toId: 'c1', type: 'PARENT_CHILD' },
      { id: 'r3', fromId: 'dec', toId: 'c2', type: 'PARENT_CHILD' },
    ];

    const estate: EstateData = {
      openingDate: '2026-04-01',
      activeRealEstateWon: 500_000_000n,
      activeFinancialWon: 200_000_000n,
      activeOtherWon: 0n,
      passiveDebtWon: 0n, // Total 700,000,000 won
    };

    const result = InheritancePipelineEngine.execute({
      deceasedId: 'dec',
      allPersons,
      relationships,
      estate,
    });

    expect(result.heirResults).toHaveLength(3);
    const spResult = result.heirResults.find(h => h.personId === 'sp')!;
    const c1Result = result.heirResults.find(h => h.personId === 'c1')!;
    const c2Result = result.heirResults.find(h => h.personId === 'c2')!;

    // 700,000,000 * 3/7 = 300,000,000
    expect(spResult.statutoryShareRate.toFractionString()).toBe('3/7');
    expect(spResult.finalConcreteShareWon).toBe(300_000_000n);

    // 700,000,000 * 2/7 = 200,000,000 each
    expect(c1Result.statutoryShareRate.toFractionString()).toBe('2/7');
    expect(c1Result.finalConcreteShareWon).toBe(200_000_000n);

    expect(c2Result.statutoryShareRate.toFractionString()).toBe('2/7');
    expect(c2Result.finalConcreteShareWon).toBe(200_000_000n);

    // Sum matches active estate
    const sum = spResult.finalConcreteShareWon + c1Result.finalConcreteShareWon + c2Result.finalConcreteShareWon;
    expect(sum).toBe(700_000_000n);
  });

  it('Scenario 2: Supreme Court 2017Seu98 Excess Special Benefit Convergence Loop', () => {
    // Estate: 1,000,000,000 won
    // Heirs: Spouse (3/7), Child 1 (2/7), Child 2 (2/7)
    // Child 1 received 800,000,000 won gift in advance (Excess Benefit Heir)
    const deceased = createPerson({ id: 'dec', name: '고인', isDeceased: true });
    const spouse = createPerson({ id: 'sp', name: '배우자', gender: 'FEMALE' });
    const child1 = createPerson({
      id: 'c1',
      name: '초과수익자 자녀1',
      specialBenefits: [
        { id: 'g1', recipientId: 'c1', amountWon: 800_000_000n, giftDate: '2020-01-01', isContributionCompensation: false },
      ],
    });
    const child2 = createPerson({ id: 'c2', name: '자녀2' });

    const allPersons = new Map<string, PersonNode>([
      ['dec', deceased],
      ['sp', spouse],
      ['c1', child1],
      ['c2', child2],
    ]);

    const relationships: RelationshipEdge[] = [
      { id: 'r1', fromId: 'dec', toId: 'sp', type: 'SPOUSE' },
      { id: 'r2', fromId: 'dec', toId: 'c1', type: 'PARENT_CHILD' },
      { id: 'r3', fromId: 'dec', toId: 'c2', type: 'PARENT_CHILD' },
    ];

    const estate: EstateData = {
      openingDate: '2026-04-01',
      activeRealEstateWon: 1_000_000_000n,
      activeFinancialWon: 0n,
      activeOtherWon: 0n,
      passiveDebtWon: 0n,
    };

    const result = InheritancePipelineEngine.execute({
      deceasedId: 'dec',
      allPersons,
      relationships,
      estate,
    });

    const c1Result = result.heirResults.find(h => h.personId === 'c1')!;
    const spResult = result.heirResults.find(h => h.personId === 'sp')!;
    const c2Result = result.heirResults.find(h => h.personId === 'c2')!;

    // Child 1 is excess heir, concrete share MUST be 0
    expect(c1Result.finalConcreteShareWon).toBe(0n);

    // Remaining 1,000,000,000 won is apportioned between Spouse (3) and Child 2 (2) -> 3:2 ratio
    // Spouse: 1,000,000,000 * 3/5 = 600,000,000 won
    // Child 2: 1,000,000,000 * 2/5 = 400,000,000 won
    expect(spResult.finalConcreteShareWon).toBe(600_000_000n);
    expect(c2Result.finalConcreteShareWon).toBe(400_000_000n);

    // Total exactly 1,000,000,000 won
    expect(spResult.finalConcreteShareWon + c2Result.finalConcreteShareWon).toBe(1_000_000_000n);
  });

  it('Scenario 3: 2026 Civil Act Art. 1003 para 2 Revision - Spouse of Disqualified Person is Excluded from Representation', () => {
    // Deceased died on 2026-05-01
    // Child 1 is DISQUALIFIED (or DEPRIVED by court under Gu Hara Act)
    // Child 1 has Spouse (W) and Child (Grandchild GC)
    const deceased = createPerson({ id: 'dec', name: '고인', isDeceased: true });
    const child1 = createPerson({ id: 'c1', name: '결격자녀1', isDisqualified: true });
    const sonInLaw = createPerson({ id: 'sil', name: '사위', gender: 'MALE' });
    const grandChild = createPerson({ id: 'gc', name: '손자녀' });

    const allPersons = new Map<string, PersonNode>([
      ['dec', deceased],
      ['c1', child1],
      ['sil', sonInLaw],
      ['gc', grandChild],
    ]);

    const relationships: RelationshipEdge[] = [
      { id: 'r1', fromId: 'dec', toId: 'c1', type: 'PARENT_CHILD' },
      { id: 'r2', fromId: 'c1', toId: 'sil', type: 'SPOUSE' },
      { id: 'r3', fromId: 'c1', toId: 'gc', type: 'PARENT_CHILD' },
    ];

    const estate: EstateData = {
      openingDate: '2026-05-01',
      activeRealEstateWon: 500_000_000n,
      activeFinancialWon: 0n,
      activeOtherWon: 0n,
      passiveDebtWon: 0n,
    };

    // Under 2026 law:
    const result2026 = InheritancePipelineEngine.execute({
      deceasedId: 'dec',
      allPersons,
      relationships,
      estate,
    });

    // Grandchild inherits by representation (Art. 1001)
    expect(result2026.heirResults.some(h => h.personId === 'gc')).toBe(true);

    // Son-in-law is strictly EXCLUDED under 2026 revised Art. 1003 para 2!
    expect(result2026.heirResults.some(h => h.personId === 'sil')).toBe(false);

    // If opening date was in 2023 (prior law), Son-in-law was allowed to inherit
    const estate2023: EstateData = { ...estate, openingDate: '2023-01-01' };
    const result2023 = InheritancePipelineEngine.execute({
      deceasedId: 'dec',
      allPersons,
      relationships,
      estate: estate2023,
    });

    expect(result2023.heirResults.some(h => h.personId === 'sil')).toBe(true);
  });

  it('Scenario 4: Predeceased Spouse Remarriage Extinguishes Representation Right (Art. 775 para 2)', () => {
    // Child 1 died in 2020.
    // Child 1's spouse (Daughter-in-law) remarried in 2022.
    // Deceased died in 2026.
    const deceased = createPerson({ id: 'dec', name: '고인', isDeceased: true });
    const child1 = createPerson({ id: 'c1', name: '선사망자녀1', isDeceased: true, deathDate: '2020-01-01' });
    const dil = createPerson({ id: 'dil', name: '재혼한며느리', gender: 'FEMALE', remarriedBeforeOpening: true });
    const grandChild = createPerson({ id: 'gc', name: '손자녀' });

    const allPersons = new Map<string, PersonNode>([
      ['dec', deceased],
      ['c1', child1],
      ['dil', dil],
      ['gc', grandChild],
    ]);

    const relationships: RelationshipEdge[] = [
      { id: 'r1', fromId: 'dec', toId: 'c1', type: 'PARENT_CHILD' },
      { id: 'r2', fromId: 'c1', toId: 'dil', type: 'SPOUSE' },
      { id: 'r3', fromId: 'c1', toId: 'gc', type: 'PARENT_CHILD' },
    ];

    const estate: EstateData = {
      openingDate: '2026-05-01',
      activeRealEstateWon: 300_000_000n,
      activeFinancialWon: 0n,
      activeOtherWon: 0n,
      passiveDebtWon: 0n,
    };

    const result = InheritancePipelineEngine.execute({
      deceasedId: 'dec',
      allPersons,
      relationships,
      estate,
    });

    // Remarried spouse must be excluded because affinity relationship terminated!
    expect(result.heirResults.some(h => h.personId === 'dil')).toBe(false);
    // Grandchild inherits 100%
    const gcResult = result.heirResults.find(h => h.personId === 'gc')!;
    expect(gcResult.finalConcreteShareWon).toBe(300_000_000n);
  });

  it('Scenario 5: Supreme Court 97Da8809 - Excess Beneficiary Must Still Bear Debts Proportionately', () => {
    // Active Estate: 0 won. Debt: 70,000,000 won.
    // Heirs: Spouse (3/7), Child 1 (2/7), Child 2 (2/7)
    // Child 1 received 200,000,000 won gift in advance.
    const deceased = createPerson({ id: 'dec', name: '고인', isDeceased: true });
    const spouse = createPerson({ id: 'sp', name: '배우자', gender: 'FEMALE' });
    const child1 = createPerson({
      id: 'c1',
      name: '초과수익자 자녀1',
      specialBenefits: [{ id: 'g1', recipientId: 'c1', amountWon: 200_000_000n, giftDate: '2021-01-01', isContributionCompensation: false }],
    });
    const child2 = createPerson({ id: 'c2', name: '자녀2' });

    const allPersons = new Map<string, PersonNode>([
      ['dec', deceased],
      ['sp', spouse],
      ['c1', child1],
      ['c2', child2],
    ]);

    const relationships: RelationshipEdge[] = [
      { id: 'r1', fromId: 'dec', toId: 'sp', type: 'SPOUSE' },
      { id: 'r2', fromId: 'dec', toId: 'c1', type: 'PARENT_CHILD' },
      { id: 'r3', fromId: 'dec', toId: 'c2', type: 'PARENT_CHILD' },
    ];

    const estate: EstateData = {
      openingDate: '2026-05-01',
      activeRealEstateWon: 0n,
      activeFinancialWon: 0n,
      activeOtherWon: 0n,
      passiveDebtWon: 70_000_000n,
    };

    const result = InheritancePipelineEngine.execute({
      deceasedId: 'dec',
      allPersons,
      relationships,
      estate,
    });

    const c1Result = result.heirResults.find(h => h.personId === 'c1')!;
    const spResult = result.heirResults.find(h => h.personId === 'sp')!;
    const c2Result = result.heirResults.find(h => h.personId === 'c2')!;

    // Child 1 has 0 concrete active share
    expect(c1Result.finalConcreteShareWon).toBe(0n);

    // But MUST bear 2/7 of debt = 20,000,000 won!
    expect(c1Result.allocatedDebtWon).toBe(20_000_000n);
    expect(spResult.allocatedDebtWon).toBe(30_000_000n);
    expect(c2Result.allocatedDebtWon).toBe(20_000_000n);
  });

  it('Scenario 6: Constitutional Court 2020Heon-Ga4 - Sibling Reserved Share Comparison', () => {
    // Only siblings exist (Brother 1, Brother 2). Deceased gave all 600,000,000 won to Third Party.
    const deceased = createPerson({ id: 'dec', name: '고인', isDeceased: true });
    const brother1 = createPerson({ id: 'b1', name: '형제1' });
    const brother2 = createPerson({ id: 'b2', name: '형제2' });
    const parent = createPerson({ id: 'par', name: '부모', isDeceased: true });

    const allPersons = new Map<string, PersonNode>([
      ['dec', deceased],
      ['b1', brother1],
      ['b2', brother2],
      ['par', parent],
    ]);

    const relationships: RelationshipEdge[] = [
      { id: 'r1', fromId: 'par', toId: 'dec', type: 'PARENT_CHILD' },
      { id: 'r2', fromId: 'par', toId: 'b1', type: 'PARENT_CHILD' },
      { id: 'r3', fromId: 'par', toId: 'b2', type: 'PARENT_CHILD' },
    ];

    const estate: EstateData = {
      openingDate: '2026-05-01', // Post CC
      activeRealEstateWon: 0n,
      activeFinancialWon: 0n,
      activeOtherWon: 0n,
      passiveDebtWon: 0n,
    };

    // Under 2026 policy: Sibling reserve is 0
    const result2026 = InheritancePipelineEngine.execute({
      deceasedId: 'dec',
      allPersons,
      relationships,
      estate,
    });
    const b1Result2026 = result2026.heirResults.find(h => h.personId === 'b1')!;
    expect(b1Result2026.reserveShortageWon).toBe(0n);

    // Under 2023 policy (Pre CC): Sibling reserve was 1/3 of statutory share
    const result2023 = InheritancePipelineEngine.execute({
      deceasedId: 'dec',
      allPersons,
      relationships,
      estate: { ...estate, openingDate: '2023-01-01', activeRealEstateWon: 600_000_000n },
    });
    const b1Result2023 = result2023.heirResults.find(h => h.personId === 'b1')!;
    // Statutory share = 1/2 = 300,000,000 won
    // Reserve rate = 1/3 -> 100,000,000 won
    expect(b1Result2023.reserveShortageWon).toBe(0n); // Since he gets 300m in estate
  });

  it('Scenario 7: 2026 Proviso - Contribution Compensation Gift Excluded from Special Benefits', () => {
    // Child 1 took care of ill parent for 10 years, parent gave 100,000,000 won as contribution compensation.
    // Child 2 claims it as special benefit.
    // Under 2026 Civil Act Art. 1008 proviso, it is EXCLUDED!
    const deceased = createPerson({ id: 'dec', name: '고인', isDeceased: true });
    const child1 = createPerson({
      id: 'c1',
      name: '병간호자녀1',
      specialBenefits: [
        { id: 'g1', recipientId: 'c1', amountWon: 100_000_000n, giftDate: '2025-01-01', isContributionCompensation: true },
      ],
    });
    const child2 = createPerson({ id: 'c2', name: '자녀2' });

    const allPersons = new Map<string, PersonNode>([
      ['dec', deceased],
      ['c1', child1],
      ['c2', child2],
    ]);

    const relationships: RelationshipEdge[] = [
      { id: 'r1', fromId: 'dec', toId: 'c1', type: 'PARENT_CHILD' },
      { id: 'r2', fromId: 'dec', toId: 'c2', type: 'PARENT_CHILD' },
    ];

    const estate: EstateData = {
      openingDate: '2026-05-01',
      activeRealEstateWon: 200_000_000n,
      activeFinancialWon: 0n,
      activeOtherWon: 0n,
      passiveDebtWon: 0n,
    };

    const result = InheritancePipelineEngine.execute({
      deceasedId: 'dec',
      allPersons,
      relationships,
      estate,
    });

    const c1Result = result.heirResults.find(h => h.personId === 'c1')!;
    const c2Result = result.heirResults.find(h => h.personId === 'c2')!;

    // Because the 100m gift is excluded from special benefits, the 200m active estate is divided equally (100m each)
    expect(c1Result.finalConcreteShareWon).toBe(100_000_000n);
    expect(c2Result.finalConcreteShareWon).toBe(100_000_000n);
  });

  it('Scenario 8: Contribution Limit Exceeded Proportional Reduction (Civil Act Art. 1008-2 para 2)', () => {
    // Active Estate: 300,000,000 won. Bequest to Child 1: 100,000,000 won.
    // Contribution Limit = 300,000,000 - 100,000,000 = 200,000,000 won.
    // Child 1 claims 200,000,000 won contribution, Child 2 claims 200,000,000 won contribution (Total 400m).
    // Both must be scaled down proportionally (1:1) to 100,000,000 won each!
    const deceased = createPerson({ id: 'dec', name: '고인', isDeceased: true });
    const child1 = createPerson({
      id: 'c1',
      name: '자녀1',
      contributionAmountWon: 200_000_000n,
      bequests: [{ id: 'b1', recipientId: 'c1', amountWon: 100_000_000n }],
    });
    const child2 = createPerson({
      id: 'c2',
      name: '자녀2',
      contributionAmountWon: 200_000_000n,
    });

    const allPersons = new Map<string, PersonNode>([
      ['dec', deceased],
      ['c1', child1],
      ['c2', child2],
    ]);

    const relationships: RelationshipEdge[] = [
      { id: 'r1', fromId: 'dec', toId: 'c1', type: 'PARENT_CHILD' },
      { id: 'r2', fromId: 'dec', toId: 'c2', type: 'PARENT_CHILD' },
    ];

    const estate: EstateData = {
      openingDate: '2026-06-01',
      activeRealEstateWon: 300_000_000n,
      activeFinancialWon: 0n,
      activeOtherWon: 0n,
      passiveDebtWon: 0n,
    };

    const result = InheritancePipelineEngine.execute({
      deceasedId: 'dec',
      allPersons,
      relationships,
      estate,
    });

    // Check trace logs for contribution adjustment
    const contributionTrace = result.traces.find(t => t.titleKo === '기여분 법정한도 초과 비례 조정');
    expect(contributionTrace).toBeDefined();

    // Sum of shares must equal total active estate (300,000,000 won)
    const totalConcrete = result.heirResults.reduce((acc, h) => acc + h.finalConcreteShareWon, 0n);
    expect(totalConcrete).toBe(300_000_000n);
  });

  it('Scenario 9: Complex Representation Inheritance Fraction (Spouse 1.5 : Child A 1.0 : Predeceased Child B Group [W 1.5, GC1 1.0, GC2 1.0])', () => {
    // Primary: Spouse (3/7), Child A (2/7), Predeceased Child B (2/7)
    // Predeceased Child B's branch share (2/7) is divided among Widow (3/7), Grandchild 1 (2/7), Grandchild 2 (2/7):
    // Widow = (2/7) * (3/7) = 6/49
    // GC1 = (2/7) * (2/7) = 4/49
    // GC2 = (2/7) * (2/7) = 4/49
    const deceased = createPerson({ id: 'dec', name: '고인', isDeceased: true });
    const spouse = createPerson({ id: 'sp', name: '배우자', gender: 'FEMALE' });
    const childA = createPerson({ id: 'ca', name: '자녀A' });
    const childB = createPerson({ id: 'cb', name: '선사망자녀B', isDeceased: true });
    const widowB = createPerson({ id: 'wb', name: '자녀B의배우자', gender: 'FEMALE' });
    const gc1 = createPerson({ id: 'gc1', name: '손자녀1' });
    const gc2 = createPerson({ id: 'gc2', name: '손자녀2' });

    const allPersons = new Map<string, PersonNode>([
      ['dec', deceased],
      ['sp', spouse],
      ['ca', childA],
      ['cb', childB],
      ['wb', widowB],
      ['gc1', gc1],
      ['gc2', gc2],
    ]);

    const relationships: RelationshipEdge[] = [
      { id: 'r1', fromId: 'dec', toId: 'sp', type: 'SPOUSE' },
      { id: 'r2', fromId: 'dec', toId: 'ca', type: 'PARENT_CHILD' },
      { id: 'r3', fromId: 'dec', toId: 'cb', type: 'PARENT_CHILD' },
      { id: 'r4', fromId: 'cb', toId: 'wb', type: 'SPOUSE' },
      { id: 'r5', fromId: 'cb', toId: 'gc1', type: 'PARENT_CHILD' },
      { id: 'r6', fromId: 'cb', toId: 'gc2', type: 'PARENT_CHILD' },
    ];

    const estate: EstateData = {
      openingDate: '2026-06-01',
      activeRealEstateWon: 490_000_000n,
      activeFinancialWon: 0n,
      activeOtherWon: 0n,
      passiveDebtWon: 0n,
    };

    const result = InheritancePipelineEngine.execute({
      deceasedId: 'dec',
      allPersons,
      relationships,
      estate,
    });

    const spResult = result.heirResults.find(h => h.personId === 'sp')!;
    const caResult = result.heirResults.find(h => h.personId === 'ca')!;
    const wbResult = result.heirResults.find(h => h.personId === 'wb')!;
    const gc1Result = result.heirResults.find(h => h.personId === 'gc1')!;
    const gc2Result = result.heirResults.find(h => h.personId === 'gc2')!;

    // Spouse: 3/7 = 21/49 -> 490m * 21/49 = 210,000,000 won
    expect(spResult.statutoryShareRate.toFractionString()).toBe('3/7');
    expect(spResult.finalConcreteShareWon).toBe(210_000_000n);

    // Child A: 2/7 = 14/49 -> 490m * 14/49 = 140,000,000 won
    expect(caResult.statutoryShareRate.toFractionString()).toBe('2/7');
    expect(caResult.finalConcreteShareWon).toBe(140_000_000n);

    // Widow B: 6/49 -> 490m * 6/49 = 60,000,000 won
    expect(wbResult.statutoryShareRate.toFractionString()).toBe('6/49');
    expect(wbResult.finalConcreteShareWon).toBe(60_000_000n);

    // GC1, GC2: 4/49 each -> 490m * 4/49 = 40,000,000 won
    expect(gc1Result.statutoryShareRate.toFractionString()).toBe('4/49');
    expect(gc1Result.finalConcreteShareWon).toBe(40_000_000n);

    expect(gc2Result.statutoryShareRate.toFractionString()).toBe('4/49');
    expect(gc2Result.finalConcreteShareWon).toBe(40_000_000n);

    // 210m + 140m + 60m + 40m + 40m = 490m
    const total = spResult.finalConcreteShareWon + caResult.finalConcreteShareWon +
                  wbResult.finalConcreteShareWon + gc1Result.finalConcreteShareWon + gc2Result.finalConcreteShareWon;
    expect(total).toBe(490_000_000n);
  });

  it('Scenario 10: Renunciation of Inheritance by One Co-heir Accrues to Remaining Heirs Proportionately', () => {
    // 3 Children. Child 3 renounces inheritance (hasRenounced = true).
    // Remaining Children 1 & 2 divide 50% each.
    const deceased = createPerson({ id: 'dec', name: '고인', isDeceased: true });
    const child1 = createPerson({ id: 'c1', name: '자녀1' });
    const child2 = createPerson({ id: 'c2', name: '자녀2' });
    const child3 = createPerson({ id: 'c3', name: '상속포기자녀3', hasRenounced: true });

    const allPersons = new Map<string, PersonNode>([
      ['dec', deceased],
      ['c1', child1],
      ['c2', child2],
      ['c3', child3],
    ]);

    const relationships: RelationshipEdge[] = [
      { id: 'r1', fromId: 'dec', toId: 'c1', type: 'PARENT_CHILD' },
      { id: 'r2', fromId: 'dec', toId: 'c2', type: 'PARENT_CHILD' },
      { id: 'r3', fromId: 'dec', toId: 'c3', type: 'PARENT_CHILD' },
    ];

    const estate: EstateData = {
      openingDate: '2026-06-01',
      activeRealEstateWon: 600_000_000n,
      activeFinancialWon: 0n,
      activeOtherWon: 0n,
      passiveDebtWon: 0n,
    };

    const result = InheritancePipelineEngine.execute({
      deceasedId: 'dec',
      allPersons,
      relationships,
      estate,
    });

    expect(result.heirResults).toHaveLength(2);
    const c1Result = result.heirResults.find(h => h.personId === 'c1')!;
    const c2Result = result.heirResults.find(h => h.personId === 'c2')!;

    expect(c1Result.statutoryShareRate.toFractionString()).toBe('1/2');
    expect(c2Result.statutoryShareRate.toFractionString()).toBe('1/2');

    expect(c1Result.finalConcreteShareWon).toBe(300_000_000n);
    expect(c2Result.finalConcreteShareWon).toBe(300_000_000n);
  });

  it('Scenario 11: 2026 Legal Reserve Cash Return Settlement Order (Bequest first, then Gifts)', () => {
    // Active Estate: 20,000,000 won (low remaining estate)
    // Heirs: Child 1, Child 2. Statutory share: 1/2 each. Reserve rate: 1/2 of statutory = 1/4 each.
    // Deceased gave Bequest of 100,000,000 won to Child 1, and prior Gift of 200,000,000 won to Child 1.
    // Base estate = 20m (active) + 200m (gift) = 220,000,000 won.
    // Reserve target for Child 2 = 220m * 1/4 = 55,000,000 won.
    // Child 2 concrete share = 20,000,000 won.
    // Child 2 Shortage = 55m - 20m = 35,000,000 won.
    // Return order: Child 1's bequest (100m) covers the 35m first.
    const deceased = createPerson({ id: 'dec', name: '고인', isDeceased: true });
    const child1 = createPerson({
      id: 'c1',
      name: '수유자 자녀1',
      bequests: [{ id: 'b1', recipientId: 'c1', amountWon: 100_000_000n }],
      specialBenefits: [{ id: 'g1', recipientId: 'c1', amountWon: 200_000_000n, giftDate: '2024-01-01', isContributionCompensation: false }],
    });
    const child2 = createPerson({ id: 'c2', name: '자녀2' });

    const allPersons = new Map<string, PersonNode>([
      ['dec', deceased],
      ['c1', child1],
      ['c2', child2],
    ]);

    const relationships: RelationshipEdge[] = [
      { id: 'r1', fromId: 'dec', toId: 'c1', type: 'PARENT_CHILD' },
      { id: 'r2', fromId: 'dec', toId: 'c2', type: 'PARENT_CHILD' },
    ];

    const estate: EstateData = {
      openingDate: '2026-06-01',
      activeRealEstateWon: 20_000_000n,
      activeFinancialWon: 0n,
      activeOtherWon: 0n,
      passiveDebtWon: 0n,
    };

    const result = InheritancePipelineEngine.execute({
      deceasedId: 'dec',
      allPersons,
      relationships,
      estate,
    });

    const c2Result = result.heirResults.find(h => h.personId === 'c2')!;
    const c1Result = result.heirResults.find(h => h.personId === 'c1')!;

    // Child 2 shortage: 55m - 20m = 35,000,000 won
    expect(c2Result.reserveShortageWon).toBe(35_000_000n);
    // Child 1 has obligation to compensate 35,000,000 won in cash
    expect(c1Result.reserveCompensationObligationWon).toBe(35_000_000n);

    // Verify compensation flows exist and correctly reflect cash return
    expect(result.reserveSettlement.compensationFlows).toHaveLength(1);
    const flow = result.reserveSettlement.compensationFlows[0];
    expect(flow.fromPersonId).toBe('c1');
    expect(flow.toPersonId).toBe('c2');
    expect(flow.amountWon).toBe(35_000_000n);
    expect(flow.isMonetary).toBe(true);
  });

  it('Scenario 12: 2nd Priority Succession (Spouse 1.5 : Father 1.0 : Mother 1.0 -> 3/7 : 2/7 : 2/7)', () => {
    // No children. Spouse and parents survive.
    const deceased = createPerson({ id: 'dec', name: '고인', isDeceased: true });
    const spouse = createPerson({ id: 'sp', name: '배우자', gender: 'FEMALE' });
    const father = createPerson({ id: 'fa', name: '부', gender: 'MALE' });
    const mother = createPerson({ id: 'mo', name: '모', gender: 'FEMALE' });

    const allPersons = new Map<string, PersonNode>([
      ['dec', deceased],
      ['sp', spouse],
      ['fa', father],
      ['mo', mother],
    ]);

    const relationships: RelationshipEdge[] = [
      { id: 'r1', fromId: 'dec', toId: 'sp', type: 'SPOUSE' },
      { id: 'r2', fromId: 'fa', toId: 'dec', type: 'PARENT_CHILD' },
      { id: 'r3', fromId: 'mo', toId: 'dec', type: 'PARENT_CHILD' },
    ];

    const estate: EstateData = {
      openingDate: '2026-06-01',
      activeRealEstateWon: 700_000_000n,
      activeFinancialWon: 0n,
      activeOtherWon: 0n,
      passiveDebtWon: 0n,
    };

    const result = InheritancePipelineEngine.execute({
      deceasedId: 'dec',
      allPersons,
      relationships,
      estate,
    });

    expect(result.heirResults).toHaveLength(3);
    const spResult = result.heirResults.find(h => h.personId === 'sp')!;
    const faResult = result.heirResults.find(h => h.personId === 'fa')!;
    const moResult = result.heirResults.find(h => h.personId === 'mo')!;

    expect(spResult.statutoryShareRate.toFractionString()).toBe('3/7');
    expect(faResult.statutoryShareRate.toFractionString()).toBe('2/7');
    expect(moResult.statutoryShareRate.toFractionString()).toBe('2/7');

    expect(spResult.finalConcreteShareWon).toBe(300_000_000n);
    expect(faResult.finalConcreteShareWon).toBe(200_000_000n);
    expect(moResult.finalConcreteShareWon).toBe(200_000_000n);
  });

  it('Scenario 13: Deprivation of Succession (Goo Hara Law) Excludes Neglectful Parent from 2nd Priority', () => {
    // Deceased has no children. Surviving: Mother (cared for deceased), Father (abandoned, declared deprived hasDeprivation = true).
    const deceased = createPerson({ id: 'dec', name: '고인', isDeceased: true });
    const mother = createPerson({ id: 'mo', name: '모친' });
    const father = createPerson({ id: 'fa', name: '양육방기부친', hasDeprivation: true });

    const allPersons = new Map<string, PersonNode>([
      ['dec', deceased],
      ['mo', mother],
      ['fa', father],
    ]);

    const relationships: RelationshipEdge[] = [
      { id: 'r1', fromId: 'fa', toId: 'dec', type: 'PARENT_CHILD' },
      { id: 'r2', fromId: 'mo', toId: 'dec', type: 'PARENT_CHILD' },
    ];

    const estate: EstateData = {
      openingDate: '2026-06-01',
      activeRealEstateWon: 500_000_000n,
      activeFinancialWon: 0n,
      activeOtherWon: 0n,
      passiveDebtWon: 0n,
    };

    const result = InheritancePipelineEngine.execute({
      deceasedId: 'dec',
      allPersons,
      relationships,
      estate,
    });

    // Only mother is the sole heir (100% = 500m)
    expect(result.heirResults).toHaveLength(1);
    const moResult = result.heirResults.find(h => h.personId === 'mo')!;
    expect(moResult.statutoryShareRate.toFractionString()).toBe('1');
    expect(moResult.finalConcreteShareWon).toBe(500_000_000n);
  });

  it('Scenario 14: Sole Succession by Spouse when Neither Descendants Nor Ascendants Exist (Civil Act Art. 1003 para 1 proviso)', () => {
    // Only spouse exists; deceased's parents are deceased; siblings exist but are superseded by spouse sole succession
    const deceased = createPerson({ id: 'dec', name: '고인', isDeceased: true });
    const spouse = createPerson({ id: 'sp', name: '배우자' });
    const sibling = createPerson({ id: 'sib', name: '형제' });
    const father = createPerson({ id: 'fa', name: '부친', isDeceased: true });

    const allPersons = new Map<string, PersonNode>([
      ['dec', deceased],
      ['sp', spouse],
      ['sib', sibling],
      ['fa', father],
    ]);

    const relationships: RelationshipEdge[] = [
      { id: 'r1', fromId: 'dec', toId: 'sp', type: 'SPOUSE' },
      { id: 'r2', fromId: 'fa', toId: 'dec', type: 'PARENT_CHILD' },
      { id: 'r3', fromId: 'fa', toId: 'sib', type: 'PARENT_CHILD' },
    ];

    const estate: EstateData = {
      openingDate: '2026-06-01',
      activeRealEstateWon: 1_000_000_000n,
      activeFinancialWon: 0n,
      activeOtherWon: 0n,
      passiveDebtWon: 0n,
    };

    const result = InheritancePipelineEngine.execute({
      deceasedId: 'dec',
      allPersons,
      relationships,
      estate,
    });

    // Spouse inherits 100%; sibling is completely excluded
    expect(result.heirResults).toHaveLength(1);
    const spResult = result.heirResults.find(h => h.personId === 'sp')!;
    expect(spResult.statutoryShareRate.toFractionString()).toBe('1');
    expect(spResult.finalConcreteShareWon).toBe(1_000_000_000n);
  });

  it('Scenario 15: Ordinary Adopted Child vs Full Adopted Child Succession Eligibility', () => {
    // Biological child A, Ordinary adopted child B (retains succession right),
    // Full adopted out child C (adoptionType = FULL_ADOPTED, severed biological relationship)
    const deceased = createPerson({ id: 'dec', name: '고인', isDeceased: true });
    const childA = createPerson({ id: 'ca', name: '친생자A' });
    const childB = createPerson({ id: 'cb', name: '일반양자B', adoptionType: 'ORDINARY_ADOPTED' });
    const childC = createPerson({ id: 'cc', name: '친양자입양간자녀C', adoptionType: 'FULL_ADOPTED' });

    const allPersons = new Map<string, PersonNode>([
      ['dec', deceased],
      ['ca', childA],
      ['cb', childB],
      ['cc', childC],
    ]);

    const relationships: RelationshipEdge[] = [
      { id: 'r1', fromId: 'dec', toId: 'ca', type: 'PARENT_CHILD' },
      { id: 'r2', fromId: 'dec', toId: 'cb', type: 'PARENT_CHILD' },
      { id: 'r3', fromId: 'dec', toId: 'cc', type: 'PARENT_CHILD' },
    ];

    const estate: EstateData = {
      openingDate: '2026-06-01',
      activeRealEstateWon: 400_000_000n,
      activeFinancialWon: 0n,
      activeOtherWon: 0n,
      passiveDebtWon: 0n,
    };

    const result = InheritancePipelineEngine.execute({
      deceasedId: 'dec',
      allPersons,
      relationships,
      estate,
    });

    // Only A and B inherit (each 1/2 = 200m), C is excluded
    expect(result.heirResults).toHaveLength(2);
    const caResult = result.heirResults.find(h => h.personId === 'ca')!;
    const cbResult = result.heirResults.find(h => h.personId === 'cb')!;

    expect(caResult.statutoryShareRate.toFractionString()).toBe('1/2');
    expect(cbResult.statutoryShareRate.toFractionString()).toBe('1/2');
    expect(caResult.finalConcreteShareWon).toBe(200_000_000n);
    expect(cbResult.finalConcreteShareWon).toBe(200_000_000n);
  });
});
