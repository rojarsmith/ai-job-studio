// Resolve repo-relative paths independent of the current working directory.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const P = {
  config: (f) => path.join(ROOT, 'config', f),
  data: (f) => path.join(ROOT, 'data', f),
  reports: path.join(ROOT, 'reports'),
  profiles: path.join(ROOT, 'profiles'),
  cv: path.join(ROOT, 'cv.md'),
};
