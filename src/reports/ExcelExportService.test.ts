import { describe, it, expect } from 'vitest';
import { ExcelExportService } from './ExcelExportService';
import { InheritancePipelineEngine } from '../domain/pipeline/InheritancePipelineEngine';
import { PersonNode, RelationshipEdge } from '../domain/models/Person';
import { EstateData } from '../domain/models/Estate';
import * as XLSX from 'xlsx-js-style';

function createPerson(overrides: Partial<PersonNode>): PersonNode {
  return {
    id: overrides.id || 'p_unknown',
    name: overrides.name || 'Unknown',
    gender: overrides.gender || 'MALE',
    isDeceased: overrides.isDeceased ?? false,
    deathDate: overrides.deathDate,
    isDisqualified: overrides.isDisqualified ?? false,
    hasDeprivation: overrides.hasDeprivation ?? false,
    hasRenounced: overrides.hasRenounced ?? false,
    adoptionType: overrides.adoptionType || 'NONE',
    remarriedBeforeOpening: overrides.remarriedBeforeOpening ?? false,
    birthYear: overrides.birthYear || 1980,
    contributionAmountWon: overrides.contributionAmountWon ?? 0n,
    specialBenefits: overrides.specialBenefits || [],
    bequests: overrides.bequests || [],
    canvasX: 0,
    canvasY: 0,
  };
}

describe('ExcelExportService Worksheet Margins, Borders & Auto-Fit Tests', () => {
  const deceased = createPerson({ id: 'dec', name: '피상속인 (고인)', isDeceased: true });
  const spouse = createPerson({ id: 'sp', name: '배우자', gender: 'FEMALE' });
  const child1 = createPerson({ id: 'c1', name: '장남 (자녀1)' });
  const child2 = createPerson({ id: 'c2', name: '차남 (자녀2)' });

  const allPersons = new Map<string, PersonNode>([
    ['dec', deceased],
    ['sp', spouse],
    ['c1', child1],
    ['c2', child2],
  ]);

  const relationships: RelationshipEdge[] = [
    { id: 'rel_spouse', fromId: 'dec', toId: 'sp', type: 'SPOUSE' },
    { id: 'rel_c1', fromId: 'dec', toId: 'c1', type: 'PARENT_CHILD' },
    { id: 'rel_c2', fromId: 'dec', toId: 'c2', type: 'PARENT_CHILD' },
  ];

  const estate: EstateData = {
    openingDate: '2026-05-01',
    activeRealEstateWon: 500_000_000n,
    activeFinancialWon: 200_000_000n,
    activeOtherWon: 0n,
    passiveDebtWon: 0n,
  };

  it('verifies 30px row/col margins and auto column widths across all sheets in FULL mode', () => {
    const result = InheritancePipelineEngine.execute({
      deceasedId: 'dec',
      allPersons,
      relationships,
      estate,
    });

    const wb = ExcelExportService.createWorkbook({
      deceased,
      allPersons,
      relationships,
      estate,
      result,
      calculationMode: 'FULL',
    });

    expect(wb).toBeDefined();

    // Check all 6 sheets
    const sheetNames = ['종합 요약서', '가계도', '상속인 권리 분석', '구체적 상속분 계산', '유류분 정산 명세', '법률 근거 및 판례'];
    for (const name of sheetNames) {
      const ws = wb.Sheets[name];
      expect(ws, `Sheet '${name}' should exist`).toBeDefined();

      // Check Row 0 height is 30px (22.5pt in Excel)
      expect(ws['!rows'], `Sheet '${name}' !rows should be defined`).toBeDefined();
      expect(ws['!rows']?.[0]?.hpt, `Sheet '${name}' Row 0 height should be 22.5pt (30px)`).toBe(22.5);

      // Check Col 0 (Column A) width is 30px
      expect(ws['!cols'], `Sheet '${name}' !cols should be defined`).toBeDefined();
      expect(ws['!cols']?.[0]?.wpx, `Sheet '${name}' Col 0 width should be 30px`).toBe(30);

      // Check Col 0 (A1) does not contain substantive text
      const a1 = ws['A1'];
      expect(a1?.v === undefined || a1?.v === '', `Sheet '${name}' A1 should be empty`).toBe(true);
    }

    // Verify Section Headers in Sheet 1 (종합 요약서): Row 3 (B4:I4), Row 8 (B9:I9), Row 16 (B17:I17)
    const ws1 = wb.Sheets['종합 요약서'];
    const sectionRows = [3, 8, 16];
    for (const r of sectionRows) {
      for (let c = 1; c <= 8; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        const cell = ws1[cellRef];
        expect(cell, `Cell ${cellRef} in row ${r + 1} should exist`).toBeDefined();
        expect(cell.s?.border?.top?.style, `Cell ${cellRef} top border style`).toBe('thin');
        expect(cell.s?.border?.top?.color?.rgb, `Cell ${cellRef} top border color`).toBe('92400E');
        expect(cell.s?.border?.bottom?.style, `Cell ${cellRef} bottom border style`).toBe('thin');
        expect(cell.s?.border?.bottom?.color?.rgb, `Cell ${cellRef} bottom border color`).toBe('92400E');
        expect(cell.s?.fill?.fgColor?.rgb, `Cell ${cellRef} fill`).toBe('F5EBE6');
      }
    }

    // Verify Title Banner in Sheet 1: Row 1, Col 1 to 8
    for (let c = 1; c <= 8; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: 1, c });
      const cell = ws1[cellRef];
      expect(cell, `Title cell ${cellRef} should exist`).toBeDefined();
    }

    // Verify 가계도 (Family Tree) Sheet Table 2 legal reference merge
    const wsTree = wb.Sheets['가계도'];
    const merges = wsTree['!merges'] as XLSX.Range[];
    expect(merges).toBeDefined();

    // Check that Family tree Title Banner has NO fill shading (clean background)
    const treeTitleCell = wsTree['B2'];
    expect(treeTitleCell, 'Family tree title cell B2 should exist').toBeDefined();
    expect(treeTitleCell.s?.fill, 'Family tree title cell should have no background fill').toBeUndefined();

    // Check that legal reference column is merged across columns 5 to 13 (no 관계 ID column)
    const legalRefMerge = merges.find(m => m.s.c === 5 && m.e.c === 13);
    expect(legalRefMerge, 'Family tree Table 2 legal reference should be merged across columns 5 to 13').toBeDefined();

    // Verify Sheet 6 (법률 근거 및 판례) '내용 및 산출 수식' column width is generously wide (>= 140)
    const wsLegal = wb.Sheets['법률 근거 및 판례'];
    expect(wsLegal).toBeDefined();
    const legalCol4 = wsLegal['!cols']?.[4];
    expect(legalCol4?.wch, 'Column 4 (내용 및 산출 수식) should be at least 140 chars wide').toBeGreaterThanOrEqual(140);
  });

  it('verifies 30px row/col margins and auto column widths in SHARE_ONLY mode', () => {
    const result = InheritancePipelineEngine.execute({
      deceasedId: 'dec',
      allPersons,
      relationships,
      estate,
    });

    const wb = ExcelExportService.createWorkbook({
      deceased,
      allPersons,
      relationships,
      estate,
      result,
      calculationMode: 'SHARE_ONLY',
    });

    expect(wb).toBeDefined();

    const sheetNames = ['상속 지분율 요약', '가계도', '상속인 권리 분석', '법률 근거 및 판례'];
    for (const name of sheetNames) {
      const ws = wb.Sheets[name];
      expect(ws, `Sheet '${name}' should exist`).toBeDefined();

      // Check Row 0 height is 30px (22.5pt in Excel)
      expect(ws['!rows']?.[0]?.hpt, `Sheet '${name}' Row 0 height should be 22.5pt (30px)`).toBe(22.5);

      // Check Col 0 width is 30px
      expect(ws['!cols']?.[0]?.wpx, `Sheet '${name}' Col 0 width should be 30px`).toBe(30);
    }

    // In SHARE_ONLY Sheet 1: Section 1 (Row 3, Col 1..8), Section 2 (Row 9, Col 1..8)
    const ws1 = wb.Sheets['상속 지분율 요약'];
    const sectionRows = [3, 9];
    for (const r of sectionRows) {
      for (let c = 1; c <= 8; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        const cell = ws1[cellRef];
        expect(cell, `Cell ${cellRef} in row ${r + 1} should exist`).toBeDefined();
        expect(cell.s?.border?.top?.style).toBe('thin');
        expect(cell.s?.border?.top?.color?.rgb).toBe('92400E');
        expect(cell.s?.border?.bottom?.style).toBe('thin');
        expect(cell.s?.border?.bottom?.color?.rgb).toBe('92400E');
        expect(cell.s?.fill?.fgColor?.rgb).toBe('F5EBE6');
      }
    }

    // Verify that the removed disclaimer text does not exist
    for (const key of Object.keys(ws1)) {
      if (key.startsWith('!')) continue;
      const cellVal = String(ws1[key]?.v ?? '');
      expect(cellVal).not.toContain('재산 가액을 배제하고');
      expect(cellVal).not.toContain('공식 문서');
    }

    // Verify Sheet 4 (법률 근거 및 판례) '내용 및 산출 수식' column width is generously wide (>= 140)
    const wsLegalShare = wb.Sheets['법률 근거 및 판례'];
    expect(wsLegalShare).toBeDefined();
    const legalCol4Share = wsLegalShare['!cols']?.[4];
    expect(legalCol4Share?.wch, 'Column 4 (내용 및 산출 수식) in SHARE_ONLY should be at least 140 chars wide').toBeGreaterThanOrEqual(140);
  });
});
