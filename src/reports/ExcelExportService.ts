import * as XLSX from 'xlsx';
import { PipelineExecutionResult } from '../domain/models/PipelineResult';
import { EstateData } from '../domain/models/Estate';
import { AdoptionType, HeirStatus, PersonNode, RelationshipEdge } from '../domain/models/Person';

function formatPolicyVersionKo(version: string): string {
  switch (version) {
    case '2026_NEW_CIVIL':
      return '2026년 전면 개정 민법 (법률 제21454호)';
    case '2024_POST_CC':
      return '헌재 2020헌가4 위헌 결정 후 (2024~2026)';
    case '2000_TO_2024':
      return '구 민법 적용기 (2000~2024)';
    default:
      return version;
  }
}

function formatHeirStatusKo(status?: HeirStatus | string): string {
  switch (status) {
    case 'VALID_HEIR':
      return '상속인';
    case 'REPRESENTATIVE_HEIR':
      return '대습상속인';
    case 'DISQUALIFIED':
      return '상속결격';
    case 'DEPRIVED':
      return '상속권상실(구하라법)';
    case 'RENOUNCED':
      return '상속포기';
    case 'EXCLUDED_BY_PRIORITY':
      return '선순위 존재로 배제';
    default:
      return status ? String(status) : '비상속인';
  }
}

function formatAdoptionTypeKo(type: AdoptionType): string {
  switch (type) {
    case 'NONE':
      return '친생자';
    case 'ORDINARY_ADOPTED':
      return '일반양자';
    case 'FULL_ADOPTED':
      return '친양자 (단절)';
    default:
      return type;
  }
}

export class ExcelExportService {
  static exportToExcel(params: {
    deceased: PersonNode;
    allPersons: Map<string, PersonNode>;
    relationships: RelationshipEdge[];
    estate: EstateData;
    result: PipelineExecutionResult;
  }) {
    const { deceased, allPersons, estate, result } = params;
    const wb = XLSX.utils.book_new();

    // 1. Sheet 1: 종합 요약서
    const summaryData = [
      ['대한민국 상속 분배 및 유류분 종합 보고서'],
      [''],
      ['1. 피상속인 기본 정보'],
      ['성명', deceased.name],
      ['상속개시일자', estate.openingDate],
      ['적용 법률 버전', formatPolicyVersionKo(result.policyVersion)],
      [''],
      ['2. 상속 재산 및 채무 내역'],
      ['부동산 가액', Number(estate.activeRealEstateWon)],
      ['금융 재산', Number(estate.activeFinancialWon)],
      ['기타 재산', Number(estate.activeOtherWon)],
      ['총 적극재산', Number(estate.activeRealEstateWon + estate.activeFinancialWon + estate.activeOtherWon)],
      ['상속 채무', Number(estate.passiveDebtWon)],
      ['순 적극재산 (적극-채무)', Number(estate.activeRealEstateWon + estate.activeFinancialWon + estate.activeOtherWon - estate.passiveDebtWon)],
      [''],
      ['3. 상속인별 최종 배분 요약'],
      ['상속인 성명', '상속 자격', '법정상속비율', '구체적상속분(원)', '승계채무(원)', '순상속액(원)', '유류분부족액(원)', '유류분반환의무(원)'],
      ...result.heirResults.map(h => [
        h.name,
        formatHeirStatusKo(h.status),
        h.statutoryShareRate.toFractionString(),
        Number(h.finalConcreteShareWon),
        Number(h.allocatedDebtWon),
        Number(h.netInheritanceWon),
        Number(h.reserveShortageWon),
        Number(h.reserveCompensationObligationWon),
      ]),
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, '종합 요약서');

    // 2. Sheet 2: 상속인 권리 분석표
    const heirAnalysisData = [
      ['상속인 권리 및 자격 분석표'],
      [''],
      ['인물 성명', '성별', '생사여부', '입양형태', '상속결격', '구하라법상실선고', '상속포기', '최종상속지위'],
      ...Array.from(allPersons.values()).map(p => {
        const heirResult = result.heirResults.find(h => h.personId === p.id);
        return [
          p.name,
          p.gender === 'MALE' ? '남성' : '여성',
          p.isDeceased ? '사망' : '생존',
          formatAdoptionTypeKo(p.adoptionType),
          p.isDisqualified ? '결격' : '해당없음',
          p.hasDeprivation ? '상실선고' : '해당없음',
          p.hasRenounced ? '상속포기' : '해당없음',
          formatHeirStatusKo(heirResult?.status),
        ];
      }),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(heirAnalysisData);
    XLSX.utils.book_append_sheet(wb, ws2, '상속인 권리 분석');

    // 3. Sheet 3: 구체적 상속분 계산서
    const concreteCalcData = [
      ['구체적 상속분 및 초과특별수익 안분 계산서 (대법원 2017스98)'],
      [''],
      ['간주상속재산(원)', Number(result.deemedEstateWon)],
      [''],
      ['상속인', '법정상속비율', '잠정상속분(원)', '특별수익합계(원)', '기여분(원)', '최종구체적상속분(원)', '법정승계채무(원)'],
      ...result.heirResults.map(h => {
        const p = allPersons.get(h.personId);
        const totalGift = p?.specialBenefits.reduce((s, g) => s + g.amountWon, 0n) ?? 0n;
        const totalBequest = p?.bequests.reduce((s, b) => s + b.amountWon, 0n) ?? 0n;
        return [
          h.name,
          h.statutoryShareRate.toFractionString(),
          Number(h.tentativeConcreteShareWon),
          Number(totalGift + totalBequest),
          Number(p?.contributionAmountWon ?? 0n),
          Number(h.finalConcreteShareWon),
          Number(h.allocatedDebtWon),
        ];
      }),
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(concreteCalcData);
    XLSX.utils.book_append_sheet(wb, ws3, '구체적 상속분 계산');

    // 4. Sheet 4: 유류분 정산 명세서
    const reserveData = [
      ['유류분 부족액 및 가액반환 정산 명세서 (민법 제1113조, 제1115조)'],
      [''],
      ['유류분 산정 기초재산(원)', Number(result.reserveSettlement.baseEstateWon)],
      [''],
      ['상속인', '법정상속비율', '유류분율', '유류분부족액(원)', '유류분반환의무(원)'],
      ...result.heirResults.map(h => [
        h.name,
        h.statutoryShareRate.toFractionString(),
        h.statutoryShareRate.multiply(1n, 2n).toFractionString(),
        Number(h.reserveShortageWon),
        Number(h.reserveCompensationObligationWon),
      ]),
      [''],
      ['유류분 가액반환 흐름 명세 (2026 민법 제1115조)'],
      ['반환의무자', '반환받는권리자', '가액반환금액(원)', '반환형태'],
      ...result.reserveSettlement.compensationFlows.map(f => [
        f.fromPersonName,
        f.toPersonName,
        Number(f.amountWon),
        f.isMonetary ? '금전(가액)반환' : '원물반환',
      ]),
    ];
    const ws4 = XLSX.utils.aoa_to_sheet(reserveData);
    XLSX.utils.book_append_sheet(wb, ws4, '유류분 정산 명세');

    // 5. Sheet 5: 법률 근거 및 판례 로그
    const traceData = [
      ['적용 법률 조항 및 대법원·헌재 판례 감사 추적 로그'],
      [''],
      ['단계', '구분', '관련 법조문 / 판례', '내용 및 산출 수식'],
      ...result.traces.map(t => [
        t.stepId,
        t.titleKo,
        t.articleRefs.join(', '),
        t.descriptionKo + (t.formulaText ? ` [수식: ${t.formulaText}]` : ''),
      ]),
    ];
    const ws5 = XLSX.utils.aoa_to_sheet(traceData);
    XLSX.utils.book_append_sheet(wb, ws5, '법률 근거 및 판례');

    // Trigger download via explicit Blob & <a> click for 100% browser compatibility
    const safeName = deceased.name.replace(/[\\/:*?"<>|]/g, '_');
    const fileName = `상속분배계산서_${safeName}_${estate.openingDate}.xlsx`;

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
    });

    if (typeof window !== 'undefined') {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      setTimeout(() => {
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      }, 200);
    }

    return fileName;
  }
}
