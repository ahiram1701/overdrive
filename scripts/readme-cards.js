// Regenera en el README las tablas de cartas, sinergias y naves a partir de js/upgrades.js.
// Uso: npm run docs:cards
import { readFileSync, writeFileSync } from 'node:fs';
import { CARDS, SYNERGIES, SHIPS, RARITY, CARD_BY_ID, ABILITY_TREE } from '../js/upgrades.js';
import { ABILITIES } from '../js/abilities.js';

const START = '<!-- CARDS:START -->';
const END = '<!-- CARDS:END -->';

const rows = (header, lines) => [header, header.replace(/[^|]+/g, '---'), ...lines].join('\n');

const cards = rows(
  '| | Carta | Rareza | Efecto | Máx. |',
  CARDS.map((c) => `| ${c.icon} | **${c.name}** | ${RARITY[c.rarity].name.toLowerCase()} | ${c.desc} | ${c.max > 9 ? '∞' : c.max} |`),
);

const syn = rows(
  '| Sinergia | Combina | Efecto |',
  SYNERGIES.map((s) => `| **${s.name}** | ${s.needs.map((id) => `${CARD_BY_ID[id].icon} ${CARD_BY_ID[id].name}`).join(' + ')} | ${s.desc} |`),
);

const ships = rows(
  '| Nave | Coste | Pasiva | Habilidad activa ⚡ | ★ Mutación (árbol, nivel 3) |',
  SHIPS.map((s) => {
    const a = ABILITIES[s.ability];
    return `| **${s.name}** | ${s.cost ? `💎 ${s.cost}` : s.earn ? `🏆 ${s.earn.game}: ${s.earn.text.toLowerCase()}` : s.story ? '📖 historia de la Galaxia' : 'gratis'} | ${s.desc} | ${a.icon} **${a.name}** (${a.cd} s): ${a.desc} | ${ABILITY_TREE[s.ability].lvl3} |`;
  }),
);

const block = `${START}
### Cartas
${cards}

### Sinergias
Si tienes las dos cartas de una sinergia, se activa un efecto extra.

${syn}

### Naves (hangar)
${ships}
${END}`;

const readme = readFileSync('README.md', 'utf8');
const i = readme.indexOf(START), j = readme.indexOf(END);
if (i < 0 || j < 0) throw new Error('Faltan los marcadores CARDS en README.md');
writeFileSync('README.md', readme.slice(0, i) + block + readme.slice(j + END.length));
console.log('README actualizado');
