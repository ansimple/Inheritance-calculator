import React from 'react';
import { X, Printer } from 'lucide-react';
import { useInheritanceStore } from '../../state/useInheritanceStore';

interface PrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({ isOpen, onClose }) => {
  const {
    deceasedId,
    allPersons,
    estate,
    calculationResult,
  } = useInheritanceStore();

  if (!isOpen || !calculationResult) return null;

  const deceased = allPersons.get(deceasedId);
  const totalActive = estate.activeRealEstateWon + estate.activeFinancialWon + estate.activeOtherWon;

  const formatWon = (amt: bigint) => {
    if (amt === 0n) return '0원';
    const abs = amt < 0n ? -amt : amt;
    const eok = abs / 100_000_000n;
    const man = (abs % 100_000_000n) / 10_000n;
    let res = '';
    if (eok > 0n) res += `${eok}억 `;
    if (man > 0n) res += `${man}만 `;
    res = res.trim() + '원';
    return amt < 0n ? `-${res}` : res;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div className="bg-brown-900 border border-brown-800 rounded-2xl sm:rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl text-stone-100">
        {/* Header (Hidden on print) */}
        <div className="flex items-center justify-between p-3.5 sm:p-5 border-b border-brown-800 no-print shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1.5 sm:p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-white truncate">A4 인쇄 및 PDF 저장</h3>
              <p className="text-[11px] sm:text-xs text-stone-400 hidden sm:block">브라우저 인쇄 대화상자에서 PDF 저장이 가능합니다.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-600/25 transition"
            >
              <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>인쇄 / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 text-stone-400 hover:text-white hover:bg-brown-800 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-8 bg-brown-950 font-sans print:p-0 print:bg-white print:text-black">
          {/* Document Title Header */}
          <div className="text-center pb-4 sm:pb-6 border-b border-brown-800 print:border-black">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white print:text-black">
              대한민국 상속 분배 및 유류분 종합 보고서
            </h1>
            <p className="text-[11px] sm:text-xs text-stone-400 print:text-slate-600 mt-1 sm:mt-2">
              (민법 법률 제21454호 및 대법원 2017스98 전원합의체 판례 적용)
            </p>
          </div>

          {/* 1. Basic Info */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-amber-400 print:text-black flex items-center gap-1.5 border-b border-brown-800 print:border-gray-300 pb-1.5">
              1. 피상속인 기본 정보 및 적용 법률
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-brown-900 border border-brown-800 print:bg-gray-50 print:border-gray-300">
                <span className="text-stone-400 print:text-gray-500 block">피상속인 성명</span>
                <span className="font-bold text-white print:text-black mt-0.5 block">{deceased?.name}</span>
              </div>
              <div className="p-3 rounded-xl bg-brown-900 border border-brown-800 print:bg-gray-50 print:border-gray-300">
                <span className="text-stone-400 print:text-gray-500 block">상속개시일(사망일)</span>
                <span className="font-bold text-white print:text-black mt-0.5 block font-mono">{estate.openingDate}</span>
              </div>
              <div className="p-3 rounded-xl bg-brown-900 border border-brown-800 print:bg-gray-50 print:border-gray-300 col-span-2">
                <span className="text-stone-400 print:text-gray-500 block">적용 법률 체계</span>
                <span className="font-bold text-emerald-400 print:text-emerald-700 mt-0.5 block">
                  {calculationResult.policyVersion === '2026_NEW_CIVIL'
                    ? '2026년 전면 개정 민법 (법률 제21454호)'
                    : calculationResult.policyVersion === '2024_POST_CC'
                    ? '헌재 2020헌가4 위헌 결정 적용기 (2024~2026)'
                    : '구 민법 적용기 (2000~2024)'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Estate Summary */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-amber-400 print:text-black flex items-center gap-1.5 border-b border-brown-800 print:border-gray-300 pb-1.5">
              2. 상속 재산 및 채무 내역
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-brown-900 border border-brown-800 print:bg-gray-50 print:border-gray-300">
                <span className="text-stone-400 print:text-gray-500 block">부동산 가액</span>
                <span className="font-bold text-white print:text-black mt-0.5 block font-mono">{formatWon(estate.activeRealEstateWon)}</span>
              </div>
              <div className="p-3 rounded-xl bg-brown-900 border border-brown-800 print:bg-gray-50 print:border-gray-300">
                <span className="text-stone-400 print:text-gray-500 block">금융 재산</span>
                <span className="font-bold text-white print:text-black mt-0.5 block font-mono">{formatWon(estate.activeFinancialWon)}</span>
              </div>
              <div className="p-3 rounded-xl bg-brown-900 border border-brown-800 print:bg-gray-50 print:border-gray-300">
                <span className="text-stone-400 print:text-gray-500 block">총 적극재산</span>
                <span className="font-bold text-amber-400 print:text-sky-700 mt-0.5 block font-mono">{formatWon(totalActive)}</span>
              </div>
              <div className="p-3 rounded-xl bg-brown-900 border border-brown-800 print:bg-gray-50 print:border-gray-300">
                <span className="text-rose-400 print:text-rose-600 block">상속 채무</span>
                <span className="font-bold text-rose-400 print:text-rose-700 mt-0.5 block font-mono">{formatWon(estate.passiveDebtWon)}</span>
              </div>
            </div>
          </div>

          {/* 3. Distribution Results Table */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-amber-400 print:text-black flex items-center gap-1.5 border-b border-brown-800 print:border-gray-300 pb-1.5">
              3. 상속인별 최종 배분 및 유류분 정산 명세
            </h2>
            <div className="overflow-x-auto rounded-xl border border-brown-800 print:border-gray-300">
              <table className="w-full text-left text-xs">
                <thead className="bg-brown-900 text-stone-300 print:bg-gray-100 print:text-black uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2.5">상속인</th>
                    <th className="px-3 py-2.5">자격</th>
                    <th className="px-3 py-2.5">법정상속비율</th>
                    <th className="px-3 py-2.5">구체적 상속분</th>
                    <th className="px-3 py-2.5">승계 채무</th>
                    <th className="px-3 py-2.5">최종 순 상속액</th>
                    <th className="px-3 py-2.5">유류분 정산</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brown-800 print:divide-gray-200">
                  {calculationResult.heirResults.map((hr) => (
                    <tr key={hr.personId}>
                      <td className="px-3 py-2.5 font-bold text-white print:text-black">{hr.name}</td>
                      <td className="px-3 py-2.5 text-stone-300 print:text-gray-700">
                        {hr.status === 'VALID_HEIR' ? '상속인' : '대습상속인'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-amber-400 print:text-black">
                        {hr.statutoryShareRate.toFractionString()}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-emerald-400 print:text-black">
                        {formatWon(hr.finalConcreteShareWon)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-rose-400 print:text-black">
                        {hr.allocatedDebtWon > 0n ? `-${formatWon(hr.allocatedDebtWon)}` : '0원'}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-extrabold text-white print:text-black">
                        {formatWon(hr.netInheritanceWon)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-amber-400 print:text-black">
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
          </div>

          {/* 4. Cash Compensation Flows */}
          {calculationResult.reserveSettlement.compensationFlows.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-amber-400 print:text-black flex items-center gap-1.5 border-b border-brown-800 print:border-gray-300 pb-1.5">
                4. 유류분 가액(금전)반환 청구 명세 (2026 민법 제1115조)
              </h2>
              <div className="space-y-1.5 text-xs text-stone-300 print:text-black">
                {calculationResult.reserveSettlement.compensationFlows.map((flow, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-brown-900 border border-brown-800 print:bg-gray-50 print:border-gray-300 flex justify-between">
                    <span>
                      반환의무자: <strong>{flow.fromPersonName}</strong> ➔ 권리자: <strong>{flow.toPersonName}</strong>
                    </span>
                    <span className="font-mono font-bold text-amber-400 print:text-black">
                      {formatWon(flow.amountWon)} (금전 반환)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer note */}
          <div className="pt-6 border-t border-brown-800 print:border-gray-300 text-[11px] text-stone-500 print:text-gray-500 leading-relaxed">
            * 본 보고서는 대한민국 민법 및 대법원 전원합의체 판례 규칙에 따라 자동 산출되었으며, 실무 소송 및 세무 신고 시 법률 전문가의 최종 검토를 거치는 것을 권장합니다.
          </div>
        </div>
      </div>
    </div>
  );
};
