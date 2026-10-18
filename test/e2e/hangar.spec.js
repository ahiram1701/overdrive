import { test, expect } from '@playwright/test';
import { trackErrors, botInPage } from './helpers.js';

const SAVE = 'overdrive-save-v1';

test('hangar: comprar un nodo del árbol descuenta gemas y persiste tras recargar', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((k) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(k, JSON.stringify({ v: 2, runs: 3, gems: 200, ship: 'viper', ships: ['viper'] }));
    }
  }, SAVE);
  await page.goto('/?nosw');
  await page.locator('#btnHangar').click();
  await expect(page.locator('#shipCarousel .ship-chip')).toHaveCount(10);
  await page.locator('#hTabs [data-tab="mejoras"]').click();
  await expect(page.locator('#shipTree .node')).toHaveCount(16); // 3 ramas x 5 + maestría

  // BLINDAJE nivel 1 (40 💎) y luego nivel 2 (90 💎): tocar abre la ficha con el antes/después
  const buy = async (i) => {
    await page.locator('#shipTree .b-a .node').nth(i).click();
    await expect(page.locator('#treeSheet')).toBeVisible();
    await page.locator('#btnTreeBuy').click();
    await expect(page.locator('#treeSheet')).toBeHidden();
  };
  await buy(0);
  await buy(1);
  await expect(page.locator('#hGems')).toHaveText('70');
  await expect(page.locator('#shipTree .b-a .node.bought')).toHaveCount(2);

  // nivel 3 cuesta 180: no hay gemas, el botón está desactivado
  await page.locator('#shipTree .b-a .node').nth(2).click();
  await expect(page.locator('#btnTreeBuy')).toBeDisabled();
  await page.locator('#btnTreeClose').click();
  await expect(page.locator('#shipTree .b-a .node.bought')).toHaveCount(2);

  await page.reload();
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE);
  expect(saved.gems).toBe(70);
  expect(saved.shipLvl.viper).toEqual({ a: 2, b: 0, c: 0, m: 0 });
  await page.locator('#btnHangar').click();
  await page.locator('#hTabs [data-tab="mejoras"]').click();
  await expect(page.locator('#shipTree .b-a .node.bought')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('hangar: no se puede mejorar una nave que no tienes', async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ v: 2, runs: 3, gems: 999, ship: 'viper', ships: ['viper'] })), SAVE);
  await page.goto('/?nosw');
  await page.locator('#btnHangar').click();
  await page.locator('#shipCarousel .ship-chip').nth(5).click(); // Raptor, sin comprar
  await expect(page.locator('#btnBuyShip')).toBeVisible();
  await page.locator('#hTabs [data-tab="mejoras"]').click();
  await page.locator('#shipTree .b-a .node').nth(0).click();
  await expect(page.locator('#treeSheet .ts-act button').first()).toHaveText('Compra la nave primero');
  await page.locator('#btnTreeClose').click();
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).gems, SAVE)).toBe(999);
  await page.locator('#hTabs [data-tab="nave"]').click();
  await page.locator('#btnBuyShip').click();
  await expect(page.locator('#shipCarousel .ship-chip.equipped b')).toHaveText('Raptor');
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).gems, SAVE)).toBe(599);
});

// Con el árbol al máximo (Último aliento, dash extra, habilidad mutada) el juego sigue siendo justo
for (const ship of ['viper', 'raptor', 'comet']) {
  test(`${ship} con el árbol al máximo: el bot usa la habilidad mutada y sobrevive`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.addInitScript(([k, s]) => localStorage.setItem(k, JSON.stringify({
      v: 2, runs: 3, ship: s, ships: ['viper', 'raptor', 'comet'], shipLvl: { [s]: { a: 3, b: 3, c: 3 } },
    })), [SAVE, ship]);
    await page.goto('/?debug&nosw&seed=17');
    await page.waitForFunction(() => !!window.G);
    await page.evaluate(() => { window.G.manual = true; document.getElementById('btnPlay').click(); });
    const st = await page.evaluate(() => ({ mut: window.G.run.ability.mut, last: window.G.run.lastStand, dash: window.G.run.stats.dashMax }));
    expect(st.mut).toBeTruthy();
    expect(st.last).toBe(true);
    expect(st.dash).toBe(2);
    const res = await page.evaluate(botInPage, { seconds: 60, ability: true });
    expect(res.uses).toBeGreaterThan(0);
    expect(res.hits, `golpes: ${JSON.stringify(res.hits)}`).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('personalización por nave: probar no gasta, comprar vale solo para esa nave y persiste', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((k) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(k, JSON.stringify({ v: 3, runs: 3, gems: 300, ship: 'viper', ships: ['viper', 'kaiju'] }));
    }
  }, SAVE);
  await page.goto('/?nosw');
  await page.locator('#btnHangar').click();
  await page.locator('#hTabs [data-tab="estilo"]').click();
  await expect(page.locator('#cosTitle')).toHaveText('Personalizar · Viper');

  // PROBAR: tocar algo bloqueado lo pone en la vista 3D sin gastar nada
  await page.locator('[data-cos="palette:ice"]').click();
  await expect(page.locator('#cosPreview')).toBeVisible();
  await expect(page.locator('#cosPreview')).toContainText('PROBANDO: Hielo');
  await expect(page.locator('[data-cos="palette:ice"]')).toHaveClass(/trying/);
  await expect(page.locator('#hGems')).toHaveText('300');
  await page.locator('#btnCosCancel').click();
  await expect(page.locator('#cosPreview')).toBeHidden();

  // COMPRAR en Viper
  await page.locator('[data-cos="palette:ice"]').click();
  await page.locator('#btnCosBuy').click();
  await expect(page.locator('#hGems')).toHaveText('160');
  await expect(page.locator('[data-cos="palette:ice"]')).toHaveClass(/\bon\b/);

  // en Kaiju sigue bloqueado y no aparecen los exclusivos de Viper
  await page.locator('#shipCarousel .ship-chip', { hasText: 'Kaiju' }).click();
  await expect(page.locator('#cosTitle')).toHaveText('Personalizar · Kaiju');
  await expect(page.locator('[data-cos="palette:ice"]')).toHaveClass(/locked/);
  await expect(page.locator('[data-cos="palette:x-viper1"]')).toHaveCount(0);
  await expect(page.locator('[data-cos="palette:x-kaiju1"]')).toContainText('0/30 tramos');

  await page.reload();
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE);
  expect(saved.cosmetics.owned).toEqual({ viper: ['ice'] });
  expect(saved.cosmetics.equip.viper.palette).toBe('ice');
  expect(saved.cosmetics.equip.kaiju).toBeUndefined();
  expect(errors).toEqual([]);
});

test('la nave sale con SU pintura y SU emblema, y usarla desbloquea sus exclusivos', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({
    v: 3, runs: 3, ship: 'kaiju', ships: ['viper', 'kaiju'],
    cosmetics: { owned: { kaiju: ['skull'] }, equip: { kaiju: { palette: 'stock', trail: 'sparks', boom: 'classic', emblem: 'skull' } } },
    shipStats: { kaiju: { sections: 29 } },
  })), SAVE);
  await page.goto('/?debug&nosw&seed=17');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; document.getElementById('btnPlay').click(); });
  await page.waitForFunction(() => window.G.mode === 'play');
  // se dibuja con el emblema (el render recorre el código del emblema) y sin errores
  const look = await page.evaluate(async () => {
    const { equipped } = await import('/js/cosmetics.js');
    const { save } = await import('/js/save.js');
    for (let i = 0; i < 30; i++) window.D.step(1 / 60, true);
    return equipped(save, save.ship).emblem.id;
  });
  expect(look).toBe('skull');
  // empezar un tramo cuenta como uso de la nave: el tramo 1 lleva a 30 y desbloquea "Magma"
  const stats = await page.evaluate(async (k) => JSON.parse(localStorage.getItem(k)).shipStats.kaiju, SAVE);
  expect(stats.sections).toBe(30);
  expect(errors).toEqual([]);
});

test('emblema: posición y color por nave, se guardan', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((k) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(k, JSON.stringify({
        v: 3, runs: 3, gems: 0, ship: 'viper', ships: ['viper'],
        cosmetics: { owned: { viper: ['star'] }, equip: { viper: { emblem: 'star' } } },
      }));
    }
  }, SAVE);
  await page.goto('/?nosw');
  await page.locator('#btnHangar').click();
  await page.locator('#hTabs [data-tab="estilo"]').click();
  await expect(page.locator('.cos-style .seg button.on')).toHaveText('Alas');
  await page.locator('.cos-style [data-at="cola"]').click();
  await page.locator('.cos-style [data-color="cyan"]').click();
  await expect(page.locator('.cos-style [data-at="cola"]')).toHaveClass(/on/);
  await expect(page.locator('.cos-style [data-color="cyan"]')).toHaveClass(/on/);
  await page.reload();
  const eq = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).cosmetics.equip.viper, SAVE);
  expect(eq).toMatchObject({ emblem: 'star', emblemAt: 'cola', emblemColor: 'cyan' });
  // sin emblema no hay opciones de estilo
  await page.locator('#btnHangar').click();
  await page.locator('#hTabs [data-tab="estilo"]').click();
  await page.locator('[data-cos="emblem:none"]').click();
  await expect(page.locator('.cos-style')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('hangar por pestañas: una sección cada vez, la nave siempre a la vista y la pestaña se recuerda', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ v: 3, runs: 3, gems: 500, ship: 'viper', ships: ['viper'] })), SAVE);
  await page.goto('/?nosw');
  await page.locator('#btnHangar').click();
  // por defecto, NAVE; el resto de secciones, ocultas
  await expect(page.locator('#shipDetail')).toBeVisible();
  await expect(page.locator('#shipTree')).toBeHidden();
  await expect(page.locator('#cosmetics')).toBeHidden();
  // hay mejoras al alcance: la pestaña lo avisa
  await expect(page.locator('#hTabs [data-tab="mejoras"]')).toHaveClass(/dot/);
  await page.locator('#hTabs [data-tab="estilo"]').click();
  await expect(page.locator('#cosmetics')).toBeVisible();
  await expect(page.locator('#shipDetail')).toBeHidden();
  // tras bajar por la lista, la nave 3D sigue en pantalla (cabecera fija)
  await page.evaluate(() => { document.getElementById('hangar').scrollTop = 2000; });
  const box = await page.locator('#hangarView').boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(812);
  // salir y volver: sigue en ESTILO
  await page.locator('#btnHangarBack').click();
  await page.locator('#btnHangar').click();
  await expect(page.locator('#hTabs [data-tab="estilo"]')).toHaveClass(/\bon\b/);
  await expect(page.locator('#cosmetics')).toBeVisible();
  expect(errors).toEqual([]);
});

test('árbol: maestría con las 3 ramas completas y reinicio que devuelve las gemas', async ({ page }) => {
  await page.addInitScript((k) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, JSON.stringify({ v: 4, runs: 3, gems: 900, ship: 'viper', ships: ['viper'], shipLvl: { viper: { a: 5, b: 5, c: 5, m: 0 } } }));
  }, SAVE);
  await page.goto('/?nosw');
  await page.locator('#btnHangar').click();
  await page.locator('#hTabs [data-tab="mejoras"]').click();
  await page.locator('#shipTree .mastery').click();
  await expect(page.locator('#treeSheet .bar u.gain')).not.toHaveCount(0); // la ficha enseña lo que gana
  await page.locator('#btnTreeBuy').click();
  await expect(page.locator('#shipTree .mastery')).toHaveClass(/bought/);
  await expect(page.locator('#shipTree .tree-head b')).toHaveText('★ 16/16');
  // la pintura de maestro ya se puede usar
  await page.locator('#hTabs [data-tab="estilo"]').click();
  await expect(page.locator('[data-cos="palette:m-viper"]')).not.toHaveClass(/locked/);
  // reiniciar: dos toques, gratis la primera vez, devuelve todo
  await page.locator('#hTabs [data-tab="mejoras"]').click();
  const spent = await page.evaluate(async () => (await import('/js/upgrades.js')).treeSpent({ a: 5, b: 5, c: 5, m: 1 }));
  await page.locator('#btnTreeReset').click();
  await page.locator('#btnTreeReset').click();
  await expect(page.locator('#shipTree .node.bought')).toHaveCount(0);
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).gems, SAVE)).toBe(100 + spent);
});
