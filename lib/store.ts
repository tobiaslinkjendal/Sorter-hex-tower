import { Scheme, defaultScheme } from './scheme';
import { Summary } from './round-engine';

type State = { name: string | null; scheme: Scheme; lastSummary: Summary | null; lastSchemeKey: string | null };
export const store: State = { name: null, scheme: defaultScheme(), lastSummary: null, lastSchemeKey: null };
