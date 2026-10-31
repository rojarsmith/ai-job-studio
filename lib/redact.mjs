// "Do not publish" rules. Anything the user does not want on a public profile or in a resume file is listed once in
// <workspace>/source/redact.yml; resume-pdf and modes/profile-sync.md apply it, so no tool has to remember it.
//   drop_lines: regexes; a line (a Markdown list item is one line) that matches is removed
//   remove:     regexes; the matched text is cut out of a longer line
//   forbid:     regexes that must not survive redaction; findForbidden() reports them and callers stop
import fs from 'node:fs';
import yaml from 'js-yaml';
import { P } from './paths.mjs';

/** Workspace rules only: the example file is documentation, never applied to someone else's text. */
export function loadRedact() {
  const f = P.config('redact.yml');
  return fs.existsSync(f) ? (yaml.load(fs.readFileSync(f, 'utf8')) ?? {}) : {};
}

const compile = (list = []) => list.map((s) => new RegExp(s, 'i'));

export function applyRedact(text, rules = {}) {
  const drop = compile(rules.drop_lines), cut = (rules.remove ?? []).map((s) => new RegExp(s, 'gi'));
  return String(text).split(/\r?\n/)
    .filter((l) => !drop.some((r) => r.test(l)))
    .map((l) => cut.reduce((acc, r) => acc.replace(r, ''), l))
    .join('\n');
}

export function findForbidden(text, rules = {}) {
  return compile(rules.forbid).filter((r) => r.test(text)).map((r) => r.source);
}
