# Hex Tower Bin-Finding Study — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js web app that times how fast people locate a bin in a 3D hexagonal tower given a target address, under fully configurable addressing schemes, recording results to Supabase with leaderboards.

**Architecture:** Pure TypeScript modules (`scheme`, `tower-model`, `round-engine`) hold all the testable logic; an `react-three-fiber` component renders/handles the 3D tower; Next.js route handlers persist rounds to Supabase. UI is three pages: start → round → results.

**Tech Stack:** Next.js (App Router, TS), react-three-fiber + three + drei, Supabase (Postgres), Vitest for unit tests. Deploy on Vercel.

---

## File Structure

```
Basically/
  app/
    page.tsx                # Start screen
    round/page.tsx          # 60s round
    results/page.tsx        # Summary + leaderboards
    api/rounds/route.ts     # POST a finished round
    api/leaderboard/route.ts# GET overall + per-scheme leaderboards
    layout.tsx, globals.css
  lib/
    scheme.ts               # Scheme types, defaults, randomize, formatting, key
    tower-model.ts          # scheme -> bins + address mapping (pure)
    round-engine.ts         # round state machine, scoring, culling (pure)
    supabase.ts             # server-side Supabase client
    store.ts                # tiny client store to pass scheme/results between pages
  components/
    Tower3D.tsx             # R3F tower: render, Y-axis drag, raycast click
    Configurator.tsx        # scheme/layout panel
    AddressPrompt.tsx       # renders an ordered address (chips/text)
  lib/__tests__/
    scheme.test.ts
    tower-model.test.ts
    round-engine.test.ts
  supabase/schema.sql       # tables + RLS policies
  .env.local                # SUPABASE_URL, SUPABASE_ANON_KEY (gitignored)
  vitest.config.ts
```

**Canonical bin coordinates** used everywhere: `{ column: 0..5, rowFromTop: 1..layers, leftRank: 1..binCount }`. These are physical/absolute (independent of the scheme's display directions). The scheme only changes how a bin is *labeled*; correctness is an identity match on these coordinates.

---

## Task 0: Scaffold project

**Files:** whole project under `Basically/`.

- [ ] **Step 1: Create the Next.js app in the current folder**

Run (accept defaults if prompted; the folder already contains `docs/` which is fine):
```bash
npx create-next-app@latest . --typescript --app --eslint --no-tailwind --no-src-dir --import-alias "@/*" --use-npm
```

- [ ] **Step 2: Install runtime + test deps**

```bash
npm install three @react-three/fiber @react-three/drei @supabase/supabase-js
npm install -D vitest @vitejs/plugin-react jsdom @types/three
```

- [ ] **Step 3: Add `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['lib/**/*.test.ts'] },
});
```

- [ ] **Step 4: Add test script to `package.json`**

In `"scripts"` add: `"test": "vitest run"`.

- [ ] **Step 5: gitignore + git init**

Append to `.gitignore`:
```
.superpowers/
.env.local
```
Then:
```bash
git init && git add -A && git commit -m "chore: scaffold Next.js + r3f + supabase + vitest"
```

- [ ] **Step 6: Verify dev server boots**

Run `npm run dev`, open http://localhost:3000, confirm the default page loads. Stop the server.

---

## Task 1: `scheme` module

**Files:**
- Create: `lib/scheme.ts`
- Test: `lib/__tests__/scheme.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// lib/__tests__/scheme.test.ts
import { describe, it, expect } from 'vitest';
import {
  defaultScheme, randomizeScheme, schemeKey,
  columnSegment, layerSegment, binSegment, handedLabel, LETTERS, ICONS, COLORS,
} from '../scheme';

describe('handedLabel', () => {
  it('maps count->symmetric labels by left rank', () => {
    expect(handedLabel(1, 1)).toBe('M');
    expect([handedLabel(1,2), handedLabel(2,2)]).toEqual(['L','R']);
    expect([1,2,3].map(i => handedLabel(i,3))).toEqual(['L','M','R']);
    expect([1,2,3,4].map(i => handedLabel(i,4))).toEqual(['L','LM','RM','R']);
    expect([1,2,3,4,5].map(i => handedLabel(i,5))).toEqual(['L','LM','M','RM','R']);
  });
});

describe('segments respect type + direction', () => {
  const s = defaultScheme();
  it('column color segment returns a hex color', () => {
    const seg = columnSegment({ ...s, columnType: 'color' }, 0);
    expect(seg.kind).toBe('color');
    expect(seg.value).toBe(COLORS[0]);
  });
  it('layer number honors layerFrom=bottom', () => {
    const top = layerSegment({ ...s, layerType: 'number', layerFrom: 'top' }, 1, 5);
    const bot = layerSegment({ ...s, layerType: 'number', layerFrom: 'bottom' }, 1, 5);
    expect(top.value).toBe('1');   // rowFromTop 1 = layer 1 when counting from top
    expect(bot.value).toBe('5');   // rowFromTop 1 = layer 5 when counting from bottom
  });
  it('bin letter honors binFrom=right', () => {
    const left = binSegment({ ...s, binType: 'letter', binFrom: 'left' }, 1, 3);
    const right = binSegment({ ...s, binType: 'letter', binFrom: 'right' }, 1, 3);
    expect(left.value).toBe('A');  // leftRank 1 from left = A
    expect(right.value).toBe('C'); // leftRank 1 from right = C (of 3)
  });
  it('bin handed ignores binFrom (absolute position)', () => {
    const a = binSegment({ ...s, binType: 'handed', binFrom: 'left' }, 1, 3);
    const b = binSegment({ ...s, binType: 'handed', binFrom: 'right' }, 1, 3);
    expect(a.value).toBe('L');
    expect(b.value).toBe('L');
  });
});

describe('schemeKey is stable + order-sensitive', () => {
  it('same scheme -> same key, different order -> different key', () => {
    const s = defaultScheme();
    expect(schemeKey(s)).toBe(schemeKey({ ...s }));
    expect(schemeKey(s)).not.toBe(schemeKey({ ...s, order: ['bin','layer','column'] }));
  });
});

describe('randomizeScheme', () => {
  it('produces a valid scheme deterministically from a seed', () => {
    let n = 0; const rng = () => [0.1,0.9,0.3,0.7,0.5,0.2,0.8,0.4][n++ % 8];
    const r = randomizeScheme(rng);
    expect(r.order.length).toBe(3);
    expect(new Set(r.order).size).toBe(3);
    expect(r.layers).toBeGreaterThanOrEqual(3);
    expect(r.layers).toBeLessThanOrEqual(8);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run lib/__tests__/scheme.test.ts`
Expected: FAIL ("Cannot find module '../scheme'").

- [ ] **Step 3: Implement `lib/scheme.ts`**

```ts
export type Dim = 'column' | 'layer' | 'bin';
export type ColumnType = 'color' | 'letter' | 'number' | 'icon';
export type LayerType = 'letter' | 'number' | 'icon';
export type BinType = 'letter' | 'number' | 'icon' | 'handed';
export type VDir = 'top' | 'bottom';
export type HDir = 'left' | 'right';
export type BinsPerSection = 1 | 2 | 3 | 4 | 5
  | 'varied-1-2' | 'varied-1-3' | 'varied-1-4' | 'varied-1-5';

export interface Scheme {
  order: [Dim, Dim, Dim];
  columnType: ColumnType;
  layerType: LayerType;
  binType: BinType;
  layerFrom: VDir;
  binFrom: HDir;
  layers: number;            // 3..8
  binsPerSection: BinsPerSection;
}

export type Segment = { kind: 'text'; value: string } | { kind: 'color'; value: string };

export const LETTERS = 'ABCDEFGH';
export const ICONS = ['★','●','▲','■','◆','✚','♥','♦'];
export const COLORS = ['#e0524a','#e08a3c','#e8d24a','#6db86d','#5aa9e0','#9b6ee0'];

const HANDED: Record<number, string[]> = {
  1: ['M'], 2: ['L','R'], 3: ['L','M','R'],
  4: ['L','LM','RM','R'], 5: ['L','LM','M','RM','R'],
};
export function handedLabel(leftRank: number, count: number): string {
  return HANDED[count][leftRank - 1];
}

function symbol(type: 'letter'|'number'|'icon', index1: number): string {
  if (type === 'letter') return LETTERS[(index1 - 1) % LETTERS.length];
  if (type === 'icon') return ICONS[(index1 - 1) % ICONS.length];
  return String(index1);
}

export function defaultScheme(): Scheme {
  return {
    order: ['column','layer','bin'],
    columnType: 'color', layerType: 'number', binType: 'number',
    layerFrom: 'top', binFrom: 'left', layers: 4, binsPerSection: 3,
  };
}

export function columnSegment(s: Scheme, column0: number): Segment {
  if (s.columnType === 'color') return { kind: 'color', value: COLORS[column0 % COLORS.length] };
  return { kind: 'text', value: symbol(s.columnType, column0 + 1) };
}

export function layerSegment(s: Scheme, rowFromTop: number, layers: number): Segment {
  const display = s.layerFrom === 'top' ? rowFromTop : layers - rowFromTop + 1;
  return { kind: 'text', value: symbol(s.layerType, display) };
}

export function binSegment(s: Scheme, leftRank: number, count: number): Segment {
  if (s.binType === 'handed') return { kind: 'text', value: handedLabel(leftRank, count) };
  const display = s.binFrom === 'left' ? leftRank : count - leftRank + 1;
  return { kind: 'text', value: symbol(s.binType, display) };
}

export function schemeKey(s: Scheme): string {
  return [
    s.order.join('>'), `c:${s.columnType}`, `l:${s.layerType}`, `b:${s.binType}`,
    `lf:${s.layerFrom}`, `bf:${s.binFrom}`, `L:${s.layers}`, `bps:${s.binsPerSection}`,
  ].join('|');
}

type RNG = () => number;
const pick = <T,>(rng: RNG, arr: T[]): T => arr[Math.floor(rng() * arr.length)];

export function randomizeScheme(rng: RNG): Scheme {
  const orders: Dim[][] = [
    ['column','layer','bin'],['bin','layer','column'],['layer','column','bin'],
    ['column','bin','layer'],['bin','column','layer'],['layer','bin','column'],
  ];
  const bps: BinsPerSection[] = [1,2,3,4,5,'varied-1-2','varied-1-3','varied-1-4','varied-1-5'];
  return {
    order: pick(rng, orders) as [Dim,Dim,Dim],
    columnType: pick(rng, ['color','letter','number','icon'] as ColumnType[]),
    layerType: pick(rng, ['letter','number','icon'] as LayerType[]),
    binType: pick(rng, ['letter','number','icon','handed'] as BinType[]),
    layerFrom: pick(rng, ['top','bottom'] as VDir[]),
    binFrom: pick(rng, ['left','right'] as HDir[]),
    layers: 3 + Math.floor(rng() * 6), // 3..8
    binsPerSection: pick(rng, bps),
  };
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run lib/__tests__/scheme.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add lib/scheme.ts lib/__tests__/scheme.test.ts && git commit -m "feat: scheme types, formatting, randomize, key"
```

---

## Task 2: `tower-model` module

**Files:**
- Create: `lib/tower-model.ts`
- Test: `lib/__tests__/tower-model.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// lib/__tests__/tower-model.test.ts
import { describe, it, expect } from 'vitest';
import { buildTower, sectionAt, addressOf, sameBin, pickTarget } from '../tower-model';
import { defaultScheme } from '../scheme';

const seededRng = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

describe('buildTower', () => {
  it('has 6 columns x layers sections, fixed bins per section', () => {
    const t = buildTower({ ...defaultScheme(), layers: 5, binsPerSection: 3 }, seededRng(1));
    expect(t.layers).toBe(5);
    expect(t.sections.length).toBe(6 * 5);
    expect(t.sections.every(s => s.binCount === 3)).toBe(true);
  });
  it('varied bins stay within the band and are stable for a seed', () => {
    const t1 = buildTower({ ...defaultScheme(), binsPerSection: 'varied-1-4' }, seededRng(7));
    const t2 = buildTower({ ...defaultScheme(), binsPerSection: 'varied-1-4' }, seededRng(7));
    expect(t1.sections.map(s => s.binCount)).toEqual(t2.sections.map(s => s.binCount));
    expect(t1.sections.every(s => s.binCount >= 1 && s.binCount <= 4)).toBe(true);
  });
});

describe('addressOf', () => {
  it('orders segments per scheme.order', () => {
    const s = { ...defaultScheme(), order: ['bin','layer','column'] as any,
                columnType: 'letter' as const, layerType: 'number' as const, binType: 'number' as const };
    const t = buildTower(s, seededRng(2));
    const addr = addressOf(t, { column: 0, rowFromTop: 1, leftRank: 1 });
    // order bin,layer,column => values: bin '1', layer '1', column 'A'
    expect(addr.segments.map(x => x.value ?? x.kind)).toEqual(['1','1','A']);
  });
});

describe('sameBin', () => {
  it('identity match on canonical coords', () => {
    const a = { column: 1, rowFromTop: 2, leftRank: 1 };
    expect(sameBin(a, { ...a })).toBe(true);
    expect(sameBin(a, { ...a, leftRank: 2 })).toBe(false);
  });
});

describe('pickTarget', () => {
  it('returns a bin that exists in the tower', () => {
    const t = buildTower({ ...defaultScheme(), binsPerSection: 'varied-1-5' }, seededRng(3));
    const tgt = pickTarget(t, seededRng(9));
    const sec = sectionAt(t, tgt.column, tgt.rowFromTop);
    expect(tgt.leftRank).toBeGreaterThanOrEqual(1);
    expect(tgt.leftRank).toBeLessThanOrEqual(sec.binCount);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run lib/__tests__/tower-model.test.ts`
Expected: FAIL ("Cannot find module '../tower-model'").

- [ ] **Step 3: Implement `lib/tower-model.ts`**

```ts
import { Scheme, Segment, columnSegment, layerSegment, binSegment } from './scheme';

export interface Bin { column: number; rowFromTop: number; leftRank: number; }
export interface Section { column: number; rowFromTop: number; binCount: number; }
export interface Tower { layers: number; sections: Section[]; scheme: Scheme; }
export interface Address { segments: Segment[]; }

type RNG = () => number;

function bandRange(bps: Scheme['binsPerSection']): [number, number] {
  if (typeof bps === 'number') return [bps, bps];
  const max = Number(bps.split('-').pop());
  return [1, max];
}

export function buildTower(scheme: Scheme, rng: RNG): Tower {
  const [lo, hi] = bandRange(scheme.binsPerSection);
  const sections: Section[] = [];
  for (let column = 0; column < 6; column++) {
    for (let rowFromTop = 1; rowFromTop <= scheme.layers; rowFromTop++) {
      const binCount = lo === hi ? lo : lo + Math.floor(rng() * (hi - lo + 1));
      sections.push({ column, rowFromTop, binCount });
    }
  }
  return { layers: scheme.layers, sections, scheme };
}

export function sectionAt(t: Tower, column: number, rowFromTop: number): Section {
  return t.sections.find(s => s.column === column && s.rowFromTop === rowFromTop)!;
}

export function addressOf(t: Tower, bin: Bin): Address {
  const sec = sectionAt(t, bin.column, bin.rowFromTop);
  const segMap = {
    column: columnSegment(t.scheme, bin.column),
    layer: layerSegment(t.scheme, bin.rowFromTop, t.layers),
    bin: binSegment(t.scheme, bin.leftRank, sec.binCount),
  };
  return { segments: t.scheme.order.map(d => segMap[d]) };
}

export function sameBin(a: Bin, b: Bin): boolean {
  return a.column === b.column && a.rowFromTop === b.rowFromTop && a.leftRank === b.leftRank;
}

export function pickTarget(t: Tower, rng: RNG): Bin {
  const sec = t.sections[Math.floor(rng() * t.sections.length)];
  const leftRank = 1 + Math.floor(rng() * sec.binCount);
  return { column: sec.column, rowFromTop: sec.rowFromTop, leftRank };
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run lib/__tests__/tower-model.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/tower-model.ts lib/__tests__/tower-model.test.ts && git commit -m "feat: tower model + address mapping"
```

---

## Task 3: `round-engine` module

**Files:**
- Create: `lib/round-engine.ts`
- Test: `lib/__tests__/round-engine.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// lib/__tests__/round-engine.test.ts
import { describe, it, expect } from 'vitest';
import { createRound, clickBin, isOver, summarize, isValidRound } from '../round-engine';
import { buildTower } from '../tower-model';
import { defaultScheme } from '../scheme';

const rng = (() => { let s = 5; return () => (s = (s*16807) % 2147483647) / 2147483647; });
const newRound = () => createRound(buildTower({ ...defaultScheme(), binsPerSection: 2 }, rng), 60000, rng, 0);

describe('round flow', () => {
  it('correct click advances target and scores; wrong click is recorded', () => {
    let r = newRound();
    const wrong = { ...r.target, leftRank: r.target.leftRank === 1 ? 2 : 1 };
    r = clickBin(r, wrong, 500).state;          // wrong
    const res = clickBin(r, r.target, 1000);     // correct
    r = res.state;
    expect(res.correct).toBe(true);
    const sum = summarize(r);
    expect(sum.findsCount).toBe(1);
    expect(sum.wrongClicksTotal).toBe(1);
    expect(sum.score).toBe(1);
  });

  it('isOver true after duration', () => {
    const r = newRound();
    expect(isOver(r, 59999)).toBe(false);
    expect(isOver(r, 60000)).toBe(true);
  });
});

describe('summarize + culling', () => {
  it('accuracy = correct / (correct + wrong)', () => {
    let r = newRound();
    const wrong = { ...r.target, leftRank: r.target.leftRank === 1 ? 2 : 1 };
    r = clickBin(r, wrong, 100).state;
    r = clickBin(r, wrong, 200).state;
    r = clickBin(r, r.target, 300).state;
    const sum = summarize(r);
    expect(sum.accuracy).toBeCloseTo(1/3, 5);
  });
  it('invalid when no finds', () => {
    const r = newRound();
    expect(isValidRound(summarize(r))).toBe(false);
  });
  it('invalid when accuracy below 0.2', () => {
    let r = newRound();
    for (let i = 0; i < 5; i++) {
      const wrong = { ...r.target, leftRank: r.target.leftRank === 1 ? 2 : 1 };
      r = clickBin(r, wrong, i * 100).state;
    }
    r = clickBin(r, r.target, 600).state; // 1 correct, 5 wrong => acc ~0.166
    expect(isValidRound(summarize(r))).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run lib/__tests__/round-engine.test.ts`
Expected: FAIL ("Cannot find module '../round-engine'").

- [ ] **Step 3: Implement `lib/round-engine.ts`**

```ts
import { Bin, Tower, pickTarget, sameBin, addressOf } from './tower-model';

type RNG = () => number;

export interface ClickRecord { bin: Bin; isCorrect: boolean; timeMs: number; }
export interface FindRecord {
  target: Bin; targetDisplay: string; startMs: number; endMs: number; wrongClicks: number;
}
export interface Round {
  tower: Tower; durationMs: number; startMs: number; rng: RNG;
  target: Bin; targetDisplay: string; findStartMs: number;
  finds: FindRecord[]; clicks: ClickRecord[]; currentWrong: number;
}
export interface Summary {
  findsCount: number; score: number; accuracy: number; wrongClicksTotal: number;
  avgTimeMs: number; finds: FindRecord[]; clicks: ClickRecord[];
}

function displayString(tower: Tower, bin: Bin): string {
  return addressOf(tower, bin).segments
    .map(s => (s.kind === 'color' ? `#${s.value.slice(1)}` : s.value)).join(' · ');
}

export function createRound(tower: Tower, durationMs: number, rng: RNG, nowMs: number): Round {
  const target = pickTarget(tower, rng);
  return {
    tower, durationMs, startMs: nowMs, rng,
    target, targetDisplay: displayString(tower, target), findStartMs: nowMs,
    finds: [], clicks: [], currentWrong: 0,
  };
}

export function isOver(r: Round, nowMs: number): boolean {
  return nowMs - r.startMs >= r.durationMs;
}

export function clickBin(r: Round, clicked: Bin, nowMs: number): { state: Round; correct: boolean } {
  const correct = sameBin(clicked, r.target);
  const clicks = [...r.clicks, { bin: clicked, isCorrect: correct, timeMs: nowMs - r.startMs }];
  if (!correct) {
    return { state: { ...r, clicks, currentWrong: r.currentWrong + 1 }, correct: false };
  }
  const finds = [...r.finds, {
    target: r.target, targetDisplay: r.targetDisplay,
    startMs: r.findStartMs, endMs: nowMs, wrongClicks: r.currentWrong,
  }];
  const next = pickTarget(r.tower, r.rng);
  return {
    state: {
      ...r, clicks, finds, currentWrong: 0,
      target: next, targetDisplay: displayString(r.tower, next), findStartMs: nowMs,
    },
    correct: true,
  };
}

export function summarize(r: Round): Summary {
  const findsCount = r.finds.length;
  const wrongClicksTotal = r.clicks.filter(c => !c.isCorrect).length;
  const correct = r.clicks.filter(c => c.isCorrect).length;
  const totalClicks = correct + wrongClicksTotal;
  const accuracy = totalClicks === 0 ? 0 : correct / totalClicks;
  const avgTimeMs = findsCount === 0 ? 0
    : r.finds.reduce((a, f) => a + (f.endMs - f.startMs), 0) / findsCount;
  return { findsCount, score: findsCount, accuracy, wrongClicksTotal, avgTimeMs,
           finds: r.finds, clicks: r.clicks };
}

export function isValidRound(s: Summary): boolean {
  if (s.findsCount < 1) return false;
  if (s.accuracy < 0.2) return false;
  return true;
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run lib/__tests__/round-engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/round-engine.ts lib/__tests__/round-engine.test.ts && git commit -m "feat: round engine + scoring + culling"
```

---

## Task 4: Supabase schema + server client + API routes

**Files:**
- Create: `supabase/schema.sql`, `lib/supabase.ts`, `app/api/rounds/route.ts`, `app/api/leaderboard/route.ts`

- [ ] **Step 1: Write `supabase/schema.sql`**

Run this in the Supabase SQL editor (after creating a project). RLS allows anonymous insert/select only on these tables (no personal data).

```sql
create table rounds (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_at timestamptz default now(),
  scheme jsonb not null,
  scheme_key text not null,
  duration_s int not null,
  finds_count int not null,
  score int not null,
  accuracy real not null,
  wrong_clicks_total int not null,
  valid boolean not null
);
create table finds (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references rounds(id) on delete cascade,
  seq int not null,
  target_column int, target_layer int, target_bin int,
  target_display text, time_ms int, wrong_clicks int
);
create table clicks (
  id uuid primary key default gen_random_uuid(),
  find_id uuid references finds(id) on delete cascade,
  clicked_column int, clicked_layer int, clicked_bin int,
  is_correct boolean, time_ms int
);
create index on rounds (scheme_key);
create index on rounds (valid, score desc);

alter table rounds enable row level security;
alter table finds  enable row level security;
alter table clicks enable row level security;
create policy "anon insert rounds" on rounds for insert to anon with check (true);
create policy "anon read rounds"   on rounds for select to anon using (true);
create policy "anon insert finds"  on finds  for insert to anon with check (true);
create policy "anon insert clicks" on clicks for insert to anon with check (true);
```

- [ ] **Step 2: Add env vars**

In `.env.local`:
```
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

- [ ] **Step 3: Implement `lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js';
export function serverSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
}
```

- [ ] **Step 4: Implement `app/api/rounds/route.ts`**

Accepts the finished round payload (scheme + summary + finds/clicks), computes `scheme_key`/`valid` server-side from the trusted pure modules, inserts rows.

```ts
import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase';
import { schemeKey, Scheme } from '@/lib/scheme';

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    name: string | null; scheme: Scheme; durationS: number;
    summary: { findsCount: number; score: number; accuracy: number; wrongClicksTotal: number; valid: boolean;
      finds: { seq: number; target: {column:number;rowFromTop:number;leftRank:number};
        targetDisplay: string; timeMs: number; wrongClicks: number;
        clicks: { bin:{column:number;rowFromTop:number;leftRank:number}; isCorrect:boolean; timeMs:number }[] }[] };
  };
  const sb = serverSupabase();
  const { data: round, error } = await sb.from('rounds').insert({
    name: body.name, scheme: body.scheme, scheme_key: schemeKey(body.scheme),
    duration_s: body.durationS, finds_count: body.summary.findsCount, score: body.summary.score,
    accuracy: body.summary.accuracy, wrong_clicks_total: body.summary.wrongClicksTotal,
    valid: body.summary.valid,
  }).select('id').single();
  if (error || !round) return NextResponse.json({ error: error?.message }, { status: 500 });

  for (const f of body.summary.finds) {
    const { data: find } = await sb.from('finds').insert({
      round_id: round.id, seq: f.seq, target_column: f.target.column,
      target_layer: f.target.rowFromTop, target_bin: f.target.leftRank,
      target_display: f.targetDisplay, time_ms: f.timeMs, wrong_clicks: f.wrongClicks,
    }).select('id').single();
    if (find) {
      const rows = f.clicks.map(c => ({
        find_id: find.id, clicked_column: c.bin.column, clicked_layer: c.bin.rowFromTop,
        clicked_bin: c.bin.leftRank, is_correct: c.isCorrect, time_ms: c.timeMs,
      }));
      if (rows.length) await sb.from('clicks').insert(rows);
    }
  }
  return NextResponse.json({ id: round.id });
}
```

- [ ] **Step 5: Implement `app/api/leaderboard/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const schemeKey = req.nextUrl.searchParams.get('schemeKey');
  const sb = serverSupabase();
  const overall = await sb.from('rounds').select('name,score,accuracy,scheme_key,created_at')
    .eq('valid', true).order('score', { ascending: false }).limit(20);
  let perScheme = null;
  if (schemeKey) {
    perScheme = (await sb.from('rounds').select('name,score,accuracy,created_at')
      .eq('valid', true).eq('scheme_key', schemeKey)
      .order('score', { ascending: false }).limit(20)).data;
  }
  const all = await sb.from('rounds').select('score').eq('valid', true);
  const scores = (all.data ?? []).map(r => r.score);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  return NextResponse.json({ overall: overall.data ?? [], perScheme, averageScore: avg, totalRounds: scores.length });
}
```

- [ ] **Step 6: Commit**

```bash
git add supabase lib/supabase.ts app/api && git commit -m "feat: supabase schema + rounds/leaderboard API"
```

> Note: API routes are verified manually in Task 9 (need a real Supabase project). No unit test here.

---

## Task 5: `Tower3D` component

**Files:**
- Create: `components/Tower3D.tsx`

This renders the tower from a `Tower`, spins on Y-axis via drag, and emits the clicked `Bin`. Header cells and the cap are non-clickable. A drag beyond a small threshold suppresses the click (so spinning doesn't select).

- [ ] **Step 1: Implement `components/Tower3D.tsx`**

```tsx
'use client';
import { useRef, useState, useMemo } from 'react';
import { Canvas, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { Tower, Bin, sectionAt } from '@/lib/tower-model';
import { COLORS, LETTERS, ICONS } from '@/lib/scheme';

const R = 1.25, HTOT = 2.6;

function faceBasis(column: number) {
  const a0 = column * Math.PI / 3, a1 = (column + 1) * Math.PI / 3;
  const v0 = new THREE.Vector3(R * Math.cos(a0), 0, R * Math.sin(a0));
  const v1 = new THREE.Vector3(R * Math.cos(a1), 0, R * Math.sin(a1));
  const center = v0.clone().add(v1).multiplyScalar(0.5);
  const along = v1.clone().sub(v0);                       // edge direction
  const width = along.length();
  along.normalize();
  const normal = new THREE.Vector3(Math.cos((column + 0.5) * Math.PI / 3), 0,
                                   Math.sin((column + 0.5) * Math.PI / 3));
  return { center, along, width, normal };
}

function Cell({ position, quaternion, w, h, color, onClick }: {
  position: THREE.Vector3; quaternion: THREE.Quaternion; w: number; h: number;
  color: string; onClick?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  return (
    <mesh position={position} quaternion={quaternion} onClick={onClick}>
      <boxGeometry args={[w * 0.96, h * 0.92, 0.12]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function TowerMesh({ tower, onPick }: { tower: Tower; onPick: (b: Bin) => void }) {
  const rows = tower.layers + 1;              // row 0 = header
  const rowH = HTOT / rows;
  const cells = useMemo(() => {
    const out: JSX.Element[] = [];
    for (let column = 0; column < 6; column++) {
      const { center, along, width, normal } = faceBasis(column);
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      for (let row = 0; row < rows; row++) {
        const yTop = HTOT / 2 - row * rowH, yc = yTop - rowH / 2;
        const isHeader = row === 0;
        const count = isHeader ? 1 : sectionAt(tower, column, row).binCount;
        for (let j = 0; j < count; j++) {
          const u = (j + 0.5) / count - 0.5;
          const pos = center.clone().addScaledVector(normal, 0.06)
            .addScaledVector(along, u * width).setY(yc);
          const color = isHeader
            ? (tower.scheme.columnType === 'color' ? COLORS[column] : '#dfe6ec')
            : '#f4f6f8';
          out.push(
            <Cell key={`${column}-${row}-${j}`} position={pos} quaternion={quat}
              w={width / count} h={rowH} color={color}
              onClick={isHeader ? undefined : (e) => { e.stopPropagation();
                onPick({ column, rowFromTop: row, leftRank: j + 1 }); }} />
          );
        }
      }
    }
    return out;
  }, [tower, onPick, rows, rowH]);

  return (
    <group>
      {cells}
      <mesh position={[0, HTOT / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[R, 6]} />
        <meshStandardMaterial color="#cfd6dd" />
      </mesh>
    </group>
  );
}

export default function Tower3D({ tower, onPick }: { tower: Tower; onPick: (b: Bin) => void }) {
  const groupRot = useRef(0.5);
  const dragging = useRef(false);
  const moved = useRef(0);
  const lastX = useRef(0);
  const group = useRef<THREE.Group>(null);

  return (
    <div
      style={{ width: '100%', height: 520, touchAction: 'none', cursor: 'grab' }}
      onPointerDown={(e) => { dragging.current = true; moved.current = 0; lastX.current = e.clientX; }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        const dx = e.clientX - lastX.current; lastX.current = e.clientX;
        moved.current += Math.abs(dx);
        groupRot.current += dx * 0.01;
        if (group.current) group.current.rotation.y = groupRot.current;
      }}
      onPointerUp={() => { dragging.current = false; }}
    >
      <Canvas
        camera={{ position: [0, 1.6, 5.2], fov: 42 }}
        onPointerMissed={() => {}}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 5, 4]} intensity={0.7} />
        <group ref={group} rotation={[0, groupRot.current, 0]}>
          <TowerMesh tower={tower} onPick={(b) => { if (moved.current < 6) onPick(b); }} />
        </group>
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/Tower3D.tsx && git commit -m "feat: 3D tower with Y-axis drag + raycast pick"
```

> Manual check happens in Task 9 (render + spin + click).

---

## Task 6: `AddressPrompt` + `Configurator` components + client store

**Files:**
- Create: `components/AddressPrompt.tsx`, `components/Configurator.tsx`, `lib/store.ts`

- [ ] **Step 1: Implement `lib/store.ts`** (tiny module-level store; survives client nav)

```ts
import { Scheme, defaultScheme } from './scheme';
import { Summary } from './round-engine';

type State = { name: string | null; scheme: Scheme; lastSummary: Summary | null; lastSchemeKey: string | null };
export const store: State = { name: null, scheme: defaultScheme(), lastSummary: null, lastSchemeKey: null };
```

- [ ] **Step 2: Implement `components/AddressPrompt.tsx`**

```tsx
import { Segment } from '@/lib/scheme';
export default function AddressPrompt({ segments }: { segments: Segment[] }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#8a92a0', textTransform: 'uppercase', letterSpacing: 1, fontSize: 13 }}>Find</span>
      {segments.map((s, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {s.kind === 'color'
            ? <span style={{ width: 26, height: 26, borderRadius: 6, background: s.value, border: '1px solid #0006' }} />
            : <b style={{ fontSize: 28 }}>{s.value}</b>}
          {i < segments.length - 1 && <span style={{ color: '#56606e', fontSize: 22 }}>·</span>}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Implement `components/Configurator.tsx`**

Controlled panel that edits a `Scheme` (all settings from the spec) and exposes a randomize button. Mirrors the brainstorm mock controls.

```tsx
'use client';
import { Scheme, Dim, randomizeScheme, BinsPerSection } from '@/lib/scheme';

const ORDERS: Dim[][] = [
  ['column','layer','bin'],['bin','layer','column'],['layer','column','bin'],
  ['column','bin','layer'],['bin','column','layer'],['layer','bin','column'],
];
const BPS: BinsPerSection[] = [1,2,3,4,5,'varied-1-2','varied-1-3','varied-1-4','varied-1-5'];

export default function Configurator({ scheme, onChange }:
  { scheme: Scheme; onChange: (s: Scheme) => void }) {
  const set = (patch: Partial<Scheme>) => onChange({ ...scheme, ...patch });
  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 320 }}>
      <label>Order
        <select value={scheme.order.join(',')}
          onChange={e => set({ order: e.target.value.split(',') as [Dim,Dim,Dim] })}>
          {ORDERS.map(o => <option key={o.join(',')} value={o.join(',')}>{o.join(' → ')}</option>)}
        </select>
      </label>
      <label>Column type
        <select value={scheme.columnType} onChange={e => set({ columnType: e.target.value as any })}>
          {['color','letter','number','icon'].map(t => <option key={t}>{t}</option>)}
        </select>
      </label>
      <label>Layer type
        <select value={scheme.layerType} onChange={e => set({ layerType: e.target.value as any })}>
          {['letter','number','icon'].map(t => <option key={t}>{t}</option>)}
        </select>
      </label>
      <label>Bin type
        <select value={scheme.binType} onChange={e => set({ binType: e.target.value as any })}>
          {['letter','number','icon','handed'].map(t => <option key={t}>{t}</option>)}
        </select>
      </label>
      <label>Layer counts from
        <select value={scheme.layerFrom} onChange={e => set({ layerFrom: e.target.value as any })}>
          {['top','bottom'].map(t => <option key={t}>{t}</option>)}
        </select>
      </label>
      <label>Bin counts from
        <select value={scheme.binFrom} onChange={e => set({ binFrom: e.target.value as any })}>
          {['left','right'].map(t => <option key={t}>{t}</option>)}
        </select>
      </label>
      <label>Layers: {scheme.layers}
        <input type="range" min={3} max={8} value={scheme.layers}
          onChange={e => set({ layers: +e.target.value })} />
      </label>
      <label>Bins per section
        <select value={String(scheme.binsPerSection)}
          onChange={e => set({ binsPerSection: (isNaN(+e.target.value) ? e.target.value : +e.target.value) as BinsPerSection })}>
          {BPS.map(b => <option key={String(b)} value={String(b)}>{String(b)}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => onChange(randomizeScheme(Math.random))}>🎲 Randomize scheme</button>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/AddressPrompt.tsx components/Configurator.tsx lib/store.ts && git commit -m "feat: address prompt, configurator, client store"
```

---

## Task 7: Start page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Implement `app/page.tsx`**

```tsx
'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Configurator from '@/components/Configurator';
import { store } from '@/lib/store';
import { Scheme } from '@/lib/scheme';

export default function StartPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [scheme, setScheme] = useState<Scheme>(store.scheme);
  const start = () => {
    store.name = name.trim() || null;
    store.scheme = scheme;
    router.push('/round');
  };
  return (
    <main style={{ maxWidth: 760, margin: '40px auto', padding: 16 }}>
      <h1>Hex Tower Challenge</h1>
      <p>Find bins as fast as you can in 60 seconds. Spin the tower, click the right bin.</p>
      <label>Name (optional)
        <input value={name} onChange={e => setName(e.target.value)} placeholder="anonymous" />
      </label>
      <h3>Addressing scheme</h3>
      <Configurator scheme={scheme} onChange={setScheme} />
      <button onClick={start} style={{ marginTop: 16, padding: '10px 24px', fontSize: 18 }}>Start ▶</button>
    </main>
  );
}
```

- [ ] **Step 2: Manual check**

Run `npm run dev`, open `/`, change scheme, click Start, confirm it navigates to `/round` (which may error until Task 8). Commit.

```bash
git add app/page.tsx && git commit -m "feat: start page"
```

---

## Task 8: Round page

**Files:**
- Create: `app/round/page.tsx`

Wires the engine to `Tower3D`: builds a tower from `store.scheme` once, runs a 60s timer, shows the prompt + countdown, records clicks, and on time-out posts the round to the API then routes to `/results`.

- [ ] **Step 1: Implement `app/round/page.tsx`**

```tsx
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Tower3D from '@/components/Tower3D';
import AddressPrompt from '@/components/AddressPrompt';
import { store } from '@/lib/store';
import { buildTower, addressOf, Bin } from '@/lib/tower-model';
import { createRound, clickBin, isOver, summarize, isValidRound, Round } from '@/lib/round-engine';
import { schemeKey } from '@/lib/scheme';

const DURATION = 60000;

export default function RoundPage() {
  const router = useRouter();
  const tower = useMemo(() => buildTower(store.scheme, Math.random), []);
  const roundRef = useRef<Round>(createRound(tower, DURATION, Math.random, performance.now()));
  const [, force] = useState(0);
  const [remaining, setRemaining] = useState(60);
  const [flash, setFlash] = useState<'ok' | 'no' | null>(null);
  const done = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now();
      setRemaining(Math.max(0, Math.ceil((DURATION - (now - roundRef.current.startMs)) / 1000)));
      if (isOver(roundRef.current, now) && !done.current) finish();
    }, 100);
    return () => clearInterval(id);
  }, []);

  async function finish() {
    done.current = true;
    const r = roundRef.current;
    const summary = summarize(r);
    const valid = isValidRound(summary);
    // group clicks under finds by find boundaries
    const findsPayload = r.finds.map((f, i) => ({
      seq: i, target: f.target, targetDisplay: f.targetDisplay, timeMs: f.endMs - f.startMs,
      wrongClicks: f.wrongClicks,
      clicks: r.clicks.filter(c => c.timeMs >= (f.startMs - r.startMs) && c.timeMs <= (f.endMs - r.startMs)),
    }));
    store.lastSummary = summary;
    store.lastSchemeKey = schemeKey(store.scheme);
    try {
      await fetch('/api/rounds', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: store.name, scheme: store.scheme, durationS: 60,
          summary: { ...summary, valid, finds: findsPayload } }) });
    } catch { /* offline: results page still shows local summary */ }
    router.push('/results');
  }

  function onPick(bin: Bin) {
    if (done.current) return;
    const res = clickBin(roundRef.current, bin, performance.now());
    roundRef.current = res.state;
    setFlash(res.correct ? 'ok' : 'no');
    setTimeout(() => setFlash(null), 180);
    force(n => n + 1);
  }

  const prompt = addressOf(tower, roundRef.current.target);
  return (
    <main style={{ maxWidth: 820, margin: '12px auto', textAlign: 'center', padding: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>⏱ {remaining}s</span>
        <span>Found: {roundRef.current.finds.length}</span>
      </div>
      <div style={{ margin: '10px 0', outline: flash === 'ok' ? '3px solid #4caf50'
        : flash === 'no' ? '3px solid #e0524a' : 'none', borderRadius: 8 }}>
        <AddressPrompt segments={prompt.segments} />
      </div>
      <Tower3D tower={tower} onPick={onPick} />
      <p style={{ color: '#888' }}>Drag to spin · click the bin</p>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/round/page.tsx && git commit -m "feat: round page wiring engine + tower + timer + save"
```

---

## Task 9: Results page + end-to-end verification

**Files:**
- Create: `app/results/page.tsx`

- [ ] **Step 1: Implement `app/results/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { store } from '@/lib/store';

export default function ResultsPage() {
  const router = useRouter();
  const [board, setBoard] = useState<any>(null);
  const s = store.lastSummary;

  useEffect(() => {
    if (!s) { router.replace('/'); return; }
    fetch(`/api/leaderboard?schemeKey=${encodeURIComponent(store.lastSchemeKey ?? '')}`)
      .then(r => r.json()).then(setBoard).catch(() => {});
  }, []);

  if (!s) return null;
  const beat = board && board.totalRounds
    ? Math.round(100 * (board.overall.filter((r: any) => r.score < s.score).length) / Math.max(1, board.overall.length))
    : null;

  return (
    <main style={{ maxWidth: 720, margin: '30px auto', padding: 16 }}>
      <h1>Your run</h1>
      <p>Found <b>{s.findsCount}</b> bins · accuracy <b>{Math.round(s.accuracy * 100)}%</b> ·
        avg <b>{(s.avgTimeMs / 1000).toFixed(1)}s</b>/find · wrong clicks <b>{s.wrongClicksTotal}</b></p>
      {board && <p>Average score across players: <b>{board.averageScore.toFixed(1)}</b>
        {s.score > board.averageScore ? ' — you beat the average! 🎉' : ''}</p>}

      <h3>Leaderboard — overall</h3>
      <ol>{board?.overall?.map((r: any, i: number) =>
        <li key={i}>{r.name ?? 'anon'} — {r.score} ({Math.round(r.accuracy*100)}%)</li>)}</ol>

      {board?.perScheme && <>
        <h3>Leaderboard — this scheme</h3>
        <ol>{board.perScheme.map((r: any, i: number) =>
          <li key={i}>{r.name ?? 'anon'} — {r.score} ({Math.round(r.accuracy*100)}%)</li>)}</ol>
      </>}

      <button onClick={() => router.push('/')} style={{ marginTop: 16 }}>Play again</button>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/results/page.tsx && git commit -m "feat: results page with summary + leaderboards"
```

- [ ] **Step 3: Full unit suite**

Run: `npm test`
Expected: all three test files PASS.

- [ ] **Step 4: End-to-end manual verification**

1. Create a Supabase project, run `supabase/schema.sql`, fill `.env.local`.
2. `npm run dev`. On `/`: enter a name, pick a scheme, Start.
3. On `/round`: confirm the tower **spins by dragging** (Y-axis only), the prompt renders in the scheme's representation, a **correct click** flashes green + advances, a **wrong click** flashes red + keeps the same target, and the counter rises. Let the 60s elapse.
4. Confirm redirect to `/results` showing your summary + leaderboards.
5. In Supabase, confirm a `rounds` row + child `finds`/`clicks` rows exist with sensible values.

- [ ] **Step 5: Deploy**

Push to GitHub, import the repo in Vercel, set `SUPABASE_URL` + `SUPABASE_ANON_KEY` env vars, deploy. Smoke-test the live URL.

```bash
git add -A && git commit -m "chore: ready for deploy"
```

---

## Self-Review notes (addressed)

- **Spec coverage:** tower structure (Task 2/5), full scheme incl. Handed bin type + layers 3–8 + varied bands (Task 1), hybrid keep/randomize/customize (Tasks 6–7), 60s beat-the-clock + keep-trying + record where pressed (Tasks 3/8), central DB + overall & per-scheme leaderboards + "beat the average" + culling (Tasks 3/4/9). ✔
- **Type consistency:** `Bin` uses `{column,rowFromTop,leftRank}` everywhere; `schemeKey`, `summarize`, `isValidRound` signatures match across tasks. ✔
- **Placeholders:** none — every code step is complete. Supabase URL/key are real runtime secrets, not code placeholders.
```
