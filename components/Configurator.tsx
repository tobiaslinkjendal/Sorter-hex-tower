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
        <select value={scheme.columnType} onChange={e => set({ columnType: e.target.value as Scheme['columnType'] })}>
          {['color','letter','number','icon'].map(t => <option key={t}>{t}</option>)}
        </select>
      </label>
      <label>Layer type
        <select value={scheme.layerType} onChange={e => set({ layerType: e.target.value as Scheme['layerType'] })}>
          {['letter','number','icon'].map(t => <option key={t}>{t}</option>)}
        </select>
      </label>
      <label>Bin type
        <select value={scheme.binType} onChange={e => set({ binType: e.target.value as Scheme['binType'] })}>
          {['letter','number','icon','handed'].map(t => <option key={t}>{t}</option>)}
        </select>
      </label>
      <label>Layer counts from
        <select value={scheme.layerFrom} onChange={e => set({ layerFrom: e.target.value as Scheme['layerFrom'] })}>
          {['top','bottom'].map(t => <option key={t}>{t}</option>)}
        </select>
      </label>
      <label>Bin counts from
        <select value={scheme.binFrom} onChange={e => set({ binFrom: e.target.value as Scheme['binFrom'] })}>
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
