// Normalise profile.yml into one canonical shape. Accepts the native layout (examples/workspace/source/profile.yml)
// and the career-ops "private data repo" layout (candidate / target_roles / compensation / location ...), so a
// workspace migrated from career-ops works without rewriting.
export const CANONICAL_KEYS = ['name', 'email', 'phone', 'location', 'linkedin', 'website', 'target_titles', 'seniority',
  'remote_preference', 'salary', 'work_authorization', 'languages', 'deal_breakers', 'notice_period_days'];

const num = (s) => { const m = String(s ?? '').replace(/,/g, '').match(/\d+(\.\d+)?/); return m ? Number(m[0]) : undefined; };

export function normalizeProfile(raw = {}) {
  if (!raw.candidate && !raw.target_roles) return { ...raw, deal_breakers: raw.deal_breakers ?? [], languages: raw.languages ?? ['en'], _format: 'native' };
  const c = raw.candidate ?? {}, tr = raw.target_roles ?? {}, comp = raw.compensation ?? {}, loc = raw.location ?? {}, lang = raw.language ?? {};
  const authorized = (loc.authorized_in ?? []).map((x) => String(x).toLowerCase());
  const flex = String(comp.location_flexibility ?? '').toLowerCase();
  const level = (tr.archetypes ?? []).map((a) => String(a.level ?? '').toLowerCase()).join(' ');
  return {
    name: c.full_name ?? '', email: c.email ?? '', phone: c.phone ?? '', location: c.location ?? [loc.city, loc.country].filter(Boolean).join(', '),
    linkedin: c.linkedin ?? '', website: c.portfolio_url || c.github || '',
    target_titles: tr.primary ?? (tr.archetypes ?? []).map((a) => a.name).filter(Boolean),
    seniority: /director|vp|head/.test(level + ' ' + (tr.primary ?? []).join(' ').toLowerCase()) ? 'director' : /manager/.test(level) ? 'manager' : raw.seniority ?? 'senior',
    remote_preference: /remote/.test(flex) ? 'any' : raw.remote_preference ?? 'hybrid',
    salary: { currency: comp.currency ?? 'TWD', monthly_min: num(comp.minimum), note: [comp.target_range, comp.minimum].filter(Boolean).join('; ') },
    work_authorization: { taiwan: authorized.includes('taiwan') ? 'citizen' : 'needs_sponsorship', other: loc.needs_sponsorship === false ? 'authorized' : 'needs_sponsorship', note: loc.visa_status ?? '' },
    languages: [lang.output, 'zh-TW', 'en'].filter((v, i, a) => v && a.indexOf(v) === i),
    deal_breakers: raw.deal_breakers ?? [],
    notice_period_days: raw.cover_letter?.notice_period_days,
    narrative: raw.narrative, _format: 'career-ops', _raw: raw,
  };
}
