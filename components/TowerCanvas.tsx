'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Tower, Bin, sectionAt } from '@/lib/tower-model';
import { COLORS, COLORS_CB, LETTERS, ICONS, columnDisplayIndex } from '@/lib/scheme';
import { Appearance } from '@/lib/appearance';

const LOGW = 720, LOGH = 600, DPR = 2;
const cx = LOGW / 2, CY_BASE = LOGH / 2 + 36, scale = 150;
const R = 1.25, HTOT = 2.6, PHI = 0.42;
const GREEN = [31, 157, 58], RED = '#d12f2f', FADE_MS = 1000, SPIN = 0.0034;
const SIZE_VH: Record<string, number> = { s: 42, m: 52, l: 64 };
const PLACE_OFF: Record<string, number> = { high: -55, mid: 0, low: 55 };

type V3 = { x: number; y: number; z: number };
type P2 = { x: number; y: number };
const rotY = (p: V3, a: number): V3 => ({ x: p.x * Math.cos(a) + p.z * Math.sin(a), y: p.y, z: -p.x * Math.sin(a) + p.z * Math.cos(a) });
const rotX = (p: V3, a: number): V3 => ({ x: p.x, y: p.y * Math.cos(a) - p.z * Math.sin(a), z: p.y * Math.sin(a) + p.z * Math.cos(a) });
const tx = (p: V3, t: number): V3 => rotX(rotY(p, t), PHI);
const lerp3 = (a: V3, b: V3, t: number): V3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
const hexVert = (i: number, top: boolean): V3 => ({ x: R * Math.cos(i * Math.PI / 3), y: top ? HTOT / 2 : -HTOT / 2, z: R * Math.sin(i * Math.PI / 3) });

const hex2rgb = (h: string): number[] => { const s = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2) || '0', 16)); };
const css = (r: number[]) => `rgb(${r[0] | 0},${r[1] | 0},${r[2] | 0})`;
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
function shadeHex(hex: string, brightness: number, solid: boolean): string {
  if (!solid) return hex;
  return css(mix([0, 0, 0], hex2rgb(hex), 0.55 + 0.45 * Math.max(0, Math.min(1, brightness))));
}
function inPoly(pt: P2, poly: P2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
const key = (b: Bin) => `${b.column}-${b.rowFromTop}-${b.leftRank}`;

export interface TowerHandle { onCorrect: (b: Bin) => void; onWrong: (b: Bin) => void; reset: () => void; }
interface BinPoly { bin: Bin; poly: P2[]; }
interface Props { tower: Tower; appearance: Appearance; onPick?: (b: Bin) => void; pickable?: boolean; autoSpin?: boolean; }

const TowerCanvas = forwardRef<TowerHandle, Props>(function TowerCanvas(
  { tower, appearance, onPick, pickable = true, autoSpin = false }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theta = useRef(0.5);
  const binPolys = useRef<BinPoly[]>([]);
  const drag = useRef({ active: false, lastX: 0, moved: 0 });
  const greens = useRef<Map<string, number>>(new Map());
  const reds = useRef<Set<string>>(new Set());
  const raf = useRef<number | null>(null);
  const props = useRef({ tower, appearance, autoSpin });
  props.current = { tower, appearance, autoSpin };

  function binFill(b: Bin, brightness: number): string {
    const ap = props.current.appearance;
    if (reds.current.has(key(b))) return RED;
    const factor = ap.solid ? 0.55 + 0.45 * Math.max(0, Math.min(1, brightness)) : 1;
    const baseRgb = mix([0, 0, 0], hex2rgb(ap.binColor), factor);
    const t0 = greens.current.get(key(b));
    if (t0 != null) return css(mix(baseRgb, GREEN, Math.max(0, 1 - (performance.now() - t0) / FADE_MS)));
    return css(baseRgb);
  }

  function draw() {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const { tower: tw, appearance: ap } = props.current;
    const cy = CY_BASE + (PLACE_OFF[ap.placement] ?? 0);
    const proj = (p: V3): P2 => ({ x: cx + p.x * scale, y: cy - p.y * scale });
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, LOGW, LOGH);
    ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';

    const rows = tw.layers + 1;
    const glyph = Math.max(20, Math.min(56, (HTOT / rows) * scale * 0.5)); // constant, rotation-independent
    type Poly = { z: number; kind: 'cap' | 'header' | 'bin'; pts: P2[]; column?: number; row?: number; leftRank?: number; bright: number };
    const polys: Poly[] = [];

    for (let column = 0; column < 6; column++) {
      const nA = (column + 0.5) * Math.PI / 3;
      const n = tx({ x: Math.cos(nA), y: 0, z: Math.sin(nA) }, theta.current);
      if (n.z <= 0.02) continue;
      const bright = n.z;
      const tA = hexVert(column, true), tB = hexVert((column + 1) % 6, true);
      const bA = hexVert(column, false), bB = hexVert((column + 1) % 6, false);
      for (let row = 0; row < rows; row++) {
        const v0 = row / rows, v1 = (row + 1) / rows;
        const isHeader = row === 0;
        const count = isHeader ? 1 : sectionAt(tw, column, row).binCount;
        for (let j = 0; j < count; j++) {
          const u0 = j / count, u1 = (j + 1) / count;
          const pts = [
            proj(tx(lerp3(lerp3(tA, tB, u0), lerp3(bA, bB, u0), v0), theta.current)),
            proj(tx(lerp3(lerp3(tA, tB, u1), lerp3(bA, bB, u1), v0), theta.current)),
            proj(tx(lerp3(lerp3(tA, tB, u1), lerp3(bA, bB, u1), v1), theta.current)),
            proj(tx(lerp3(lerp3(tA, tB, u0), lerp3(bA, bB, u0), v1), theta.current)),
          ];
          const depth = tx(lerp3(lerp3(tA, tB, (u0 + u1) / 2), lerp3(bA, bB, (u0 + u1) / 2), (v0 + v1) / 2), theta.current).z;
          polys.push({ z: depth, kind: isHeader ? 'header' : 'bin', pts, column, row, leftRank: isHeader ? undefined : count - j, bright });
        }
      }
    }
    const O: V3 = { x: 0, y: HTOT / 2, z: 0 };
    for (let column = 0; column < 6; column++) {
      if (tx({ x: 0, y: 1, z: 0 }, theta.current).z <= 0) break;
      const A = hexVert(column, true), B = hexVert((column + 1) % 6, true);
      const pts = [O, A, B].map(p => proj(tx(p, theta.current)));
      const depth = tx({ x: (A.x + B.x) / 3, y: HTOT / 2, z: (A.z + B.z) / 3 }, theta.current).z;
      polys.push({ z: depth, kind: 'cap', pts, bright: 1 });
    }

    polys.sort((a, b) => a.z - b.z);
    binPolys.current = [];
    const palette = ap.colorblind ? COLORS_CB : COLORS;
    for (const o of polys) {
      ctx.beginPath();
      o.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      if (o.kind === 'cap') {
        ctx.fillStyle = shadeHex('#ffffff', o.bright, ap.solid); ctx.fill();
        ctx.lineWidth = 1.2; ctx.strokeStyle = '#111'; ctx.stroke();
      } else if (o.kind === 'header') {
        const ci = columnDisplayIndex(o.column!);
        ctx.fillStyle = tw.scheme.columnType === 'color' ? shadeHex(palette[ci], o.bright, ap.solid) : shadeHex(ap.headerColor, o.bright, ap.solid);
        ctx.fill();
        ctx.lineWidth = 1.6; ctx.strokeStyle = '#111'; ctx.stroke();
        if (tw.scheme.columnType !== 'color') {
          const v = tw.scheme.columnType === 'letter' ? LETTERS[ci]
            : tw.scheme.columnType === 'icon' ? ICONS[ci] : String(ci + 1);
          const m = o.pts.reduce((s, p) => ({ x: s.x + p.x / 4, y: s.y + p.y / 4 }), { x: 0, y: 0 });
          ctx.fillStyle = '#111'; ctx.font = `700 ${glyph}px ui-sans-serif, system-ui, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(v, m.x, m.y);
        }
      } else {
        ctx.fillStyle = binFill({ column: o.column!, rowFromTop: o.row!, leftRank: o.leftRank! }, o.bright); ctx.fill();
        ctx.lineWidth = 1.2; ctx.strokeStyle = '#111'; ctx.stroke();
        binPolys.current.push({ bin: { column: o.column!, rowFromTop: o.row!, leftRank: o.leftRank! }, poly: o.pts });
      }
    }
  }

  function loop() {
    const now = performance.now();
    if (props.current.autoSpin && !drag.current.active) theta.current -= SPIN;
    for (const [k, t0] of greens.current) if (now - t0 >= FADE_MS) greens.current.delete(k);
    draw();
    if (props.current.autoSpin || greens.current.size > 0) raf.current = requestAnimationFrame(loop);
    else raf.current = null;
  }
  function startLoop() { if (raf.current == null) raf.current = requestAnimationFrame(loop); }

  useImperativeHandle(ref, () => ({
    onCorrect: (b) => { reds.current.clear(); greens.current.set(key(b), performance.now()); startLoop(); },
    onWrong: (b) => { reds.current.add(key(b)); draw(); },
    reset: () => { greens.current.clear(); reds.current.clear(); draw(); },
  }));

  useEffect(() => {
    draw();
    if (autoSpin) startLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tower, appearance, autoSpin]);
  useEffect(() => () => { if (raf.current != null) cancelAnimationFrame(raf.current); }, []);

  function toLogical(e: React.PointerEvent): P2 {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (LOGW / rect.width), y: (e.clientY - rect.top) * (LOGH / rect.height) };
  }

  return (
    <canvas
      ref={canvasRef}
      width={LOGW * DPR}
      height={LOGH * DPR}
      style={{ height: `${SIZE_VH[appearance.size] ?? 52}vh`, width: 'auto', maxWidth: '100%', display: 'block', touchAction: 'none', cursor: 'grab', border: '1px solid #d8d8d8' }}
      onPointerDown={(e) => { drag.current = { active: true, lastX: e.clientX, moved: 0 }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => {
        if (!drag.current.active) return;
        const dx = e.clientX - drag.current.lastX;
        drag.current.lastX = e.clientX; drag.current.moved += Math.abs(dx);
        theta.current += dx * 0.01 * (props.current.appearance.sensitivity ?? 1);
        if (!props.current.autoSpin) draw();
      }}
      onPointerUp={(e) => {
        const wasDrag = drag.current.moved >= 6;
        drag.current.active = false;
        if (wasDrag || !pickable || !onPick) return;
        const pt = toLogical(e);
        for (let i = binPolys.current.length - 1; i >= 0; i--) {
          if (inPoly(pt, binPolys.current[i].poly)) { onPick(binPolys.current[i].bin); return; }
        }
      }}
    />
  );
});

export default TowerCanvas;
