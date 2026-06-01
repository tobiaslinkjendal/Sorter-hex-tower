'use client';
import { useState } from 'react';
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

function Icon({ name }: { name: string }) {
  const c = { width: 18, height: 18, viewBox: '0 0 18 18', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4 } as const;
  switch (name) {
    case 'order': return <svg {...c}><path d="M4 3v12M4 3l-2 2M4 3l2 2M14 15V3M14 15l-2-2M14 15l2-2" /></svg>;
    case 'column': return <svg {...c}><rect x="6" y="2" width="6" height="14" /><path d="M6 6h6" /></svg>;
    case 'layers': return <svg {...c}><rect x="3" y="3" width="12" height="3" /><rect x="3" y="8" width="12" height="3" /><rect x="3" y="13" width="12" height="2" /></svg>;
    case 'bin': return <svg {...c}><rect x="2" y="6" width="14" height="6" /><path d="M7 6v6M11 6v6" /></svg>;
    case 'dirV': return <svg {...c}><path d="M9 3v12M9 3l-3 3M9 3l3 3" /></svg>;
    case 'dirH': return <svg {...c}><path d="M3 9h12M15 9l-3-3M15 9l-3 3" /></svg>;
    case 'paint': return <svg {...c}><rect x="3" y="3" width="12" height="8" /><path d="M9 11v4M6 15h6" /></svg>;
    case 'spin': return <svg {...c}><path d="M15 9a6 6 0 1 1-2-4.5M15 3v3h-3" /></svg>;
    case 'clock': return <svg {...c}><circle cx="9" cy="9" r="6" /><path d="M9 5v4l3 2" /></svg>;
    case 'sound': return <svg {...c}><path d="M3 7v4h3l3 3V4L6 7H3zM12 6c1.5 1.5 1.5 4.5 0 6" /></svg>;
    case 'frame': return <svg {...c}><rect x="3" y="3" width="12" height="12" /></svg>;
    default: return null;
  }
}

function Row({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="cfg-row">
      <span className="ico"><Icon name={icon} /></span>
      <div className="field"><span className="label-up">{label}</span>{children}</div>
    </div>
  );
}

function DualRow({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="cfg-row">
      <span className="ico"><Icon name={icon} /></span>
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
  const set = (patch: Partial<Scheme>) => onChange({ ...scheme, ...patch });
  const setAp = (patch: Partial<Appearance>) => onAppearance({ ...appearance, ...patch });

  return (
    <div>
      <Row icon="order" label="Address order">
        <select value={scheme.order.join(',')} onChange={e => set({ order: e.target.value.split(',') as [Dim, Dim, Dim] })}>
          {ORDERS.map(o => <option key={o.join(',')} value={o.join(',')}>{o.join(' → ')}</option>)}
        </select>
      </Row>

      <Row icon="column" label="Column type">
        <select value={scheme.columnType} onChange={e => set({ columnType: e.target.value as Scheme['columnType'] })}>
          {['color', 'letter', 'number', 'icon'].map(t => <option key={t}>{t}</option>)}
        </select>
      </Row>

      <DualRow icon="layers">
        <Field label="Layer type">
          <select value={scheme.layerType} onChange={e => set({ layerType: e.target.value as Scheme['layerType'] })}>
            {['letter', 'number'].map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Layers">
          <select value={scheme.layers} onChange={e => set({ layers: +e.target.value })}>
            {LAYER_OPTS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
      </DualRow>

      <DualRow icon="bin">
        <Field label="Bin type">
          <select value={scheme.binType} onChange={e => set({ binType: e.target.value as Scheme['binType'] })}>
            {['letter', 'number', 'handed'].map(t => <option key={t}>{t}</option>)}
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
          <DualRow icon="dirV">
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

          <Row icon="spin" label={`Rotation sensitivity — ${appearance.sensitivity.toFixed(1)}×`}>
            <input type="range" min={0.4} max={2} step={0.1} value={appearance.sensitivity}
              onChange={e => setAp({ sensitivity: +e.target.value })} />
          </Row>

          <DualRow icon="clock">
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

          <DualRow icon="frame">
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

          <DualRow icon="paint">
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
            <p className="hint" style={{ margin: '-6px 0 12px' }}>Top color is set by the palette in color mode; the bin color still applies.</p>
          )}

          <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
            <Toggle on={appearance.solid} onClick={() => setAp({ solid: !appearance.solid })}>Solid (shaded) mode</Toggle>
            <Toggle on={appearance.colorblind} onClick={() => setAp({ colorblind: !appearance.colorblind })}>Colorblind palette</Toggle>
          </div>

          <button type="button" className="ghost" style={{ width: '100%' }} onClick={onRandomize}>⚂ Randomize scheme</button>
        </div>
      )}
    </div>
  );
}
