import * as XLSX from 'xlsx-js-style';
import { PipelineExecutionResult } from '../domain/models/PipelineResult';
import { EstateData } from '../domain/models/Estate';
import { AdoptionType, HeirStatus, PersonNode, RelationshipEdge } from '../domain/models/Person';
import { CalculationMode } from '../state/useInheritanceStore';

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
   * Helper to set standard margin (Row 0 height: 30px [22.5pt], Col 0 width: 30px)
   * and automatically calculate column widths based on cell content length
   */
  private static applyAutoFitAndMargins(
    ws: Record<string, any>,
    merges: XLSX.Range[],
    maxCols: number,
    customMinWidths?: Record<number, number>
  ) {
    // 1. Set Row 0 height to exactly 30px (In Excel OpenXML, row height is in points: 1px = 0.75pt, so 30px = 22.5pt)
    ws['!rows'] = ws['!rows'] || [];
    ws['!rows'][0] = { hpt: 22.5, hpx: 22.5 };

    // 2. Identify merged cells that span multiple columns (should be excluded from single-column width calc)
    const multiColMergedCells = new Set<string>();
    for (const m of merges) {
      if (m.e.c > m.s.c) {
        for (let r = m.s.r; r <= m.e.r; r++) {
          for (let c = m.s.c; c <= m.e.c; c++) {
            multiColMergedCells.add(`${r},${c}`);
          }
        }
      }
    }

    // 3. Calculate max visual length per column (c: 1 to maxCols)
    // Col 0: empty margin exactly 30px
    const colWidths: XLSX.ColInfo[] = [
      { wpx: 30 },
    ];

    for (let c = 1; c <= maxCols; c++) {
      let maxLen = customMinWidths?.[c] ?? 12;

      // Scan all cells in column c
      for (const key of Object.keys(ws)) {
        if (key.startsWith('!')) continue;
        const cellCoord = XLSX.utils.decode_cell(key);
        if (cellCoord.c !== c) continue;
        if (cellCoord.r === 0) continue; // Skip margin row

        // Skip multi-column merged cells to avoid inflating single column width
        if (multiColMergedCells.has(`${cellCoord.r},${cellCoord.c}`)) {
          continue;
        }

        const cell = ws[key];
        if (!cell || cell.v === undefined || cell.v === null || cell.v === '') continue;

        let strVal = String(cell.v);
        if (typeof cell.v === 'number') {
          if (cell.z && cell.z.includes('#,##0')) {
            strVal = Math.round(cell.v).toLocaleString();
          }
        }

        let visualLen = 0;
        for (let i = 0; i < strVal.length; i++) {
          const code = strVal.charCodeAt(i);
          // Hangul, fullwidth symbols, CJK
          if (
            (code >= 0xac00 && code <= 0xd7a3) ||
            (code >= 0x1100 && code <= 0x11ff) ||
            (code >= 0x3130 && code <= 0x318f) ||
            (code >= 0x4e00 && code <= 0x9fff) ||
            code > 0xff
          ) {
            visualLen += 2.25;
          } else {
            visualLen += 1.0;
          }
        }

        if (visualLen > maxLen) {
          maxLen = visualLen;
        }
      }

      // Add generous padding (8 chars) and allow wide text columns up to 320 chars without clipping
      const finalWch = Math.min(320, Math.max(customMinWidths?.[c] ?? 12, Math.ceil(maxLen + 8)));
      colWidths.push({ wch: finalWch });
    }

    ws['!cols'] = colWidths;
    ws['!merges'] = merges;
  }

  /**
   * Helper to format a merged section header across columns with continuous top & bottom border
   */
  private static styleMergedSectionHeader(
    ws: Record<string, any>,
    merges: XLSX.Range[],
    r: number,
    startCol: number,
    endCol: number,
    text?: string
  ) {
    merges.push({ s: { r, c: startCol }, e: { r, c: endCol } });
    for (let c = startCol; c <= endCol; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const currentVal = ws[addr]?.v;
      const val = c === startCol ? (text !== undefined ? text : (currentVal ?? '')) : '';
      this.setCell(
        ws,
        r,
        c,
        val,
        {
          fill: { fgColor: { rgb: 'F5EBE6' } },
          font: { name: '맑은 고딕', sz: 11, bold: true, color: { rgb: PALETTE.sectionBg } },
          alignment: { horizontal: 'left', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: PALETTE.borderMedium } },
            bottom: { style: 'thin', color: { rgb: PALETTE.borderMedium } },
            left: c === startCol ? { style: 'thin', color: { rgb: PALETTE.borderMedium } } : undefined,
            right: c === endCol ? { style: 'thin', color: { rgb: PALETTE.borderMedium } } : undefined,
          },
        }
      );
    }
  }

  /**
   * Helper to style a full-width title banner across columns
   */
  private static styleTitleBanner(
    ws: Record<string, any>,
    merges: XLSX.Range[],
    r: number,
    startCol: number,
    endCol: number,
    title: string,
    fontSize: number = 14
  ) {
    merges.push({ s: { r, c: startCol }, e: { r, c: endCol } });
    for (let c = startCol; c <= endCol; c++) {
      this.setCell(
        ws,
        r,
        c,
        c === startCol ? title : '',
        {
          font: { name: '맑은 고딕', sz: fontSize, bold: true, color: { rgb: PALETTE.headerBg } },
          alignment: { horizontal: 'left', vertical: 'center' },
        }
      );
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
    calculationMode: CalculationMode;
  }): XLSX.WorkSheet {
    const { deceased, allPersons, relationships, estate, result, calculationMode } = params;
    const isShareOnly = calculationMode === 'SHARE_ONLY';
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
    const table1ColSpan = isShareOnly ? 11 : 13;
    this.styleTitleBanner(ws, merges, 1, 1, table1ColSpan, '대한민국 상속 가계도 및 친족 계통 다이어그램', 14);

    // --- GRID COORDINATE COMPUTATION ---
    const childCount = children.length;
    const totalChildCols = childCount > 0 ? childCount * 3 + (childCount - 1) * 1 : 0;
    const totalColsNeeded = Math.max(totalChildCols, spouses.length > 0 ? 9 : 7);
    const startOffsetCol = 1;

    let currentRow = 3;

    // A. Generation -1: Parents (if any)
    if (parents.length > 0) {
      const parentStartCol = startOffsetCol + 2;
      parents.forEach((par, idx) => {
        const c = parentStartCol + idx * 4;
        const hr = result.heirResults.find(h => h.personId === par.id);
        const isHeir = hr?.status === 'VALID_HEIR';

        const roleDesc = hr
          ? (isShareOnly
              ? `법정지분: ${hr.statutoryShareRate.toFractionString()} (${(hr.statutoryShareRate.toNumber() * 100).toFixed(1)}%)`
              : `지위: ${formatHeirStatusKo(hr?.status)}`)
          : '지위: 비상속인';
        const finalDesc = hr
          ? (isShareOnly
              ? `유류분율: ${hr.statutoryShareRate.multiply(1n, 3n).toFractionString()}`
              : `배분액: ${Number(hr.finalConcreteShareWon).toLocaleString()} 원`)
          : (isShareOnly ? '상속 지분 없음' : '0 원');

        this.drawPersonCard(
          ws,
          merges,
          currentRow,
          c,
          `직계존속 · ${par.name}`,
          `상태: ${par.isDeceased ? '선사망' : '생존'} · ${formatAdoptionTypeKo(par.adoptionType)}`,
          roleDesc,
          finalDesc,
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
      isShareOnly ? `상속개시일: ${estate.openingDate}` : `순재산: ${Number(netTotal).toLocaleString()} 원`,
      isShareOnly ? `적용: ${formatPolicyVersionKo(result.policyVersion).split(' ')[0]}` : `상속채무: ${Number(estate.passiveDebtWon).toLocaleString()} 원`,
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

      const spRole = hr
        ? (isShareOnly
            ? `법정지분: ${hr.statutoryShareRate.toFractionString()} (${(hr.statutoryShareRate.toNumber() * 100).toFixed(1)}%)`
            : `지위: ${formatHeirStatusKo(hr?.status)} [지분: ${hr.statutoryShareRate.toFractionString()}]`)
        : '지위: 비상속인';
      const spAmount = hr
        ? (isShareOnly
            ? `유류분율: ${hr.statutoryShareRate.multiply(1n, 2n).toFractionString()} (${(hr.statutoryShareRate.multiply(1n, 2n).toNumber() * 100).toFixed(1)}%)`
            : `최종 배분: ${Number(hr.finalConcreteShareWon).toLocaleString()} 원`)
        : (isShareOnly ? '지분 없음' : '0 원');

      // Draw Spouse Card
      this.drawPersonCard(
        ws,
        merges,
        currentRow,
        spouseCol,
        `♀ 배우자 · ${sp.person.name}`,
        `상태: ${sp.isDivorced ? '이혼 (단절)' : '법률혼'} · ${sp.person.isDeceased ? '사망' : '생존'}`,
        spRole,
        spAmount,
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
        const shareDesc = hr
          ? (isShareOnly
              ? `법정지분: ${hr.statutoryShareRate.toFractionString()} (${(hr.statutoryShareRate.toNumber() * 100).toFixed(1)}%)`
              : `지위: ${formatHeirStatusKo(hr?.status)} [지분: ${hr.statutoryShareRate.toFractionString()}]`)
          : '지위: 비상속인';
        const amountDesc = hr
          ? (isShareOnly
              ? `유류분율: ${hr.statutoryShareRate.multiply(1n, 2n).toFractionString()} (${(hr.statutoryShareRate.multiply(1n, 2n).toNumber() * 100).toFixed(1)}%)`
              : `최종 배분: ${Number(hr.finalConcreteShareWon).toLocaleString()} 원`)
          : (isShareOnly ? '지분 없음' : '0 원');

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

            const gcRole = hr
              ? (isShareOnly
                  ? `법정지분: ${hr.statutoryShareRate.toFractionString()} (${(hr.statutoryShareRate.toNumber() * 100).toFixed(1)}%)`
                  : `지위: 대습상속인 [지분: ${hr.statutoryShareRate.toFractionString()}]`)
              : '비상속인';
            const gcAmt = hr
              ? (isShareOnly
                  ? `유류분율: ${hr.statutoryShareRate.multiply(1n, 2n).toFractionString()} (${(hr.statutoryShareRate.multiply(1n, 2n).toNumber() * 100).toFixed(1)}%)`
                  : `최종 배분: ${Number(hr.finalConcreteShareWon).toLocaleString()} 원`)
              : (isShareOnly ? '지분 없음' : '0 원');

            this.drawPersonCard(
              ws,
              merges,
              currentRow,
              gcCol,
              `손자녀 · ${gc.name} [대습상속]`,
              `상태: ${gc.isDeceased ? '사망' : '생존'} · ${formatAdoptionTypeKo(gc.adoptionType)}`,
              gcRole,
              gcAmt,
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
    const table1Title = isShareOnly
      ? '1. 가계도 구성원별 법정 상속지분율 및 유류분율 총괄표'
      : '1. 가계도 구성원별 상속 지위 및 재산 승계 총괄표';

    this.mergeRange(
      ws,
      merges,
      currentRow,
      1,
      currentRow,
      table1ColSpan,
      table1Title,
      {
        font: { name: '맑은 고딕', sz: 11, bold: true, color: { rgb: PALETTE.headerBg } },
        alignment: { horizontal: 'left', vertical: 'center' },
      }
    );
    currentRow += 1;

    const t1Headers = isShareOnly
      ? [
          '구분',
          '성명',
          '성별',
          '생사여부',
          '입양형태',
          '법적 상속지위',
          '법정상속비율(분수)',
          '법정지분율(%)',
          '유류분비율(분수)',
          '유류분율(%)',
          '비고 및 법적 특이사항',
        ]
      : [
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
    const deceasedRowData = isShareOnly
      ? [
          '피상속인',
          deceased.name,
          deceased.gender === 'MALE' ? '남성' : '여성',
          '사망 (상속개시)',
          formatAdoptionTypeKo(deceased.adoptionType),
          '피상속인 (고인)',
          '-',
          '-',
          '-',
          '-',
          `상속개시일: ${estate.openingDate}`,
        ]
      : [
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

      const reserveRate = hr ? hr.statutoryShareRate.multiply(1n, 2n) : null;
      const rowVals = isShareOnly
        ? [
            roleTag,
            p.name,
            p.gender === 'MALE' ? '남성' : '여성',
            p.isDeceased ? '사망' : '생존',
            formatAdoptionTypeKo(p.adoptionType),
            formatHeirStatusKo(hr?.status),
            hr ? hr.statutoryShareRate.toFractionString() : '-',
            hr ? `${(hr.statutoryShareRate.toNumber() * 100).toFixed(2)}%` : '-',
            reserveRate ? reserveRate.toFractionString() : '-',
            reserveRate ? `${(reserveRate.toNumber() * 100).toFixed(2)}%` : '-',
            specialNotes.length > 0 ? specialNotes.join(', ') : '해당없음',
          ]
        : [
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
    // TABLE 2: 친족 관계 및 상속 계통 연결망
    // ====================================================
    this.mergeRange(
      ws,
      merges,
      currentRow,
      1,
      currentRow,
      table1ColSpan,
      '2. 친족 관계 및 상속 계통 연결망',
      {
        font: { name: '맑은 고딕', sz: 11, bold: true, color: { rgb: PALETTE.headerBg } },
        alignment: { horizontal: 'left', vertical: 'center' },
      }
    );
    currentRow += 1;

    const t2Headers = ['기준 인물', '관계 인물', '관계 유형', '혼인/친자 상태'];
    t2Headers.forEach((th, cIdx) => {
      this.setCell(ws, currentRow, cIdx + 1, th, {
        fill: { fgColor: { rgb: PALETTE.sectionBg } },
        font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerFg } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: BORDERS.tableHeader,
      });
    });

    // Merge columns 5 to table1ColSpan for legal reference header
    this.mergeRange(
      ws,
      merges,
      currentRow,
      5,
      currentRow,
      table1ColSpan,
      '적용 민법 조항 및 법적 효력',
      {
        fill: { fgColor: { rgb: PALETTE.sectionBg } },
        font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerFg } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: BORDERS.tableHeader,
      }
    );
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

      const rVals = [fromName, toName, relTypeKo, statusKo];
      const rBg = idx % 2 === 0 ? PALETTE.cardBodyBg : PALETTE.zebraBg;

      rVals.forEach((val, cIdx) => {
        this.setCell(ws, currentRow, cIdx + 1, val, {
          fill: { fgColor: { rgb: rBg } },
          font: { name: '맑은 고딕', sz: 9 },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: BORDERS.thinLight,
        });
      });

      // Merge columns 5 to table1ColSpan for legalNote so long text doesn't overflow or clip
      this.mergeRange(
        ws,
        merges,
        currentRow,
        5,
        currentRow,
        table1ColSpan,
        legalNote,
        {
          fill: { fgColor: { rgb: rBg } },
          font: { name: '맑은 고딕', sz: 9 },
          alignment: { horizontal: 'left', vertical: 'center' },
          border: BORDERS.thinLight,
        }
      );
      currentRow += 1;
    });

    // Finalize Worksheet Range, Merges, and Column Widths with 30px Margins and Auto-Fit
    ws['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: currentRow + 2, c: table1ColSpan + 1 },
    });
    this.applyAutoFitAndMargins(ws, merges, table1ColSpan, {
      1: 14,
      2: 14,
      3: 10,
      4: 12,
      5: 14,
      6: 16,
      7: 14,
      8: 18,
      9: 16,
      10: 18,
      11: 16,
      12: 16,
      13: 28,
    });

    return ws;
  }

  /**
   * Builds the multi-tab stylized Excel workbook
   */
  static createWorkbook(params: {
    deceased: PersonNode;
    allPersons: Map<string, PersonNode>;
    relationships: RelationshipEdge[];
    estate: EstateData;
    result: PipelineExecutionResult;
    calculationMode?: CalculationMode;
  }): XLSX.WorkBook {
    const { deceased, allPersons, estate, result } = params;
    const calculationMode = params.calculationMode || 'FULL';
    const isShareOnly = calculationMode === 'SHARE_ONLY';
    const wb = XLSX.utils.book_new();

    if (isShareOnly) {
      // ==========================================
      // [SHARE_ONLY MODE: 4 TABS WITHOUT AMOUNTS]
      // ==========================================

      // 1. Sheet 1: 상속 지분율 요약서 (Row 0 & Col A margin)
      const summaryData = [
        [''], // Row 0 (Empty margin)
        ['', '대한민국 상속 지분율 및 유류분율 요약서'], // Row 1
        [''], // Row 2
        ['', '1. 피상속인(고인) 기본 정보'], // Row 3
        ['', '성명', deceased.name], // Row 4
        ['', '상속개시일자', estate.openingDate], // Row 5
        ['', '적용 법률 버전', formatPolicyVersionKo(result.policyVersion)], // Row 6
        ['', '상속인 총원', `${result.heirResults.length}명`], // Row 7
        [''], // Row 8
        ['', '2. 상속인별 최종 법정상속분율 및 유류분율 명세'], // Row 9
        ['', '상속인 성명', '상속 자격', '법정상속비율(분수)', '법정지분율(%)', '유류분비율(분수)', '유류분율(%)', '대습상속 여부', '관련 법률 조항 및 비고'], // Row 10
        ...result.heirResults.map(h => {
          const isRep = h.status === 'REPRESENTATIVE_HEIR';
          const reserveRate = h.statutoryShareRate.multiply(1n, 2n);
          return [
            '',
            h.name,
            formatHeirStatusKo(h.status),
            h.statutoryShareRate.toFractionString(),
            `${(h.statutoryShareRate.toNumber() * 100).toFixed(2)}%`,
            reserveRate.toFractionString(),
            `${(reserveRate.toNumber() * 100).toFixed(2)}%`,
            isRep ? '대습상속 (민법 제1001조)' : '직접상속',
            isRep ? '선사망/결격 상속인의 고유 지분을 균등 승계' : '민법 제1000조 및 제1003조 배우자 5할 가산',
          ];
        }),
        ['', '합 계', '', '1/1', '100.00%', '-', '-', '-', '민법 제1009조 법정상속분 배분 완료'],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
      const ws1Merges: XLSX.Range[] = [];

      // Title Styling (Row 1, Col 1 to 8)
      this.styleTitleBanner(ws1, ws1Merges, 1, 1, 8, '대한민국 상속 지분율 및 유류분율 요약서', 14);

      // Section 1: 피상속인(고인) 기본 정보 (Row 3, Col 1 to 8)
      this.styleMergedSectionHeader(ws1, ws1Merges, 3, 1, 8, '1. 피상속인(고인) 기본 정보');

      // Rows 4 to 7: Info items (Col 1: label, Col 2: value)
      for (let r = 4; r <= 7; r++) {
        const aAddr = XLSX.utils.encode_cell({ r, c: 1 });
        const bAddr = XLSX.utils.encode_cell({ r, c: 2 });
        if (ws1[aAddr]) {
          ws1[aAddr].s = {
            fill: { fgColor: { rgb: PALETTE.cardSubBg } },
            font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerBg } },
            alignment: { horizontal: 'left', vertical: 'center' },
            border: BORDERS.thinLight,
          };
        }
        if (ws1[bAddr]) {
          ws1[bAddr].s = {
            font: { name: '맑은 고딕', sz: 9.5, color: { rgb: '1C1917' } },
            alignment: { horizontal: 'left', vertical: 'center' },
            border: BORDERS.thinLight,
          };
        }
      }

      // Section 2: 상속인별 최종 법정상속분율 및 유류분율 명세 (Row 9, Col 1 to 8)
      this.styleMergedSectionHeader(ws1, ws1Merges, 9, 1, 8, '2. 상속인별 최종 법정상속분율 및 유류분율 명세');

      // Table Header Row 10 (Col 1 to 8)
      const ws1HeaderRow = 10;
      for (let c = 1; c <= 8; c++) {
        const addr = XLSX.utils.encode_cell({ r: ws1HeaderRow, c });
        if (ws1[addr]) {
          ws1[addr].s = {
            fill: { fgColor: { rgb: PALETTE.headerBg } },
            font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerFg } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: BORDERS.tableHeader,
          };
        }
      }

      // Data Rows
      const dataStartR = 11;
      const heirCount = result.heirResults.length;
      for (let r = dataStartR; r < dataStartR + heirCount; r++) {
        const isZebra = (r - dataStartR) % 2 === 1;
        const bg = isZebra ? PALETTE.zebraBg : PALETTE.cardBodyBg;
        for (let c = 1; c <= 8; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (ws1[addr]) {
            ws1[addr].s = {
              fill: { fgColor: { rgb: bg } },
              font: { name: '맑은 고딕', sz: 9.5, bold: c === 1 || c === 3 },
              alignment: { horizontal: c === 8 ? 'left' : 'center', vertical: 'center' },
              border: BORDERS.thinLight,
            };
          }
        }
      }

      // Summary Row
      const sumRow = dataStartR + heirCount;
      for (let c = 1; c <= 8; c++) {
        const addr = XLSX.utils.encode_cell({ r: sumRow, c });
        if (ws1[addr]) {
          ws1[addr].s = {
            fill: { fgColor: { rgb: PALETTE.cardSubBg } },
            font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerBg } },
            alignment: { horizontal: c === 8 ? 'left' : 'center', vertical: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: PALETTE.borderMedium } },
              bottom: { style: 'double', color: { rgb: PALETTE.headerBg } },
            },
          };
        }
      }

      this.applyAutoFitAndMargins(ws1, ws1Merges, 8);
      XLSX.utils.book_append_sheet(wb, ws1, '상속 지분율 요약');

      // 2. Sheet 2: 가계도
      const wsFamilyTree = this.buildNativeFamilyTreeSheet({ ...params, calculationMode });
      XLSX.utils.book_append_sheet(wb, wsFamilyTree, '가계도');

      // 3. Sheet 3: 상속인 권리 및 지분 분석
      const heirAnalysisData = [
        [''], // Row 0 (Margin)
        ['', '상속인 권리 및 지분 자격 분석표'], // Row 1
        [''], // Row 2
        ['', '인물 성명', '성별', '생사여부', '입양형태', '상속결격', '구하라법상실선고', '상속포기', '최종상속지위', '법정상속비율', '지분율(%)'], // Row 3
        ...Array.from(allPersons.values()).map(p => {
          const heirResult = result.heirResults.find(h => h.personId === p.id);
          return [
            '',
            p.name,
            p.gender === 'MALE' ? '남성' : '여성',
            p.isDeceased ? '사망' : '생존',
            formatAdoptionTypeKo(p.adoptionType),
            p.isDisqualified ? '결격(제1004조)' : '해당없음',
            p.hasDeprivation ? '상실선고(제1004조의2)' : '해당없음',
            p.hasRenounced ? '상속포기(제1019조)' : '해당없음',
            formatHeirStatusKo(heirResult?.status),
            heirResult ? heirResult.statutoryShareRate.toFractionString() : '-',
            heirResult ? `${(heirResult.statutoryShareRate.toNumber() * 100).toFixed(2)}%` : '-',
          ];
        }),
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(heirAnalysisData);
      const ws2Merges: XLSX.Range[] = [];
      this.styleTitleBanner(ws2, ws2Merges, 1, 1, 10, '상속인 권리 및 지분 자격 분석표');

      for (let c = 1; c <= 10; c++) {
        const addr = XLSX.utils.encode_cell({ r: 3, c });
        if (ws2[addr]) {
          ws2[addr].s = {
            fill: { fgColor: { rgb: PALETTE.headerBg } },
            font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerFg } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: BORDERS.tableHeader,
          };
        }
      }

      const pCount = allPersons.size;
      for (let r = 4; r < 4 + pCount; r++) {
        const bg = (r - 4) % 2 === 1 ? PALETTE.zebraBg : PALETTE.cardBodyBg;
        for (let c = 1; c <= 10; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (ws2[addr]) {
            ws2[addr].s = {
              fill: { fgColor: { rgb: bg } },
              font: { name: '맑은 고딕', sz: 9.5, bold: c === 1 || c === 8 },
              alignment: { horizontal: 'center', vertical: 'center' },
              border: BORDERS.thinLight,
            };
          }
        }
      }

      this.applyAutoFitAndMargins(ws2, ws2Merges, 10);
      XLSX.utils.book_append_sheet(wb, ws2, '상속인 권리 분석');

      // 4. Sheet 4: 법률 근거 및 판례 로그
      const traceData = [
        [''], // Row 0 (Margin)
        ['', '적용 법률 조항 및 대법원·헌재 판례 감사 추적 로그 (지분율 관련)'], // Row 1
        [''], // Row 2
        ['', '단계', '구분', '관련 법조문 / 판례', '내용 및 산출 수식'], // Row 3
        ...result.traces
          .filter(t => t.stepId === 'STEP1' || t.stepId === 'STEP2')
          .map(t => [
            '',
            t.stepId,
            t.titleKo,
            t.articleRefs.join(', '),
            t.descriptionKo + (t.formulaText ? ` [수식: ${t.formulaText}]` : ''),
          ]),
      ];
      const ws4 = XLSX.utils.aoa_to_sheet(traceData);
      const ws4Merges: XLSX.Range[] = [];
      this.styleTitleBanner(ws4, ws4Merges, 1, 1, 4, '적용 법률 조항 및 대법원·헌재 판례 감사 추적 로그 (지분율 관련)');

      for (let c = 1; c <= 4; c++) {
        const addr = XLSX.utils.encode_cell({ r: 3, c });
        if (ws4[addr]) {
          ws4[addr].s = {
            fill: { fgColor: { rgb: PALETTE.headerBg } },
            font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerFg } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: BORDERS.tableHeader,
          };
        }
      }

      const traceCount = result.traces.filter(t => t.stepId === 'STEP1' || t.stepId === 'STEP2').length;
      for (let r = 4; r < 4 + traceCount; r++) {
        const bg = (r - 4) % 2 === 1 ? PALETTE.zebraBg : PALETTE.cardBodyBg;
        for (let c = 1; c <= 4; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (ws4[addr]) {
            ws4[addr].s = {
              fill: { fgColor: { rgb: bg } },
              font: { name: '맑은 고딕', sz: 9 },
              alignment: { horizontal: c === 4 ? 'left' : 'center', vertical: 'center' },
              border: BORDERS.thinLight,
            };
          }
        }
      }

      this.applyAutoFitAndMargins(ws4, ws4Merges, 4, { 1: 14, 2: 26, 3: 40, 4: 140 });
      XLSX.utils.book_append_sheet(wb, ws4, '법률 근거 및 판례');
    } else {
      // ==========================================
      // [FULL MODE: 6 TABS WITH ALL AMOUNTS]
      // ==========================================

      // 1. Sheet 1: 종합 요약서 (Row 0 & Col A margin)
      const totalConcrete = result.heirResults.reduce((sum, h) => sum + Number(h.finalConcreteShareWon), 0);
      const totalDebt = result.heirResults.reduce((sum, h) => sum + Number(h.allocatedDebtWon), 0);
      const totalNet = result.heirResults.reduce((sum, h) => sum + Number(h.netInheritanceWon), 0);
      const totalShortage = result.heirResults.reduce((sum, h) => sum + Number(h.reserveShortageWon), 0);
      const totalReturn = result.heirResults.reduce((sum, h) => sum + Number(h.reserveCompensationObligationWon), 0);

      const summaryData = [
        [''], // Row 0 (Empty margin)
        ['', '대한민국 상속 분배 및 유류분 종합 보고서'], // Row 1
        [''], // Row 2
        ['', '1. 피상속인 기본 정보'], // Row 3
        ['', '성명', deceased.name], // Row 4
        ['', '상속개시일자', estate.openingDate], // Row 5
        ['', '적용 법률 버전', formatPolicyVersionKo(result.policyVersion)], // Row 6
        [''], // Row 7
        ['', '2. 상속 재산 및 채무 내역'], // Row 8
        ['', '부동산 가액', Number(estate.activeRealEstateWon)], // Row 9
        ['', '금융 재산', Number(estate.activeFinancialWon)], // Row 10
        ['', '기타 재산', Number(estate.activeOtherWon)], // Row 11
        ['', '총 적극재산', Number(estate.activeRealEstateWon + estate.activeFinancialWon + estate.activeOtherWon)], // Row 12
        ['', '상속 채무', Number(estate.passiveDebtWon)], // Row 13
        ['', '순 적극재산 (적극-채무)', Number(estate.activeRealEstateWon + estate.activeFinancialWon + estate.activeOtherWon - estate.passiveDebtWon)], // Row 14
        [''], // Row 15
        ['', '3. 상속인별 최종 배분 요약'], // Row 16
        ['', '상속인 성명', '상속 자격', '법정상속비율', '구체적상속분(원)', '승계채무(원)', '순상속액(원)', '유류분부족액(원)', '유류분반환의무(원)'], // Row 17
        ...result.heirResults.map(h => [
          '',
          h.name,
          formatHeirStatusKo(h.status),
          h.statutoryShareRate.toFractionString(),
          Number(h.finalConcreteShareWon),
          Number(h.allocatedDebtWon),
          Number(h.netInheritanceWon),
          Number(h.reserveShortageWon),
          Number(h.reserveCompensationObligationWon),
        ]),
        ['', '합 계', '', '1/1', totalConcrete, totalDebt, totalNet, totalShortage, totalReturn],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
      const ws1Merges: XLSX.Range[] = [];

      // Title Styling (Row 1, Col 1 to 8)
      this.styleTitleBanner(ws1, ws1Merges, 1, 1, 8, '대한민국 상속 분배 및 유류분 종합 보고서', 14);

      // Section 1: 피상속인 기본 정보 (Row 3, Col 1 to 8)
      this.styleMergedSectionHeader(ws1, ws1Merges, 3, 1, 8, '1. 피상속인 기본 정보');
      for (let r = 4; r <= 6; r++) {
        const aAddr = XLSX.utils.encode_cell({ r, c: 1 });
        const bAddr = XLSX.utils.encode_cell({ r, c: 2 });
        if (ws1[aAddr]) {
          ws1[aAddr].s = {
            fill: { fgColor: { rgb: PALETTE.cardSubBg } },
            font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerBg } },
            alignment: { horizontal: 'left', vertical: 'center' },
            border: BORDERS.thinLight,
          };
        }
        if (ws1[bAddr]) {
          ws1[bAddr].s = {
            font: { name: '맑은 고딕', sz: 9.5, color: { rgb: '1C1917' } },
            alignment: { horizontal: 'left', vertical: 'center' },
            border: BORDERS.thinLight,
          };
        }
      }

      // Section 2: 상속 재산 및 채무 내역 (Row 8, Col 1 to 8)
      this.styleMergedSectionHeader(ws1, ws1Merges, 8, 1, 8, '2. 상속 재산 및 채무 내역');
      for (let r = 9; r <= 14; r++) {
        const isHighlight = r === 12 || r === 14; // 총 적극재산, 순 적극재산
        const aAddr = XLSX.utils.encode_cell({ r, c: 1 });
        const bAddr = XLSX.utils.encode_cell({ r, c: 2 });
        if (ws1[aAddr]) {
          ws1[aAddr].s = {
            fill: isHighlight ? { fgColor: { rgb: PALETTE.cardSubBg } } : undefined,
            font: { name: '맑은 고딕', sz: 9.5, bold: isHighlight, color: { rgb: r === 13 ? '991B1B' : '1C1917' } },
            alignment: { horizontal: 'left', vertical: 'center' },
            border: BORDERS.thinLight,
          };
        }
        if (ws1[bAddr]) {
          ws1[bAddr].z = '#,##0';
          ws1[bAddr].s = {
            fill: isHighlight ? { fgColor: { rgb: PALETTE.cardSubBg } } : undefined,
            font: { name: '맑은 고딕', sz: 9.5, bold: isHighlight, color: { rgb: r === 13 ? '991B1B' : '1C1917' } },
            alignment: { horizontal: 'right', vertical: 'center' },
            border: BORDERS.thinLight,
          };
        }
      }

      // Section 3: 상속인별 최종 배분 요약 (Row 16, Col 1 to 8)
      this.styleMergedSectionHeader(ws1, ws1Merges, 16, 1, 8, '3. 상속인별 최종 배분 요약');

      // Table Header Row 17 (Col 1 to 8)
      const ws1HeaderRow = 17;
      for (let c = 1; c <= 8; c++) {
        const addr = XLSX.utils.encode_cell({ r: ws1HeaderRow, c });
        if (ws1[addr]) {
          ws1[addr].s = {
            fill: { fgColor: { rgb: PALETTE.headerBg } },
            font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerFg } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: BORDERS.tableHeader,
          };
        }
      }

      // Data Rows (Row 18 ~ Row 18 + heirCount - 1)
      const dataStartR = 18;
      const heirCount = result.heirResults.length;
      for (let r = dataStartR; r < dataStartR + heirCount; r++) {
        const isZebra = (r - dataStartR) % 2 === 1;
        const bg = isZebra ? PALETTE.zebraBg : PALETTE.cardBodyBg;
        for (let c = 1; c <= 8; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (ws1[addr]) {
            const isAmountCol = c >= 4;
            ws1[addr].s = {
              fill: { fgColor: { rgb: bg } },
              font: {
                name: '맑은 고딕',
                sz: 9.5,
                bold: c === 1 || c === 4 || c === 6,
                color: c === 5 && ws1[addr].v > 0 ? { rgb: '991B1B' } : undefined,
              },
              alignment: { horizontal: isAmountCol ? 'right' : 'center', vertical: 'center' },
              border: BORDERS.thinLight,
            };
            if (isAmountCol) {
              ws1[addr].z = '#,##0';
            }
          }
        }
      }

      // Summary Total Row
      const sumRow = dataStartR + heirCount;
      for (let c = 1; c <= 8; c++) {
        const addr = XLSX.utils.encode_cell({ r: sumRow, c });
        if (ws1[addr]) {
          const isAmountCol = c >= 4;
          ws1[addr].s = {
            fill: { fgColor: { rgb: PALETTE.cardSubBg } },
            font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerBg } },
            alignment: { horizontal: isAmountCol ? 'right' : 'center', vertical: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: PALETTE.borderMedium } },
              bottom: { style: 'double', color: { rgb: PALETTE.headerBg } },
            },
          };
          if (isAmountCol) {
            ws1[addr].z = '#,##0';
          }
        }
      }

      this.applyAutoFitAndMargins(ws1, ws1Merges, 8);
      XLSX.utils.book_append_sheet(wb, ws1, '종합 요약서');

      // 2. Sheet 2: 가계도
      const wsFamilyTree = this.buildNativeFamilyTreeSheet({ ...params, calculationMode });
      XLSX.utils.book_append_sheet(wb, wsFamilyTree, '가계도');

      // 3. Sheet 3: 상속인 권리 분석표
      const heirAnalysisData = [
        [''], // Row 0 (Margin)
        ['', '상속인 권리 및 자격 분석표'], // Row 1
        [''], // Row 2
        ['', '인물 성명', '성별', '생사여부', '입양형태', '상속결격', '구하라법상실선고', '상속포기', '최종상속지위'], // Row 3
        ...Array.from(allPersons.values()).map(p => {
          const heirResult = result.heirResults.find(h => h.personId === p.id);
          return [
            '',
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
      const ws2Merges: XLSX.Range[] = [];
      this.styleTitleBanner(ws2, ws2Merges, 1, 1, 8, '상속인 권리 및 자격 분석표');

      for (let c = 1; c <= 8; c++) {
        const addr = XLSX.utils.encode_cell({ r: 3, c });
        if (ws2[addr]) {
          ws2[addr].s = {
            fill: { fgColor: { rgb: PALETTE.headerBg } },
            font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerFg } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: BORDERS.tableHeader,
          };
        }
      }

      const pCountFull = allPersons.size;
      for (let r = 4; r < 4 + pCountFull; r++) {
        const bg = (r - 4) % 2 === 1 ? PALETTE.zebraBg : PALETTE.cardBodyBg;
        for (let c = 1; c <= 8; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (ws2[addr]) {
            ws2[addr].s = {
              fill: { fgColor: { rgb: bg } },
              font: { name: '맑은 고딕', sz: 9.5, bold: c === 1 || c === 8 },
              alignment: { horizontal: 'center', vertical: 'center' },
              border: BORDERS.thinLight,
            };
          }
        }
      }

      this.applyAutoFitAndMargins(ws2, ws2Merges, 8);
      XLSX.utils.book_append_sheet(wb, ws2, '상속인 권리 분석');

      // 4. Sheet 4: 구체적 상속분 계산서
      const concreteCalcData = [
        [''], // Row 0 (Margin)
        ['', '구체적 상속분 및 초과특별수익 안분 계산서 (대법원 2017스98)'], // Row 1
        [''], // Row 2
        ['', '간주상속재산(원)', Number(result.deemedEstateWon)], // Row 3
        [''], // Row 4
        ['', '상속인', '법정상속비율', '잠정상속분(원)', '특별수익합계(원)', '기여분(원)', '최종구체적상속분(원)', '법정승계채무(원)'], // Row 5
        ...result.heirResults.map(h => {
          const p = allPersons.get(h.personId);
          const totalGift = p?.specialBenefits.reduce((s, g) => s + g.amountWon, 0n) ?? 0n;
          const totalBequest = p?.bequests.reduce((s, b) => s + b.amountWon, 0n) ?? 0n;
          return [
            '',
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
      const ws3Merges: XLSX.Range[] = [];
      this.styleTitleBanner(ws3, ws3Merges, 1, 1, 7, '구체적 상속분 및 초과특별수익 안분 계산서 (대법원 2017스98)');

      // r: 3 간주상속재산 (Col 1: label, Col 2: value)
      const cAAddr = XLSX.utils.encode_cell({ r: 3, c: 1 });
      const cBAddr = XLSX.utils.encode_cell({ r: 3, c: 2 });
      if (ws3[cAAddr]) {
        ws3[cAAddr].s = {
          fill: { fgColor: { rgb: PALETTE.cardSubBg } },
          font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerBg } },
          alignment: { horizontal: 'left', vertical: 'center' },
          border: BORDERS.thinLight,
        };
      }
      if (ws3[cBAddr]) {
        ws3[cBAddr].z = '#,##0';
        ws3[cBAddr].s = {
          font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: '1C1917' } },
          alignment: { horizontal: 'right', vertical: 'center' },
          border: BORDERS.thinLight,
        };
      }

      // r: 5 Header (Col 1 to 7)
      for (let c = 1; c <= 7; c++) {
        const addr = XLSX.utils.encode_cell({ r: 5, c });
        if (ws3[addr]) {
          ws3[addr].s = {
            fill: { fgColor: { rgb: PALETTE.headerBg } },
            font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerFg } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: BORDERS.tableHeader,
          };
        }
      }

      // r: 6 ~ Data (Col 1 to 7)
      for (let r = 6; r < 6 + heirCount; r++) {
        const bg = (r - 6) % 2 === 1 ? PALETTE.zebraBg : PALETTE.cardBodyBg;
        for (let c = 1; c <= 7; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (ws3[addr]) {
            const isAmount = c >= 3;
            ws3[addr].s = {
              fill: { fgColor: { rgb: bg } },
              font: { name: '맑은 고딕', sz: 9.5, bold: c === 1 || c === 6 },
              alignment: { horizontal: isAmount ? 'right' : 'center', vertical: 'center' },
              border: BORDERS.thinLight,
            };
            if (isAmount) {
              ws3[addr].z = '#,##0';
            }
          }
        }
      }

      this.applyAutoFitAndMargins(ws3, ws3Merges, 7);
      XLSX.utils.book_append_sheet(wb, ws3, '구체적 상속분 계산');

      // 5. Sheet 5: 유류분 정산 명세서
      const reserveData = [
        [''], // Row 0 (Margin)
        ['', '유류분 부족액 및 가액반환 정산 명세서 (민법 제1113조, 제1115조)'], // Row 1
        [''], // Row 2
        ['', '유류분 산정 기초재산(원)', Number(result.reserveSettlement.baseEstateWon)], // Row 3
        [''], // Row 4
        ['', '상속인', '법정상속비율', '유류분율', '유류분부족액(원)', '유류분반환의무(원)'], // Row 5
        ...result.heirResults.map(h => [
          '',
          h.name,
          h.statutoryShareRate.toFractionString(),
          h.statutoryShareRate.multiply(1n, 2n).toFractionString(),
          Number(h.reserveShortageWon),
          Number(h.reserveCompensationObligationWon),
        ]),
        [''], // Row 5 + heirCount + 1
        ['', '유류분 가액반환 흐름 명세 (2026 민법 제1115조)'], // Row 5 + heirCount + 2
        ['', '반환의무자', '반환받는권리자', '가액반환금액(원)', '반환형태'], // Row 5 + heirCount + 3
        ...result.reserveSettlement.compensationFlows.map(f => [
          '',
          f.fromPersonName,
          f.toPersonName,
          Number(f.amountWon),
          f.isMonetary ? '금전(가액)반환' : '원물반환',
        ]),
      ];
      const ws4 = XLSX.utils.aoa_to_sheet(reserveData);
      const ws4Merges: XLSX.Range[] = [];
      this.styleTitleBanner(ws4, ws4Merges, 1, 1, 5, '유류분 부족액 및 가액반환 정산 명세서 (민법 제1113조, 제1115조)');

      // r: 3 기초재산 (Col 1: label, Col 2: value)
      const rAAddr = XLSX.utils.encode_cell({ r: 3, c: 1 });
      const rBAddr = XLSX.utils.encode_cell({ r: 3, c: 2 });
      if (ws4[rAAddr]) {
        ws4[rAAddr].s = {
          fill: { fgColor: { rgb: PALETTE.cardSubBg } },
          font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerBg } },
          alignment: { horizontal: 'left', vertical: 'center' },
          border: BORDERS.thinLight,
        };
      }
      if (ws4[rBAddr]) {
        ws4[rBAddr].z = '#,##0';
        ws4[rBAddr].s = {
          font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: '1C1917' } },
          alignment: { horizontal: 'right', vertical: 'center' },
          border: BORDERS.thinLight,
        };
      }

      // r: 5 Header 1 (Col 1 to 5)
      for (let c = 1; c <= 5; c++) {
        const addr = XLSX.utils.encode_cell({ r: 5, c });
        if (ws4[addr]) {
          ws4[addr].s = {
            fill: { fgColor: { rgb: PALETTE.headerBg } },
            font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerFg } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: BORDERS.tableHeader,
          };
        }
      }

      // r: 6 ~ Data 1 (Col 1 to 5)
      for (let r = 6; r < 6 + heirCount; r++) {
        const bg = (r - 6) % 2 === 1 ? PALETTE.zebraBg : PALETTE.cardBodyBg;
        for (let c = 1; c <= 5; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (ws4[addr]) {
            const isAmount = c >= 4;
            ws4[addr].s = {
              fill: { fgColor: { rgb: bg } },
              font: { name: '맑은 고딕', sz: 9.5, bold: c === 1 },
              alignment: { horizontal: isAmount ? 'right' : 'center', vertical: 'center' },
              border: BORDERS.thinLight,
            };
            if (isAmount) {
              ws4[addr].z = '#,##0';
            }
          }
        }
      }

      // Section 2: 유류분 가액반환 흐름 명세 (Row 6 + heirCount + 1, Col 1 to 5)
      const flowSectionR = 6 + heirCount + 1;
      this.styleMergedSectionHeader(ws4, ws4Merges, flowSectionR, 1, 5, '유류분 가액반환 흐름 명세 (2026 민법 제1115조)');

      // Flow Table Header: row flowSectionR + 1 (Col 1 to 4)
      const flowHeaderR = flowSectionR + 1;
      for (let c = 1; c <= 4; c++) {
        const addr = XLSX.utils.encode_cell({ r: flowHeaderR, c });
        if (ws4[addr]) {
          ws4[addr].s = {
            fill: { fgColor: { rgb: PALETTE.headerBg } },
            font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerFg } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: BORDERS.tableHeader,
          };
        }
      }

      // Flow Data Rows
      const flowCount = result.reserveSettlement.compensationFlows.length;
      for (let r = flowHeaderR + 1; r <= flowHeaderR + flowCount; r++) {
        const bg = (r - flowHeaderR) % 2 === 1 ? PALETTE.cardBodyBg : PALETTE.zebraBg;
        for (let c = 1; c <= 4; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (ws4[addr]) {
            const isAmount = c === 3;
            ws4[addr].s = {
              fill: { fgColor: { rgb: bg } },
              font: { name: '맑은 고딕', sz: 9.5, bold: c === 1 || c === 2 },
              alignment: { horizontal: isAmount ? 'right' : 'center', vertical: 'center' },
              border: BORDERS.thinLight,
            };
            if (isAmount) {
              ws4[addr].z = '#,##0';
            }
          }
        }
      }

      this.applyAutoFitAndMargins(ws4, ws4Merges, 5);
      XLSX.utils.book_append_sheet(wb, ws4, '유류분 정산 명세');

      // 6. Sheet 6: 법률 근거 및 판례 로그
      const traceData = [
        [''], // Row 0 (Margin)
        ['', '적용 법률 조항 및 대법원·헌재 판례 감사 추적 로그'], // Row 1
        [''], // Row 2
        ['', '단계', '구분', '관련 법조문 / 판례', '내용 및 산출 수식'], // Row 3
        ...result.traces.map(t => [
          '',
          t.stepId,
          t.titleKo,
          t.articleRefs.join(', '),
          t.descriptionKo + (t.formulaText ? ` [수식: ${t.formulaText}]` : ''),
        ]),
      ];
      const ws5 = XLSX.utils.aoa_to_sheet(traceData);
      const ws5Merges: XLSX.Range[] = [];
      this.styleTitleBanner(ws5, ws5Merges, 1, 1, 4, '적용 법률 조항 및 대법원·헌재 판례 감사 추적 로그');

      for (let c = 1; c <= 4; c++) {
        const addr = XLSX.utils.encode_cell({ r: 3, c });
        if (ws5[addr]) {
          ws5[addr].s = {
            fill: { fgColor: { rgb: PALETTE.headerBg } },
            font: { name: '맑은 고딕', sz: 9.5, bold: true, color: { rgb: PALETTE.headerFg } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: BORDERS.tableHeader,
          };
        }
      }

      const fullTraceCount = result.traces.length;
      for (let r = 4; r < 4 + fullTraceCount; r++) {
        const bg = (r - 4) % 2 === 1 ? PALETTE.zebraBg : PALETTE.cardBodyBg;
        for (let c = 1; c <= 4; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (ws5[addr]) {
            ws5[addr].s = {
              fill: { fgColor: { rgb: bg } },
              font: { name: '맑은 고딕', sz: 9 },
              alignment: { horizontal: c === 4 ? 'left' : 'center', vertical: 'center' },
              border: BORDERS.thinLight,
            };
          }
        }
      }

      this.applyAutoFitAndMargins(ws5, ws5Merges, 4, { 1: 14, 2: 26, 3: 40, 4: 140 });
      XLSX.utils.book_append_sheet(wb, ws5, '법률 근거 및 판례');
    }

    return wb;
  }

  /**
   * Main export method: creates full multi-tab stylized Excel document and triggers file download
   */
  static exportToExcel(params: {
    deceased: PersonNode;
    allPersons: Map<string, PersonNode>;
    relationships: RelationshipEdge[];
    estate: EstateData;
    result: PipelineExecutionResult;
    calculationMode?: CalculationMode;
  }): string {
    const { deceased, estate } = params;
    const calculationMode = params.calculationMode || 'FULL';
    const isShareOnly = calculationMode === 'SHARE_ONLY';

    const wb = this.createWorkbook(params);

    // Export Excel workbook via Blob
    const safeName = deceased.name.replace(/[\\/:*?"<>|]/g, '_');
    const prefix = isShareOnly ? '상속지분율계산서' : '상속분배계산서';
    const fileName = `${prefix}_${safeName}_${estate.openingDate}.xlsx`;

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
