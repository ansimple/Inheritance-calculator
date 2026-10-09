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
  const netEstateWon = totalActive - estate.passiveDebtWon;

  // Format currency helper (Shortened Korean won text)
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

  const formatNumberWon = (amt: bigint) => {
    return `${amt.toLocaleString()}원`;
  };

  const handlePrint = () => {
    window.print();
  };

  const documentNo = `제2026-상속-${estate.openingDate.replace(/[^0-9]/g, '') || '01'}호`;
  const todayStr = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  const totalConcreteWon = calculationResult.heirResults.reduce(
    (sum, hr) => sum + hr.finalConcreteShareWon,
    0n
  );
  const totalDebtAllocated = calculationResult.heirResults.reduce(
    (sum, hr) => sum + hr.allocatedDebtWon,
    0n
  );
  const totalNetInheritance = calculationResult.heirResults.reduce(
    (sum, hr) => sum + hr.netInheritanceWon,
    0n
  );

  return (
    <div className="print-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto print:block print:overflow-visible">
      {/* Modal Dialog Window */}
      <div className="print-modal-container bg-brown-900 border border-brown-800 rounded-2xl sm:rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl text-stone-100 overflow-hidden print:border-none print:shadow-none print:max-w-none print:max-h-none print:w-full print:bg-white print:text-black print:rounded-none print:block print:overflow-visible">
        
        {/* Header Bar (Hidden on print) */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-brown-800 no-print shrink-0 bg-brown-900">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-white truncate">상속 분배 및 유류분 감정서 (A4 1장 최적화)</h3>
              <p className="text-[11px] text-stone-400 hidden sm:block">
                화면 요소나 타이틀바 없이 오직 감정서 본문만 A4 단일 페이지 규격으로 인쇄 및 PDF 저장됩니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-600/25 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>A4 인쇄 / PDF 저장</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 text-stone-400 hover:text-white hover:bg-brown-800 rounded-xl transition cursor-pointer"
              title="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Paper Sheet Preview Container */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-6 bg-brown-950/90 print:p-0 print:bg-white print:overflow-visible print:block">
          
          {/* Formal Legal Document Sheet (A4 Fit, 1-Page Layout) */}
          <div className="print-sheet bg-white text-stone-900 shadow-2xl max-w-3xl mx-auto border border-stone-300 p-6 sm:p-8 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-full font-serif select-text leading-tight text-[11px]">
            
            {/* 1. Header Metadata Bar */}
            <div className="border-b-2 border-stone-800 pb-1.5 mb-3 flex justify-between items-center text-[10px] text-stone-600 font-sans">
              <div>
                <span className="font-bold text-stone-800">문서번호:</span> {documentNo} &nbsp;|&nbsp; 
                <span className="font-bold text-stone-800"> 피상속인:</span> 故 {deceased?.name}
              </div>
              <div>
                <span className="font-bold text-stone-800">발행일자:</span> {todayStr}
              </div>
            </div>

            {/* 2. Document Title */}
            <div className="text-center py-2.5 mb-3.5 border-y border-stone-400">
              <h1 className="text-xl sm:text-2xl font-black tracking-widest text-stone-950 font-serif">
                상 속 분 배  및  유 류 분  산 정  감 정 서
              </h1>
              <p className="text-[10px] text-stone-600 mt-1 font-sans">
                【 민법 (법률 제21454호) 및 대법원 2017스98 전원합의체 판례 적용 】
              </p>
            </div>

            {/* 3. Section 1: Basic Info & Estate Overview (2-Column Unified Summary Table) */}
            <div className="mb-3.5 space-y-1">
              <div className="font-bold text-stone-900 flex items-center gap-1 font-sans text-xs">
                <span>1. 기본 인적사항 및 상속 재산·채무 내역</span>
              </div>
              <table className="w-full border-collapse border border-stone-400 font-sans text-[10.5px]">
                <tbody>
                  <tr className="border-b border-stone-300">
                    <th className="w-20 bg-stone-100 p-1.5 text-stone-700 font-semibold border-r border-stone-300 text-left">
                      피상속인
                    </th>
                    <td className="w-44 p-1.5 border-r border-stone-300 font-bold text-stone-900">
                      {deceased?.name} ({deceased?.gender === 'MALE' ? '남성' : '여성'})
                    </td>
                    <th className="w-24 bg-stone-100 p-1.5 text-stone-700 font-semibold border-r border-stone-300 text-left">
                      적극 상속재산
                    </th>
                    <td className="p-1.5 font-mono text-stone-900 font-bold">
                      {formatNumberWon(totalActive)}
                      <span className="text-[9.5px] font-normal text-stone-600 font-sans ml-1">
                        (부동산 {formatWon(estate.activeRealEstateWon)}, 금융 {formatWon(estate.activeFinancialWon)})
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-stone-300">
                    <th className="bg-stone-100 p-1.5 text-stone-700 font-semibold border-r border-stone-300 text-left">
                      상속개시일
                    </th>
                    <td className="p-1.5 border-r border-stone-300 font-mono text-stone-900">
                      {estate.openingDate}
                    </td>
                    <th className="bg-stone-100 p-1.5 text-rose-700 font-semibold border-r border-stone-300 text-left">
                      상속 채무
                    </th>
                    <td className="p-1.5 font-mono text-rose-700 font-bold">
                      {estate.passiveDebtWon > 0n ? `-${formatNumberWon(estate.passiveDebtWon)}` : '0원'}
                      <span className="text-[9.5px] font-normal text-stone-500 font-sans ml-1">
                        {estate.passiveDebtWon > 0n ? '(대법원 97다8809 법정승계)' : '(채무 없음)'}
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-stone-300">
                    <th className="bg-stone-100 p-1.5 text-stone-700 font-semibold border-r border-stone-300 text-left">
                      적용 법률
                    </th>
                    <td className="p-1.5 border-r border-stone-300 font-medium text-stone-900 text-[10px]">
                      {calculationResult.policyVersion === '2026_NEW_CIVIL'
                        ? '2026 개정 민법 (법률 제21454호)'
                        : calculationResult.policyVersion === '2024_POST_CC'
                        ? '헌재 2020헌가4 위헌 적용기'
                        : '구 민법 (2000~2024)'}
                    </td>
                    <th className="bg-stone-100 p-1.5 text-stone-700 font-semibold border-r border-stone-300 text-left">
                      순 상속재산
                    </th>
                    <td className="p-1.5 font-mono font-bold text-stone-950">
                      {formatNumberWon(netEstateWon)}
                      <span className="text-[9.5px] font-normal text-stone-600 font-sans ml-1">
                        (적극재산 - 상속채무)
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <th className="bg-stone-100 p-1.5 text-stone-700 font-semibold border-r border-stone-300 text-left">
                      적용 법리
                    </th>
                    <td className="p-1.5 border-r border-stone-300 text-[9.5px] text-stone-600 leading-tight">
                      결격자 배우자 대습 배제, 유류분 전면 가액반환, 2017스98 초과특별수익 안분
                    </td>
                    <th className="bg-stone-100 p-1.5 text-stone-700 font-semibold border-r border-stone-300 text-left">
                      간주 / 기초재산
                    </th>
                    <td className="p-1.5 font-mono text-[10px] text-stone-800">
                      간주: {formatWon(calculationResult.deemedEstateWon)} &nbsp;|&nbsp; 기초: {formatWon(calculationResult.reserveSettlement.baseEstateWon)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 4. Section 2: Distribution & Legal Reserve Table (The Core) */}
            <div className="mb-3.5 space-y-1">
              <div className="font-bold text-stone-900 flex items-center justify-between font-sans text-xs">
                <span>2. 상속인별 최종 배분 및 유류분 정산 총괄 명세</span>
                <span className="text-[9.5px] text-stone-500 font-normal">단위: 원 (대한민국 원화)</span>
              </div>
              <table className="w-full border-collapse border border-stone-400 font-sans text-[10.5px]">
                <thead>
                  <tr className="bg-stone-100 border-b border-stone-400 text-stone-800 text-[10px]">
                    <th className="p-1.5 border-r border-stone-300 text-center w-8">순</th>
                    <th className="p-1.5 border-r border-stone-300 text-left w-20">상속인</th>
                    <th className="p-1.5 border-r border-stone-300 text-center w-14">자격</th>
                    <th className="p-1.5 border-r border-stone-300 text-center w-16">법정지분</th>
                    <th className="p-1.5 border-r border-stone-300 text-right w-28">구체적 상속분(A)</th>
                    <th className="p-1.5 border-r border-stone-300 text-right w-24">승계 채무(B)</th>
                    <th className="p-1.5 border-r border-stone-300 text-right w-28 bg-stone-50">최종 순 상속액(A-B)</th>
                    <th className="p-1.5 text-center w-24">유류분 정산</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {calculationResult.heirResults.map((hr, idx) => (
                    <tr key={hr.personId} className="hover:bg-stone-50">
                      <td className="p-1.5 border-r border-stone-300 text-center font-mono text-stone-500 text-[10px]">
                        {idx + 1}
                      </td>
                      <td className="p-1.5 border-r border-stone-300 font-bold text-stone-900">
                        {hr.name}
                      </td>
                      <td className="p-1.5 border-r border-stone-300 text-center text-[10px] text-stone-700">
                        {hr.status === 'VALID_HEIR' ? '상속인' : '대습상속인'}
                      </td>
                      <td className="p-1.5 border-r border-stone-300 text-center font-mono font-semibold text-stone-800">
                        {hr.statutoryShareRate.toFractionString()}
                      </td>
                      <td className="p-1.5 border-r border-stone-300 text-right font-mono font-medium text-stone-900">
                        {formatNumberWon(hr.finalConcreteShareWon)}
                      </td>
                      <td className="p-1.5 border-r border-stone-300 text-right font-mono text-rose-700">
                        {hr.allocatedDebtWon > 0n ? `-${formatNumberWon(hr.allocatedDebtWon)}` : '0원'}
                      </td>
                      <td className="p-1.5 border-r border-stone-300 text-right font-mono font-bold text-stone-950 bg-stone-50">
                        {formatNumberWon(hr.netInheritanceWon)}
                      </td>
                      <td className="p-1.5 text-center text-[10px]">
                        {hr.reserveShortageWon > 0n ? (
                          <span className="text-amber-800 font-bold">
                            부족 +{formatWon(hr.reserveShortageWon)}
                          </span>
                        ) : hr.reserveCompensationObligationWon > 0n ? (
                          <span className="text-rose-800 font-bold">
                            반환 -{formatWon(hr.reserveCompensationObligationWon)}
                          </span>
                        ) : (
                          <span className="text-emerald-800 font-medium">정산완료</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {/* Summary Row */}
                  <tr className="bg-stone-100 font-bold border-t-2 border-stone-400 text-stone-900">
                    <td colSpan={3} className="p-1.5 border-r border-stone-300 text-center">
                      합  계
                    </td>
                    <td className="p-1.5 border-r border-stone-300 text-center font-mono">
                      1 / 1
                    </td>
                    <td className="p-1.5 border-r border-stone-300 text-right font-mono">
                      {formatNumberWon(totalConcreteWon)}
                    </td>
                    <td className="p-1.5 border-r border-stone-300 text-right font-mono text-rose-700">
                      {totalDebtAllocated > 0n ? `-${formatNumberWon(totalDebtAllocated)}` : '0원'}
                    </td>
                    <td className="p-1.5 border-r border-stone-300 text-right font-mono font-black text-stone-950 bg-stone-100">
                      {formatNumberWon(totalNetInheritance)}
                    </td>
                    <td className="p-1.5 text-center text-stone-500 text-[10px]">
                      -
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 5. Section 3: Reserve Cash Settlement Flows (Compact) */}
            <div className="mb-3 space-y-1">
              <div className="font-bold text-stone-900 font-sans text-xs">
                3. 유류분 가액(금전)반환 청구 명세 (2026 민법 제1115조)
              </div>
              {calculationResult.reserveSettlement.compensationFlows.length > 0 ? (
                <table className="w-full border-collapse border border-stone-400 font-sans text-[10.5px]">
                  <thead>
                    <tr className="bg-stone-100 border-b border-stone-300 text-stone-800 text-[10px]">
                      <th className="p-1 border-r border-stone-300 text-center w-8">순</th>
                      <th className="p-1 border-r border-stone-300 text-left">반환 의무자 (채무자)</th>
                      <th className="p-1 border-r border-stone-300 text-left">반환 권리자 (채권자)</th>
                      <th className="p-1 border-r border-stone-300 text-right w-32">금전 반환액</th>
                      <th className="p-1 text-left text-[10px]">이행 방식</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculationResult.reserveSettlement.compensationFlows.map((flow, i) => (
                      <tr key={i} className="border-b border-stone-200">
                        <td className="p-1 border-r border-stone-300 text-center font-mono">{i + 1}</td>
                        <td className="p-1 border-r border-stone-300 font-bold text-rose-800">{flow.fromPersonName}</td>
                        <td className="p-1 border-r border-stone-300 font-bold text-emerald-800">{flow.toPersonName}</td>
                        <td className="p-1 border-r border-stone-300 text-right font-mono font-bold text-stone-900">
                          {formatNumberWon(flow.amountWon)}
                        </td>
                        <td className="p-1 text-[9.5px] text-stone-600">
                          민법 제1115조 제1항 전면 가액(금전)반환
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-1.5 border border-stone-300 bg-stone-50 text-[10px] text-stone-600 font-sans">
                  ※ 본 상속 건은 유류분 부족액 또는 반환의무자가 발생하지 아니하여, 유류분 가액반환 청구 대상이 없습니다.
                </div>
              )}
            </div>

            {/* 6. Section 4: Legal Basis & Certification (Ultra Compact) */}
            <div className="border-t border-stone-300 pt-2 font-sans space-y-1.5 text-[9.5px] text-stone-600 leading-tight">
              <div>
                <strong>【 법률 감정 요지 】</strong> &nbsp;
                1. 금전채무는 상속재산분할 대상이 아니며 법정상속분율에 따라 당연 분할 승계됩니다(대법원 97다8809). &nbsp;
                2. 초과특별수익자의 초과분은 대법원 2017스98 전합 판례에 따라 나머지 상속인들에게 안분 분담되었습니다. &nbsp;
                3. 2026년 개정 민법에 따라 형제자매 유류분 배제 및 유류분 전면 가액(금전)반환이 적용되었습니다.
              </div>
              <div className="border-t border-stone-800 pt-2 flex items-center justify-between">
                <span className="text-[10px] text-stone-700">
                  위와 같이 대한민국 민법 및 대법원 전원합의체 판례에 의거하여 상속재산 분배액을 공정하게 감정하였음을 확인함.
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-serif font-bold text-xs tracking-wider text-stone-950">
                    대한민국 상속분배 법률자동감정시스템
                  </span>
                  <span className="border border-rose-800 text-rose-800 text-[9px] font-bold px-1 py-0.2 rounded font-serif">
                    직인생략
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
