import { BigFraction } from '../math/BigFraction';
import { HeirStatus } from './Person';

export interface StepTraceItem {
  readonly stepId: 'STEP1' | 'STEP2' | 'STEP3' | 'STEP4';
  readonly titleKo: string;
  readonly articleRefs: string[];
  readonly descriptionKo: string;
  readonly formulaText?: string;
  readonly metadata?: Record<string, unknown>;
  readonly timestamp: number;
}

export interface HeirCalculationResult {
  personId: string;
  name: string;
  status: HeirStatus;
  statutoryShareRate: BigFraction;
  tentativeConcreteShareWon: bigint;
  finalConcreteShareWon: bigint;
  allocatedDebtWon: bigint;
  netInheritanceWon: bigint;
  reserveShortageWon: bigint;
  reserveCompensationObligationWon: bigint;
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

export interface ReserveSettlementResult {
  baseEstateWon: bigint;
  compensationFlows: CompensationFlow[];
}

export interface PipelineExecutionResult {
  readonly openingDate: string;
  readonly policyVersion: string;
  readonly heirResults: HeirCalculationResult[];
  readonly deemedEstateWon: bigint;
  readonly reserveSettlement: ReserveSettlementResult;
  readonly traces: StepTraceItem[];
}
