import fs from 'node:fs';
import yaml from 'js-yaml';
import { P } from './paths.mjs';

const cache = new Map();
export function loadConfig(name) {
  if (!cache.has(name)) cache.set(name, yaml.load(fs.readFileSync(P.config(`${name}.yml`), 'utf8')) ?? {});
  return cache.get(name);
}
export const today = () => new Date().toISOString().slice(0, 10);
export const nowIso = () => new Date().toISOString();
