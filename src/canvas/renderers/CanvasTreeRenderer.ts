import { PersonNode, RelationshipEdge } from '../../domain/models/Person';
import { HeirCalculationResult } from '../../domain/models/PipelineResult';
import { CanvasViewport, CANVAS_CONSTANTS } from '../core/CanvasViewport';
import { OrthogonalRouter } from '../core/OrthogonalRouter';

export interface RenderOptions {
  deceasedId: string;
  persons: Map<string, PersonNode>;
  relationships: RelationshipEdge[];
  heirResults?: Map<string, HeirCalculationResult>;
  selectedPersonId?: string | null;
  hoveredPersonId?: string | null;
  activeGuidelines?: {
    horizontalY?: number;
    verticalX?: number;
  };
}

export class CanvasTreeRenderer {
  static render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    viewport: CanvasViewport,
    options: RenderOptions
  ) {
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // 1. Draw dot grid background
    this.renderGrid(ctx, width, height, viewport);

    // Apply viewport transform (pan & zoom)
    ctx.save();
    ctx.scale(viewport.zoom, viewport.zoom);
    ctx.translate(viewport.panX, viewport.panY);

    // 2. Draw guidelines if any
    this.renderGuidelines(ctx, options.activeGuidelines);

    // 3. Draw routed connection lines (Spouse & Parent-Child)
    this.renderEdges(ctx, options);

    // 4. Draw person nodes
    this.renderNodes(ctx, options);

    ctx.restore();
    ctx.restore();
  }

  private static renderGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    viewport: CanvasViewport
  ) {
    ctx.fillStyle = '#0f0c0a'; // Deep espresso dark background
    ctx.fillRect(0, 0, width, height);

    const gridSize = 30 * viewport.zoom;
    if (gridSize < 8) return; // Don't draw if too small

    const startX = (viewport.panX * viewport.zoom) % gridSize;
    const startY = (viewport.panY * viewport.zoom) % gridSize;

    ctx.fillStyle = 'rgba(217, 180, 140, 0.12)'; // Warm bronze dot grid
    for (let x = startX; x < width; x += gridSize) {
      for (let y = startY; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private static renderGuidelines(
    ctx: CanvasRenderingContext2D,
    guidelines?: { horizontalY?: number; verticalX?: number }
  ) {
    if (!guidelines) return;

    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    if (guidelines.horizontalY !== undefined) {
      ctx.strokeStyle = '#06b6d4'; // Cyan
      ctx.beginPath();
      ctx.moveTo(-5000, guidelines.horizontalY);
      ctx.lineTo(5000, guidelines.horizontalY);
      ctx.stroke();
    }

    if (guidelines.verticalX !== undefined) {
      ctx.strokeStyle = '#a855f7'; // Purple
      ctx.beginPath();
      ctx.moveTo(guidelines.verticalX, -5000);
      ctx.lineTo(guidelines.verticalX, 5000);
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }

  private static renderEdges(ctx: CanvasRenderingContext2D, options: RenderOptions) {
    const routed = OrthogonalRouter.routeEdges(options.persons, options.relationships);

    // 1. Render spouse connections
    for (const sp of routed.spouseLines) {
      ctx.save();
      if (sp.isDivorced) {
        ctx.strokeStyle = '#78716c';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
      } else {
        ctx.strokeStyle = '#e11d48'; // Rose red
        ctx.lineWidth = 2;
      }

      // Parallel double line
      const offset = 2.5;
      ctx.beginPath();
      ctx.moveTo(sp.start.x, sp.start.y - offset);
      ctx.lineTo(sp.end.x, sp.end.y - offset);
      ctx.moveTo(sp.start.x, sp.start.y + offset);
      ctx.lineTo(sp.end.x, sp.end.y + offset);
      ctx.stroke();

      // Middle badge
      ctx.setLineDash([]);
      ctx.fillStyle = '#261b16';
      ctx.strokeStyle = sp.isDivorced ? '#78716c' : '#e11d48';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sp.center.x, sp.center.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = sp.isDivorced ? '#a8a29e' : '#fda4af';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sp.isDivorced ? '이혼' : '부부', sp.center.x, sp.center.y);

      ctx.restore();
    }

    // 2. Render family buses (Parent-Child)
    for (const bus of routed.familyBuses) {
      ctx.save();
      ctx.strokeStyle = '#d97706'; // Warm Bronze / Amber gold
      ctx.lineWidth = 2;

      // Vertical drop from parents
      ctx.beginPath();
      ctx.moveTo(bus.verticalDropStart.x, bus.verticalDropStart.y);
      ctx.lineTo(bus.verticalDropEnd.x, bus.verticalDropEnd.y);

      // Horizontal bus bar
      ctx.moveTo(bus.horizontalBusStart.x, bus.horizontalBusStart.y);
      ctx.lineTo(bus.horizontalBusEnd.x, bus.horizontalBusEnd.y);

      // Drops to each child
      for (const entry of bus.childEntries) {
        ctx.moveTo(entry.start.x, entry.start.y);
        ctx.lineTo(entry.end.x, entry.end.y);
      }
      ctx.stroke();

      // Bus connection points
      ctx.fillStyle = '#f59e0b';
      for (const entry of bus.childEntries) {
        ctx.beginPath();
        ctx.arc(entry.end.x, entry.end.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private static renderNodes(ctx: CanvasRenderingContext2D, options: RenderOptions) {
    const nodeW = CANVAS_CONSTANTS.NODE_WIDTH;
    const nodeH = CANVAS_CONSTANTS.NODE_HEIGHT;
    const radius = CANVAS_CONSTANTS.CORNER_RADIUS;

    for (const person of options.persons.values()) {
      const isSelected = options.selectedPersonId === person.id;
      const isHovered = options.hoveredPersonId === person.id;
      const isDeceasedPerson = person.id === options.deceasedId;
      const heirResult = options.heirResults?.get(person.id);

      const x = person.canvasX;
      const y = person.canvasY;

      ctx.save();

      // Card Status Colors
      let borderColor = '#57483e'; // Warm brown border
      let statusBadgeText = '';
      let statusBadgeBg = 'rgba(87, 72, 62, 0.4)';
      let statusBadgeColor = '#d6d3d1';

      if (isDeceasedPerson) {
        borderColor = '#d97706'; // Amber-600 (Deceased gold)
        statusBadgeText = '피상속인';
        statusBadgeBg = 'rgba(217, 119, 6, 0.25)';
        statusBadgeColor = '#fbbf24';
      } else if (person.isDisqualified) {
        borderColor = '#ef4444'; // Red
        statusBadgeText = '상속결격';
        statusBadgeBg = 'rgba(239, 68, 68, 0.2)';
        statusBadgeColor = '#ef4444';
      } else if (person.hasDeprivation) {
        borderColor = '#f43f5e'; // Rose
        statusBadgeText = '상실선고(구하라법)';
        statusBadgeBg = 'rgba(244, 63, 94, 0.2)';
        statusBadgeColor = '#f43f5e';
      } else if (person.hasRenounced) {
        borderColor = '#b45309'; // Brown amber
        statusBadgeText = '상속포기';
        statusBadgeBg = 'rgba(180, 83, 9, 0.2)';
        statusBadgeColor = '#f59e0b';
      } else if (person.isDeceased) {
        borderColor = '#78716c'; // Stone-500
        statusBadgeText = '선사망';
        statusBadgeBg = 'rgba(120, 113, 108, 0.3)';
        statusBadgeColor = '#d6d3d1';
      } else if (heirResult) {
        if (heirResult.status === 'VALID_HEIR') {
          borderColor = '#10b981'; // Emerald
          statusBadgeText = '상속인';
          statusBadgeBg = 'rgba(16, 185, 129, 0.2)';
          statusBadgeColor = '#34d399';
        } else if (heirResult.status === 'REPRESENTATIVE_HEIR') {
          borderColor = '#a855f7'; // Purple
          statusBadgeText = '대습상속인';
          statusBadgeBg = 'rgba(168, 85, 247, 0.2)';
          statusBadgeColor = '#c084fc';
        }
      }

      // Selection glow
      if (isSelected) {
        ctx.shadowColor = '#f59e0b'; // Amber gold glow
        ctx.shadowBlur = 14;
      } else if (isHovered) {
        ctx.shadowColor = 'rgba(217, 180, 140, 0.25)';
        ctx.shadowBlur = 8;
      }

      // Card Background (Rounded Rectangle)
      ctx.beginPath();
      this.roundedRect(ctx, x, y, nodeW, nodeH, radius);
      ctx.fillStyle = '#1e1814'; // Dark Mahogany / Warm Walnut
      ctx.fill();

      // Card Border
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.strokeStyle = isSelected ? '#f59e0b' : borderColor;
      ctx.stroke();

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Top Status Bar (3px colored line)
      ctx.save();
      ctx.beginPath();
      this.roundedRect(ctx, x + 1, y + 1, nodeW - 2, 4, [radius, radius, 0, 0]);
      ctx.fillStyle = borderColor;
      ctx.fill();
      ctx.restore();

      // Gender & Name
      const genderSymbol = person.gender === 'MALE' ? '♂' : '♀';
      const genderColor = person.gender === 'MALE' ? '#f59e0b' : '#fb7185';

      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = genderColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(genderSymbol, x + 12, y + 14);

      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#f5f5f4';
      ctx.fillText(person.name, x + 28, y + 14);

      // Status Badge
      if (statusBadgeText) {
        ctx.font = '10px sans-serif';
        const badgeW = ctx.measureText(statusBadgeText).width + 10;
        const badgeX = x + nodeW - badgeW - 10;
        const badgeY = y + 12;

        ctx.fillStyle = statusBadgeBg;
        this.roundedRect(ctx, badgeX, badgeY, badgeW, 18, 4);
        ctx.fill();

        ctx.fillStyle = statusBadgeColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(statusBadgeText, badgeX + badgeW / 2, badgeY + 9);
      }

      // Divider line
      ctx.strokeStyle = 'rgba(120, 113, 108, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 36);
      ctx.lineTo(x + nodeW - 10, y + 36);
      ctx.stroke();

      // Details / Share info
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      if (heirResult && heirResult.finalConcreteShareWon > 0n) {
        // Legal Share Rate
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#a8a29e';
        ctx.fillText(`법정 지분: ${heirResult.statutoryShareRate.toFractionString()}`, x + 12, y + 43);

        // Final Share Amount
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#34d399'; // Emerald-400
        const formattedAmt = this.formatCurrencyWon(heirResult.finalConcreteShareWon);
        ctx.fillText(`배분: ${formattedAmt}`, x + 12, y + 59);

        // Net Inheritance after debt
        if (heirResult.allocatedDebtWon > 0n) {
          ctx.font = '10px sans-serif';
          ctx.fillStyle = '#f87171'; // Red-400
          ctx.fillText(`(채무승계 -${this.formatCurrencyWon(heirResult.allocatedDebtWon)})`, x + 12, y + 75);
        }
      } else if (person.contributionAmountWon > 0n || person.specialBenefits.length > 0) {
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#a8a29e';
        if (person.contributionAmountWon > 0n) {
          ctx.fillText(`기여분: ${this.formatCurrencyWon(person.contributionAmountWon)}`, x + 12, y + 43);
        }
        if (person.specialBenefits.length > 0) {
          const totalGift = person.specialBenefits.reduce((sum, g) => sum + g.amountWon, 0n);
          ctx.fillText(`특별수익: ${this.formatCurrencyWon(totalGift)}`, x + 12, y + 59);
        }
      } else {
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#78716c';
        ctx.fillText(isDeceasedPerson ? '상속개시일 기준 피상속인' : '클릭하여 상세 편집', x + 12, y + 52);
      }

      ctx.restore();
    }
  }

  private static formatCurrencyWon(amount: bigint): string {
    if (amount === 0n) return '0원';
    const abs = amount < 0n ? -amount : amount;
    const eok = abs / 100_000_000n;
    const man = (abs % 100_000_000n) / 10_000n;
    const won = abs % 10_000n;

    let res = '';
    if (eok > 0n) res += `${eok}억 `;
    if (man > 0n) res += `${man}만 `;
    if (won > 0n && eok === 0n) res += `${won}`;
    res = res.trim() + '원';
    return amount < 0n ? `-${res}` : res;
  }

  private static roundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number | number[]
  ) {
    if (typeof radius === 'number') {
      radius = [radius, radius, radius, radius];
    }
    const [tl, tr, br, bl] = radius;
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + width - tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + tr);
    ctx.lineTo(x + width, y + height - br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - br, y + height);
    ctx.lineTo(x + bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - bl);
    ctx.lineTo(x, y + tl);
    ctx.quadraticCurveTo(x, y, x + tl, y);
  }
}
