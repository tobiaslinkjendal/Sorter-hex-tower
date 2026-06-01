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
