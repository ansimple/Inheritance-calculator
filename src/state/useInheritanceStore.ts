import { create } from 'zustand';
import { PersonNode, RelationshipEdge, RelationshipType } from '../domain/models/Person';
import { EstateData } from '../domain/models/Estate';
import { PipelineExecutionResult } from '../domain/models/PipelineResult';
import { InheritancePipelineEngine } from '../domain/pipeline/InheritancePipelineEngine';
import { GenerationalTreeLayout } from '../canvas/layout/GenerationalTreeLayout';
import { UndoRedoManager } from './UndoRedoManager';

export interface TreeSnapshot {
  deceasedId: string;
  allPersons: Map<string, PersonNode>;
  relationships: RelationshipEdge[];
  estate: EstateData;
}

export type CalculationMode = 'FULL' | 'SHARE_ONLY';

export interface InheritanceState {
  // Core data
  deceasedId: string;
  allPersons: Map<string, PersonNode>;
  relationships: RelationshipEdge[];
  estate: EstateData;

  // Calculation & Operation Mode
  calculationMode: CalculationMode;

  // Selected & UI state
  selectedPersonId: string | null;
  calculationResult: PipelineExecutionResult | null;
  activeGuidelines: { horizontalY?: number; verticalX?: number };

  // Undo/Redo availability
  canUndo: boolean;
  canRedo: boolean;

  // Actions
  setCalculationMode: (mode: CalculationMode) => void;
  toggleCalculationMode: () => void;
  setDeceasedInfo: (updates: Partial<PersonNode>) => void;
  addPerson: (
    person: Omit<PersonNode, 'canvasX' | 'canvasY'>,
    relType: RelationshipType,
    targetId: string,
    isDivorced?: boolean
  ) => void;
  updatePerson: (id: string, updates: Partial<PersonNode>) => void;
  removePerson: (id: string) => void;
  updatePersonPosition: (id: string, x: number, y: number) => void;
  updateEstate: (updates: Partial<EstateData>) => void;
  selectPerson: (id: string | null) => void;
  setGuidelines: (guidelines: { horizontalY?: number; verticalX?: number }) => void;
  autoLayout: () => void;
  calculate: () => void;
  loadSampleScenario: (scenarioKey: 'standard' | 'excess' | 'disqualified_2026' | 'ascendant_hara') => void;
  undo: () => void;
  redo: () => void;
}

const history = new UndoRedoManager<TreeSnapshot>(25);

function createInitialState(): TreeSnapshot {
  const deceased: PersonNode = {
    id: 'deceased',
    name: '피상속인 (고인)',
    gender: 'MALE',
    isDeceased: true,
    deathDate: '2026-05-01',
    isDisqualified: false,
    hasDeprivation: false,
    hasRenounced: false,
    adoptionType: 'NONE',
    remarriedBeforeOpening: false,
    contributionAmountWon: 0n,
    specialBenefits: [],
    bequests: [],
    canvasX: 330,
    canvasY: 240,
  };

  const spouse: PersonNode = {
    id: 'spouse',
    name: '배우자',
    gender: 'FEMALE',
    isDeceased: false,
    isDisqualified: false,
    hasDeprivation: false,
    hasRenounced: false,
    adoptionType: 'NONE',
    remarriedBeforeOpening: false,
    contributionAmountWon: 0n,
    specialBenefits: [],
    bequests: [],
    canvasX: 585,
    canvasY: 240,
  };

  const child1: PersonNode = {
    id: 'child1',
    name: '장남 (자녀1)',
    gender: 'MALE',
    isDeceased: false,
    isDisqualified: false,
    hasDeprivation: false,
    hasRenounced: false,
    adoptionType: 'NONE',
    remarriedBeforeOpening: false,
    contributionAmountWon: 0n,
    specialBenefits: [],
    bequests: [],
    canvasX: 330,
    canvasY: 420,
  };

  const child2: PersonNode = {
    id: 'child2',
    name: '차남 (자녀2)',
    gender: 'MALE',
    isDeceased: false,
    isDisqualified: false,
    hasDeprivation: false,
    hasRenounced: false,
    adoptionType: 'NONE',
    remarriedBeforeOpening: false,
    contributionAmountWon: 0n,
    specialBenefits: [],
    bequests: [],
    canvasX: 585,
    canvasY: 420,
  };

  const allPersons = new Map<string, PersonNode>([
    ['deceased', deceased],
    ['spouse', spouse],
    ['child1', child1],
    ['child2', child2],
  ]);

  const relationships: RelationshipEdge[] = [
    { id: 'rel_spouse', fromId: 'deceased', toId: 'spouse', type: 'SPOUSE' },
    { id: 'rel_c1', fromId: 'deceased', toId: 'child1', type: 'PARENT_CHILD' },
    { id: 'rel_c2', fromId: 'deceased', toId: 'child2', type: 'PARENT_CHILD' },
  ];

  const estate: EstateData = {
    openingDate: '2026-05-01',
    activeRealEstateWon: 500_000_000n,
    activeFinancialWon: 200_000_000n,
    activeOtherWon: 0n,
    passiveDebtWon: 0n,
  };

  return {
    deceasedId: 'deceased',
    allPersons,
    relationships,
    estate,
  };
}

const initial = createInitialState();

export const useInheritanceStore = create<InheritanceState>((set, get) => {
  // Helper to trigger calculation
  const executeCalculation = (state: {
    deceasedId: string;
    allPersons: Map<string, PersonNode>;
    relationships: RelationshipEdge[];
    estate: EstateData;
  }): PipelineExecutionResult | null => {
    try {
      return InheritancePipelineEngine.execute({
        deceasedId: state.deceasedId,
        allPersons: state.allPersons,
        relationships: state.relationships,
        estate: state.estate,
      });
    } catch (err) {
      console.error('Calculation error:', err);
      return null;
    }
  };

  // Helper to record history before mutation
  const pushSnapshot = () => {
    const s = get();
    history.push({
      deceasedId: s.deceasedId,
      allPersons: new Map(s.allPersons),
      relationships: [...s.relationships],
      estate: { ...s.estate },
    });
    set({ canUndo: history.canUndo, canRedo: history.canRedo });
  };

  const initialCalc = executeCalculation(initial);

  return {
    deceasedId: initial.deceasedId,
    allPersons: initial.allPersons,
    relationships: initial.relationships,
    estate: initial.estate,
    calculationMode: 'SHARE_ONLY',
    selectedPersonId: null,
    calculationResult: initialCalc,
    activeGuidelines: {},
    canUndo: false,
    canRedo: false,

    setCalculationMode: (mode) => set({ calculationMode: mode }),
    toggleCalculationMode: () =>
      set((state) => ({
        calculationMode: state.calculationMode === 'SHARE_ONLY' ? 'FULL' : 'SHARE_ONLY',
      })),

    setDeceasedInfo: (updates) => {
      pushSnapshot();
      const persons = new Map(get().allPersons);
      const dec = persons.get(get().deceasedId);
      if (dec) {
        persons.set(get().deceasedId, { ...dec, ...updates });
        const calc = executeCalculation({ ...get(), allPersons: persons });
        set({ allPersons: persons, calculationResult: calc });
      }
    },

    addPerson: (personData, relType, targetId, isDivorced = false) => {
      pushSnapshot();
      const persons = new Map(get().allPersons);
      const relationships = [...get().relationships];

      const newId = personData.id || `p_${Date.now()}`;
      const newPerson: PersonNode = {
        ...personData,
        id: newId,
        canvasX: 300,
        canvasY: 300,
      };
      persons.set(newId, newPerson);

      const newEdge: RelationshipEdge = {
        id: `rel_${Date.now()}`,
        fromId: targetId,
        toId: newId,
        type: relType,
        isDivorced,
      };
      relationships.push(newEdge);

      // Recompute layout
      const layout = GenerationalTreeLayout.computeLayout(get().deceasedId, persons, relationships);
      for (const [id, pos] of layout) {
        const p = persons.get(id);
        if (p) {
          persons.set(id, { ...p, canvasX: pos.canvasX, canvasY: pos.canvasY });
        }
      }

      const calc = executeCalculation({ ...get(), allPersons: persons, relationships });
      set({
        allPersons: persons,
        relationships,
        calculationResult: calc,
        selectedPersonId: newId,
      });
    },

    updatePerson: (id, updates) => {
      pushSnapshot();
      const persons = new Map(get().allPersons);
      const target = persons.get(id);
      if (target) {
        persons.set(id, { ...target, ...updates });
        const calc = executeCalculation({ ...get(), allPersons: persons });
        set({ allPersons: persons, calculationResult: calc });
      }
    },

    removePerson: (id) => {
      if (id === get().deceasedId) return; // Cannot delete deceased
      pushSnapshot();
      const persons = new Map(get().allPersons);
      persons.delete(id);

      const relationships = get().relationships.filter(
        r => r.fromId !== id && r.toId !== id
      );

      const calc = executeCalculation({ ...get(), allPersons: persons, relationships });
      set({
        allPersons: persons,
        relationships,
        calculationResult: calc,
        selectedPersonId: get().selectedPersonId === id ? null : get().selectedPersonId,
      });
    },

    updatePersonPosition: (id, x, y) => {
      const persons = new Map(get().allPersons);
      const target = persons.get(id);
      if (target) {
        persons.set(id, { ...target, canvasX: x, canvasY: y });
        set({ allPersons: persons });
      }
    },

    updateEstate: (updates) => {
      pushSnapshot();
      const estate = { ...get().estate, ...updates };
      const calc = executeCalculation({ ...get(), estate });
      set({ estate, calculationResult: calc });
    },

    selectPerson: (id) => {
      set({ selectedPersonId: id });
    },

    setGuidelines: (guidelines) => {
      set({ activeGuidelines: guidelines });
    },

    autoLayout: () => {
      pushSnapshot();
      const persons = new Map(get().allPersons);
      const layout = GenerationalTreeLayout.computeLayout(
        get().deceasedId,
        persons,
        get().relationships
      );
      for (const [id, pos] of layout) {
        const p = persons.get(id);
        if (p) {
          persons.set(id, { ...p, canvasX: pos.canvasX, canvasY: pos.canvasY });
        }
      }
      set({ allPersons: persons });
    },

    calculate: () => {
      const calc = executeCalculation(get());
      set({ calculationResult: calc });
    },

    loadSampleScenario: (scenarioKey) => {
      pushSnapshot();
      let deceased: PersonNode;
      let allPersons = new Map<string, PersonNode>();
      let relationships: RelationshipEdge[] = [];
      let estate: EstateData;

      if (scenarioKey === 'excess') {
        // Supreme Court 2017Seu98 Scenario
        deceased = {
          id: 'dec',
          name: '피상속인',
          gender: 'MALE',
          isDeceased: true,
          deathDate: '2026-05-01',
          isDisqualified: false,
          hasDeprivation: false,
          hasRenounced: false,
          adoptionType: 'NONE',
          remarriedBeforeOpening: false,
          contributionAmountWon: 0n,
          specialBenefits: [],
          bequests: [],
          canvasX: 330,
          canvasY: 240,
        };
        const c1: PersonNode = {
          id: 'c1',
          name: '장남 (초과특별수익)',
          gender: 'MALE',
          isDeceased: false,
          isDisqualified: false,
          hasDeprivation: false,
          hasRenounced: false,
          adoptionType: 'NONE',
          remarriedBeforeOpening: false,
          contributionAmountWon: 0n,
          specialBenefits: [{
            id: 'g1',
            recipientId: 'c1',
            amountWon: 1_000_000_000n, // 10억 생전증여
            giftDate: '2020-01-01',
            isContributionCompensation: false,
            description: '생전 증여 부동산',
          }],
          bequests: [],
          canvasX: 180,
          canvasY: 420,
        };
        const c2: PersonNode = {
          id: 'c2',
          name: '차남',
          gender: 'MALE',
          isDeceased: false,
          isDisqualified: false,
          hasDeprivation: false,
          hasRenounced: false,
          adoptionType: 'NONE',
          remarriedBeforeOpening: false,
          contributionAmountWon: 0n,
          specialBenefits: [],
          bequests: [],
          canvasX: 435,
          canvasY: 420,
        };
        const c3: PersonNode = {
          id: 'c3',
          name: '삼남',
          gender: 'MALE',
          isDeceased: false,
          isDisqualified: false,
          hasDeprivation: false,
          hasRenounced: false,
          adoptionType: 'NONE',
          remarriedBeforeOpening: false,
          contributionAmountWon: 0n,
          specialBenefits: [],
          bequests: [],
          canvasX: 690,
          canvasY: 420,
        };

        allPersons.set('dec', deceased);
        allPersons.set('c1', c1);
        allPersons.set('c2', c2);
        allPersons.set('c3', c3);

        relationships = [
          { id: 'r1', fromId: 'dec', toId: 'c1', type: 'PARENT_CHILD' },
          { id: 'r2', fromId: 'dec', toId: 'c2', type: 'PARENT_CHILD' },
          { id: 'r3', fromId: 'dec', toId: 'c3', type: 'PARENT_CHILD' },
        ];

        estate = {
          openingDate: '2026-05-01',
          activeRealEstateWon: 300_000_000n,
          activeFinancialWon: 0n,
          activeOtherWon: 0n,
          passiveDebtWon: 0n,
        };
      } else if (scenarioKey === 'disqualified_2026') {
        // 2026 Revised Civil Act Disqualified representation exclusion
        deceased = {
          id: 'dec',
          name: '피상속인',
          gender: 'MALE',
          isDeceased: true,
          deathDate: '2026-05-01',
          isDisqualified: false,
          hasDeprivation: false,
          hasRenounced: false,
          adoptionType: 'NONE',
          remarriedBeforeOpening: false,
          contributionAmountWon: 0n,
          specialBenefits: [],
          bequests: [],
          canvasX: 330,
          canvasY: 240,
        };
        const spouse: PersonNode = {
          id: 'sp',
          name: '배우자',
          gender: 'FEMALE',
          isDeceased: false,
          isDisqualified: false,
          hasDeprivation: false,
          hasRenounced: false,
          adoptionType: 'NONE',
          remarriedBeforeOpening: false,
          contributionAmountWon: 0n,
          specialBenefits: [],
          bequests: [],
          canvasX: 585,
          canvasY: 240,
        };
        const c1: PersonNode = {
          id: 'c1',
          name: '장남 (상속결격자)',
          gender: 'MALE',
          isDeceased: false,
          isDisqualified: true, // Disqualified
          hasDeprivation: false,
          hasRenounced: false,
          adoptionType: 'NONE',
          remarriedBeforeOpening: false,
          contributionAmountWon: 0n,
          specialBenefits: [],
          bequests: [],
          canvasX: 195,
          canvasY: 420,
        };
        const daughterInLaw: PersonNode = {
          id: 'dil',
          name: '며느리 (대습배제)',
          gender: 'FEMALE',
          isDeceased: false,
          isDisqualified: false,
          hasDeprivation: false,
          hasRenounced: false,
          adoptionType: 'NONE',
          remarriedBeforeOpening: false,
          contributionAmountWon: 0n,
          specialBenefits: [],
          bequests: [],
          canvasX: 450,
          canvasY: 420,
        };
        const grandSon: PersonNode = {
          id: 'gson',
          name: '손자녀 (대습인정)',
          gender: 'MALE',
          isDeceased: false,
          isDisqualified: false,
          hasDeprivation: false,
          hasRenounced: false,
          adoptionType: 'NONE',
          remarriedBeforeOpening: false,
          contributionAmountWon: 0n,
          specialBenefits: [],
          bequests: [],
          canvasX: 330,
          canvasY: 600,
        };

        allPersons.set('dec', deceased);
        allPersons.set('sp', spouse);
        allPersons.set('c1', c1);
        allPersons.set('dil', daughterInLaw);
        allPersons.set('gson', grandSon);

        relationships = [
          { id: 'r1', fromId: 'dec', toId: 'sp', type: 'SPOUSE' },
          { id: 'r2', fromId: 'dec', toId: 'c1', type: 'PARENT_CHILD' },
          { id: 'r3', fromId: 'c1', toId: 'dil', type: 'SPOUSE' },
          { id: 'r4', fromId: 'c1', toId: 'gson', type: 'PARENT_CHILD' },
        ];

        estate = {
          openingDate: '2026-05-01',
          activeRealEstateWon: 700_000_000n,
          activeFinancialWon: 0n,
          activeOtherWon: 0n,
          passiveDebtWon: 0n,
        };
      } else if (scenarioKey === 'ascendant_hara') {
        // Goo Hara Law Ascendant Deprivation
        deceased = {
          id: 'dec',
          name: '고인 (자녀 없음)',
          gender: 'FEMALE',
          isDeceased: true,
          deathDate: '2026-05-01',
          isDisqualified: false,
          hasDeprivation: false,
          hasRenounced: false,
          adoptionType: 'NONE',
          remarriedBeforeOpening: false,
          contributionAmountWon: 0n,
          specialBenefits: [],
          bequests: [],
          canvasX: 390,
          canvasY: 240,
        };
        const mother: PersonNode = {
          id: 'mo',
          name: '모친 (단독 상속)',
          gender: 'FEMALE',
          isDeceased: false,
          isDisqualified: false,
          hasDeprivation: false,
          hasRenounced: false,
          adoptionType: 'NONE',
          remarriedBeforeOpening: false,
          contributionAmountWon: 0n,
          specialBenefits: [],
          bequests: [],
          canvasX: 510,
          canvasY: 60,
        };
        const father: PersonNode = {
          id: 'fa',
          name: '부친 (양육의무 방기 상실선고)',
          gender: 'MALE',
          isDeceased: false,
          isDisqualified: false,
          hasDeprivation: true, // Goo Hara law deprived!
          hasRenounced: false,
          adoptionType: 'NONE',
          remarriedBeforeOpening: false,
          contributionAmountWon: 0n,
          specialBenefits: [],
          bequests: [],
          canvasX: 270,
          canvasY: 60,
        };

        allPersons.set('dec', deceased);
        allPersons.set('mo', mother);
        allPersons.set('fa', father);

        relationships = [
          { id: 'r1', fromId: 'fa', toId: 'dec', type: 'PARENT_CHILD' },
          { id: 'r2', fromId: 'mo', toId: 'dec', type: 'PARENT_CHILD' },
        ];

        estate = {
          openingDate: '2026-05-01',
          activeRealEstateWon: 600_000_000n,
          activeFinancialWon: 0n,
          activeOtherWon: 0n,
          passiveDebtWon: 0n,
        };
      } else {
        // Standard
        const s = createInitialState();
        deceased = s.allPersons.get('deceased')!;
        allPersons = s.allPersons;
        relationships = s.relationships;
        estate = s.estate;
      }

      const calc = executeCalculation({
        deceasedId: deceased.id,
        allPersons,
        relationships,
        estate,
      });

      set({
        deceasedId: deceased.id,
        allPersons,
        relationships,
        estate,
        selectedPersonId: null,
        calculationResult: calc,
      });
    },

    undo: () => {
      const current: TreeSnapshot = {
        deceasedId: get().deceasedId,
        allPersons: new Map(get().allPersons),
        relationships: [...get().relationships],
        estate: { ...get().estate },
      };
      const previous = history.undo(current);
      if (previous) {
        const calc = executeCalculation(previous);
        set({
          ...previous,
          calculationResult: calc,
          canUndo: history.canUndo,
          canRedo: history.canRedo,
        });
      }
    },

    redo: () => {
      const current: TreeSnapshot = {
        deceasedId: get().deceasedId,
        allPersons: new Map(get().allPersons),
        relationships: [...get().relationships],
        estate: { ...get().estate },
      };
      const next = history.redo(current);
      if (next) {
        const calc = executeCalculation(next);
        set({
          ...next,
          calculationResult: calc,
          canUndo: history.canUndo,
          canRedo: history.canRedo,
        });
      }
    },
  };
});
