'use client';
import { useState } from 'react';
import { Scheme, Dim, randomizeScheme, BinsPerSection } from '@/lib/scheme';
import { Appearance } from '@/lib/appearance';

const ORDERS: Dim[][] = [
  ['column', 'layer', 'bin'], ['bin', 'layer', 'column'], ['layer', 'column', 'bin'],
  ['column', 'bin', 'layer'], ['bin', 'column', 'layer'], ['layer', 'bin', 'column'],
];
const BPS: BinsPerSection[] = [1, 2, 3, 4, 5, 'varied-1-2', 'varied-1-3', 'varied-1-4', 'varied-1-5'];
const LAYER_OPTS = [3, 4, 5, 6, 7, 8];

function Icon({ name }: { name: string }) {
  const c = { width: 18, height: 18, viewBox: '0 0 18 18', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4 } as const;
  switch (name) {
    case 'order': return <svg {...c}><path d="M4 3v12M4 3l-2 2M4 3l2 2M14 15V3M14 15l-2-2M14 15l2-2" /></svg>;
    case 'column': return <svg {...c}><rect x="6" y="2" width="6" height="14" /><path d="M6 6h6" /></svg>;
    case 'layer': return <svg {...c}><path d="M2 5h14M2 9h14M2 13h14" /></svg>;
    case 'bin': return <svg {...c}><rect x="2" y="6" width="14" height="6" /><path d="M7 6v6M11 6v6" /></svg>;
    case 'dirV': return <svg {...c}><path d="M9 3v12M9 3l-3 3M9 3l3 3" /></svg>;
    case 'dirH': return <svg {...c}><path d="M3 9h12M15 9l-3-3M15 9l-3 3" /></svg>;
    case 'layers': return <svg {...c}><rect x="3" y="3" width="12" height="3" /><rect x="3" y="8" width="12" height="3" /><rect x="3" y="13" width="12" height="2" /></svg>;
    case 'bins': return <svg {...c}><rect x="2" y="4" width="3" height="10" /><rect x="7" y="4" width="3" height="10" /><rect x="12" y="4" width="3" height="10" /></svg>;
    case 'paint': return <svg {...c}><rect x="3" y="3" width="12" height="8" /><path d="M9 11v4M6 15h6" /></svg>;
    case 'adv': return <svg {...c}><path d="M3 6h12M3 12h12" /><circle cx="7" cy="6" r="1.6" /><circle cx="11" cy="12" r="1.6" /></svg>;
    case 'eye': return <svg {...c}><path d="M1 9s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z" /><circle cx="9" cy="9" r="2" /></svg>;
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

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={on ? 'primary' : 'ghost'} style={{ width: '100%', textAlign: 'left' }}
    onClick={onClick}>{on ? '☑' : '☐'} {children}</button>;
}

export default function Configurator({ scheme, onChange, appearance, onAppearance }:
  { scheme: Scheme; onChange: (s: Scheme) => void; appearance: Appearance; onAppearance: (a: Appearance) => void }) {
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
      {scheme.columnType !== 'color' && (
        <Row icon="paint" label="Colors">
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ flex: 1, fontSize: 12, color: 'var(--muted)' }}>top
              <input type="color" value={appearance.headerColor} onChange={e => setAp({ headerColor: e.target.value })}
                style={{ width: '100%', height: 30, padding: 0, border: '1px solid #111', background: '#fff' }} />
            </label>
            <label style={{ flex: 1, fontSize: 12, color: 'var(--muted)' }}>bins
              <input type="color" value={appearance.binColor} onChange={e => setAp({ binColor: e.target.value })}
                style={{ width: '100%', height: 30, padding: 0, border: '1px solid #111', background: '#fff' }} />
            </label>
          </div>
        </Row>
      )}

      <Row icon="layer" label="Layer type">
        <select value={scheme.layerType} onChange={e => set({ layerType: e.target.value as Scheme['layerType'] })}>
          {['letter', 'number', 'icon'].map(t => <option key={t}>{t}</option>)}
        </select>
      </Row>
      <Row icon="layers" label="Layers">
        <select value={scheme.layers} onChange={e => set({ layers: +e.target.value })}>
          {LAYER_OPTS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </Row>

      <Row icon="bin" label="Bin type">
        <select value={scheme.binType} onChange={e => set({ binType: e.target.value as Scheme['binType'] })}>
          {['letter', 'number', 'icon', 'handed'].map(t => <option key={t}>{t}</option>)}
        </select>
      </Row>
      <Row icon="bins" label="Bins per section">
        <select value={String(scheme.binsPerSection)}
          onChange={e => set({ binsPerSection: (isNaN(+e.target.value) ? e.target.value : +e.target.value) as BinsPerSection })}>
          {BPS.map(b => <option key={String(b)} value={String(b)}>{String(b)}</option>)}
        </select>
      </Row>

      <button type="button" className="ghost" style={{ width: '100%', marginTop: 4, textAlign: 'left' }}
        onClick={() => setAdvOpen(o => !o)}>
        {advOpen ? '▾' : '▸'} Advanced options
      </button>

      {advOpen && (
        <div style={{ borderLeft: '1px solid var(--hair)', paddingLeft: 10, marginTop: 10 }}>
          <Row icon="dirV" label="Layer counts from">
            <select value={scheme.layerFrom} onChange={e => set({ layerFrom: e.target.value as Scheme['layerFrom'] })}>
              {['top', 'bottom'].map(t => <option key={t}>{t}</option>)}
            </select>
          </Row>
          <Row icon="dirH" label="Bin counts from">
            <select value={scheme.binFrom} onChange={e => set({ binFrom: e.target.value as Scheme['binFrom'] })}>
              {['left', 'right'].map(t => <option key={t}>{t}</option>)}
            </select>
          </Row>
          <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
            <Toggle on={appearance.solid} onClick={() => setAp({ solid: !appearance.solid })}>Solid (shaded) mode</Toggle>
            <Toggle on={appearance.colorblind} onClick={() => setAp({ colorblind: !appearance.colorblind })}>Colorblind palette</Toggle>
          </div>
          <button type="button" className="ghost" style={{ width: '100%' }}
            onClick={() => onChange(randomizeScheme(Math.random))}>⚂ Randomize scheme</button>
        </div>
      )}
    </div>
  );
}
