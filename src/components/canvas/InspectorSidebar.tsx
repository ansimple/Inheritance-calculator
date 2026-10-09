import React, { useState } from 'react';
import { 
  X, 
  Trash2, 
  Plus, 
  ShieldAlert, 
  Coins, 
  Gift, 
  ScrollText,
  UserCheck
} from 'lucide-react';
import { useInheritanceStore } from '../../state/useInheritanceStore';
import { AdoptionType, Gender } from '../../domain/models/Person';

export const InspectorSidebar: React.FC = () => {
  const { 
    selectedPersonId, 
    allPersons, 
    deceasedId, 
    calculationResult,
    selectPerson, 
    updatePerson, 
    removePerson 
  } = useInheritanceStore();

  const [giftAmountInput, setGiftAmountInput] = useState('');
  const [giftDateInput, setGiftDateInput] = useState('2024-01-01');
  const [giftIsComp, setGiftIsComp] = useState(false);

  const [bequestAmountInput, setBequestAmountInput] = useState('');
  const [bequestDescInput, setBequestDescInput] = useState('');

  if (!selectedPersonId) return null;
  const person = allPersons.get(selectedPersonId);
  if (!person) return null;

  const isDeceased = person.id === deceasedId;
  const heirResult = calculationResult?.heirResults.find(h => h.personId === person.id);

  const handleAddGift = () => {
    const amt = BigInt(giftAmountInput.replace(/[^0-9]/g, '') || '0');
    if (amt <= 0n) return;

    const newGift = {
      id: `gift_${Date.now()}`,
      recipientId: person.id,
      amountWon: amt,
      giftDate: giftDateInput,
      isContributionCompensation: giftIsComp,
      description: giftIsComp ? '기여보상 증여' : '일반 생전 증여',
    };

    updatePerson(person.id, {
      specialBenefits: [...person.specialBenefits, newGift],
    });
    setGiftAmountInput('');
  };

  const handleRemoveGift = (giftId: string) => {
    updatePerson(person.id, {
      specialBenefits: person.specialBenefits.filter(g => g.id !== giftId),
    });
  };

  const handleAddBequest = () => {
    const amt = BigInt(bequestAmountInput.replace(/[^0-9]/g, '') || '0');
    if (amt <= 0n) return;

    const newBequest = {
      id: `bequest_${Date.now()}`,
      recipientId: person.id,
      amountWon: amt,
      description: bequestDescInput || '유언 유증',
    };

    updatePerson(person.id, {
      bequests: [...person.bequests, newBequest],
    });
    setBequestAmountInput('');
    setBequestDescInput('');
  };

  const handleRemoveBequest = (bequestId: string) => {
    updatePerson(person.id, {
      bequests: person.bequests.filter(b => b.id !== bequestId),
    });
  };

  return (
    <aside className="absolute top-4 right-4 z-10 w-84 max-h-[calc(100vh-5rem)] overflow-y-auto bg-slate-900/95 backdrop-blur border border-slate-800 rounded-2xl shadow-2xl p-5 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <UserCheck className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              {person.name}
              {isDeceased && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-normal">
                  피상속인
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">{person.id}</p>
          </div>
        </div>

        <button
          onClick={() => selectPerson(null)}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Calculated Result Card if Available */}
      {heirResult && (
        <div className="mt-4 p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">법정상속비율</span>
            <span className="font-bold text-sky-400">
              {heirResult.statutoryShareRate.toFractionString()} (
              {(heirResult.statutoryShareRate.toNumber() * 100).toFixed(1)}%)
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">최종 배분액</span>
            <span className="font-bold text-emerald-400 text-sm">
              {heirResult.finalConcreteShareWon.toLocaleString()} 원
            </span>
          </div>

          {heirResult.allocatedDebtWon > 0n && (
            <div className="flex items-center justify-between text-[11px] text-rose-400">
              <span>승계 채무</span>
              <span>-{heirResult.allocatedDebtWon.toLocaleString()} 원</span>
            </div>
          )}

          {heirResult.reserveShortageWon > 0n && (
            <div className="flex items-center justify-between text-[11px] text-amber-400 pt-1 border-t border-slate-800">
              <span>유류분 부족(청구)</span>
              <span>+{heirResult.reserveShortageWon.toLocaleString()} 원</span>
            </div>
          )}

          {heirResult.reserveCompensationObligationWon > 0n && (
            <div className="flex items-center justify-between text-[11px] text-rose-400 pt-1 border-t border-slate-800">
              <span>유류분 반환 의무</span>
              <span>-{heirResult.reserveCompensationObligationWon.toLocaleString()} 원</span>
            </div>
          )}
        </div>
      )}

      {/* Profile Form */}
      <div className="mt-4 space-y-3 text-xs">
        <div>
          <label className="text-slate-400 block mb-1">이름</label>
          <input
            type="text"
            value={person.name}
            onChange={(e) => updatePerson(person.id, { name: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-slate-400 block mb-1">성별</label>
            <select
              value={person.gender}
              onChange={(e) => updatePerson(person.id, { gender: e.target.value as Gender })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-sky-500"
            >
              <option value="MALE">남성 (♂)</option>
              <option value="FEMALE">여성 (♀)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">입양 형태</label>
            <select
              value={person.adoptionType}
              onChange={(e) => updatePerson(person.id, { adoptionType: e.target.value as AdoptionType })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-sky-500"
            >
              <option value="NONE">친생자</option>
              <option value="ORDINARY_ADOPTED">일반 양자</option>
              <option value="FULL_ADOPTED">친양자 (단절)</option>
            </select>
          </div>
        </div>

        {/* Legal Status Flags */}
        {!isDeceased && (
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              법적 자격 및 특수 상태
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={person.isDeceased}
                onChange={(e) => updatePerson(person.id, { isDeceased: e.target.checked })}
                className="rounded bg-slate-950 border-slate-800 text-sky-500 focus:ring-0"
              />
              <span>선사망 (고인보다 먼저 사망)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={person.isDisqualified}
                onChange={(e) => updatePerson(person.id, { isDisqualified: e.target.checked })}
                className="rounded bg-slate-950 border-slate-800 text-rose-500 focus:ring-0"
              />
              <span>상속결격 (민법 제1004조 살해·사기·유언방해)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={person.hasDeprivation}
                onChange={(e) => updatePerson(person.id, { hasDeprivation: e.target.checked })}
                className="rounded bg-slate-950 border-slate-800 text-pink-500 focus:ring-0"
              />
              <span>상속권 상실선고 (구하라법 제1004조의2)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={person.hasRenounced}
                onChange={(e) => updatePerson(person.id, { hasRenounced: e.target.checked })}
                className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-0"
              />
              <span>상속포기 신고 수리 (민법 제1019조)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={person.remarriedBeforeOpening}
                onChange={(e) => updatePerson(person.id, { remarriedBeforeOpening: e.target.checked })}
                className="rounded bg-slate-950 border-slate-800 text-indigo-500 focus:ring-0"
              />
              <span>재혼 여부 (선사망 배우자의 재혼으로 인척종료)</span>
            </label>
          </div>
        )}

        {/* Contribution Amount */}
        {!isDeceased && (
          <div className="pt-2 border-t border-slate-800">
            <label className="text-slate-400 block mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-300 font-semibold text-[11px]">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                기여분 (원)
              </span>
              <span className="text-[10px] text-slate-400">민법 제1008조의2</span>
            </label>
            <input
              type="text"
              value={person.contributionAmountWon > 0n ? person.contributionAmountWon.toString() : ''}
              placeholder="예: 50000000"
              onChange={(e) => {
                const val = BigInt(e.target.value.replace(/[^0-9]/g, '') || '0');
                updatePerson(person.id, { contributionAmountWon: val });
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>
        )}

        {/* Special Benefits (Gifts) */}
        {!isDeceased && (
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-300 font-semibold text-[11px]">
                <Gift className="w-3.5 h-3.5 text-pink-400" />
                생전 증여 (특별수익)
              </span>
              <span className="text-[10px] text-slate-400">
                합계: {person.specialBenefits.reduce((sum, g) => sum + g.amountWon, 0n).toLocaleString()}원
              </span>
            </div>

            {/* List */}
            {person.specialBenefits.map((g) => (
              <div key={g.id} className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800 text-[11px]">
                <div>
                  <div className="font-semibold text-white">
                    {g.amountWon.toLocaleString()} 원
                  </div>
                  <div className="text-slate-400 text-[10px]">
                    {g.giftDate} · {g.isContributionCompensation ? '기여보상 증여(제외)' : '일반증여'}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveGift(g.id)}
                  className="text-slate-400 hover:text-rose-400 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* Add gift input */}
            <div className="space-y-1.5 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="금액(원)"
                  value={giftAmountInput}
                  onChange={(e) => setGiftAmountInput(e.target.value)}
                  className="w-1/2 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs font-mono"
                />
                <input
                  type="date"
                  value={giftDateInput}
                  onChange={(e) => setGiftDateInput(e.target.value)}
                  className="w-1/2 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs"
                />
              </div>

              <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={giftIsComp}
                  onChange={(e) => setGiftIsComp(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-sky-500"
                />
                <span>기여보상 증여 (2026 개정 민법 제1008조 단서 제외)</span>
              </label>

              <button
                onClick={handleAddGift}
                className="w-full flex items-center justify-center gap-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 font-medium text-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                증여 추가
              </button>
            </div>
          </div>
        )}

        {/* Bequests */}
        {!isDeceased && (
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-300 font-semibold text-[11px]">
                <ScrollText className="w-3.5 h-3.5 text-violet-400" />
                유언 유증 (Bequest)
              </span>
              <span className="text-[10px] text-slate-400">
                합계: {person.bequests.reduce((sum, b) => sum + b.amountWon, 0n).toLocaleString()}원
              </span>
            </div>

            {person.bequests.map((b) => (
              <div key={b.id} className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800 text-[11px]">
                <div>
                  <div className="font-semibold text-white">
                    {b.amountWon.toLocaleString()} 원
                  </div>
                  <div className="text-slate-400 text-[10px]">
                    {b.description || '유증'}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveBequest(b.id)}
                  className="text-slate-400 hover:text-rose-400 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            <div className="space-y-1.5 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="유증 금액(원)"
                  value={bequestAmountInput}
                  onChange={(e) => setBequestAmountInput(e.target.value)}
                  className="w-1/2 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs font-mono"
                />
                <input
                  type="text"
                  placeholder="설명"
                  value={bequestDescInput}
                  onChange={(e) => setBequestDescInput(e.target.value)}
                  className="w-1/2 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs"
                />
              </div>

              <button
                onClick={handleAddBequest}
                className="w-full flex items-center justify-center gap-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-violet-400 font-medium text-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                유증 추가
              </button>
            </div>
          </div>
        )}

        {/* Delete Person Button */}
        {!isDeceased && (
          <div className="pt-3 border-t border-slate-800">
            <button
              onClick={() => removePerson(person.id)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              가계도에서 삭제
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
