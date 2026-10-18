import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIPS, TIP_KEYS, tipSeen, markTip, resetTips } from '../../js/tips.js';
import { CAST } from '../../js/story.js';
import { loadFrom } from '../../js/save.js';

test('consejos: cada uno lo dice un personaje que existe, salen una vez y se pueden repetir', () => {
  assert.ok(TIP_KEYS.length >= 10);
  for (const id of TIP_KEYS) {
    assert.ok(TIPS[id].length >= 1, id);
    for (const [who, text] of TIPS[id]) { assert.ok(CAST[who], `${id}: ${who}`); assert.ok(text.length > 10); }
  }
  const s = loadFrom(null);
  assert.equal(tipSeen(s, 'galaxy'), false);
  markTip(s, 'galaxy');
  assert.equal(tipSeen(s, 'galaxy'), true);
  assert.equal(loadFrom(JSON.stringify(s)).tips.galaxy, true, 'tips está en MAPS');
  resetTips(s);
  assert.equal(tipSeen(s, 'galaxy'), false);
});
