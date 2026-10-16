import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { CARDS, SYNERGIES, SHIPS } from '../../js/upgrades.js';

const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');

test('el README documenta todas las cartas, sinergias y naves (npm run docs:cards)', () => {
  for (const c of CARDS) assert.ok(readme.includes(`**${c.name}**`), `falta la carta ${c.name}`);
  for (const s of SYNERGIES) assert.ok(readme.includes(`**${s.name}**`), `falta la sinergia ${s.name}`);
  for (const s of SHIPS) assert.ok(readme.includes(`**${s.name}**`), `falta la nave ${s.name}`);
});

test('las imágenes que enlaza el README existen', () => {
  for (const [, src] of readme.matchAll(/src="(docs\/[^"]+)"/g)) {
    assert.ok(existsSync(new URL(`../../${src}`, import.meta.url)), `no existe ${src}`);
  }
});
