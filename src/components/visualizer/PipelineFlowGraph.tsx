import React, { useState } from 'react';
import { 
  Users, 
  PieChart, 
  Calculator, 
  Scale, 
  BookOpen, 
  FileCode, 
  CheckCircle2
} from 'lucide-react';
import { useInheritanceStore } from '../../state/useInheritanceStore';

export const PipelineFlowGraph: React.FC = () => {
  const { calculationResult } = useInheritanceStore();
  const [activeStep, setActiveStep] = useState<'ALL' | 'STEP1' | 'STEP2' | 'STEP3' | 'STEP4'>('ALL');

  if (!calculationResult) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center text-stone-400">
        계산 결과가 없습니다.
      </div>
    );
  }

  const { traces, heirResults, deemedEstateWon, reserveSettlement } = calculationResult;

  const stepMeta = [
    {
      id: 'STEP1' as const,
      num: 'Step 1',
      title: '상속인 및 순위 판정',
      desc: '민법 제1000조 및 제1003조',
      icon: Users,
      summary: `${heirResults.length}명 상속인 확정`,
      color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
    },
    {
      id: 'STEP2' as const,
      num: 'Step 2',
      title: '법정상속분율 확정',
      desc: '배우자 1.5 : 자녀 1.0 가중치',
      icon: PieChart,
      summary: '기약분수 무손실 확정',
      color: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
    },
    {
      id: 'STEP3' as const,
      num: 'Step 3',
      title: '구체적 상속분 산정',
      desc: '대법원 2017스98 전합 수렴',
      icon: Calculator,
      summary: `간주재산 ${deemedEstateWon.toLocaleString()}원`,
      color: 'border-amber-600/40 bg-amber-600/10 text-amber-300',
    },
    {
      id: 'STEP4' as const,
      num: 'Step 4',
      title: '유류분 부족액 및 반환',
      desc: '2026 민법 제1115조 가액반환',
      icon: Scale,
      summary: `기초재산 ${reserveSettlement.baseEstateWon.toLocaleString()}원`,
      color: 'border-amber-400/40 bg-amber-400/10 text-amber-400',
    },
  ];

  const filteredTraces = activeStep === 'ALL' 
    ? traces 
    : traces.filter(t => t.stepId === activeStep);

  return (
    <div className="h-full flex flex-col bg-brown-950 text-stone-100 overflow-y-auto p-4 sm:p-8 pb-8">
      <div className="max-w-5xl mx-auto w-full space-y-6 sm:space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 mb-1">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>4단계 법률 계산 엔진 검증 트레이스</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            상속 분배 및 유류분 계산과정 도식화
          </h2>
          <p className="text-xs sm:text-sm text-stone-400 mt-1 leading-relaxed">
            각 단계를 클릭하면 적용된 민법 조항, 대법원 판례, 산출식 및 수렴 루프 로그를 검증할 수 있습니다.
          </p>
        </div>

        {/* 4 Pipeline Step Cards (2x2 on mobile, 4x1 on desktop) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {stepMeta.map((st) => {
            const Icon = st.icon;
            const isSelected = activeStep === st.id;

            return (
              <button
                key={st.id}
                onClick={() => setActiveStep(isSelected ? 'ALL' : st.id)}
                className={`p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? `${st.color} shadow-lg ring-2 ring-amber-500/40`
                    : 'bg-brown-900/60 border-brown-800 hover:border-brown-700 hover:bg-brown-900'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <span className="text-[9px] sm:text-[10px] font-bold tracking-wider uppercase px-1.5 sm:px-2 py-0.5 rounded bg-brown-950/80 border border-brown-800 text-stone-300">
                      {st.num}
                    </span>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-stone-400 shrink-0" />
                  </div>

                  <div className="font-bold text-xs sm:text-sm text-white line-clamp-1">{st.title}</div>
                  <div className="text-[11px] sm:text-xs text-stone-400 mt-0.5 line-clamp-1">{st.desc}</div>
                </div>

                <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-brown-800/80 text-[11px] sm:text-xs font-semibold text-stone-300 truncate">
                  {st.summary}
                </div>
              </button>
            );
          })}
        </div>

        {/* Audit Trace Logs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-brown-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-400" />
              법률 근거 및 산출 로그 ({filteredTraces.length}건)
            </h3>

            {activeStep !== 'ALL' && (
              <button
                onClick={() => setActiveStep('ALL')}
                className="text-xs text-amber-400 hover:underline"
              >
                전체 단계 보기
              </button>
            )}
          </div>

          <div className="space-y-3">
            {filteredTraces.map((item, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-brown-900/60 border border-brown-800 space-y-3 hover:border-brown-700 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {item.stepId}
                    </span>
                    <h4 className="text-sm font-bold text-white">{item.titleKo}</h4>
                  </div>

                  {/* Article references */}
                  <div className="flex flex-wrap gap-1.5">
                    {item.articleRefs.map((art, aIdx) => (
                      <span
                        key={aIdx}
                        className="px-2 py-0.5 rounded text-[10px] bg-brown-950 text-amber-200 border border-amber-500/20 font-medium"
                      >
                        {art}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-stone-300 leading-relaxed">
                  {item.descriptionKo}
                </p>

                {item.formulaText && (
                  <div className="bg-brown-950 p-2.5 rounded-xl border border-brown-800 flex items-center gap-2 text-xs font-mono text-emerald-400 overflow-x-auto">
                    <FileCode className="w-4 h-4 text-stone-500 shrink-0" />
                    <span>{item.formulaText}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
