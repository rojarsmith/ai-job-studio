// An application submitted by hand never walked the pipeline. Record it by passing through each state in order, so the
// status log stays a faithful chain and the state machine is not bypassed.
import { canTransition } from './state.mjs';

const CHAIN = ['scored', 'tailored', 'prepared', 'filled', 'submitted'];

export function walkToSubmitted(row, transition, reason = 'submitted by hand') {
  if (row.state === 'submitted') return row;
  const at = CHAIN.indexOf(row.state);
  if (at < 0) throw new Error(`cannot record a submission from state "${row.state}" (needs one of ${CHAIN.slice(0, -1).join(', ')})`);
  for (const next of CHAIN.slice(at + 1)) {
    if (!canTransition(row.state, next)) throw new Error(`pipeline ${row.state} → ${next} is not allowed`);
    transition(row, next, reason);
  }
  return row;
}
