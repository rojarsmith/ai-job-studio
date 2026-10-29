import fs from 'node:fs';
import yaml from 'js-yaml';
import { P, WS } from './paths.mjs';

// profile and portals are personal: the workspace must provide them. The rest fall back to examples/ defaults.
const REQUIRED = new Set(['profile', 'portals']);
const cache = new Map();
export function loadConfig(name) {
  if (cache.has(name)) return cache.get(name);
  const ws = P.config(`${name}.yml`);
  let file = ws;
  if (!fs.existsSync(ws)) {
    if (REQUIRED.has(name)) throw new Error(`missing ${ws}\nworkspace: ${WS}\nrun: node scripts/workspace.mjs init   (then edit config/${name}.yml)`);
    file = P.exampleConfig(`${name}.yml`);
    console.error(`[config] ${name}.yml not in workspace, using defaults from examples/`);
  }
  const v = yaml.load(fs.readFileSync(file, 'utf8')) ?? {};
  cache.set(name, v);
  return v;
}
export const today = () => new Date().toISOString().slice(0, 10);
export const nowIso = () => new Date().toISOString();
