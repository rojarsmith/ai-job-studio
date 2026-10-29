// L5 state machine. Mirrors design section 4:
//   discovered → scored → (skip | tailored) → prepared → filled → submitted
//   any pre-submit state → needs_human; submitted → screening → interview → (offer | rejected | ghosted)
export const STATES = Object.freeze([
  'discovered', 'scored', 'skip', 'tailored', 'prepared', 'filled', 'submitted',
  'needs_human', 'screening', 'interview', 'offer', 'rejected', 'ghosted',
]);

const T = {
  discovered: ['scored', 'skip', 'needs_human'],
  scored: ['skip', 'tailored', 'needs_human'],
  tailored: ['prepared', 'skip', 'needs_human'],
  prepared: ['filled', 'skip', 'needs_human'],
  filled: ['submitted', 'skip', 'needs_human'],
  needs_human: ['discovered', 'scored', 'tailored', 'prepared', 'filled', 'skip'],
  submitted: ['screening', 'interview', 'rejected', 'ghosted', 'offer'],
  screening: ['interview', 'rejected', 'ghosted'],
  interview: ['offer', 'rejected', 'ghosted', 'interview'],
  offer: [], rejected: [], ghosted: [], skip: [],
};
export const TRANSITIONS = Object.freeze(T);
export const TERMINAL = Object.freeze(['skip', 'offer', 'rejected', 'ghosted']);
export const OPEN_PRE_APPLY = Object.freeze(['discovered', 'scored']);

export const isState = (s) => STATES.includes(s);
export const isTerminal = (s) => TERMINAL.includes(s);
export const canTransition = (from, to) => Boolean(T[from]?.includes(to));
export function assertTransition(from, to) {
  if (!isState(from)) throw new Error(`unknown state: ${from}`);
  if (!isState(to)) throw new Error(`unknown state: ${to}`);
  if (!canTransition(from, to)) throw new Error(`illegal transition ${from} → ${to}`);
  return to;
}
