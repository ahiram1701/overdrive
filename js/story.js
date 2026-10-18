// GALAXIA: historia "LA SEÑAL" por actos (8 capítulos cada uno) y, al acabarlos, la CRÓNICA:
// capítulos generados sin fin, cada vez más duros. Módulo puro (se testea en Node).
import { makeRng, hashString } from './rng.js';
import { ownerOf } from './factions.js';
// Cada capítulo tiene diálogo de entrada y salida, un objetivo en un sistema concreto y premio.
// Los sistemas salen de la galaxia (deterministas), cada vez más lejos de ORIGEN.

export const CAST = {
  ilen: { icon: '👩‍🔬', name: 'Dra. Ilen', color: '#00e5ff' },
  brak: { icon: '⛏️', name: 'Capataz Brak', color: '#30d158' },
  senal: { icon: '📡', name: 'La Señal', color: '#bf5af2' },
  heraldo: { icon: '👁️', name: 'El Heraldo', color: '#ff2d55' },
  reina: { icon: '🐝', name: 'La Reina', color: '#ffd60a' },
  vex: { icon: '🛰️', name: 'Vex', color: '#ff9f0a' },
};

export const ACT_LEN = 8;
export const ACT_NAMES = ['La Señal', 'El Enjambre', 'El Origen'];
const ROMAN = ['I', 'II', 'III', 'IV'];

// Sistemas de la historia: en cada acto, el k-ésimo sistema de cada anillo de peligro (por id).
// Acto I: el primero de cada anillo y el más lejano para el final.
export function storySystems(gal, act = 1) {
  const ring = (d) => gal.filter((s) => s.danger === d).sort((a, b) => a.id - b.id);
  const far = [...gal].sort((a, b) => b.danger - a.danger || a.id - b.id);
  const k = act - 1;
  const pick = (d) => { const r = ring(d); return r.length ? r[k % r.length].id : far[k % far.length].id; };
  if (act === 1) {
    const byDanger = (d) => ring(d)[0];
    return { o: 0, a: byDanger(1).id, b: byDanger(2).id, c: byDanger(3).id, d: byDanger(4).id, e: (byDanger(5) || far[0]).id, f: far[0].id };
  }
  const top = Math.max(...gal.map((s) => s.danger));
  return { a: pick(1), b: pick(2), c: pick(3), d: pick(4), e: pick(5), f: pick(top) };
}

function act1(gal) {
  const S = storySystems(gal, 1), N = (id) => gal[id].name;
  return [
    { title: 'La Señal', goal: { kind: 'reach', sys: S.o, n: 1, text: 'Investiga la baliza junto a ORIGEN' }, reward: { credits: 500 },
      intro: [['ilen', 'Piloto, aquí la doctora Ilen. Captamos una señal que no debería existir.'], ['ilen', 'Viene de muy cerca. Vuela hasta la baliza marcada y quédate a su lado.']],
      outro: [['senal', '…si me oyes… no sigas al sol rojo… …el Devorador despierta…'], ['ilen', '¿Has oído eso? Es un mensaje de hace siglos. Tenemos que seguir el rastro.']] },
    { title: 'Ecos', goal: { kind: 'reach', sys: S.a, n: 1, text: `Sigue el eco de la señal hasta ${N(S.a)}` }, reward: { credits: 660 },
      intro: [['ilen', `La señal rebota en ${N(S.a)}. Hay otra baliza allí. Encuéntrala.`]],
      outro: [['senal', '…tres ojos… una boca que come estrellas…'], ['ilen', 'Esto no es una broma. Necesitamos a alguien que conozca las rutas mineras.']] },
    { title: 'El fragmento', goal: { kind: 'dock', sys: S.b, n: 1, text: `Lleva el fragmento de la baliza a la estación de ${N(S.b)}` }, reward: { credits: 930, mats: { artefactos: 1 } },
      intro: [['ilen', `La baliza tenía un fragmento de metal vivo. Llévalo a ${N(S.b)}: allí trabaja Brak.`]],
      outro: [['brak', 'Esto no lo ha forjado nadie de esta galaxia, chaval. Y está… caliente.'], ['brak', 'La Liga y la Coalición querrán quedárselo. Tú decides quién.']] },
    { title: 'Elección', goal: { kind: 'choice', n: 1, text: 'Decide a quién entregas el fragmento' }, reward: { credits: 780 },
      intro: [['brak', 'La Liga lo usará para encontrar minas nuevas. La Coalición, para estudiarlo. ¿Para quién?']],
      choice: [['liga', '⛏️ A la Liga Minera'], ['coal', '☀️ A la Coalición Solar']],
      outro: [['ilen', 'Hecho. Y ahora sabemos de dónde viene: más allá del cinturón pirata.']] },
    { title: 'Emboscada', goal: { kind: 'kill', sys: S.c, n: 5, text: `Abre paso: abate 5 piratas en ${N(S.c)}` }, reward: { credits: 1200 },
      intro: [['brak', `Los piratas también buscan el fragmento. Te esperan en ${N(S.c)}.`]],
      outro: [['brak', 'Huyen como ratas. Pero no huyen de ti: huyen de algo peor.']] },
    { title: 'El Heraldo', goal: { kind: 'boss', boss: 'herald', sys: S.d, n: 1, text: `Derrota al Heraldo en ${N(S.d)}` }, reward: { credits: 1740, mats: { nucleos: 2 } },
      intro: [['heraldo', 'Pequeña nave. Llevas algo que pertenece a mi amo.'], ['heraldo', `Ven a ${N(S.d)} a devolvérmelo.`]],
      outro: [['heraldo', 'No importa… el Devorador ya… ha despertado…'], ['ilen', 'Su núcleo marca un rumbo. El final está en el sistema más lejano.']] },
    { title: 'La puerta rota', goal: { kind: 'base', sys: S.e, n: 1, text: `Destruye la base que guarda el paso en ${N(S.e)}` }, reward: { credits: 2160 },
      intro: [['ilen', `Los piratas protegen el paso en ${N(S.e)} con una base. Sin ella no llegaremos.`]],
      outro: [['senal', '…gracias… estoy cerca… acaba con él…']] },
    { title: 'El Devorador de Estrellas', goal: { kind: 'boss', boss: 'devourer', sys: S.f, n: 1, text: `Derrota al Devorador de Estrellas en ${N(S.f)}` }, reward: { credits: 6600, ship: 'wanderer' },
      intro: [['ilen', `Está en ${N(S.f)}. Primero sus tres ojos: mientras miren, su núcleo es invulnerable.`], ['ilen', 'Cuando caigan, ve a por el núcleo. Y suerte, piloto.']],
      outro: [['senal', 'Por fin… silencio. Toma mi nave, viajera: la ERRANTE. Ya no la necesito.'], ['ilen', 'Lo has conseguido. La galaxia es tuya, piloto.'], ['ilen', '…¿O no? Los sensores captan un zumbido nuevo. Descansa: mañana seguimos.']] },
  ];
}

// ACTO II · EL ENJAMBRE: con el Devorador muerto, su colmena despierta sin amo
function act2(gal) {
  const S = storySystems(gal, 2), N = (id) => gal[id].name;
  return [
    { title: 'Zumbido', goal: { kind: 'reach', sys: S.a, n: 1, text: `Busca el origen del zumbido en ${N(S.a)}` }, reward: { credits: 1500 },
      intro: [['ilen', 'Piloto, el zumbido no para. Suena como mil alas a la vez.'], ['ilen', `Lo más fuerte viene de ${N(S.a)}. Hay una baliza nueva allí.`]],
      outro: [['reina', '…el Devorador cayó… ahora la colmena tiene hambre… y una Reina.'], ['ilen', '¿Una Reina? El Devorador no estaba solo.']] },
    { title: 'El desertor', goal: { kind: 'dock', sys: S.b, n: 1, text: `Encuentra a Vex en la estación de ${N(S.b)}` }, reward: { credits: 1700 },
      intro: [['brak', `Un pirata ha desertado y pide hablar contigo. Está escondido en ${N(S.b)}.`], ['brak', 'No me fío. Pero sabe cosas.']],
      outro: [['vex', 'Me llamo Vex. Los míos le rezan a la Reina: le dan naves a cambio de no ser devorados.'], ['vex', 'Yo me harté. Os ayudo… si me protegéis.']] },
    { title: 'Lealtades', goal: { kind: 'choice', n: 1, text: 'Decide quién protege a Vex' }, reward: { credits: 1400 },
      intro: [['vex', 'La Liga me daría trabajo en las minas. La Coalición me interrogaría hasta secarme. ¿Con quién voy?']],
      choice: [['liga', '⛏️ Que trabaje con la Liga'], ['coal', '☀️ Que lo custodie la Coalición']],
      outro: [['vex', 'Trato hecho. Ahora escucha: la colmena se alimenta de mineral. Córtale el suministro.']] },
    { title: 'Colmena', goal: { kind: 'kill', sys: S.c, n: 8, text: `Limpia el enjambre: abate 8 enemigos en ${N(S.c)}` }, reward: { credits: 2400, mats: { circuitos: 4 } },
      intro: [['vex', `${N(S.c)} está plagado de drones de la Reina. Si caen, la colmena se debilita.`]],
      outro: [['reina', 'Pequeña chispa… cada dron que apagas, lo siento. Te recordaré.']] },
    { title: 'Suministros', goal: { kind: 'sell', sys: S.d, n: 20, text: `Vende 20 de mineral en ${N(S.d)} antes que el enjambre` }, reward: { credits: 2600 },
      intro: [['brak', `La Reina se come el mineral de ${N(S.d)}. Si lo vendemos nosotros primero, se queda sin nada.`], ['brak', 'Mina, llena la bodega y véndelo allí: 20 unidades.']],
      outro: [['brak', '¡Ja! Mercado lleno, colmena hambrienta. Así se hace, chaval.']] },
    { title: 'Señal enferma', goal: { kind: 'scan', sys: S.d, n: 1, text: `Escanea la señal corrupta en ${N(S.d)}` }, reward: { credits: 2800, mats: { artefactos: 2 } },
      intro: [['senal', '…me… están… comiendo…'], ['ilen', `Es LA SEÑAL, pero rota. Escanéala en ${N(S.d)}: quédate junto a la baliza hasta completar la lectura.`]],
      outro: [['ilen', 'La lectura marca un nido. La Reina se esconde detrás de una base pirata.']] },
    { title: 'El nido', goal: { kind: 'base', sys: S.e, n: 1, text: `Destruye la base que oculta el nido en ${N(S.e)}` }, reward: { credits: 3200 },
      intro: [['vex', `Esa base en ${N(S.e)} es la de mi antigua banda. Le pagan tributo a la Reina.`], ['vex', 'Derríbala y el camino al nido queda abierto.']],
      outro: [['reina', 'Ven, chispa. Ven a mi trono. Mis hijas te esperan.']] },
    { title: 'La Reina del Enjambre', goal: { kind: 'boss', boss: 'queen', sys: S.f, n: 1, text: `Derrota a la Reina del Enjambre en ${N(S.f)}` }, reward: { credits: 8000, mats: { nucleos: 3 } }, end: 'act2',
      intro: [['ilen', `Está en ${N(S.f)}. Mientras la protejan 3 drones, su escudo aguanta todo.`], ['vex', 'Abate a sus hijas primero. Luego, a ella. Rápido: las repone.']],
      outro: [['reina', 'La colmena… calla… pero la Señal… la Señal no es lo que crees…'], ['ilen', '¿Qué ha querido decir? Piloto… creo que la Señal nos ha estado usando.']] },
  ];
}

// ACTO III · EL ORIGEN: la Señal no era una víctima; fue ella quien despertó al Devorador
function act3(gal) {
  const S = storySystems(gal, 3), N = (id) => gal[id].name;
  return [
    { title: 'Mentiras', goal: { kind: 'reach', sys: S.a, n: 1, text: `Vuelve a la primera baliza del eco, en ${N(S.a)}` }, reward: { credits: 3500 },
      intro: [['ilen', 'Las palabras de la Reina no me dejan dormir. Revisemos la baliza original.'], ['ilen', `Está en ${N(S.a)}. Vamos.`]],
      outro: [['senal', '…muy lista, doctora… demasiado lista…'], ['ilen', 'Nos ha hablado como si nos conociera. Piloto, esto es una trampa.']] },
    { title: 'Viejos amigos', goal: { kind: 'dock', sys: S.b, n: 1, text: `Reúnete con Brak en ${N(S.b)}` }, reward: { credits: 3800 },
      intro: [['brak', `Chaval, ven a ${N(S.b)}. Tengo el fragmento del principio… y está latiendo.`]],
      outro: [['brak', 'Late al ritmo de la Señal. No era un mensaje de auxilio: era una llamada.'], ['vex', 'Mi banda decía lo mismo: alguien llamó al Devorador. Y a la Reina.']] },
    { title: 'El fragmento', goal: { kind: 'choice', n: 1, text: 'Decide qué hacer con el fragmento' }, reward: { credits: 3000 },
      intro: [['brak', 'Podemos fundirlo en la Liga para que calle, o dárselo a la Coalición para rastrear a la Señal. ¿Qué hacemos?']],
      choice: [['liga', '⛏️ Fundirlo en la Liga'], ['coal', '☀️ Rastrear con la Coalición']],
      outro: [['ilen', 'Sea como sea, ya sabemos dónde se esconde: en el sistema más remoto de todos.']] },
    { title: 'Guardianes', goal: { kind: 'kill', sys: S.c, n: 10, text: `Abate 10 guardianes de la Señal en ${N(S.c)}` }, reward: { credits: 4500, mats: { circuitos: 6 } },
      intro: [['vex', `La Señal ha comprado a mis antiguos jefes. Patrullan ${N(S.c)}.`]],
      outro: [['senal', '…cada nave que destruyes… me alimenta igual…']] },
    { title: 'Combustible', goal: { kind: 'sell', sys: S.d, n: 30, text: `Vende 30 de mineral en ${N(S.d)} para pagar el viaje` }, reward: { credits: 4800 },
      intro: [['brak', `El viaje final cuesta. ${N(S.d)} paga bien: vende allí 30 unidades y equipamos la expedición.`]],
      outro: [['brak', 'Depósitos llenos. Ya no hay excusas.']] },
    { title: 'Coordenadas', goal: { kind: 'scan', sys: S.e, n: 1, text: `Escanea el rastro de la Señal en ${N(S.e)}` }, reward: { credits: 5200, mats: { artefactos: 3 } },
      intro: [['ilen', `El rastro pasa por ${N(S.e)}. Escanéalo con calma: necesito la lectura completa.`]],
      outro: [['ilen', 'Ya está. Y algo viene a por nosotros… lo conozco.']] },
    { title: 'El Heraldo renacido', goal: { kind: 'boss', boss: 'herald', hpMul: 2.2, sys: S.e, n: 1, text: `Derrota al Heraldo renacido en ${N(S.e)}` }, reward: { credits: 6000, mats: { nucleos: 3 } },
      intro: [['heraldo', 'Pequeña nave. La Señal me ha devuelto la vida. Y esta vez no caeré.']],
      outro: [['heraldo', 'Ella… no quiere salvaros… quiere… otro Devorador…'], ['ilen', 'Está creando uno nuevo. Más grande. Tenemos que llegar antes.']] },
    { title: 'El Devorador Primordial', goal: { kind: 'boss', boss: 'primordial', sys: S.f, n: 1, text: `Derrota al Devorador Primordial en ${N(S.f)}` }, reward: { credits: 15000, chassis: 'errante2' }, end: 'act3',
      intro: [['senal', 'Bienvenida, viajera. Mira lo que he creado: el primero de todos.'], ['ilen', 'Cuatro ojos esta vez. Mismo plan: los ojos, luego el núcleo. ¡Ve!']],
      outro: [['senal', '…no… yo era… la última voz…'], ['ilen', 'Se acabó. La Señal ha callado de verdad.'], ['brak', 'Te has ganado esto, chaval: la ERRANTE Mk II, forjada con su metal vivo. Búscala en el astillero.'], ['ilen', 'Y la galaxia sigue llena de historias. Te las iré contando: la Crónica no termina.']] },
  ];
}

// todos los capítulos escritos a mano, en orden; cada uno con su acto
export function chapters(gal) {
  return [act1(gal), act2(gal), act3(gal)].flatMap((list, a) => list.map((c) => ({ ...c, act: a + 1 })));
}

// ---------- LA CRÓNICA: capítulos generados sin fin (deterministas por número) ----------
const CRON_TITLES = ['Ruido de fondo', 'Rutas perdidas', 'Eco lejano', 'Contrabando', 'Ceniza estelar', 'Nido vacío', 'Deuda pendiente', 'Señal fantasma', 'Polvo y metal', 'Marea pirata', 'Faro roto', 'Última carga'];
const CRON_LINES = {
  reach: [['ilen', (n) => `Hay una baliza nueva en ${n}. Ve a ver qué dice.`], ['vex', (n) => `Un contacto mío dejó algo en ${n}. Búscalo junto a la baliza.`]],
  scan: [['ilen', (n) => `Lecturas raras en ${n}. Escanéalas despacio.`], ['brak', (n) => `Mis sondas no entienden lo que hay en ${n}. Echa un vistazo de cerca.`]],
  dock: [['brak', (n) => `Necesito que lleves un paquete a la estación de ${n}.`], ['ilen', (n) => `La estación de ${n} tiene datos para nosotros. Atraca allí.`]],
  sell: [['brak', (n) => `${n} se ha quedado sin mineral. Llévale el tuyo y véndelo allí.`]],
  kill: [['vex', (n) => `Mis antiguos colegas se han hecho fuertes en ${n}. Límpialo.`], ['brak', (n) => `Los piratas asaltan los cargueros de ${n}. Dales una lección.`]],
  base: [['vex', (n) => `Hay una base pirata nueva en ${n}. Derríbala.`]],
  boss: [['ilen', (n) => `Algo grande se mueve en ${n}. Ten cuidado.`]],
};
const CRON_DONE = [['ilen', '¡Bien hecho! La galaxia respira un poco mejor.'], ['brak', 'Ja, sabía que podías. Te debo una.'], ['vex', 'Nada mal, para alguien que nunca ha sido pirata.']];
const GOAL_TEXT = {
  reach: (n) => `Llega a la baliza de ${n}`,
  scan: (n) => `Escanea la anomalía de ${n}`,
  dock: (n) => `Entrega el paquete en la estación de ${n}`,
  sell: (n, k) => `Vende ${k} de mineral en ${n}`,
  kill: (n, k) => `Abate ${k} piratas en ${n}`,
  base: (n) => `Destruye la base pirata de ${n}`,
};
// i: número de crónica (0 = la primera, tras el Acto III)
export function genChapter(gal, i) {
  const rng = makeRng(hashString(`cronica-${i}`));
  const cycle = Math.floor(i / 5), top = Math.max(...gal.map((s) => s.danger));
  const isBoss = i % 5 === 4;
  const kind = isBoss ? 'boss' : rng.pick(['reach', 'scan', 'dock', 'sell', 'kill', 'kill', 'base']);
  // el peligro sube y vuelve a empezar (para pasar por toda la galaxia); atracar y vender, nunca en un sistema pirata
  const want = Math.min(top, 1 + (i % top) + (isBoss ? 2 : 0));
  const ok = (sys) => !['dock', 'sell'].includes(kind) || ownerOf(sys) !== 'pir';
  const pool = gal.filter((sys) => sys.id !== 0 && ok(sys));
  const near = pool.filter((sys) => sys.danger === want);
  const sys = rng.pick(near.length ? near : pool.filter((x) => x.danger <= want).length ? pool.filter((x) => x.danger <= want) : pool).id;
  const N = gal[sys].name;
  const n = kind === 'kill' ? 5 + Math.min(10, cycle * 2) : kind === 'sell' ? 15 + Math.min(30, cycle * 5) : 1;
  const boss = isBoss ? (cycle % 2 ? 'queen' : 'herald') : undefined;
  const goal = isBoss
    ? { kind: 'boss', boss, hpMul: +(1 + 0.15 * cycle).toFixed(2), sys, n: 1, text: `Derrota al eco ${boss === 'queen' ? 'de la Reina' : 'del Heraldo'} en ${N}` }
    : { kind, sys, n, text: GOAL_TEXT[kind](N, n) };
  const [who, line] = rng.pick(CRON_LINES[kind]);
  const reward = { credits: 2500 + 350 * i, mats: { chatarra: 4 + cycle, ...(i % 10 === 9 ? { nucleos: 2 } : {}), ...(isBoss ? { artefactos: 2 } : {}) } };
  return {
    title: `Crónica #${i + 1} · ${CRON_TITLES[i % CRON_TITLES.length]}`, act: 4, chronicle: i + 1, goal, reward,
    intro: [[who, isBoss ? `${line(N)} ${boss === 'queen' ? 'Una nueva Reina ha nacido de la colmena.' : 'Alguien ha vuelto a vestir el manto del Heraldo.'}` : line(N)]],
    outro: [rng.pick(CRON_DONE)],
  };
}

export const storyState = (save) => {
  const st = save.story;
  st.ch ??= 0;
  st.n ??= 0;
  st.seen ??= {};
  return st;
};
// la historia escrita a mano se acaba; la Crónica, no
export const storyDone = (save, gal) => storyState(save).ch >= chapters(gal).length;
export const currentChapter = (save, gal) => {
  const ch = storyState(save).ch, hand = chapters(gal);
  return hand[ch] || genChapter(gal, ch - hand.length);
};
// "Acto II · 3/8" (para el HUD y el panel)
export function chapterLabel(save) {
  const ch = storyState(save).ch;
  const a = Math.floor(ch / ACT_LEN);
  if (a >= ACT_NAMES.length) return `Crónica #${ch - ACT_NAMES.length * ACT_LEN + 1}`;
  return `Acto ${ROMAN[a] || a + 1} · ${(ch % ACT_LEN) + 1}/${ACT_LEN}`;
}

// Un suceso de la galaxia: { type: 'reach'|'scan'|'dock'|'kill'|'base'|'boss'|'choice'|'sell', sys?, boss?, pick?, amount? }
// Devuelve el capítulo si se acaba de completar (y avanza al siguiente).
export function storyEvent(save, gal, ev) {
  const ch = currentChapter(save, gal);
  if (!ch) return null;
  const g = ch.goal, st = storyState(save);
  const hit = g.kind === ev.type && (g.sys === undefined || g.sys === ev.sys) && (!g.boss || g.boss === ev.boss);
  if (!hit) return null;
  if (g.kind === 'choice') st.choice = ev.pick;
  st.n += Math.max(1, ev.amount || 1);
  if (st.n < g.n) return null;
  st.ch++;
  st.n = 0;
  return ch;
}

// Marcador de una baliza (capítulos "reach" y "scan"): un punto fijo del sistema
export const markerPos = (sysId) => ({ x: 520 + (sysId % 5) * 60, y: 140, z: -620 - (sysId % 3) * 80 });
// segundos junto a la baliza para completarla
export const markerTime = (kind) => (kind === 'scan' ? 5 : 2);
