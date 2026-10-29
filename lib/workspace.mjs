// Workspace = the one directory that holds everything private: config, cv, reports, applications, tracking, browser profiles.
// The code repo never contains it. Resolution order (first hit wins):
//   1. --workspace <path>            CLI flag
//   2. JOB_WORKSPACE                 environment variable
//   3. <repo>/.workspace             a one-line pointer file (git-ignored) with an absolute or repo-relative path
//   4. <repo>/workspace              default, git-ignored
// Any directory that follows the layout works: a local folder, a private git clone, an encrypted drive, a synced folder.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const EXAMPLES = path.join(ROOT, 'examples', 'workspace');
export const LAYOUT = Object.freeze(['config', 'data', 'reports', 'applications', 'retro', 'profiles', 'templates', 'secrets']);
export const REQUIRED = Object.freeze(['config/profile.yml', 'config/portals.yml', 'cv.md']);

export function resolveWorkspace({ argv = process.argv.slice(2), env = process.env, root = ROOT } = {}) {
  const i = argv.indexOf('--workspace');
  if (i >= 0 && argv[i + 1]) return { dir: path.resolve(argv[i + 1]), via: '--workspace' };
  if (env.JOB_WORKSPACE) return { dir: path.resolve(env.JOB_WORKSPACE), via: 'JOB_WORKSPACE' };
  const pointer = path.join(root, '.workspace');
  if (fs.existsSync(pointer)) {
    const p = fs.readFileSync(pointer, 'utf8').split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith('#'));
    if (p) return { dir: path.resolve(root, p), via: '.workspace' };
  }
  return { dir: path.join(root, 'workspace'), via: 'default' };
}

const copyTree = (src, dst) => {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copyTree(s, d); }
    else if (!fs.existsSync(d)) fs.copyFileSync(s, d);
  }
};

const WS_GITIGNORE = `# Written by ai-job-studio. Even if this workspace is a private git repo, never commit browser sessions.
profiles/
secrets/
*.storageState.json
applications/**/filled.json
*.log
`;

/** Create or complete a workspace from examples/. Never overwrites existing files. */
export function initWorkspace(dir, { fromGit } = {}) {
  if (fromGit) {
    if (fs.existsSync(dir) && fs.readdirSync(dir).length) throw new Error(`refusing to clone into non-empty ${dir}`);
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    execFileSync('git', ['clone', '--quiet', fromGit, dir], { stdio: 'inherit' });
  }
  fs.mkdirSync(dir, { recursive: true });
  for (const d of LAYOUT) fs.mkdirSync(path.join(dir, d), { recursive: true });
  copyTree(EXAMPLES, dir);
  const gi = path.join(dir, '.gitignore');
  if (!fs.existsSync(gi)) fs.writeFileSync(gi, WS_GITIGNORE);
  return dir;
}

/** Diagnose a workspace. Returns { ok, problems[], notes[] }. */
export function checkWorkspace(dir, { root = ROOT } = {}) {
  const problems = [], notes = [];
  if (!fs.existsSync(dir)) return { ok: false, problems: [`workspace does not exist: ${dir} (run: node scripts/workspace.mjs init)`], notes };
  for (const f of REQUIRED) if (!fs.existsSync(path.join(dir, f))) problems.push(`missing ${f}`);
  for (const d of LAYOUT) if (!fs.existsSync(path.join(dir, d))) problems.push(`missing directory ${d}/`);
  const inside = !path.relative(root, dir).startsWith('..') && !path.isAbsolute(path.relative(root, dir));
  if (inside) {
    try {
      execFileSync('git', ['-C', root, 'check-ignore', '-q', dir], { stdio: 'ignore' });
      notes.push('workspace is inside the code repo and git-ignored');
    } catch { problems.push(`workspace ${dir} is inside the code repo but NOT git-ignored; private data would be committed`); }
  } else notes.push('workspace is outside the code repo');
  try {
    const top = execFileSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (path.resolve(top) !== path.resolve(dir)) throw new Error('nested in another repo, not its own');
    const remote = (() => { try { return execFileSync('git', ['-C', dir, 'remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } })();
    notes.push(`workspace is a git repo${remote ? ` (origin: ${remote})` : ''}`);
    if (!fs.existsSync(path.join(dir, '.gitignore'))) problems.push('workspace is a git repo without .gitignore; profiles/ and secrets/ would be committed');
  } catch { notes.push('workspace is not a git repo'); }
  const cv = path.join(dir, 'cv.md');
  if (fs.existsSync(cv) && /single source of truth[\s\S]*\(one paragraph\)/.test(fs.readFileSync(cv, 'utf8'))) notes.push('cv.md still looks like the example; fill it before scoring');
  return { ok: problems.length === 0, problems, notes };
}
