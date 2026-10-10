import React, { useState } from 'react';
import { 
  Users, 
  Heart, 
  Baby, 
  UserCheck, 
  Building2, 
  Coins, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Sparkles,
  ShieldCheck,
  Scale
} from 'lucide-react';
import { useInheritanceStore } from '../../state/useInheritanceStore';
import { Gender } from '../../domain/models/Person';
import { WonCurrencyInput } from '../common/WonCurrencyInput';

export const WizardContainer: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const {
    deceasedId,
    allPersons,
    relationships,
    estate,
    calculationResult,
    calculationMode,
    setDeceasedInfo,
    addPerson,
    updatePerson,
    removePerson,
    updateEstate,
  } = useInheritanceStore();

  const isShareOnly = calculationMode === 'SHARE_ONLY';
  const maxStep = isShareOnly ? 5 : 7;

  // Ensure current step stays in bound when switching modes
  if (currentStep > maxStep) {
    setCurrentStep(maxStep);
  }

  const deceased = allPersons.get(deceasedId);
  const spouseEdge = relationships.find(
    (r) => r.type === 'SPOUSE' && (r.fromId === deceasedId || r.toId === deceasedId) && !r.isDivorced
  );
  const spouse = spouseEdge
    ? allPersons.get(spouseEdge.fromId === deceasedId ? spouseEdge.toId : spouseEdge.fromId)
    : undefined;

  const children = Array.from(allPersons.values()).filter((p) => {
    return relationships.some(
      (r) => r.type === 'PARENT_CHILD' && r.fromId === deceasedId && r.toId === p.id
    );
  });

  const parents = Array.from(allPersons.values()).filter((p) => {
    return relationships.some(
      (r) => r.type === 'PARENT_CHILD' && r.toId === deceasedId && r.fromId === p.id
    );
  });

  const steps = isShareOnly
    ? [
        { num: 1, label: '고인 정보', icon: UserCheck },
        { num: 2, label: '배우자', icon: Heart },
        { num: 3, label: '직계비속(자녀)', icon: Baby },
        { num: 4, label: '직계존속(부모)', icon: Users },
        { num: 5, label: '법정 지분율 결과', icon: Scale },
      ]
    : [
        { num: 1, label: '고인 정보', icon: UserCheck },
        { num: 2, label: '배우자', icon: Heart },
        { num: 3, label: '직계비속(자녀)', icon: Baby },
        { num: 4, label: '직계존속(부모)', icon: Users },
        { num: 5, label: '상속 재산/채무', icon: Building2 },
        { num: 6, label: '기여분/증여', icon: Coins },
        { num: 7, label: '최종 결과', icon: Scale },
      ];

  // Helper to format currency
  const formatWon = (amt: bigint) => {
    if (amt === 0n) return '0원';
    const abs = amt < 0n ? -amt : amt;
    const eok = abs / 100_000_000n;
    const man = (abs % 100_000_000n) / 10_000n;
    const rest = abs % 10_000n;
    let res = '';
    if (eok > 0n) res += `${eok}억 `;
    if (man > 0n) res += `${man}만 `;
    if (eok === 0n && man === 0n && rest > 0n) res += `${rest.toLocaleString()}`;
    res = res.trim() + '원';
    return amt < 0n ? `-${res}` : res;
  };

  return (
    <div className="h-full flex flex-col bg-brown-950 text-stone-100 overflow-y-auto p-3 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col pb-4">
        {/* Step Indicator Bar - Desktop Version */}
        <div className="mb-6 sm:mb-8 hidden sm:block">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-brown-800 w-full -z-0" />
            {steps.map((st) => {
              const Icon = st.icon;
              const isActive = currentStep === st.num;
              const isPast = currentStep > st.num;

              return (
                <button
                  key={st.num}
                  onClick={() => setCurrentStep(st.num)}
                  className={`relative z-10 flex flex-col items-center gap-1.5 focus:outline-none transition group`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border transition-all ${
                      isActive
                        ? 'bg-amber-600 text-white border-amber-400 shadow-lg shadow-amber-600/25 ring-4 ring-amber-500/20'
                        : isPast
                        ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-brown-900 text-stone-400 border-brown-800 group-hover:border-brown-700'
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span
                    className={`text-[11px] font-medium hidden sm:block ${
                      isActive ? 'text-amber-400 font-semibold' : isPast ? 'text-stone-300' : 'text-stone-500'
                    }`}
                  >
                    {st.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step Indicator Bar - Mobile Version (Compact Header + Progress Bar) */}
        <div className="mb-4 sm:hidden bg-brown-900/80 border border-brown-800 rounded-2xl p-3.5 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs">
                {React.createElement(steps[currentStep - 1].icon, { className: 'w-4 h-4' })}
              </div>
              <div>
                <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                  Step {currentStep} / {steps.length}
                </div>
                <div className="text-xs font-bold text-white">
                  {steps[currentStep - 1].label}
                </div>
              </div>
            </div>

            {/* Quick Step Switcher Dots */}
            <div className="flex items-center gap-1">
              {steps.map((st) => (
                <button
                  key={st.num}
                  onClick={() => setCurrentStep(st.num)}
                  aria-label={`Step ${st.num}`}
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold transition ${
                    currentStep === st.num
                      ? 'bg-amber-600 text-white font-extrabold shadow'
                      : currentStep > st.num
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-brown-800 text-stone-400 hover:text-white'
                  }`}
                >
                  {st.num}
                </button>
              ))}
            </div>
          </div>

          {/* Progress Gauge */}
          <div className="w-full bg-brown-800 h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className="bg-gradient-to-r from-amber-500 to-amber-300 h-full transition-all duration-300 rounded-full"
              style={{ width: `${(currentStep / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Wizard Step Content Card */}
        <div className="flex-1 bg-brown-900/60 border border-brown-800 rounded-2xl sm:rounded-3xl p-4 sm:p-8 flex flex-col shadow-2xl backdrop-blur">
          {/* STEP 1: 고인 정보 및 상속개시일 */}
          {currentStep === 1 && (
            <div className="space-y-6 flex-1">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-6 h-6 text-amber-400" />
                  피상속인(고인) 정보 및 상속개시일
                </h3>
                <p className="text-sm text-stone-400 mt-1">
                  상속개시일(사망일)을 기준으로 적용될 대한민국 민법 및 대법원·헌법재판소 판례 버전이 자동 판정됩니다.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                    고인 성함
                  </label>
                  <input
                    type="text"
                    value={deceased?.name || ''}
                    onChange={(e) => setDeceasedInfo({ name: e.target.value })}
                    className="w-full bg-brown-950 border border-brown-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                    성별
                  </label>
                  <select
                    value={deceased?.gender || 'MALE'}
                    onChange={(e) => setDeceasedInfo({ gender: e.target.value as Gender })}
                    className="w-full bg-brown-950 border border-brown-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="MALE">남성 (남편/부친)</option>
                    <option value="FEMALE">여성 (아내/모친)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                    상속개시일자 (사망일자)
                  </label>
                  <input
                    type="date"
                    value={estate.openingDate}
                    onChange={(e) => updateEstate({ openingDate: e.target.value })}
                    className="w-full bg-brown-950 border border-brown-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                {/* Legal Policy Indicator */}
                <div className="bg-brown-950/80 border border-brown-800 p-3.5 rounded-xl flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <div className="font-bold text-amber-300">
                      {estate.openingDate >= '2026-03-17'
                        ? '2026 개정 민법 (법률 제21454호 전면 시행)'
                        : estate.openingDate >= '2024-04-26'
                        ? '헌재 2020헌가4 위헌 결정 적용기'
                        : '구 민법 적용기 (2000~2024)'}
                    </div>
                    <div className="text-stone-400 mt-0.5 leading-relaxed">
                      {estate.openingDate >= '2026-03-17'
                        ? '결격자·상실자 배우자 대습 배제, 유류분 전면 가액반환, 기여보상증여 특별수익 제외가 적용됩니다.'
                        : '형제자매 유류분 위헌 효력 및 해당 시기 판례가 적용됩니다.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: 배우자 */}
          {currentStep === 2 && (
            <div className="space-y-6 flex-1">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Heart className="w-6 h-6 text-pink-400" />
                  법적 배우자 정보
                </h3>
                <p className="text-sm text-stone-400 mt-1">
                  상속개시 당시 법률상 혼인 관계에 있는 배우자는 5할 가산(1.5 가중치) 공동상속권을 가집니다. (사실혼 및 이혼은 제외)
                </p>
              </div>

              {spouse ? (
                <div className="p-4 rounded-2xl bg-brown-950 border border-brown-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20 flex items-center justify-center font-bold">
                        배
                      </span>
                      <div>
                        <div className="font-bold text-white">{spouse.name}</div>
                        <div className="text-xs text-stone-400">법적 배우자 (법정 가중치 1.5)</div>
                      </div>
                    </div>

                    <button
                      onClick={() => removePerson(spouse.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs hover:bg-rose-500/20 transition"
                    >
                      배우자 제외
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-brown-800 text-xs">
                    <div>
                      <label className="text-stone-400 block mb-1">성명</label>
                      <input
                        type="text"
                        value={spouse.name}
                        onChange={(e) => updatePerson(spouse.id, { name: e.target.value })}
                        className="w-full bg-brown-900 border border-brown-800 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-stone-400 block mb-1">기여분 (원)</label>
                      <WonCurrencyInput
                        value={spouse.contributionAmountWon}
                        placeholder="0"
                        onChange={(val) => updatePerson(spouse.id, { contributionAmountWon: val })}
                        className="w-full bg-brown-900 border border-brown-800 rounded-lg px-3 py-2 text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-brown-800 rounded-2xl space-y-3">
                  <p className="text-stone-400 text-sm">현재 등록된 법적 배우자가 없습니다.</p>
                  <button
                    onClick={() => {
                      addPerson(
                        {
                          id: `spouse_${Date.now()}`,
                          name: '배우자',
                          gender: deceased?.gender === 'MALE' ? 'FEMALE' : 'MALE',
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
                    }}
                    className="px-4 py-2 rounded-xl bg-pink-500/20 text-pink-300 border border-pink-500/30 hover:bg-pink-500/30 font-semibold text-xs transition"
                  >
                    + 배우자 등록하기
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: 직계비속 (자녀) */}
          {currentStep === 3 && (
            <div className="space-y-6 flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Baby className="w-6 h-6 text-emerald-400" />
                    직계비속 (자녀 및 손자녀)
                  </h3>
                  <p className="text-sm text-stone-400 mt-1">
                    자녀는 제1순위 상속인입니다. 선사망 또는 결격 자녀가 있는 경우 그 직계비속이 대습상속합니다.
                  </p>
                </div>

                <button
                  onClick={() => {
                    addPerson(
                      {
                        id: `child_${Date.now()}`,
                        name: `자녀 ${children.length + 1}`,
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
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-xs font-semibold transition"
                >
                  + 자녀 추가
                </button>
              </div>

              <div className="space-y-3">
                {children.map((child, idx) => (
                  <div key={child.id} className="p-4 rounded-xl bg-brown-950 border border-brown-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={child.name}
                          onChange={(e) => updatePerson(child.id, { name: e.target.value })}
                          className="bg-brown-900 border border-brown-800 rounded px-2.5 py-1 text-sm font-semibold text-white"
                        />
                      </div>

                      <button
                        onClick={() => removePerson(child.id)}
                        className="text-stone-400 hover:text-rose-400 text-xs"
                      >
                        삭제
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <label className="flex items-center gap-1.5 text-stone-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={child.isDeceased}
                          onChange={(e) => updatePerson(child.id, { isDeceased: e.target.checked })}
                          className="rounded bg-brown-900 border-brown-800 text-amber-500"
                        />
                        <span>선사망 (대습)</span>
                      </label>

                      <label className="flex items-center gap-1.5 text-stone-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={child.isDisqualified}
                          onChange={(e) => updatePerson(child.id, { isDisqualified: e.target.checked })}
                          className="rounded bg-brown-900 border-brown-800 text-rose-500"
                        />
                        <span>상속결격</span>
                      </label>

                      <label className="flex items-center gap-1.5 text-stone-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={child.hasDeprivation}
                          onChange={(e) => updatePerson(child.id, { hasDeprivation: e.target.checked })}
                          className="rounded bg-brown-900 border-brown-800 text-pink-500"
                        />
                        <span>상속권상실선고</span>
                      </label>

                      <label className="flex items-center gap-1.5 text-stone-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={child.hasRenounced}
                          onChange={(e) => updatePerson(child.id, { hasRenounced: e.target.checked })}
                          className="rounded bg-brown-900 border-brown-800 text-amber-500"
                        />
                        <span>상속포기</span>
                      </label>
                    </div>
                  </div>
                ))}
                {children.length === 0 && (
                  <div className="text-center py-8 text-stone-500 text-xs border border-dashed border-brown-800 rounded-xl">
                    등록된 자녀가 없습니다. 자녀가 없으면 부모(직계존속)가 상속권을 갖습니다.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: 직계존속 (부모) */}
          {currentStep === 4 && (
            <div className="space-y-6 flex-1">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-6 h-6 text-amber-400" />
                  직계존속 (부모 및 조부모)
                </h3>
                <p className="text-sm text-stone-400 mt-1">
                  직계비속(자녀)이 전혀 없는 경우에만 제2순위로 상속인이 됩니다.
                </p>
              </div>

              {children.some((c) => !c.isDeceased && !c.isDisqualified && !c.hasDeprivation && !c.hasRenounced) ? (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs leading-relaxed">
                  💡 <strong>스마트 자동 안내</strong>: 제1순위 상속인인 생존 자녀가 존재하므로, 민법 제1000조에 따라 직계존속(부모님)은 상속 순위에서 완전히 배제됩니다. 다음 단계로 넘어가셔도 됩니다.
                </div>
              ) : null}

              <div className="space-y-3">
                {parents.map((parent) => (
                  <div key={parent.id} className="p-4 rounded-xl bg-brown-950 border border-brown-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={parent.name}
                        onChange={(e) => updatePerson(parent.id, { name: e.target.value })}
                        className="bg-brown-900 border border-brown-800 rounded px-2.5 py-1 text-sm font-semibold text-white"
                      />
                      <button
                        onClick={() => removePerson(parent.id)}
                        className="text-stone-400 hover:text-rose-400 text-xs"
                      >
                        삭제
                      </button>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <label className="flex items-center gap-1.5 text-stone-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={parent.hasDeprivation}
                          onChange={(e) => updatePerson(parent.id, { hasDeprivation: e.target.checked })}
                          className="rounded bg-brown-900 border-brown-800 text-pink-500"
                        />
                        <span>양육의무 중대위반 상실선고 (구하라법)</span>
                      </label>
                    </div>
                  </div>
                ))}

                {parents.length < 2 && (
                  <button
                    onClick={() => {
                      addPerson(
                        {
                          id: `parent_${Date.now()}`,
                          name: parents.length === 0 ? '부친' : '모친',
                          gender: parents.length === 0 ? 'MALE' : 'FEMALE',
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
                    }}
                    className="w-full py-2.5 rounded-xl border border-dashed border-brown-800 hover:border-brown-700 text-amber-400 text-xs font-semibold transition"
                  >
                    + 부모 등록하기
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 5 (SHARE_ONLY): 법정 지분율 결과 */}
          {currentStep === 5 && isShareOnly && (
            <div className="space-y-6 flex-1">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Scale className="w-6 h-6 text-emerald-400" />
                  상속인별 법정 상속지분율 및 유류분율 분석 결과
                </h3>
                <p className="text-sm text-stone-400 mt-1">
                  민법 제1000조(상속순위), 제1009조(법정상속분), 제1001조·제1003조(대습상속) 및 제1112조(유류분)에 따른 법정 지분율입니다.
                </p>
              </div>

              {calculationResult && (
                <div className="space-y-5">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-brown-950 border border-emerald-900/40">
                      <div className="text-xs text-stone-400">적용 법령 기준</div>
                      <div className="text-sm font-bold text-emerald-400 mt-1">
                        민법 제1009조 (배우자 1.5할 가산)
                      </div>
                      <div className="text-[11px] text-stone-500 mt-0.5">상속개시: {estate.openingDate}</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-brown-950 border border-brown-800">
                      <div className="text-xs text-stone-400">유효 상속인 인원</div>
                      <div className="text-lg font-bold text-white mt-1">
                        {calculationResult.heirResults.filter(h => h.statutoryShareRate.numerator > 0n).length} 명
                      </div>
                      <div className="text-[11px] text-stone-500 mt-0.5">지분 배분 대상 상속인</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-brown-950 border border-amber-900/40">
                      <div className="text-xs text-stone-400">유류분 산정 기준</div>
                      <div className="text-sm font-bold text-amber-400 mt-1">
                        배우자·직계비속 1/2 · 직계존속 1/3
                      </div>
                      <div className="text-[11px] text-stone-500 mt-0.5">2026 헌재 2020헌바43등 반영</div>
                    </div>
                  </div>

                  {/* Heir Statutory Share Table */}
                  <div className="overflow-x-auto rounded-2xl border border-brown-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-brown-950 text-stone-400 uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="px-4 py-3">상속인</th>
                          <th className="px-4 py-3">상속 관계</th>
                          <th className="px-4 py-3">상속 지위</th>
                          <th className="px-4 py-3 text-center">법정상속비율 (분수)</th>
                          <th className="px-4 py-3 text-right">지분율 (%)</th>
                          <th className="px-4 py-3 text-center">유류분율 (분수)</th>
                          <th className="px-4 py-3 text-right">유류분율 (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brown-800/60 bg-brown-900/40">
                        {calculationResult.heirResults.map((hr) => {
                          const p = allPersons.get(hr.personId);
                          const isSpouse = spouse && spouse.id === hr.personId;
                          const reserveRate = hr.statutoryShareRate.multiply(1n, 2n);
                          const isZero = hr.statutoryShareRate.numerator === 0n;

                          return (
                            <tr key={hr.personId} className="hover:bg-brown-800/30">
                              <td className="px-4 py-3.5 font-bold text-white flex items-center gap-1.5">
                                <span>{hr.name}</span>
                                {isSpouse && <span className="text-[10px] text-pink-400 font-normal">(배우자)</span>}
                              </td>
                              <td className="px-4 py-3.5 text-stone-300">
                                {isSpouse ? '배우자' : p?.gender === 'MALE' ? '직계비속 (남)' : '직계비속 (여)'}
                              </td>
                              <td className="px-4 py-3.5">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    isZero
                                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  }`}
                                >
                                  {isZero ? '상속 제외' : hr.status === 'VALID_HEIR' ? '상속인' : '대습상속인'}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-center font-mono font-bold text-emerald-400 text-sm">
                                {isZero ? '0' : hr.statutoryShareRate.toFractionString()}
                              </td>
                              <td className="px-4 py-3.5 text-right font-mono font-bold text-white">
                                {isZero ? '0.00%' : `${(hr.statutoryShareRate.toNumber() * 100).toFixed(2)}%`}
                              </td>
                              <td className="px-4 py-3.5 text-center font-mono font-medium text-amber-400">
                                {isZero ? '0' : reserveRate.toFractionString()}
                              </td>
                              <td className="px-4 py-3.5 text-right font-mono text-amber-300">
                                {isZero ? '0.00%' : `${(reserveRate.toNumber() * 100).toFixed(2)}%`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Legal Formula Explanations */}
                  <div className="p-4 rounded-2xl bg-brown-950/80 border border-brown-800 space-y-2">
                    <div className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      민법상 법정 상속지분율 산출 원리
                    </div>
                    <ul className="text-xs text-stone-400 space-y-1 list-disc list-inside">
                      <li>동순위 상속인이 수인인 때에는 그 상속분은 균등하게 나눕니다 (민법 제1009조 제1항).</li>
                      <li>피상속인의 배우자의 상속분은 직계비속 또는 직계존속과 공동으로 상속하는 때에는 그 상속분의 5할을 가산합니다 (1.5 : 1) (민법 제1009조 제2항).</li>
                      <li>대습상속인의 상속분은 피대습인이 받을 상속분의 한도 내에서 균등 분배됩니다 (민법 제1001조, 제1010조).</li>
                      <li>유류분은 피상속인의 배우자 및 직계비속의 경우 법정상속분의 1/2이며, 형제자매는 2026년 개정 민법에 의해 제외되었습니다.</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5 (FULL MODE): 상속 재산 및 채무 */}
          {currentStep === 5 && !isShareOnly && (
            <div className="space-y-6 flex-1">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Building2 className="w-6 h-6 text-amber-400" />
                  상속 재산 및 상속 채무
                </h3>
                <p className="text-sm text-stone-400 mt-1">
                  고인이 사망 당시 남긴 순수 적극재산(부동산, 예금 등)과 소극재산(채무, 대출금)을 입력합니다.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                    부동산 가액 (원)
                  </label>
                  <WonCurrencyInput
                    value={estate.activeRealEstateWon}
                    placeholder="0"
                    onChange={(val) => updateEstate({ activeRealEstateWon: val })}
                    className="w-full bg-brown-950 border border-brown-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <span className="text-[11px] text-stone-400 mt-1 block">
                    {formatWon(estate.activeRealEstateWon)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                    금융 재산 (예금, 주식 등) (원)
                  </label>
                  <WonCurrencyInput
                    value={estate.activeFinancialWon}
                    placeholder="0"
                    onChange={(val) => updateEstate({ activeFinancialWon: val })}
                    className="w-full bg-brown-950 border border-brown-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <span className="text-[11px] text-stone-400 mt-1 block">
                    {formatWon(estate.activeFinancialWon)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                    기타 적극재산 (원)
                  </label>
                  <WonCurrencyInput
                    value={estate.activeOtherWon}
                    placeholder="0"
                    onChange={(val) => updateEstate({ activeOtherWon: val })}
                    className="w-full bg-brown-950 border border-brown-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <span className="text-[11px] text-stone-400 mt-1 block">
                    {formatWon(estate.activeOtherWon)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-rose-300 mb-1.5">
                    상속 채무 (소극재산, 대출금) (원)
                  </label>
                  <WonCurrencyInput
                    value={estate.passiveDebtWon}
                    placeholder="0"
                    onChange={(val) => updateEstate({ passiveDebtWon: val })}
                    className="w-full bg-brown-950 border border-rose-900/40 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500 font-mono"
                  />
                  <span className="text-[11px] text-rose-400 mt-1 block">
                    {formatWon(estate.passiveDebtWon)} (대법원 97다8809 법정지분 승계)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6 (FULL MODE): 특별수익 및 기여분 */}
          {currentStep === 6 && !isShareOnly && (
            <div className="space-y-6 flex-1">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Coins className="w-6 h-6 text-amber-400" />
                  특별수익(생전증여/유증) 및 기여분 요약
                </h3>
                <p className="text-sm text-stone-400 mt-1">
                  생전 증여액이 법정상속분을 초과하면 대법원 2017스98 전원합의체 판례에 따라 초과분이 다른 공동상속인에게 안분 수렴됩니다.
                </p>
              </div>

              <div className="space-y-3">
                {Array.from(allPersons.values())
                  .filter((p) => p.id !== deceasedId)
                  .map((p) => {
                    const totalGifts = p.specialBenefits.reduce((sum, g) => sum + g.amountWon, 0n);
                    const totalBequests = p.bequests.reduce((sum, b) => sum + b.amountWon, 0n);

                    return (
                      <div key={p.id} className="p-4 rounded-xl bg-brown-950 border border-brown-800 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-bold text-white">{p.name}</span>
                          <span className="text-xs text-stone-400">
                            기여분: {formatWon(p.contributionAmountWon)} · 특별수익:{' '}
                            {formatWon(totalGifts + totalBequests)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* STEP 7 (FULL MODE): 최종 결과 */}
          {currentStep === 7 && !isShareOnly && (
            <div className="space-y-6 flex-1">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Scale className="w-6 h-6 text-amber-400" />
                  법률 판례 기반 최종 상속 분배 결과
                </h3>
                <p className="text-sm text-stone-400 mt-1">
                  2026 개정 민법 및 대법원 2017스98 전합 수렴 루프를 반영한 상속인별 최종 수령액입니다.
                </p>
              </div>

              {calculationResult && (
                <div className="space-y-4">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-brown-950 border border-brown-800">
                      <div className="text-xs text-stone-400">총 적극 상속재산</div>
                      <div className="text-lg font-bold text-amber-400 mt-1 font-mono">
                        {formatWon(
                          estate.activeRealEstateWon + estate.activeFinancialWon + estate.activeOtherWon
                        )}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-brown-950 border border-brown-800">
                      <div className="text-xs text-stone-400">간주상속재산 (특별수익 합산)</div>
                      <div className="text-lg font-bold text-amber-200 mt-1 font-mono">
                        {formatWon(calculationResult.deemedEstateWon)}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-brown-950 border border-brown-800">
                      <div className="text-xs text-stone-400">유류분 산정 기초재산</div>
                      <div className="text-lg font-bold text-amber-500 mt-1 font-mono">
                        {formatWon(calculationResult.reserveSettlement.baseEstateWon)}
                      </div>
                    </div>
                  </div>

                  {/* Heir Distribution Table */}
                  <div className="overflow-x-auto rounded-2xl border border-brown-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-brown-950 text-stone-400 uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="px-4 py-3">상속인</th>
                          <th className="px-4 py-3">자격</th>
                          <th className="px-4 py-3">법정상속비율</th>
                          <th className="px-4 py-3">구체적 상속분</th>
                          <th className="px-4 py-3">승계 채무</th>
                          <th className="px-4 py-3">순 수령액</th>
                          <th className="px-4 py-3">유류분 정산</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brown-800/60 bg-brown-900/40">
                        {calculationResult.heirResults.map((hr) => (
                          <tr key={hr.personId} className="hover:bg-brown-800/30">
                            <td className="px-4 py-3.5 font-bold text-white">{hr.name}</td>
                            <td className="px-4 py-3.5 text-stone-300">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  hr.status === 'VALID_HEIR'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                {hr.status === 'VALID_HEIR' ? '상속인' : '대습상속인'}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-amber-400 font-mono font-medium">
                              {hr.statutoryShareRate.toFractionString()}
                            </td>
                            <td className="px-4 py-3.5 text-emerald-400 font-mono font-bold">
                              {formatWon(hr.finalConcreteShareWon)}
                            </td>
                            <td className="px-4 py-3.5 text-rose-400 font-mono">
                              {hr.allocatedDebtWon > 0n ? `-${formatWon(hr.allocatedDebtWon)}` : '0원'}
                            </td>
                            <td className="px-4 py-3.5 text-white font-mono font-extrabold">
                              {formatWon(hr.netInheritanceWon)}
                            </td>
                            <td className="px-4 py-3.5 text-amber-400 font-mono">
                              {hr.reserveShortageWon > 0n
                                ? `부족액 +${formatWon(hr.reserveShortageWon)}`
                                : hr.reserveCompensationObligationWon > 0n
                                ? `반환의무 -${formatWon(hr.reserveCompensationObligationWon)}`
                                : '정산완료'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Cash Compensation Flows (Civil Act Art. 1115) */}
                  {calculationResult.reserveSettlement.compensationFlows.length > 0 && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                      <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" />
                        2026 민법 제1115조 유류분 가액(금전)반환 청구 명세
                      </div>
                      {calculationResult.reserveSettlement.compensationFlows.map((flow, i) => (
                        <div key={i} className="text-xs text-stone-300 flex items-center gap-2">
                          <span className="font-semibold text-rose-400">{flow.fromPersonName}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-stone-500" />
                          <span className="font-semibold text-emerald-400">{flow.toPersonName}</span>
                          <span className="text-stone-400 font-mono">: {formatWon(flow.amountWon)} (금전 반환)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 mt-6 border-t border-brown-800">
            <button
              onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
              disabled={currentStep === 1}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                currentStep === 1
                  ? 'opacity-40 cursor-not-allowed text-stone-500'
                  : 'text-stone-300 hover:text-white bg-brown-800 hover:bg-brown-700'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              이전 단계
            </button>

            {currentStep < maxStep ? (
              <button
                onClick={() => setCurrentStep((s) => Math.min(maxStep, s + 1))}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/25 transition"
              >
                다음 단계
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setCurrentStep(1)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 transition"
              >
                처음부터 다시 보기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
