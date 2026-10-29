// All private paths go through the workspace. Code-repo paths are limited to ROOT and EXAMPLES.
import path from 'node:path';
import { ROOT, EXAMPLES, resolveWorkspace } from './workspace.mjs';

export { ROOT, EXAMPLES };
export const WORKSPACE = resolveWorkspace();
export const WS = WORKSPACE.dir;
export const P = {
  config: (f) => path.join(WS, 'config', f),
  exampleConfig: (f) => path.join(EXAMPLES, 'config', f),
  data: (f) => path.join(WS, 'data', f),
  reports: path.join(WS, 'reports'),
  applications: path.join(WS, 'applications'),
  retro: path.join(WS, 'retro'),
  profiles: path.join(WS, 'profiles'),
  templates: path.join(WS, 'templates'),
  cv: path.join(WS, 'cv.md'),
};
