import { test, expect } from '@playwright/test';
import { trackErrors, botInPage } from './helpers.js';

const SHIPS = ['viper', 'brick', 'ghost', 'nova', 'kaiju', 'raptor', 'comet', 'manta', 'spectra', 'titan', 'falcon', 'chimera', 'wanderer', 'centella', 'gladiador', 'carronero'];

async function startWithShip(page, ship, seed) {
  await page.addInitScript((s) => {
    localStorage.setItem('overdrive-save-v1', JSON.stringify({
      runs: 1, ship: s, ships: ['viper', 'brick', 'ghost', 'nova', 'kaiju', 'raptor', 'comet', 'manta', 'spectra', 'titan', 'falcon', 'chimera', 'wanderer', 'centella', 'gladiador', 'carronero'],
    }));
  }, ship);
  await page.goto(`/?debug&nosw&seed=${seed}`);
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; document.getElementById('btnPlay').click(); });
  await page.waitForFunction(() => window.G.mode === 'play');
}

// Cada nave usando su habilidad siempre que puede: ninguna habilidad debe llevarte a la muerte
// (p.ej. el Gancho contra un muro, o el Ariete sin poder saltar).
for (const ship of SHIPS) {
  test(`${ship}: el bot usa la habilidad y sobrevive 60 s`, async ({ page }) => {
    const errors = trackErrors(page);
    await startWithShip(page, ship, 31);
    expect(await page.evaluate(() => window.G.run.ability.id)).toBeTruthy();
    const res = await page.evaluate(botInPage, { seconds: 60, ability: true });
    expect(res.uses, 'la habilidad se ha usado').toBeGreaterThan(0);
    expect(res.hits, `golpes: ${JSON.stringify(res.hits)}`).toEqual([]);
    expect(errors).toEqual([]);
  });
}

// Las habilidades no tocan el RNG de la pista: usarlas o no, la pista es la misma.
test('la misma semilla genera la misma pista usando la habilidad o no', async ({ page }) => {
  const track = async (use) => {
    await startWithShip(page, 'nova', 88);
    return page.evaluate((use) => {
      const G = window.G, r = G.run;
      r.sectionEnd = Infinity;
      G.god = true;
      // la PISTA son las filas generadas: cada objeto tal y como nace. Los disparos (Cazador/jefe)
      // y el movimiento posterior de los movers son IA y dependen legítimamente de lo que hagas.
      const seen = new Set(), known = new WeakSet();
      for (let i = 0; i < 60 * 25; i++) {
        if (use && r.ability.cdLeft <= 0) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
        r.ability.cdLeft = Math.min(r.ability.cdLeft, 2); // usarla mucho más de lo normal
        window.D.step(1 / 60, false);
        for (const o of r.objects) {
          if (known.has(o)) continue;
          known.add(o);
          // solo hasta 1000 m: con overdrive se llega más lejos en el mismo tiempo, y lo de
          // después no existe todavía en la otra partida (no es otra pista, es más pista)
          if (o.type !== 'coin' && o.type !== 'shot' && o.z <= 1000) seen.add(`${o.type}:${o.lane}:${Math.round(o.z)}`);
        }
      }
      return [...seen].sort();
    }, use);
  };
  const without = await track(false);
  const withAbility = await track(true);
  expect(without.length).toBeGreaterThan(30);
  expect(withAbility).toEqual(without);
});

test('el botón ⚡ lanza la habilidad al tocarlo', async ({ page }) => {
  await startWithShip(page, 'raptor', 5);
  await page.evaluate(() => window.D.step(0.5));
  await page.locator('#abilityBtn').tap();
  const st = await page.evaluate(() => ({ cd: window.G.run.ability.cdLeft, beam: !!window.G.run.beam, mode: window.G.mode }));
  expect(st.mode).toBe('play');
  expect(st.cd).toBeGreaterThan(0);
  expect(st.beam).toBe(true);
});
