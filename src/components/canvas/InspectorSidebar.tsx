import React, { useState, useRef } from 'react';
import { 
  X, 
  Trash2, 
  Plus, 
  ShieldAlert, 
  Coins, 
  Gift, 
  ScrollText,
  UserCheck,
  Maximize2,
  Minimize2,
  RotateCcw,
  GripHorizontal,
  Scale
} from 'lucide-react';
import { useInheritanceStore } from '../../state/useInheritanceStore';
import { AdoptionType, Gender } from '../../domain/models/Person';
import { WonCurrencyInput } from '../common/WonCurrencyInput';

export const InspectorSidebar: React.FC = () => {
  const { 
    selectedPersonId, 
    allPersons, 
    deceasedId, 
    calculationResult,
    calculationMode,
    selectPerson, 
    updatePerson, 
    removePerson 
  } = useInheritanceStore();

  const [giftAmountInput, setGiftAmountInput] = useState('');
  const [giftDateInput, setGiftDateInput] = useState('2024-01-01');
  const [giftIsComp, setGiftIsComp] = useState(false);

  const [bequestAmountInput, setBequestAmountInput] = useState('');
  const [bequestDescInput, setBequestDescInput] = useState('');

  // Floating window position & size states (Desktop)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 384,
    height: 640,
  });
  const [isMaximized, setIsMaximized] = useState(false);
  const prevRectRef = useRef<{ pos: { x: number; y: number } | null; size: { width: number; height: number } }>({
    pos: null,
    size: { width: 384, height: 640 },
  });
  const asideRef = useRef<HTMLElement>(null);

  if (!selectedPersonId) return null;
  const person = allPersons.get(selectedPersonId);
  if (!person) return null;

  const isDeceased = person.id === deceasedId;
  const heirResult = calculationResult?.heirResults.find(h => h.personId === person.id);

  // Determine status badge (sticker) corresponding to the canvas node badge
  const getStatusBadge = () => {
    if (isDeceased) {
      return { text: '피상속인', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
    }
    if (person.isDisqualified) {
      return { text: '상속결격', bg: 'bg-red-500/20 text-red-300 border-red-500/40' };
    }
    if (person.hasDeprivation) {
      return { text: '상실선고', bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40' };
    }
    if (person.hasRenounced) {
      return { text: '상속포기', bg: 'bg-amber-700/20 text-amber-400 border-amber-700/40' };
    }
    if (person.isDeceased) {
      return { text: '선사망', bg: 'bg-stone-500/25 text-stone-300 border-stone-500/40' };
    }
    if (heirResult?.status === 'VALID_HEIR') {
      return { text: '상속인', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
    }
    if (heirResult?.status === 'REPRESENTATIVE_HEIR') {
      return { text: '대습상속인', bg: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
    }
    return { text: '비상속인', bg: 'bg-stone-700/30 text-stone-400 border-stone-700/50' };
  };

  const statusBadge = getStatusBadge();

  // Compute floating style for desktop viewport
  const getFloatingStyle = (): React.CSSProperties => {
    if (typeof window === 'undefined') return {};
    if (window.innerWidth < 640) {
      return {};
    }

    if (isMaximized) {
      const curW = Math.max(340, Math.min(window.innerWidth - 40, size.width));
      const maxHeight = window.innerHeight - 80;
      return {
        top: '4.5rem',
        right: '1.25rem',
        width: `${curW}px`,
        height: `${maxHeight}px`,
      };
    }

    if (position) {
      return {
        top: `${position.y}px`,
        left: `${position.x}px`,
        right: 'auto',
        bottom: 'auto',
        width: `${size.width}px`,
        height: `${size.height}px`,
      };
    }

    // Default desktop placement: 72px (top-18) below header (56px) and 20px from right
    return {
      top: '4.5rem',
      right: '1.25rem',
      width: `${size.width}px`,
      height: `${Math.min(size.height, window.innerHeight - 90)}px`,
    };
  };

  // Drag handler for window movement
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (window.innerWidth < 640) return;
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a, .no-drag')) return;
    if (isMaximized) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const aside = asideRef.current;
    if (!aside) return;

    const rect = aside.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;

    const onMove = (moveEv: MouseEvent | TouchEvent) => {
      const curX = 'touches' in moveEv ? moveEv.touches[0].clientX : moveEv.clientX;
      const curY = 'touches' in moveEv ? moveEv.touches[0].clientY : moveEv.clientY;

      const newX = Math.max(10, Math.min(window.innerWidth - rect.width - 10, curX - offsetX));
      // Clamp Y to stay within viewport while not disappearing under top
      const newY = Math.max(58, Math.min(window.innerHeight - 60, curY - offsetY));

      setPosition({ x: newX, y: newY });
    };

    const onEnd = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);
  };

  // Resize handler
  const handleResizeStart = (
    e: React.MouseEvent,
    dir: 'left' | 'bottom' | 'bottom-left' | 'right' | 'bottom-right'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (window.innerWidth < 640) return;
    if (isMaximized && dir !== 'left') return;

    const aside = asideRef.current;
    if (!aside) return;

    const startRect = aside.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const initW = startRect.width;
    const initH = startRect.height;
    const initLeft = startRect.left;
    const initTop = startRect.top;

    const onMove = (moveEv: MouseEvent) => {
      const deltaX = moveEv.clientX - startX;
      const deltaY = moveEv.clientY - startY;

      if (isMaximized) {
        // In maximized mode, right edge is fixed at 1.25rem, only width adjusts from left wall
        const candidateW = initW - deltaX;
        const newW = Math.max(340, Math.min(window.innerWidth - 40, candidateW));
        setSize((prev) => ({ ...prev, width: newW }));
        return;
      }

      let newW = initW;
      let newH = initH;
      let newX = position ? position.x : initLeft;

      if (dir === 'left' || dir === 'bottom-left') {
        const candidateW = initW - deltaX;
        newW = Math.max(340, Math.min(window.innerWidth - 40, candidateW));
        newX = initLeft + (initW - newW);
      } else if (dir === 'right' || dir === 'bottom-right') {
        const candidateW = initW + deltaX;
        newW = Math.max(340, Math.min(window.innerWidth - (position?.x ?? initLeft) - 20, candidateW));
      }

      if (dir === 'bottom' || dir === 'bottom-left' || dir === 'bottom-right') {
        const candidateH = initH + deltaY;
        newH = Math.max(360, Math.min(window.innerHeight - (position?.y ?? initTop) - 20, candidateH));
      }

      setSize({ width: newW, height: newH });
      if (dir === 'left' || dir === 'bottom-left') {
        setPosition({ x: newX, y: position ? position.y : initTop });
      } else if (!position) {
        setPosition({ x: initLeft, y: initTop });
      }
    };

    const onEnd = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
  };

  // Toggle maximize
  const toggleMaximize = () => {
    if (isMaximized) {
      setPosition(prevRectRef.current.pos);
      setSize(prevRectRef.current.size);
      setIsMaximized(false);
    } else {
      prevRectRef.current = {
        pos: position,
        size: size,
      };
      // Default maximized width reduced by 30% (680px -> 476px)
      const maxWidth = Math.min(476, window.innerWidth - 40);
      const maxHeight = window.innerHeight - 80;
      setIsMaximized(true);
      setPosition({ x: Math.max(20, window.innerWidth - maxWidth - 20), y: 64 });
      setSize({ width: maxWidth, height: maxHeight });
    }
  };

  // Reset position & size
  const handleReset = () => {
    setPosition(null);
    setSize({ width: 384, height: Math.min(640, window.innerHeight - 90) });
    setIsMaximized(false);
  };

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
    <aside
      ref={asideRef}
      style={getFloatingStyle()}
      className="fixed inset-x-0 bottom-16 sm:bottom-auto sm:inset-x-auto z-40 sm:z-30 w-full sm:w-auto max-h-[75vh] sm:max-h-none flex flex-col bg-brown-900/95 backdrop-blur-xl border-t sm:border border-brown-700/80 sm:border-brown-800 rounded-t-3xl sm:rounded-2xl shadow-2xl text-stone-200 overflow-hidden"
    >
      {/* Mobile Drag Handle Indicator */}
      <div className="w-10 h-1 bg-brown-700 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

      {/* Header Bar (Draggable on Desktop) */}
      <div
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        onDoubleClick={toggleMaximize}
        className="flex items-center justify-between px-4 py-3 sm:px-4 sm:py-3.5 border-b border-brown-800 shrink-0 bg-brown-900/90 sm:cursor-grab sm:active:cursor-grabbing select-none"
        title="드래그하여 이동 (더블클릭 시 확대/복원)"
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal className="w-4 h-4 text-brown-500 hidden sm:block shrink-0" />
          <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0">
            <UserCheck className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5 truncate">
              <span className="truncate">{person.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-normal shrink-0 ${statusBadge.bg}`}>
                {statusBadge.text}
              </span>
            </h3>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {/* Position Reset Button */}
          <button
            onClick={handleReset}
            className="p-1 text-stone-400 hover:text-amber-300 hover:bg-brown-800 rounded-lg transition hidden sm:inline-flex"
            title="위치 및 크기 초기화"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Maximize / Restore Button */}
          <button
            onClick={toggleMaximize}
            className="p-1 text-stone-400 hover:text-amber-300 hover:bg-brown-800 rounded-lg transition hidden sm:inline-flex"
            title={isMaximized ? "원래 크기로 복원" : "창 확대"}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Close Button */}
          <button
            onClick={() => selectPerson(null)}
            className="p-1 text-stone-400 hover:text-white hover:bg-brown-800 rounded-lg transition"
            title="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Body Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {/* Profile Form */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="text-stone-400 block mb-1">이름</label>
            <input
              type="text"
              value={person.name}
              onChange={(e) => updatePerson(person.id, { name: e.target.value })}
              className="w-full bg-brown-950 border border-brown-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-stone-400 block mb-1">성별</label>
              <select
                value={person.gender}
                onChange={(e) => updatePerson(person.id, { gender: e.target.value as Gender })}
                className="w-full bg-brown-950 border border-brown-800 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-amber-500"
              >
                <option value="MALE">남성 (♂)</option>
                <option value="FEMALE">여성 (♀)</option>
              </select>
            </div>

            <div>
              <label className="text-stone-400 block mb-1">입양 형태</label>
              <select
                value={person.adoptionType}
                onChange={(e) => updatePerson(person.id, { adoptionType: e.target.value as AdoptionType })}
                className="w-full bg-brown-950 border border-brown-800 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-amber-500"
              >
                <option value="NONE">친생자</option>
                <option value="ORDINARY_ADOPTED">일반 양자</option>
                <option value="FULL_ADOPTED">친양자 (단절)</option>
              </select>
            </div>
          </div>

          {/* Legal Status Flags */}
          {!isDeceased && (
            <div className="pt-2 border-t border-brown-800 space-y-2">
              <div className="text-[11px] font-semibold text-stone-300 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                법적 자격 및 특수 상태
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-stone-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={person.isDeceased}
                  onChange={(e) => updatePerson(person.id, { isDeceased: e.target.checked })}
                  className="rounded bg-brown-950 border-brown-800 text-amber-500 focus:ring-0"
                />
                <span>선사망 (고인보다 먼저 사망)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-stone-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={person.isDisqualified}
                  onChange={(e) => updatePerson(person.id, { isDisqualified: e.target.checked })}
                  className="rounded bg-brown-950 border-brown-800 text-rose-500 focus:ring-0"
                />
                <span>상속결격 (민법 제1004조 살해·사기·유언방해)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-stone-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={person.hasDeprivation}
                  onChange={(e) => updatePerson(person.id, { hasDeprivation: e.target.checked })}
                  className="rounded bg-brown-950 border-brown-800 text-rose-400 focus:ring-0"
                />
                <span>상속권 상실선고 (구하라법 제1004조의2)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-stone-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={person.hasRenounced}
                  onChange={(e) => updatePerson(person.id, { hasRenounced: e.target.checked })}
                  className="rounded bg-brown-950 border-brown-800 text-amber-500 focus:ring-0"
                />
                <span>상속포기 신고 수리 (민법 제1019조)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-stone-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={person.remarriedBeforeOpening}
                  onChange={(e) => updatePerson(person.id, { remarriedBeforeOpening: e.target.checked })}
                  className="rounded bg-brown-950 border-brown-800 text-amber-500 focus:ring-0"
                />
                <span>재혼 여부 (선사망 배우자의 재혼으로 인척종료)</span>
              </label>
            </div>
          )}

          {/* Contribution Amount */}
          {!isDeceased && calculationMode === 'SHARE_ONLY' && (
            <div className="pt-2 border-t border-brown-800">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 leading-relaxed">
                <p className="font-semibold flex items-center gap-1.5 mb-1 text-amber-300">
                  <Scale className="w-3.5 h-3.5" />
                  지분율 모드
                </p>
                <p className="text-[11px] text-stone-400">
                  금액 산정(기여분, 생전 증여, 유증 등)을 생략하고 법정 상속지분율 및 유류분 권리율만 산출합니다. 금액을 정산하시려면 상단 스위치에서 [금액 정산]을 선택하세요.
                </p>
              </div>
            </div>
          )}

          {/* Contribution Amount */}
          {!isDeceased && calculationMode === 'FULL' && (
            <div className="pt-2 border-t border-brown-800">
              <label className="text-stone-400 block mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-stone-300 font-semibold text-[11px]">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  기여분 (원)
                </span>
                <span className="text-[10px] text-stone-400">민법 제1008조의2</span>
              </label>
              <WonCurrencyInput
                value={person.contributionAmountWon}
                placeholder="0"
                onChange={(val) => updatePerson(person.id, { contributionAmountWon: val })}
                className="w-full bg-brown-950 border border-brown-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          )}

          {/* Special Benefits (Gifts) */}
          {!isDeceased && calculationMode === 'FULL' && (
            <div className="pt-2 border-t border-brown-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-stone-300 font-semibold text-[11px]">
                  <Gift className="w-3.5 h-3.5 text-pink-400" />
                  생전 증여 (특별수익)
                </span>
                <span className="text-[10px] text-stone-400">
                  합계: {person.specialBenefits.reduce((sum, g) => sum + g.amountWon, 0n).toLocaleString()}원
                </span>
              </div>

              {/* List */}
              {person.specialBenefits.map((g) => (
                <div key={g.id} className="flex items-center justify-between bg-brown-950 p-2 rounded-lg border border-brown-800 text-[11px]">
                  <div>
                    <div className="font-semibold text-white">
                      {g.amountWon.toLocaleString()} 원
                    </div>
                    <div className="text-stone-400 text-[10px]">
                      {g.giftDate} · {g.isContributionCompensation ? '기여보상 증여(제외)' : '일반증여'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveGift(g.id)}
                    className="text-stone-400 hover:text-rose-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Add gift input */}
              <div className="space-y-1.5 bg-brown-950/60 p-2.5 rounded-lg border border-brown-800">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="금액(원)"
                    value={giftAmountInput}
                    onChange={(e) => setGiftAmountInput(e.target.value)}
                    className="w-1/2 bg-brown-950 border border-brown-800 rounded px-2 py-1 text-white text-xs font-mono"
                  />
                  <input
                    type="date"
                    value={giftDateInput}
                    onChange={(e) => setGiftDateInput(e.target.value)}
                    className="w-1/2 bg-brown-950 border border-brown-800 rounded px-2 py-1 text-white text-xs"
                  />
                </div>

                <label className="flex items-center gap-1.5 text-[10px] text-stone-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={giftIsComp}
                    onChange={(e) => setGiftIsComp(e.target.checked)}
                    className="rounded bg-brown-950 border-brown-800 text-amber-500"
                  />
                  <span>기여보상 증여 (2026 개정 민법 제1008조 단서 제외)</span>
                </label>

                <button
                  onClick={handleAddGift}
                  className="w-full flex items-center justify-center gap-1 py-1 rounded bg-brown-800 hover:bg-brown-700 text-amber-400 font-medium text-xs transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  증여 추가
                </button>
              </div>
            </div>
          )}

          {/* Bequests */}
          {!isDeceased && calculationMode === 'FULL' && (
            <div className="pt-2 border-t border-brown-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-stone-300 font-semibold text-[11px]">
                  <ScrollText className="w-3.5 h-3.5 text-amber-400" />
                  유언 유증 (Bequest)
                </span>
                <span className="text-[10px] text-stone-400">
                  합계: {person.bequests.reduce((sum, b) => sum + b.amountWon, 0n).toLocaleString()}원
                </span>
              </div>

              {person.bequests.map((b) => (
                <div key={b.id} className="flex items-center justify-between bg-brown-950 p-2 rounded-lg border border-brown-800 text-[11px]">
                  <div>
                    <div className="font-semibold text-white">
                      {b.amountWon.toLocaleString()} 원
                    </div>
                    <div className="text-stone-400 text-[10px]">
                      {b.description || '유증'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveBequest(b.id)}
                    className="text-stone-400 hover:text-rose-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <div className="space-y-1.5 bg-brown-950/60 p-2.5 rounded-lg border border-brown-800">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="유증 금액(원)"
                    value={bequestAmountInput}
                    onChange={(e) => setBequestAmountInput(e.target.value)}
                    className="w-1/2 bg-brown-950 border border-brown-800 rounded px-2 py-1 text-white text-xs font-mono"
                  />
                  <input
                    type="text"
                    placeholder="설명"
                    value={bequestDescInput}
                    onChange={(e) => setBequestDescInput(e.target.value)}
                    className="w-1/2 bg-brown-950 border border-brown-800 rounded px-2 py-1 text-white text-xs"
                  />
                </div>

                <button
                  onClick={handleAddBequest}
                  className="w-full flex items-center justify-center gap-1 py-1 rounded bg-brown-800 hover:bg-brown-700 text-amber-400 font-medium text-xs transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  유증 추가
                </button>
              </div>
            </div>
          )}

          {/* Delete Person Button */}
          {!isDeceased && (
            <div className="pt-3 border-t border-brown-800">
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
      </div>

      {/* Resize Handles (Desktop only) */}
      {/* Left Edge Resize (Available both in normal and maximized mode) */}
      <div
        onMouseDown={(e) => handleResizeStart(e, 'left')}
        className="hidden sm:block absolute top-12 bottom-4 left-0 w-2 cursor-ew-resize z-10"
        title="좌우 너비 조절"
      />

      {/* Bottom & Corner Resize Handles (Normal mode only) */}
      {!isMaximized && (
        <>
          {/* Bottom Edge Resize */}
          <div
            onMouseDown={(e) => handleResizeStart(e, 'bottom')}
            className="hidden sm:block absolute bottom-0 left-4 right-4 h-2 cursor-ns-resize z-10"
            title="상하 높이 조절"
          />
          {/* Bottom-Left Corner Resize */}
          <div
            onMouseDown={(e) => handleResizeStart(e, 'bottom-left')}
            className="hidden sm:block absolute bottom-0 left-0 w-6 h-6 cursor-nesw-resize rounded-bl-2xl z-20 group"
            title="크기 조절 (가로/세로)"
          >
            <div className="w-2 h-2 border-b-[1.5px] border-l-[1.5px] border-amber-400/30 absolute bottom-2.5 left-2.5 rounded-bl-[1.5px]" />
          </div>
          {/* Bottom-Right Corner Resize */}
          <div
            onMouseDown={(e) => handleResizeStart(e, 'bottom-right')}
            className="hidden sm:block absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize rounded-br-2xl z-20 group"
            title="크기 조절 (가로/세로)"
          >
            <div className="w-2 h-2 border-b-[1.5px] border-r-[1.5px] border-amber-400/30 absolute bottom-2.5 right-2.5 rounded-br-[1.5px]" />
          </div>
        </>
      )}
    </aside>
  );
};
