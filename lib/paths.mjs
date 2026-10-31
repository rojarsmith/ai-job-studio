// All private paths go through the workspace. Code-repo paths are limited to ROOT and EXAMPLES.
// Tiers: original/ is frozen hand-written material, never written; source/ is read-only for code and modes; generated/ is where they write; runtime/ never leaves the machine.
import path from 'node:path';
import { ROOT, EXAMPLES, resolveWorkspace } from './workspace.mjs';

export { ROOT, EXAMPLES };
export const WORKSPACE = resolveWorkspace();
export const WS = WORKSPACE.dir;
export const TIER = {
  original: path.join(WS, 'original'),
  source: path.join(WS, 'source'),
  generated: path.join(WS, 'generated'),
  runtime: path.join(WS, 'runtime'),
};
export const P = {
  // original (read; frozen, input for deriving source/cv.md)
  original: TIER.original,
  // source (read)
  config: (f) => path.join(TIER.source, f),
  exampleConfig: (f) => path.join(EXAMPLES, 'source', f),
  cv: path.join(TIER.source, 'cv.md'),
  answers: path.join(TIER.source, 'answers.md'),
  templates: path.join(TIER.source, 'templates'),
  // generated (write)
  data: (f) => path.join(TIER.generated, 'data', f),
  reports: path.join(TIER.generated, 'reports'),
  applications: path.join(TIER.generated, 'applications'),
  retro: path.join(TIER.generated, 'retro'),
  // runtime (never committed)
  profiles: path.join(TIER.runtime, 'profiles'),
  secrets: path.join(TIER.runtime, 'secrets'),
  logs: TIER.runtime,
};
