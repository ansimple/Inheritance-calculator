import { PersonNode, RelationshipEdge } from '../../domain/models/Person';
import { HeirCalculationResult } from '../../domain/models/PipelineResult';
import { CanvasViewport, CANVAS_CONSTANTS } from '../core/CanvasViewport';
import { OrthogonalRouter, Point2D } from '../core/OrthogonalRouter';
import { CalculationMode } from '../../state/useInheritanceStore';

export interface RenderOptions {
  deceasedId: string;
  persons: Map<string, PersonNode>;
  relationships: RelationshipEdge[];
  heirResults?: Map<string, HeirCalculationResult>;
  selectedPersonId?: string | null;
  hoveredPersonId?: string | null;
  calculationMode?: CalculationMode;
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

    const gridSize = 15 * viewport.zoom;
    if (gridSize < 6) return; // Don't draw if too small

    const startX = ((viewport.panX * viewport.zoom) % gridSize + gridSize) % gridSize;
    const startY = ((viewport.panY * viewport.zoom) % gridSize + gridSize) % gridSize;

    // 10% softer opacity (0.12 -> 0.108) and refined 1.0px dot radius for 15px spacing
    ctx.fillStyle = 'rgba(217, 180, 140, 0.105)'; // Warm bronze dot grid
    for (let x = startX; x < width; x += gridSize) {
      for (let y = startY; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.arc(x, y, 1.0, 0, Math.PI * 2);
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
      const y = CanvasViewport.snapToGrid(guidelines.horizontalY, CANVAS_CONSTANTS.MAGNET_GRID_STEP);
      ctx.strokeStyle = '#06b6d4'; // Cyan
      ctx.beginPath();
      ctx.moveTo(-5000, y);
      ctx.lineTo(5000, y);
      ctx.stroke();
    }

    if (guidelines.verticalX !== undefined) {
      const x = CanvasViewport.snapToGrid(guidelines.verticalX, CANVAS_CONSTANTS.MAGNET_GRID_STEP);
      ctx.strokeStyle = '#a855f7'; // Purple
      ctx.beginPath();
      ctx.moveTo(x, -5000);
      ctx.lineTo(x, 5000);
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }

  /**
   * Generates a parallel offset path for an orthogonal polyline.
   */
  private static computeOrthogonalOffsetPath(points: Point2D[], offset: number): Point2D[] {
    if (points.length < 2) return points;

    // Compute unit normal vectors for each segment
    const normals: { nx: number; ny: number }[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      const len = Math.hypot(dx, dy);
      if (len === 0) {
        normals.push({ nx: 0, ny: 0 });
      } else {
        normals.push({ nx: -dy / len, ny: dx / len });
      }
    }

    const offsetPoints: Point2D[] = [];

    for (let i = 0; i < points.length; i++) {
      if (i === 0) {
        const n = normals[0];
        offsetPoints.push({
          x: points[0].x + n.nx * offset,
          y: points[0].y + n.ny * offset,
        });
      } else if (i === points.length - 1) {
        const n = normals[normals.length - 1];
        offsetPoints.push({
          x: points[i].x + n.nx * offset,
          y: points[i].y + n.ny * offset,
        });
      } else {
        const n1 = normals[i - 1];
        const n2 = normals[i];
        offsetPoints.push({
          x: points[i].x + (n1.nx + n2.nx) * offset,
          y: points[i].y + (n1.ny + n2.ny) * offset,
        });
      }
    }

    return offsetPoints;
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

      ctx.lineJoin = 'miter';

      // Draw two parallel orthogonal lines
      const pts = sp.points && sp.points.length >= 2 ? sp.points : [sp.start, sp.end];
      const offset = 2.5;
      const pathA = this.computeOrthogonalOffsetPath(pts, -offset);
      const pathB = this.computeOrthogonalOffsetPath(pts, offset);

      // Path A
      ctx.beginPath();
      ctx.moveTo(pathA[0].x, pathA[0].y);
      for (let i = 1; i < pathA.length; i++) {
        ctx.lineTo(pathA[i].x, pathA[i].y);
      }
      ctx.stroke();

      // Path B
      ctx.beginPath();
      ctx.moveTo(pathB[0].x, pathB[0].y);
      for (let i = 1; i < pathB.length; i++) {
        ctx.lineTo(pathB[i].x, pathB[i].y);
      }
      ctx.stroke();

      // Middle badge placed at exact midpoint of the line length
      ctx.setLineDash([]);
      ctx.fillStyle = '#261b16';
      ctx.strokeStyle = sp.isDivorced ? '#78716c' : '#e11d48';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sp.center.x, sp.center.y, 13, 0, Math.PI * 2);
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

      // Selection / Hover glow
      if (isSelected) {
        ctx.shadowColor = statusBadgeColor || borderColor; // Match glow color to node's border tone
        ctx.shadowBlur = 6; // Crisp, subtle glow without excessive spread
      } else if (isHovered) {
        ctx.shadowColor = 'rgba(217, 180, 140, 0.25)';
        ctx.shadowBlur = 4;
      }

      // 1. Outer Frame (Base rounded rectangle creating the roof & border seamlessly)
      ctx.beginPath();
      this.roundedRect(ctx, x, y, nodeW, nodeH, radius);
      ctx.fillStyle = borderColor;
      ctx.fill();

      if (isSelected) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = statusBadgeColor || borderColor;
        ctx.stroke();
      }

      // Reset shadow immediately so inner content is sharp
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // 2. Inner Content Card (Rounded rectangle with top margin for roof, pure dark background)
      const roofMargin = 5; // Top colored roof thickness
      const borderMargin = 1.5; // Left, right, bottom border thickness
      const innerX = x + borderMargin;
      const innerY = y + roofMargin;
      const innerW = nodeW - borderMargin * 2;
      const innerH = nodeH - roofMargin - borderMargin;
      const innerRadius: [number, number, number, number] = [5, 5, 6.5, 6.5]; // Rounded on all 4 corners

      ctx.beginPath();
      this.roundedRect(ctx, innerX, innerY, innerW, innerH, innerRadius);
      ctx.fillStyle = '#1e1814'; // Pure Dark Mahogany / Warm Walnut
      ctx.fill();

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
        ctx.beginPath(); // Ensure isolated path so badge bg doesn't bleed into card background
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

      if (options.calculationMode === 'SHARE_ONLY') {
        if (isDeceasedPerson) {
          ctx.font = 'bold 10px sans-serif';
          ctx.fillStyle = '#f59e0b';
          ctx.fillText('피상속인 (상속개시)', x + 12, y + 44);
          ctx.font = '10px sans-serif';
          ctx.fillStyle = '#a8a29e';
          ctx.fillText('법정 지분 기준점', x + 12, y + 62);
        } else if (heirResult && heirResult.statutoryShareRate) {
          const sharePct = (heirResult.statutoryShareRate.toNumber() * 100).toFixed(1);
          const reserveFraction = heirResult.statutoryShareRate.multiply(1n, 2n);
          const reservePct = (reserveFraction.toNumber() * 100).toFixed(1);

          // Statutory Share Rate (Bold Emerald)
          ctx.font = 'bold 11px sans-serif';
          ctx.fillStyle = '#34d399'; // Emerald-400
          ctx.fillText(`법정 지분: ${heirResult.statutoryShareRate.toFractionString()} (${sharePct}%)`, x + 12, y + 44);

          // Reserved Share Rate (Amber)
          ctx.font = '10px sans-serif';
          ctx.fillStyle = '#fbbf24'; // Amber-400
          ctx.fillText(`유류분율: ${reserveFraction.toFractionString()} (${reservePct}%)`, x + 12, y + 62);
        } else {
          ctx.font = '10px sans-serif';
          ctx.fillStyle = '#78716c';
          ctx.fillText('비상속인 (상속 지분 없음)', x + 12, y + 52);
        }
      } else if (heirResult && heirResult.finalConcreteShareWon > 0n) {
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
