export type Gender = 'MALE' | 'FEMALE';

/**
 * Adoption relationship classification
 * - NONE: Biological child
 * - ORDINARY_ADOPTED: Ordinary adopted child (maintains inheritance from both biological and adoptive parents)
 * - FULL_ADOPTED: Special fully adopted child (親養子, biological ties severed, inherits only from adoptive parents)
 */
export type AdoptionType = 'NONE' | 'ORDINARY_ADOPTED' | 'FULL_ADOPTED';

export type RelationshipType = 'SPOUSE' | 'PARENT_CHILD';

export type HeirStatus =
  | 'VALID_HEIR'
  | 'REPRESENTATIVE_HEIR'
  | 'DISQUALIFIED'
  | 'DEPRIVED'
  | 'RENOUNCED'
  | 'EXCLUDED_BY_PRIORITY';

export interface GiftItem {
  id: string;
  recipientId: string;
  amountWon: bigint;
  giftDate: string; // YYYY-MM-DD
  isContributionCompensation: boolean; // 2026 Civil Act Art. 1008 proviso
  description?: string;
}

export interface BequestItem {
  id: string;
  recipientId: string;
  amountWon: bigint;
  description?: string;
}

export interface PersonNode {
  id: string;
  name: string;
  gender: Gender;
  isDeceased: boolean;
  deathDate?: string;
  isDisqualified: boolean;
  hasDeprivation: boolean;
  hasRenounced: boolean;
  adoptionType: AdoptionType;
  remarriedBeforeOpening: boolean; // Civil Act Art. 775 para 2
  birthYear?: number;
  contributionAmountWon: bigint;
  specialBenefits: GiftItem[];
  bequests: BequestItem[];
  canvasX: number;
  canvasY: number;
}

export interface RelationshipEdge {
  id: string;
  fromId: string;
  toId: string;
  type: RelationshipType;
  isDivorced?: boolean;
}
