import { PersonNode, RelationshipEdge } from '../models/Person';
import { EstateData, getTotalActiveEstate } from '../models/Estate';
import { PipelineExecutionResult, HeirCalculationResult } from '../models/PipelineResult';
import { PolicyRegistry } from '../policies/PolicyRegistry';
import { StepTraceCollector } from './StepTraceCollector';
import { determineHeirs } from './Step1HeirDetermination';
import { calculateStatutoryShareRates } from './Step2StatutoryShares';
import { executeStep3ConcreteShares } from './Step3ConcreteShares';
import { executeStep4ReserveSettlement } from './Step4ReserveSettlement';

export interface PipelineExecutionInput {
  deceasedId: string;
  allPersons: Map<string, PersonNode>;
  relationships: RelationshipEdge[];
  estate: EstateData;
}

export class InheritancePipelineEngine {
  /**
   * Executes the complete 4-step inheritance & reserved share calculation pipeline.
   */
  static execute(input: PipelineExecutionInput): PipelineExecutionResult {
    const trace = new StepTraceCollector();
    const policy = PolicyRegistry.getPolicy(input.estate.openingDate);

    trace.log({
      stepId: 'STEP1',
      titleKo: '상속 계산 파이프라인 개시',
      articleRefs: ['민법 상속편 (제997조 ~ 제1118조)'],
      descriptionKo: `상속개시일(${input.estate.openingDate}) 기준 [${policy.nameKo}]이 적용되어 파이프라인 연산이 시작되었습니다.`,
      metadata: { openingDate: input.estate.openingDate, policyVersion: policy.version },
    });

    const deceased = input.allPersons.get(input.deceasedId);
    if (!deceased) {
      throw new Error(`Deceased person with ID ${input.deceasedId} not found.`);
    }

    // Step 1: Heir Determination
    const step1Result = determineHeirs({
      deceased,
      allPersons: input.allPersons,
      relationships: input.relationships,
      openingDate: input.estate.openingDate,
      policy,
      trace,
    });

    // Step 2: Statutory Shares Fraction
    const statutoryShares = calculateStatutoryShareRates({
      deceased,
      heirStatuses: step1Result.heirStatuses,
      representativeMap: step1Result.representativeMap,
      allPersons: input.allPersons,
      relationships: input.relationships,
      trace,
    });

    const totalActiveWon = getTotalActiveEstate(input.estate);

    // Step 3: Concrete Shares & Excess Convergence (Supreme Court 2017Seu98)
    const step3Result = executeStep3ConcreteShares({
      activeEstateWon: totalActiveWon,
      passiveDebtWon: input.estate.passiveDebtWon,
      heirRates: statutoryShares,
      allPersons: input.allPersons,
      policy,
      trace,
    });

    // Step 4: Reserved Share Settlement (Cash return)
    const spouseEdge = input.relationships.find(
      r => r.type === 'SPOUSE' && (r.fromId === input.deceasedId || r.toId === input.deceasedId) && !r.isDivorced
    );
    const spouseId = spouseEdge
      ? (spouseEdge.fromId === input.deceasedId ? spouseEdge.toId : spouseEdge.fromId)
      : undefined;

    const step4Result = executeStep4ReserveSettlement({
      deceasedId: input.deceasedId,
      spouseId,
      activeEstateWon: totalActiveWon,
      passiveDebtWon: input.estate.passiveDebtWon,
      statutoryShares,
      concreteShares: step3Result.concreteSharesWon,
      allocatedDebts: step3Result.allocatedDebtsWon,
      allPersons: input.allPersons,
      heirOrder: step1Result.heirOrder,
      policy,
      trace,
    });

    // Compile Heir Calculation Results
    const heirResults: HeirCalculationResult[] = [];

    for (const [id, statRate] of statutoryShares) {
      const person = input.allPersons.get(id)!;
      const status = step1Result.heirStatuses.get(id) ?? 'VALID_HEIR';
      const concreteWon = step3Result.concreteSharesWon.get(id) ?? 0n;
      const allocatedDebtWon = step3Result.allocatedDebtsWon.get(id) ?? 0n;
      const shortageWon = step4Result.reserveShortages.get(id) ?? 0n;
      const obligationWon = step4Result.reserveObligations.get(id) ?? 0n;

      heirResults.push({
        personId: id,
        name: person.name,
        status,
        statutoryShareRate: statRate,
        tentativeConcreteShareWon: concreteWon,
        finalConcreteShareWon: concreteWon,
        allocatedDebtWon,
        netInheritanceWon: concreteWon - allocatedDebtWon,
        reserveShortageWon: shortageWon,
        reserveCompensationObligationWon: obligationWon,
      });
    }

    return {
      openingDate: input.estate.openingDate,
      policyVersion: policy.version,
      heirResults,
      deemedEstateWon: step3Result.deemedEstateWon,
      reserveSettlement: {
        baseEstateWon: step4Result.baseEstateWon,
        compensationFlows: step4Result.compensationFlows,
      },
      traces: trace.getTraces(),
    };
  }
}
