export interface EstateData {
  openingDate: string; // YYYY-MM-DD
  activeRealEstateWon: bigint;
  activeFinancialWon: bigint;
  activeOtherWon: bigint;
  passiveDebtWon: bigint;
}

export function getTotalActiveEstate(estate: EstateData): bigint {
  return estate.activeRealEstateWon + estate.activeFinancialWon + estate.activeOtherWon;
}
