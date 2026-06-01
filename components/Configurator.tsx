'use client';
import { useState } from 'react';
import {
  Cards, Columns, Rows, SquaresFour, ArrowsVertical, ArrowsHorizontal,
  ArrowsClockwise, Timer, SpeakerHigh, ArrowsOutSimple, Palette, MouseScroll,
} from '@phosphor-icons/react';
import { Scheme, Dim, BinsPerSection } from '@/lib/scheme';
import { Appearance, Size, Placement } from '@/lib/appearance';

const ORDERS: Dim[][] = [
  ['column', 'layer', 'bin'], ['bin', 'layer', 'column'], ['layer', 'column', 'bin'],
  ['column', 'bin', 'layer'], ['bin', 'column', 'layer'], ['layer', 'bin', 'column'],
];
const BPS: BinsPerSection[] = [1, 2, 3, 4, 5, 'varied-1-2', 'varied-1-3', 'varied-1-4', 'varied-1-5'];
const LAYER_OPTS = [3, 4, 5, 6, 7, 8];
const bpsLabel = (v: BinsPerSection) =>
  typeof v === 'number' ? String(v) : '✱ ' + v.replace('varied-', '').replace('-', '–');
const TYPE_LABEL: Record<string, string> = { color: 'color', letter: 'ABC', number: '123', icon: 'icon', handed: 'handed' };
const tl = (t: string) => TYPE_LABEL[t] ?? t;
const ic = { size: 18, weight: 'light' as const };

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="cfg-row">
      <span className="ico">{icon}</span>
      <div className="field"><span className="label-up">{label}</span>{children}</div>
    </div>
  );
}
function DualRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="cfg-row">
      <span className="ico">{icon}</span>
      <div className="dual">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field"><span className="label-up">{label}</span>{children}</div>;
}
function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={on ? 'primary' : 'ghost'} style={{ width: '100%', textAlign: 'left' }}
    onClick={onClick}>{on ? '☑' : '☐'} {children}</button>;
}

export default function Configurator({ scheme, onChange, appearance, onAppearance, onRandomize }:
  {
    scheme: Scheme; onChange: (s: Scheme) => void;
    appearance: Appearance; onAppearance: (a: Appearance) => void; onRandomize: () => void;
  }) {
  const [advOpen, setAdvOpen] = useState(false);
  const [confirmRand, setConfirmRand] = useState(false);
  const set = (patch: Partial<Scheme>) => onChange({ ...scheme, ...patch });
  const setAp = (patch: Partial<Appearance>) => onAppearance({ ...appearance, ...patch });

  return (
    <div>
      <Row icon={<Cards {...ic} />} label="Address order">
        <select value={scheme.order.join(',')} onChange={e => set({ order: e.target.value.split(',') as [Dim, Dim, Dim] })}>
          {ORDERS.map(o => <option key={o.join(',')} value={o.join(',')}>{o.join(' → ')}</option>)}
        </select>
      </Row>

      <Row icon={<Columns {...ic} />} label="Column type">
        <select value={scheme.columnType} onChange={e => set({ columnType: e.target.value as Scheme['columnType'] })}>
          {['color', 'letter', 'number', 'icon'].map(t => <option key={t} value={t}>{tl(t)}</option>)}
        </select>
      </Row>

      <DualRow icon={<Rows {...ic} />}>
        <Field label="Layer type">
          <select value={scheme.layerType} onChange={e => set({ layerType: e.target.value as Scheme['layerType'] })}>
            {['letter', 'number'].map(t => <option key={t} value={t}>{tl(t)}</option>)}
          </select>
        </Field>
        <Field label="Layers">
          <select value={scheme.layers} onChange={e => set({ layers: +e.target.value })}>
            {LAYER_OPTS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
      </DualRow>

      <DualRow icon={<SquaresFour {...ic} />}>
        <Field label="Bin type">
          <select value={scheme.binType} onChange={e => set({ binType: e.target.value as Scheme['binType'] })}>
            {['letter', 'number', 'handed'].map(t => <option key={t} value={t}>{tl(t)}</option>)}
          </select>
        </Field>
        <Field label="Bins / section">
          <select value={String(scheme.binsPerSection)}
            onChange={e => set({ binsPerSection: (isNaN(+e.target.value) ? e.target.value : +e.target.value) as BinsPerSection })}>
            {BPS.map(b => <option key={String(b)} value={String(b)}>{bpsLabel(b)}</option>)}
          </select>
        </Field>
      </DualRow>

      <button type="button" className="ghost" style={{ width: '100%', marginTop: 4, textAlign: 'left' }}
        onClick={() => setAdvOpen(o => !o)}>{advOpen ? '▾' : '▸'} Advanced options</button>

      {advOpen && (
        <div style={{ borderLeft: '1px solid var(--hair)', paddingLeft: 10, marginTop: 10 }}>
          <DualRow icon={<ArrowsVertical {...ic} />}>
            <Field label="Layers from">
              <select value={scheme.layerFrom} onChange={e => set({ layerFrom: e.target.value as Scheme['layerFrom'] })}>
                {['top', 'bottom'].map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Bins from">
              <select value={scheme.binFrom} onChange={e => set({ binFrom: e.target.value as Scheme['binFrom'] })}>
                {['left', 'right'].map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </DualRow>

          <Row icon={<ArrowsClockwise {...ic} />} label={`Rotation sensitivity — ${appearance.sensitivity.toFixed(1)}×`}>
            <input type="range" min={0.4} max={2} step={0.1} value={appearance.sensitivity}
              onChange={e => setAp({ sensitivity: +e.target.value })} />
          </Row>

          <DualRow icon={<MouseScroll {...ic} />}>
            <Field label="Scroll to rotate">
              <select value={appearance.scrollRotate ? 'yes' : 'no'} onChange={e => setAp({ scrollRotate: e.target.value === 'yes' })}>
                {['no', 'yes'].map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Scroll direction">
              <select value={appearance.scrollDir} onChange={e => setAp({ scrollDir: e.target.value as Appearance['scrollDir'] })}>
                {['up', 'down'].map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </DualRow>

          <DualRow icon={<Timer {...ic} />}>
            <Field label="Round length">
              <select value={appearance.durationS} onChange={e => setAp({ durationS: +e.target.value })}>
                {[30, 60, 90].map(n => <option key={n} value={n}>{n}s</option>)}
              </select>
            </Field>
            <Field label="Sound">
              <select value={appearance.sound ? 'on' : 'off'} onChange={e => setAp({ sound: e.target.value === 'on' })}>
                {['off', 'on'].map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </DualRow>

          <DualRow icon={<ArrowsOutSimple {...ic} />}>
            <Field label="Tower size">
              <select value={appearance.size} onChange={e => setAp({ size: e.target.value as Size })}>
                <option value="s">small</option><option value="m">medium</option><option value="l">large</option>
              </select>
            </Field>
            <Field label="Placement">
              <select value={appearance.placement} onChange={e => setAp({ placement: e.target.value as Placement })}>
                <option value="high">high</option><option value="mid">mid</option><option value="low">low</option>
              </select>
            </Field>
          </DualRow>

          <DualRow icon={<Palette {...ic} />}>
            <Field label="Top color">
              <input type="color" value={appearance.headerColor} onChange={e => setAp({ headerColor: e.target.value })}
                style={{ width: '100%', height: 30, padding: 0, border: '1px solid #111', background: '#fff' }} />
            </Field>
            <Field label="Bin color">
              <input type="color" value={appearance.binColor} onChange={e => setAp({ binColor: e.target.value })}
                style={{ width: '100%', height: 30, padding: 0, border: '1px solid #111', background: '#fff' }} />
            </Field>
          </DualRow>
          {scheme.columnType === 'color' && (
            <p className="hint" style={{ margin: '-6px 0 12px' }}>Top color applies to the cap; column headers use the palette in color mode. Bin color always applies.</p>
          )}

          <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
            <Toggle on={appearance.solid} onClick={() => setAp({ solid: !appearance.solid })}>Solid (shaded) mode</Toggle>
            <Toggle on={appearance.colorblind} onClick={() => setAp({ colorblind: !appearance.colorblind })}>Colorblind palette</Toggle>
            <Toggle on={appearance.autospin} onClick={() => setAp({ autospin: !appearance.autospin })}>Auto-spin tower</Toggle>
          </div>

          <button type="button" className={confirmRand ? 'primary' : 'ghost'} style={{ width: '100%' }}
            onClick={() => {
              if (confirmRand) { onRandomize(); setConfirmRand(false); }
              else { setConfirmRand(true); setTimeout(() => setConfirmRand(false), 2500); }
            }}>
            {confirmRand ? 'Sure? Might be messy — click again' : '⚂ Randomize scheme'}
          </button>
        </div>
      )}
    </div>
  );
}
