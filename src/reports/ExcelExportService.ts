import * as XLSX from 'xlsx-js-style';
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

// ----------------------------------------------------
// Color Palette & Reusable Styles for Native Excel
// ----------------------------------------------------
const PALETTE = {
  headerBg: '291811',       // Deep espresso
  headerFg: 'FFFFFF',       // Pure white
  sectionBg: '3E2723',      // Dark chocolate brown
  deceasedHeader: '451A03', // Deep amber brown
  heirHeader: '14532D',     // Dark forest green
  disqualifiedHeader: '881337', // Dark rose / crimson
  inactiveHeader: '374151', // Dark slate gray
  cardSubBg: 'FDF8F3',      // Soft warm ivory / beige
  statusHeirBg: 'DCFCE7',   // Soft light emerald
  statusOtherBg: 'FEF3C7',  // Soft light amber
  cardBodyBg: 'FFFFFF',     // Pure white
  borderDark: '78350F',     // Rich amber brown border
  borderMedium: '92400E',
  borderLight: 'D6D3D1',    // Stone light gray border
  zebraBg: 'FAF7F4',        // Soft alternating row color
  connectorBg: 'FFFBEB',    // Light amber background for connector cell
};

const BORDERS = {
  thinLight: {
    top: { style: 'thin', color: { rgb: PALETTE.borderLight } },
    bottom: { style: 'thin', color: { rgb: PALETTE.borderLight } },
    left: { style: 'thin', color: { rgb: PALETTE.borderLight } },
    right: { style: 'thin', color: { rgb: PALETTE.borderLight } },
  },
  tableHeader: {
    top: { style: 'medium', color: { rgb: PALETTE.headerBg } },
    bottom: { style: 'medium', color: { rgb: PALETTE.headerBg } },
    left: { style: 'thin', color: { rgb: '57392B' } },
    right: { style: 'thin', color: { rgb: '57392B' } },
  },
};

export class ExcelExportService {
  /**
   * Helper to set cell value, format, and style in worksheet
   */
  private static setCell(
    ws: Record<string, any>,
    r: number,
    c: number,
    val: any,
    style?: any,
    numFmt?: string
  ) {
    const addr = XLSX.utils.encode_cell({ r, c });
    const isNum = typeof val === 'number';
    ws[addr] = {
      v: val,
      t: isNum ? 'n' : 's',
      s: style || {},
      z: numFmt,
    };
  }

  /**
   * Helper to merge a range and apply unified borders/background
   */
  private static mergeRange(
    ws: Record<string, any>,
    merges: XLSX.Range[],
    startR: number,
    startC: number,
    endR: number,
    endC: number,
    val: any,
    style: any
  ) {
    merges.push({ s: { r: startR, c: startC }, e: { r: endR, c: endC } });
    for (let r = startR; r <= endR; r++) {
      for (let c = startC; c <= endC; c++) {
        const isTop = r === startR;
        const isBottom = r === endR;
        const isLeft = c === startC;
        const isRight = c === endC;

        const cellBorder: any = {
          top: isTop ? style.border?.top : undefined,
          bottom: isBottom ? style.border?.bottom : undefined,
          left: isLeft ? style.border?.left : undefined,
          right: isRight ? style.border?.right : undefined,
        };

        this.setCell(
          ws,
          r,
          c,
          r === startR && c === startC ? val : '',
          {
            fill: style.fill,
            font: style.font,
            alignment: style.alignment,
            border: cellBorder,
          }
        );
      }
    }
  }

  /**
   * Renders a 3-column x 4-row native Excel person card
   */
  private static drawPersonCard(
    ws: Record<string, any>,
    merges: XLSX.Range[],
    r: number,
    c: number,
    title: string,
    subText: string,
    roleText: string,
    amountText: string,
    headerColor: string,
    isHeir: boolean
  ) {
    const endC = c + 2; // 3 columns wide (c, c+1, c+2)
    const borderColor = { rgb: PALETTE.borderDark };

    // Row 0: Header (Name & Main Role)
    this.mergeRange(ws, merges, r, c, r, endC, title, {
      fill: { fgColor: { rgb: headerColor } },
      font: { name: '맑은 고딕', sz: 10.5, bold: true, color: { rgb: PALETTE.headerFg } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'medium', color: borderColor },
        left: { style: 'medium', color: borderColor },
        right: { style: 'medium', color: borderColor },
        bottom: { style: 'thin', color: { rgb: 'A8A29E' } },
      },
    });

    // Row 1: Personal Status (Life/Death, Adoption)
    this.mergeRange(ws, merges, r + 1, c, r + 1, endC, subText, {
      fill: { fgColor: { rgb: PALETTE.cardSubBg } },
      font: { name: '맑은 고딕', sz: 9, color: { rgb: '44403C' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        left: { style: 'medium', color: borderColor },
        right: { style: 'medium', color: borderColor },
        bottom: { style: 'thin', color: { rgb: 'E7E5E4' } },
      },
    });

    // Row 2: Legal Inheritance Status & Share Rate
    this.mergeRange(ws, merges, r + 2, c, r + 2, endC, roleText, {
      fill: { fgColor: { rgb: isHeir ? PALETTE.statusHeirBg : PALETTE.statusOtherBg } },
      font: {
        name: '맑은 고딕',
        sz: 9.5,
        bold: true,
        color: { rgb: isHeir ? '14532D' : '92400E' },
      },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        left: { style: 'medium', color: borderColor },
        right: { style: 'medium', color: borderColor },
        bottom: { style: 'thin', color: { rgb: 'E7E5E4' } },
      },
    });

    // Row 3: Final Allocated Share or Net Estate
    this.mergeRange(ws, merges, r + 3, c, r + 3, endC, amountText, {
      fill: { fgColor: { rgb: PALETTE.cardBodyBg } },
      font: {
        name: '맑은 고딕',
        sz: 10,
        bold: true,
        color: { rgb: isHeir ? '047857' : '1C1917' },
      },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        left: { style: 'medium', color: borderColor },
        right: { style: 'medium', color: borderColor },
        bottom: { style: 'medium', color: borderColor },
      },
    });
  }

  /**
   * Builds the '가계도' worksheet with Native Excel Merged Cells, Borders, and Fills
   */
  private static buildNativeFamilyTreeSheet(params: {
    deceased: PersonNode;
    allPersons: Map<string, PersonNode>;
    relationships: RelationshipEdge[];
    estate: EstateData;
    result: PipelineExecutionResult;
  }): XLSX.WorkSheet {
    const { deceased, allPersons, relationships, estate, result } = params;
    const ws: Record<string, any> = {};
    const merges: XLSX.Range[] = [];

    // 1. Identify relational subsets
    const parentEdges = relationships.filter(r => r.type === 'PARENT_CHILD' && r.toId === deceased.id);
    const parents = parentEdges.map(e => allPersons.get(e.fromId)).filter(Boolean) as PersonNode[];

    const spouseEdges = relationships.filter(
      r => r.type === 'SPOUSE' && (r.fromId === deceased.id || r.toId === deceased.id)
    );
    const spouses = spouseEdges.map(e => {
      const spId = e.fromId === deceased.id ? e.toId : e.fromId;
      return { person: allPersons.get(spId)!, isDivorced: e.isDivorced };
    }).filter(s => s.person);

    const childrenSet = new Set<string>();
    for (const r of relationships) {
      if (r.type === 'PARENT_CHILD' && (r.fromId === deceased.id || spouses.some(s => s.person.id === r.fromId))) {
        childrenSet.add(r.toId);
      }
    }
    const children = Array.from(childrenSet).map(id => allPersons.get(id)).filter(Boolean) as PersonNode[];

    // Grandchildren / Representative heirs
    const grandchildrenMap = new Map<string, PersonNode[]>();
    for (const child of children) {
      const gcList: PersonNode[] = [];
      for (const r of relationships) {
        if (r.type === 'PARENT_CHILD' && r.fromId === child.id) {
          const gc = allPersons.get(r.toId);
          if (gc) gcList.push(gc);
        }
      }
      if (gcList.length > 0) grandchildrenMap.set(child.id, gcList);
    }

    // --- TITLE BANNER ---
    this.mergeRange(ws, merges, 1, 1, 1, 12, '대한민국 상속 가계도 및 친족 계통 다이어그램 (Family Tree Diagram)', {
      fill: { fgColor: { rgb: PALETTE.headerBg } },
      font: { name: '맑은 고딕', sz: 14, bold: true, color: { rgb: PALETTE.headerFg } },
      alignment: { horizontal: 'left', vertical: 'center' },
    });
    this.mergeRange(
      ws,
      merges,
      2,
      1,
      2,
      12,
      `※ 엑셀 기본 셀 서식(외곽선·음영·병합)으로 구성된 친족 관계 및 세대별 상속권·배분액 계통도입니다. (기준일자: ${estate.openingDate})`,
      {
        font: { name: '맑은 고딕', sz: 9.5, italic: true, color: { rgb: '78716C' } },
        alignment: { horizontal: 'left', vertical: 'center' },
      }
    );

    // --- GRID COORDINATE COMPUTATION ---
    const childCount = children.length;
    const totalChildCols = childCount > 0 ? childCount * 3 + (childCount - 1) * 1 : 0;
    const totalColsNeeded = Math.max(totalChildCols, spouses.length > 0 ? 9 : 7);
    const startOffsetCol = 1;

    let currentRow = 4;

    // A. Generation -1: Parents (if any)
    if (parents.length > 0) {
      const parentStartCol = startOffsetCol + 2;
      parents.forEach((par, idx) => {
        const c = parentStartCol + idx * 4;
        const hr = result.heirResults.find(h => h.personId === par.id);
        const isHeir = hr?.status === 'VALID_HEIR';
        this.drawPersonCard(
          ws,
          merges,
          currentRow,
          c,
          `직계존속 · ${par.name}`,
          `상태: ${par.isDeceased ? '선사망' : '생존'} · ${formatAdoptionTypeKo(par.adoptionType)}`,
          `지위: ${formatHeirStatusKo(hr?.status)}`,
          `배분액: ${hr ? Number(hr.finalConcreteShareWon).toLocaleString() + ' 원' : '0 원'}`,
          isHeir ? PALETTE.heirHeader : PALETTE.inactiveHeader,
          isHeir
        );
      });

      currentRow += 4;
      // Vertical line to deceased
      this.setCell(ws, currentRow, startOffsetCol + 3, '│', {
        alignment: { horizontal: 'center', vertical: 'center' },
        font: { bold: true, color: { rgb: PALETTE.borderDark } },
      });
      currentRow += 1;
    }

    // B. Generation 0: Deceased & Spouse
    const deceasedCol = childCount >= 3 ? startOffsetCol + Math.floor((totalColsNeeded - 7) / 2) : startOffsetCol + 1;
    const activeTotal = estate.activeRealEstateWon + estate.activeFinancialWon + estate.activeOtherWon;
    const netTotal = activeTotal - estate.passiveDebtWon;

    // Draw Deceased Card
    this.drawPersonCard(
      ws,
      merges,
      currentRow,
      deceasedCol,
      `★ 피상속인 (고인) [사망]`,
      `성명: ${deceased.name} · ${deceased.gender === 'MALE' ? '남성' : '여성'}`,
      `순재산: ${Number(netTotal).toLocaleString()} 원`,
      `상속채무: ${Number(estate.passiveDebtWon).toLocaleString()} 원`,
      PALETTE.deceasedHeader,
      false
    );

    const coupleMidCol = deceasedCol + 3;

    if (spouses.length > 0) {
      const sp = spouses[0];
      const spouseCol = deceasedCol + 4;
      const hr = result.heirResults.find(h => h.personId === sp.person.id);
      const isHeir = hr?.status === 'VALID_HEIR';

      // Couple connector cell in middle
      this.setCell(
        ws,
        currentRow + 1,
        coupleMidCol,
        sp.isDivorced ? '── (이혼) ──' : '══ (법률혼) ══',
        {
          alignment: { horizontal: 'center', vertical: 'center' },
          font: { bold: true, color: { rgb: PALETTE.borderDark }, sz: 9 },
          fill: { fgColor: { rgb: PALETTE.connectorBg } },
          border: {
            top: { style: 'medium', color: { rgb: PALETTE.borderDark } },
            bottom: { style: 'medium', color: { rgb: PALETTE.borderDark } },
          },
        }
      );

      // Draw Spouse Card
      this.drawPersonCard(
        ws,
        merges,
        currentRow,
        spouseCol,
        `♀ 배우자 · ${sp.person.name}`,
        `상태: ${sp.isDivorced ? '이혼 (단절)' : '법률혼'} · ${sp.person.isDeceased ? '사망' : '생존'}`,
        `지위: ${formatHeirStatusKo(hr?.status)} [지분: ${hr ? hr.statutoryShareRate.toFractionString() : '-'}]`,
        `최종 배분: ${hr ? Number(hr.finalConcreteShareWon).toLocaleString() + ' 원' : '0 원'}`,
        isHeir ? PALETTE.heirHeader : PALETTE.inactiveHeader,
        isHeir
      );
    }

    currentRow += 4;

    // C. Generation 1: Children (if any)
    if (children.length > 0) {
      // 1. Vertical drop from couple midpoint
      this.setCell(ws, currentRow, coupleMidCol, '│', {
        alignment: { horizontal: 'center', vertical: 'center' },
        font: { bold: true, color: { rgb: PALETTE.borderDark }, sz: 12 },
      });
      currentRow += 1;

      // 2. Compute each child's column and center column
      const childCols: number[] = [];
      const childCenterCols: number[] = [];
      children.forEach((_, idx) => {
        const col = startOffsetCol + idx * 4;
        childCols.push(col);
        childCenterCols.push(col + 1);
      });

      // 3. Horizontal distribution line across children
      const minChildCenter = Math.min(...childCenterCols);
      const maxChildCenter = Math.max(...childCenterCols);
      const spanStart = Math.min(minChildCenter, coupleMidCol);
      const spanEnd = Math.max(maxChildCenter, coupleMidCol);

      for (let c = spanStart; c <= spanEnd; c++) {
        const isChildCenter = childCenterCols.includes(c);
        const isMid = c === coupleMidCol;

        let char = '─';
        if (isChildCenter && isMid) char = '┼';
        else if (isChildCenter) char = '┬';
        else if (isMid) char = '┴';

        this.setCell(ws, currentRow, c, char, {
          alignment: { horizontal: 'center', vertical: 'center' },
          font: { bold: true, color: { rgb: PALETTE.borderDark }, sz: 11 },
          border: {
            bottom: { style: 'medium', color: { rgb: PALETTE.borderDark } },
          },
        });
      }
      currentRow += 1;

      // 4. Downward arrows to each child
      childCenterCols.forEach(cc => {
        this.setCell(ws, currentRow, cc, '▼', {
          alignment: { horizontal: 'center', vertical: 'center' },
          font: { bold: true, color: { rgb: PALETTE.borderDark }, sz: 10 },
        });
      });
      currentRow += 1;

      // 5. Draw each child card
      const childStartRow = currentRow;
      children.forEach((ch, idx) => {
        const col = childCols[idx];
        const hr = result.heirResults.find(h => h.personId === ch.id);
        const isHeir = hr?.status === 'VALID_HEIR' || hr?.status === 'REPRESENTATIVE_HEIR';
        const isDisq = ch.isDisqualified || ch.hasDeprivation || ch.hasRenounced;

        let headerColor = PALETTE.heirHeader;
        if (isDisq) headerColor = PALETTE.disqualifiedHeader;
        else if (ch.isDeceased) headerColor = PALETTE.inactiveHeader;

        const roleTitle = `${ch.gender === 'MALE' ? '♂' : '♀'} 자녀 ${idx + 1} (${ch.name})`;
        const statusDesc = `상태: ${ch.isDeceased ? '선사망' : '생존'} · ${formatAdoptionTypeKo(ch.adoptionType)}`;
        const shareDesc = `지위: ${formatHeirStatusKo(hr?.status)} [지분: ${hr ? hr.statutoryShareRate.toFractionString() : '-'}]`;
        const amountDesc = `최종 배분: ${hr ? Number(hr.finalConcreteShareWon).toLocaleString() + ' 원' : '0 원'}`;

        this.drawPersonCard(
          ws,
          merges,
          childStartRow,
          col,
          roleTitle,
          statusDesc,
          shareDesc,
          amountDesc,
          headerColor,
          isHeir
        );
      });

      currentRow += 4;

      // D. Generation 2: Grandchildren / Representative Heirs
      for (const [chId, gcList] of grandchildrenMap.entries()) {
        const chIdx = children.findIndex(c => c.id === chId);
        if (chIdx !== -1 && gcList.length > 0) {
          const chCenter = childCenterCols[chIdx];
          this.setCell(ws, currentRow, chCenter, '│ [대습]', {
            alignment: { horizontal: 'center', vertical: 'center' },
            font: { bold: true, color: { rgb: PALETTE.borderDark }, sz: 9 },
          });
          currentRow += 1;

          gcList.forEach((gc, gcIdx) => {
            const gcCol = childCols[chIdx] + gcIdx * 4;
            const hr = result.heirResults.find(h => h.personId === gc.id);
            const isHeir = hr?.status === 'REPRESENTATIVE_HEIR' || hr?.status === 'VALID_HEIR';

            this.drawPersonCard(
              ws,
              merges,
              currentRow,
              gcCol,
              `손자녀 · ${gc.name} [대습상속]`,
              `상태: ${gc.isDeceased ? '사망' : '생존'} · ${formatAdoptionTypeKo(gc.adoptionType)}`,
              `지위: 대습상속인 [지분: ${hr ? hr.statutoryShareRate.toFractionString() : '-'}]`,
              `최종 배분: ${hr ? Number(hr.finalConcreteShareWon).toLocaleString() + ' 원' : '0 원'}`,
              PALETTE.heirHeader,
              isHeir
            );
          });
          currentRow += 4;
        }
      }
    }

    // Spacing between Diagram and Tables
    currentRow += 3;

    // ====================================================
    // TABLE 1: 가계도 구성원별 상속 지위 및 재산 승계 총괄표
    // ====================================================
    this.mergeRange(
      ws,
      merges,
      currentRow,
      1,
      currentRow,
      13,
      '1. 가계도 구성원별 상속 지위 및 재산 승계 총괄표',
      {
        font: { name: '맑은 고딕', sz: 11, bold: true, color: { rgb: PALETTE.headerBg } },
        alignment: { horizontal: 'left', vertical: 'center' },
      }
    );
    currentRow += 1;

    const t1Headers = [
      '구분',
      '성명',
      '성별',
      '생사여부',
      '입양형태',
      '법적 상속지위',
      '법정상속비율',
      '최종구체적상속분(원)',
      '법정승계채무(원)',
      '최종순상속액(원)',
      '특별수익(원)',
      '기여분(원)',
      '비고 및 법적 특이사항',
    ];

    t1Headers.forEach((th, cIdx) => {
      this.setCell(ws, currentRow, cIdx + 1, th, {
        fill: { fgColor: { rgb: PALETTE.sectionBg } },
        font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerFg } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: BORDERS.tableHeader,
      });
    });
    currentRow += 1;

    // Deceased Row
    const deceasedRowData = [
      '피상속인',
      deceased.name,
      deceased.gender === 'MALE' ? '남성' : '여성',
      '사망 (상속개시)',
      formatAdoptionTypeKo(deceased.adoptionType),
      '피상속인 (고인)',
      '-',
      0,
      0,
      0,
      0,
      0,
      `상속개시일: ${estate.openingDate}`,
    ];
    deceasedRowData.forEach((val, cIdx) => {
      const isNum = typeof val === 'number';
      this.setCell(
        ws,
        currentRow,
        cIdx + 1,
        val,
        {
          fill: { fgColor: { rgb: 'F5EFEA' } },
          font: { name: '맑은 고딕', sz: 9, bold: true },
          alignment: { horizontal: isNum ? 'right' : 'center', vertical: 'center' },
          border: BORDERS.thinLight,
        },
        isNum ? '#,##0' : undefined
      );
    });
    currentRow += 1;

    // Relative Rows
    const otherPersons = Array.from(allPersons.values()).filter(p => p.id !== deceased.id);
    otherPersons.forEach((p, pIdx) => {
      const hr = result.heirResults.find(h => h.personId === p.id);
      const totalGifts = p.specialBenefits.reduce((sum, g) => sum + g.amountWon, 0n);
      const totalBequests = p.bequests.reduce((sum, b) => sum + b.amountWon, 0n);

      let roleTag = '친족';
      const isSpouse = relationships.some(r => r.type === 'SPOUSE' && (r.fromId === p.id || r.toId === p.id));
      const isChild = relationships.some(r => r.type === 'PARENT_CHILD' && (r.fromId === deceased.id && r.toId === p.id));
      const isParent = relationships.some(r => r.type === 'PARENT_CHILD' && (r.fromId === p.id && r.toId === deceased.id));
      if (isSpouse) roleTag = '배우자';
      else if (isChild) roleTag = '직계비속(자녀)';
      else if (isParent) roleTag = '직계존속(부모)';
      else if (hr?.status === 'REPRESENTATIVE_HEIR') roleTag = '대습상속인';

      const specialNotes: string[] = [];
      if (p.isDisqualified) specialNotes.push('상속결격(제1004조)');
      if (p.hasDeprivation) specialNotes.push('상속권상실(구하라법 제1004조의2)');
      if (p.hasRenounced) specialNotes.push('상속포기(제1019조)');
      if (p.remarriedBeforeOpening) specialNotes.push('개시전재혼(인척종료)');

      const rowVals = [
        roleTag,
        p.name,
        p.gender === 'MALE' ? '남성' : '여성',
        p.isDeceased ? '사망' : '생존',
        formatAdoptionTypeKo(p.adoptionType),
        formatHeirStatusKo(hr?.status),
        hr ? hr.statutoryShareRate.toFractionString() : '-',
        hr ? Number(hr.finalConcreteShareWon) : 0,
        hr ? Number(hr.allocatedDebtWon) : 0,
        hr ? Number(hr.netInheritanceWon) : 0,
        Number(totalGifts + totalBequests),
        Number(p.contributionAmountWon),
        specialNotes.length > 0 ? specialNotes.join(', ') : '해당없음',
      ];

      const rowBg = pIdx % 2 === 0 ? PALETTE.cardBodyBg : PALETTE.zebraBg;
      rowVals.forEach((val, cIdx) => {
        const isNum = typeof val === 'number';
        this.setCell(
          ws,
          currentRow,
          cIdx + 1,
          val,
          {
            fill: { fgColor: { rgb: rowBg } },
            font: { name: '맑은 고딕', sz: 9 },
            alignment: { horizontal: isNum ? 'right' : 'center', vertical: 'center' },
            border: BORDERS.thinLight,
          },
          isNum ? '#,##0' : undefined
        );
      });
      currentRow += 1;
    });

    currentRow += 2;

    // ====================================================
    // TABLE 2: 친족 관계 및 상속 계통 연결망 (Pedigree Edges)
    // ====================================================
    this.mergeRange(
      ws,
      merges,
      currentRow,
      1,
      currentRow,
      6,
      '2. 친족 관계 및 상속 계통 연결망 (Pedigree Edges)',
      {
        font: { name: '맑은 고딕', sz: 11, bold: true, color: { rgb: PALETTE.headerBg } },
        alignment: { horizontal: 'left', vertical: 'center' },
      }
    );
    currentRow += 1;

    const t2Headers = ['관계 ID', '시작 인물 (From)', '대상 인물 (To)', '관계 유형', '혼인/친자 상태', '적용 민법 조항 및 법적 효력'];
    t2Headers.forEach((th, cIdx) => {
      this.setCell(ws, currentRow, cIdx + 1, th, {
        fill: { fgColor: { rgb: PALETTE.sectionBg } },
        font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerFg } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: BORDERS.tableHeader,
      });
    });
    currentRow += 1;

    relationships.forEach((r, idx) => {
      const fromPerson = allPersons.get(r.fromId);
      const toPerson = allPersons.get(r.toId);
      const fromName = fromPerson ? fromPerson.name : r.fromId;
      const toName = toPerson ? toPerson.name : r.toId;

      let relTypeKo = '기타 친족';
      let statusKo = '정상';
      let legalNote = '민법 친족편';

      if (r.type === 'SPOUSE') {
        relTypeKo = '배우자 관계';
        statusKo = r.isDivorced ? '이혼 (상속권 소멸)' : '법률혼 (정상 배우자)';
        legalNote = '민법 제1003조 (배우자의 상속순위, 직계존/비속과 공동상속 시 5할 가산)';
      } else if (r.type === 'PARENT_CHILD') {
        relTypeKo = '부모-자녀 관계';
        statusKo = '직계 혈족';
        legalNote = '민법 제1000조 (제1순위 직계비속 또는 제2순위 직계존속)';
      }

      const rVals = [r.id || `rel_${idx + 1}`, fromName, toName, relTypeKo, statusKo, legalNote];
      const rBg = idx % 2 === 0 ? PALETTE.cardBodyBg : PALETTE.zebraBg;

      rVals.forEach((val, cIdx) => {
        this.setCell(ws, currentRow, cIdx + 1, val, {
          fill: { fgColor: { rgb: rBg } },
          font: { name: '맑은 고딕', sz: 9 },
          alignment: { horizontal: cIdx === 5 ? 'left' : 'center', vertical: 'center' },
          border: BORDERS.thinLight,
        });
      });
      currentRow += 1;
    });

    // Finalize Worksheet Range, Merges, and Column Widths
    ws['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: currentRow + 2, c: 15 },
    });
    ws['!merges'] = merges;
    ws['!cols'] = [
      { wch: 4 },  // Margin Col A
      { wch: 14 }, // Col B
      { wch: 14 }, // Col C
      { wch: 14 }, // Col D
      { wch: 14 }, // Col E
      { wch: 14 }, // Col F
      { wch: 14 }, // Col G
      { wch: 14 }, // Col H
      { wch: 14 }, // Col I
      { wch: 14 }, // Col J
      { wch: 14 }, // Col K
      { wch: 14 }, // Col L
      { wch: 16 }, // Col M
      { wch: 28 }, // Col N
    ];

    return ws;
  }

  /**
   * Main export method: creates full multi-tab stylized Excel document
   */
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
    // Apply styling to Summary Table header
    const ws1HeaderRow = 15;
    for (let c = 0; c < 8; c++) {
      const addr = XLSX.utils.encode_cell({ r: ws1HeaderRow, c });
      if (ws1[addr]) {
        ws1[addr].s = {
          fill: { fgColor: { rgb: PALETTE.headerBg } },
          font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerFg } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
    }
    ws1['!cols'] = [{ wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws1, '종합 요약서');

    // 2. Sheet 2: 가계도 (엑셀 기본 기능인 셀 병합, 외곽선, 컬러 음영으로 구성된 네이티브 다이어그램 탭)
    const wsFamilyTree = this.buildNativeFamilyTreeSheet(params);
    XLSX.utils.book_append_sheet(wb, wsFamilyTree, '가계도');

    // 3. Sheet 3: 상속인 권리 분석표
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
    for (let c = 0; c < 8; c++) {
      const addr = XLSX.utils.encode_cell({ r: 2, c });
      if (ws2[addr]) {
        ws2[addr].s = {
          fill: { fgColor: { rgb: PALETTE.sectionBg } },
          font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerFg } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
    }
    ws2['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws2, '상속인 권리 분석');

    // 4. Sheet 4: 구체적 상속분 계산서
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
    for (let c = 0; c < 7; c++) {
      const addr = XLSX.utils.encode_cell({ r: 4, c });
      if (ws3[addr]) {
        ws3[addr].s = {
          fill: { fgColor: { rgb: PALETTE.sectionBg } },
          font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerFg } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
    }
    ws3['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 22 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws3, '구체적 상속분 계산');

    // 5. Sheet 5: 유류분 정산 명세서
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
    for (let c = 0; c < 5; c++) {
      const addr = XLSX.utils.encode_cell({ r: 4, c });
      if (ws4[addr]) {
        ws4[addr].s = {
          fill: { fgColor: { rgb: PALETTE.sectionBg } },
          font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerFg } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
    }
    ws4['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws4, '유류분 정산 명세');

    // 6. Sheet 6: 법률 근거 및 판례 로그
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
    for (let c = 0; c < 4; c++) {
      const addr = XLSX.utils.encode_cell({ r: 2, c });
      if (ws5[addr]) {
        ws5[addr].s = {
          fill: { fgColor: { rgb: PALETTE.sectionBg } },
          font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerFg } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
    }
    ws5['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 28 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws5, '법률 근거 및 판례');

    // Export Excel workbook via Blob
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
