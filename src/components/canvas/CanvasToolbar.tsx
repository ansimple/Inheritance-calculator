import React from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  LayoutGrid, 
  UserPlus, 
  BookOpen
} from 'lucide-react';
import { useInheritanceStore } from '../../state/useInheritanceStore';

interface CanvasToolbarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitScreen: () => void;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitScreen,
}) => {
  const { 
    deceasedId, 
    addPerson, 
    autoLayout, 
    loadSampleScenario 
  } = useInheritanceStore();

  const handleAddChild = () => {
    addPerson(
      {
        id: `child_${Date.now()}`,
        name: `자녀 ${Math.floor(Math.random() * 89 + 10)}`,
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
      },
      'PARENT_CHILD',
      deceasedId
    );
  };

  const handleAddSpouse = () => {
    addPerson(
      {
        id: `spouse_${Date.now()}`,
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
      },
      'SPOUSE',
      deceasedId
    );
  };

  return (
    <div className="absolute top-3 left-3 right-3 sm:right-auto sm:top-4 sm:left-4 z-10 flex items-center gap-2 bg-brown-900/95 backdrop-blur-md border border-brown-800 p-1.5 rounded-xl shadow-xl max-w-[calc(100vw-1.5rem)] overflow-x-auto scrollbar-none">
      {/* Zoom Controls */}
      <div className="flex items-center gap-1 border-r border-brown-800 pr-2 shrink-0">
        <button
          onClick={onZoomIn}
          title="확대 (Zoom In)"
          className="p-1.5 text-stone-300 hover:text-white hover:bg-brown-850 rounded-lg transition"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={onZoomOut}
          title="축소 (Zoom Out)"
          className="p-1.5 text-stone-300 hover:text-white hover:bg-brown-850 rounded-lg transition"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={onResetZoom}
          title="100% 비율"
          className="px-2 py-1 text-xs font-mono font-medium text-stone-300 hover:text-white hover:bg-brown-850 rounded-lg transition"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={onFitScreen}
          title="화면 맞춤"
          className="p-1.5 text-stone-300 hover:text-white hover:bg-brown-850 rounded-lg transition"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Layout & Auto-Align */}
      <div className="flex items-center gap-1 border-r border-brown-800 pr-2 shrink-0">
        <button
          onClick={autoLayout}
          title="세대별 가계도 자동 정렬"
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition whitespace-nowrap"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">자동 정렬</span>
        </button>
      </div>

      {/* Add Members */}
      <div className="flex items-center gap-1 border-r border-brown-800 pr-2 shrink-0">
        <button
          onClick={handleAddChild}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition whitespace-nowrap"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">자녀 추가</span>
          <span className="sm:hidden">+자녀</span>
        </button>
        <button
          onClick={handleAddSpouse}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition whitespace-nowrap"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">배우자 추가</span>
          <span className="sm:hidden">+배우자</span>
        </button>
      </div>

      {/* Preset Scenarios */}
      <div className="flex items-center gap-1.5 shrink-0">
        <BookOpen className="w-3.5 h-3.5 text-stone-400 ml-1" />
        <select
          onChange={(e) => {
            if (e.target.value) {
              loadSampleScenario(e.target.value as any);
              e.target.value = '';
            }
          }}
          defaultValue=""
          className="bg-brown-950 text-stone-300 border border-brown-700/80 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-500 cursor-pointer max-w-[130px] sm:max-w-none"
        >
          <option value="" disabled>시나리오...</option>
          <option value="standard">시나리오 1: 표준 상속</option>
          <option value="excess">시나리오 2: 초과특별수익 안분</option>
          <option value="disqualified_2026">시나리오 3: 2026 결격자대습배제</option>
          <option value="ascendant_hara">시나리오 4: 구하라법 상실선고</option>
        </select>
      </div>
    </div>
  );
};
