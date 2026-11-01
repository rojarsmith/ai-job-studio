// Title screen applied by discover.mjs to every source before a posting enters the pipeline (and before its detail page is fetched).
//   title_include: every entry must match the title (each entry is a regex, use | for alternatives), e.g. one entry for the role family and one for the level
//   title_exclude: any match drops the posting
// Matching is case-insensitive. Absent or empty lists keep everything.
export function makeTitleFilter(cfg = {}) {
  const inc = (cfg.title_include ?? []).map((s) => new RegExp(s, 'i'));
  const exc = (cfg.title_exclude ?? []).map((s) => new RegExp(s, 'i'));
  return (title) => {
    const t = String(title ?? '');
    return inc.every((r) => r.test(t)) && !exc.some((r) => r.test(t));
  };
}
