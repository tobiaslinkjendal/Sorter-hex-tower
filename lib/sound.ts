// Tiny synthesized sound effects via Web Audio — no asset files, works offline.
// All gated by the `enabled` flag; the context is created lazily on first use
// (after a user gesture, e.g. Start), per browser autoplay rules.

type Kind = 'correct' | 'wrong' | 'start' | 'finish';
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number) {
  const c = ac(); if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type; osc.frequency.value = freq;
  const t0 = c.currentTime + start;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(c.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

export function playSound(kind: Kind, enabled: boolean) {
  if (!enabled) return;
  const c = ac(); if (!c) return;
  if (c.state === 'suspended') c.resume();
  switch (kind) {
    case 'correct': tone(660, 0, 0.1, 'triangle', 0.25); tone(990, 0.08, 0.12, 'triangle', 0.25); break;
    case 'wrong': tone(160, 0, 0.18, 'square', 0.18); break;
    case 'start': tone(440, 0, 0.1, 'triangle', 0.2); tone(660, 0.09, 0.12, 'triangle', 0.2); break;
    case 'finish': tone(784, 0, 0.14, 'triangle', 0.22); tone(587, 0.13, 0.14, 'triangle', 0.22); tone(440, 0.26, 0.22, 'triangle', 0.22); break;
  }
}
