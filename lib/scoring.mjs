// Pure S2 helpers shared by score-prep, score-apply and tests.
export const DIMS = Object.freeze(['skills', 'seniority', 'location', 'compensation', 'red_flags']);
const int15 = (v) => Number.isInteger(v) && v >= 1 && v <= 5;

export function dealBreakerHit(text, list = []) {
  const t = String(text ?? '').toLowerCase();
  return list.find((d) => d && t.includes(String(d).toLowerCase())) ?? null;
}
export function decideAction(score, { apply_min = 4, maybe_min = 3 } = {}) {
  if (score >= apply_min) return 'apply';
  if (score >= maybe_min) return 'maybe';
  return 'skip';
}
export function validateFront(f) {
  const problems = [];
  if (!int15(f.score)) problems.push(`score must be integer 1..5 (got ${JSON.stringify(f.score)})`);
  if (f.deal_breaker && f.score !== 1) problems.push('deal_breaker set but score is not 1');
  if (f.scored_by !== 'deal-breaker') for (const d of DIMS) if (!int15(f.scores?.[d])) problems.push(`scores.${d} must be integer 1..5`);
  return problems;
}
