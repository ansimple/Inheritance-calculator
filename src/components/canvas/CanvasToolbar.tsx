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
    <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 bg-slate-900/90 backdrop-blur border border-slate-800 p-1.5 rounded-xl shadow-xl">
      {/* Zoom Controls */}
      <div className="flex items-center gap-1 border-r border-slate-800 pr-2">
        <button
          onClick={onZoomIn}
          title="확대 (Zoom In)"
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={onZoomOut}
          title="축소 (Zoom Out)"
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={onResetZoom}
          title="100% 비율"
          className="px-2 py-1 text-xs font-mono font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={onFitScreen}
          title="화면 맞춤"
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Layout & Auto-Align */}
      <div className="flex items-center gap-1 border-r border-slate-800 pr-2">
        <button
          onClick={autoLayout}
          title="세대별 가계도 자동 정렬"
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 rounded-lg transition"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          자동 정렬
        </button>
      </div>

      {/* Add Members */}
      <div className="flex items-center gap-1 border-r border-slate-800 pr-2">
        <button
          onClick={handleAddChild}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition"
        >
          <UserPlus className="w-3.5 h-3.5" />
          자녀 추가
        </button>
        <button
          onClick={handleAddSpouse}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-pink-400 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 rounded-lg transition"
        >
          <UserPlus className="w-3.5 h-3.5" />
          배우자 추가
        </button>
      </div>

      {/* Preset Scenarios */}
      <div className="flex items-center gap-1.5">
        <BookOpen className="w-3.5 h-3.5 text-slate-400 ml-1" />
        <select
          onChange={(e) => {
            if (e.target.value) {
              loadSampleScenario(e.target.value as any);
              e.target.value = '';
            }
          }}
          defaultValue=""
          className="bg-slate-950 text-slate-300 border border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-sky-500 cursor-pointer"
        >
          <option value="" disabled>법률 판례 시나리오 불러오기...</option>
          <option value="standard">시나리오 1: 표준 상속 (배우자 1.5 : 자녀 각 1.0)</option>
          <option value="excess">시나리오 2: 대법원 2017스98 초과특별수익 안분</option>
          <option value="disqualified_2026">시나리오 3: 2026 개정 민법 결격자 배우자 대습배제</option>
          <option value="ascendant_hara">시나리오 4: 2순위 구하라법 양육방기 부친 상실선고</option>
        </select>
      </div>
    </div>
  );
};
