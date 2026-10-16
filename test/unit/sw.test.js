import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Si un módulo no está en la lista del service worker, el juego se rompe sin conexión
// y nadie lo nota hasta jugar offline.
test('todos los módulos de js/ están en la caché offline de sw.js', () => {
  const sw = readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');
  for (const f of readdirSync(new URL('../../js/', import.meta.url))) {
    if (f.endsWith('.js')) assert.ok(sw.includes(`'./js/${f}'`), `falta ./js/${f} en ASSETS de sw.js`);
  }
});
