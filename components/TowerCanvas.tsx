'use client';
import { useEffect, useRef } from 'react';
import { Tower, Bin, sectionAt } from '@/lib/tower-model';
import { COLORS, LETTERS, ICONS } from '@/lib/scheme';

const LOGW = 720, LOGH = 600, DPR = 2;
const cx = LOGW / 2, cy = LOGH / 2 + 36, scale = 150;
const R = 1.25, HTOT = 2.6, PHI = 0.42;

type V3 = { x: number; y: number; z: number };
type P2 = { x: number; y: number };
const rotY = (p: V3, a: number): V3 => ({ x: p.x * Math.cos(a) + p.z * Math.sin(a), y: p.y, z: -p.x * Math.sin(a) + p.z * Math.cos(a) });
const rotX = (p: V3, a: number): V3 => ({ x: p.x, y: p.y * Math.cos(a) - p.z * Math.sin(a), z: p.y * Math.sin(a) + p.z * Math.cos(a) });
const tx = (p: V3, theta: number): V3 => rotX(rotY(p, theta), PHI);
const proj = (p: V3): P2 => ({ x: cx + p.x * scale, y: cy - p.y * scale });
const lerp3 = (a: V3, b: V3, t: number): V3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
const hexVert = (i: number, top: boolean): V3 => ({ x: R * Math.cos(i * Math.PI / 3), y: top ? HTOT / 2 : -HTOT / 2, z: R * Math.sin(i * Math.PI / 3) });

function inPoly(pt: P2, poly: P2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

interface BinPoly { bin: Bin; poly: P2[]; }

export default function TowerCanvas({ tower, onPick, pickable = true }:
  { tower: Tower; onPick?: (b: Bin) => void; pickable?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theta = useRef(0.5);
  const binPolys = useRef<BinPoly[]>([]);   // far -> near draw order
  const drag = useRef({ active: false, lastX: 0, moved: 0 });

  function draw() {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, LOGW, LOGH);
    ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';

    const rows = tower.layers + 1;             // row 0 = header
    type Poly = { z: number; kind: 'cap' | 'header' | 'bin'; pts: P2[]; column?: number; row?: number; leftRank?: number };
    const polys: Poly[] = [];

    for (let column = 0; column < 6; column++) {
      const nA = (column + 0.5) * Math.PI / 3;
      const n = tx({ x: Math.cos(nA), y: 0, z: Math.sin(nA) }, theta.current);
      if (n.z <= 0.02) continue;               // back-face cull
      const tA = hexVert(column, true), tB = hexVert((column + 1) % 6, true);
      const bA = hexVert(column, false), bB = hexVert((column + 1) % 6, false);
      for (let row = 0; row < rows; row++) {
        const v0 = row / rows, v1 = (row + 1) / rows;
        const isHeader = row === 0;
        const count = isHeader ? 1 : sectionAt(tower, column, row).binCount;
        for (let j = 0; j < count; j++) {
          const u0 = j / count, u1 = (j + 1) / count;
          const pts = [
            proj(tx(lerp3(lerp3(tA, tB, u0), lerp3(bA, bB, u0), v0), theta.current)),
            proj(tx(lerp3(lerp3(tA, tB, u1), lerp3(bA, bB, u1), v0), theta.current)),
            proj(tx(lerp3(lerp3(tA, tB, u1), lerp3(bA, bB, u1), v1), theta.current)),
            proj(tx(lerp3(lerp3(tA, tB, u0), lerp3(bA, bB, u0), v1), theta.current)),
          ];
          const depth = tx(lerp3(lerp3(tA, tB, (u0 + u1) / 2), lerp3(bA, bB, (u0 + u1) / 2), (v0 + v1) / 2), theta.current).z;
          // leftRank: calibrated so rank 1 is the viewer's left when facing the column
          polys.push({ z: depth, kind: isHeader ? 'header' : 'bin', pts, column, row, leftRank: isHeader ? undefined : count - j });
        }
      }
    }
    // plain top cap
    const O: V3 = { x: 0, y: HTOT / 2, z: 0 };
    for (let column = 0; column < 6; column++) {
      if (tx({ x: 0, y: 1, z: 0 }, theta.current).z <= 0) break;
      const A = hexVert(column, true), B = hexVert((column + 1) % 6, true);
      const pts = [O, A, B].map(p => proj(tx(p, theta.current)));
      const depth = tx({ x: (A.x + B.x) / 3, y: HTOT / 2, z: (A.z + B.z) / 3 }, theta.current).z;
      polys.push({ z: depth, kind: 'cap', pts });
    }

    polys.sort((a, b) => a.z - b.z);            // far -> near
    binPolys.current = [];
    for (const o of polys) {
      ctx.beginPath();
      o.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      if (o.kind === 'cap') {
        ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.lineWidth = 1.2; ctx.strokeStyle = '#111'; ctx.stroke();
      } else if (o.kind === 'header') {
        if (tower.scheme.columnType === 'color') { ctx.fillStyle = COLORS[o.column!]; }
        else { ctx.fillStyle = '#ffffff'; }
        ctx.fill();
        ctx.lineWidth = 1.6; ctx.strokeStyle = '#111'; ctx.stroke();
        if (tower.scheme.columnType !== 'color') {
          const v = tower.scheme.columnType === 'letter' ? LETTERS[o.column!]
            : tower.scheme.columnType === 'icon' ? ICONS[o.column!] : String(o.column! + 1);
          const m = o.pts.reduce((s, p) => ({ x: s.x + p.x / 4, y: s.y + p.y / 4 }), { x: 0, y: 0 });
          ctx.fillStyle = '#111'; ctx.font = '600 18px ui-sans-serif, system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(v, m.x, m.y);
        }
      } else {
        ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.lineWidth = 1.2; ctx.strokeStyle = '#111'; ctx.stroke();
        binPolys.current.push({ bin: { column: o.column!, rowFromTop: o.row!, leftRank: o.leftRank! }, poly: o.pts });
      }
    }
  }

  useEffect(() => { draw(); /* redraw when tower changes */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tower]);

  function toLogical(e: React.PointerEvent): P2 {
    const cv = canvasRef.current!; const rect = cv.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (LOGW / rect.width), y: (e.clientY - rect.top) * (LOGH / rect.height) };
  }

  return (
    <canvas
      ref={canvasRef}
      width={LOGW * DPR}
      height={LOGH * DPR}
      style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', cursor: 'grab', border: '1px solid #d8d8d8' }}
      onPointerDown={(e) => { drag.current = { active: true, lastX: e.clientX, moved: 0 }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => {
        if (!drag.current.active) return;
        const dx = e.clientX - drag.current.lastX;
        drag.current.lastX = e.clientX; drag.current.moved += Math.abs(dx);
        theta.current += dx * 0.01; draw();
      }}
      onPointerUp={(e) => {
        const wasDrag = drag.current.moved >= 6;
        drag.current.active = false;
        if (wasDrag || !pickable || !onPick) return;
        const pt = toLogical(e);
        for (let i = binPolys.current.length - 1; i >= 0; i--) {   // near -> far
          if (inPoly(pt, binPolys.current[i].poly)) { onPick(binPolys.current[i].bin); return; }
        }
      }}
    />
  );
}
