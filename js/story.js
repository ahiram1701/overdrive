// GALAXIA: historia "LA SEÑAL" (8 capítulos). Módulo puro (se testea en Node).
// Cada capítulo tiene diálogo de entrada y salida, un objetivo en un sistema concreto y premio.
// Los sistemas salen de la galaxia (deterministas), cada vez más lejos de ORIGEN.

export const CAST = {
  ilen: { icon: '👩‍🔬', name: 'Dra. Ilen', color: '#00e5ff' },
  brak: { icon: '⛏️', name: 'Capataz Brak', color: '#30d158' },
  senal: { icon: '📡', name: 'La Señal', color: '#bf5af2' },
  heraldo: { icon: '👁️', name: 'El Heraldo', color: '#ff2d55' },
};

// Sistemas de la historia: uno por anillo de peligro (el de menor id), y el último, el más lejano
export function storySystems(gal) {
  const byDanger = (d) => gal.filter((s) => s.danger === d).sort((a, b) => a.id - b.id)[0];
  const far = [...gal].sort((a, b) => b.danger - a.danger || a.id - b.id)[0];
  return { o: 0, a: byDanger(1).id, b: byDanger(2).id, c: byDanger(3).id, d: byDanger(4).id, e: (byDanger(5) || far).id, f: far.id };
}

export function chapters(gal) {
  const S = storySystems(gal), N = (id) => gal[id].name;
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
      outro: [['senal', 'Por fin… silencio. Toma mi nave, viajera: la ERRANTE. Ya no la necesito.'], ['ilen', 'Lo has conseguido. La galaxia es tuya, piloto.']] },
  ];
}

export const storyState = (save) => {
  const st = save.story;
  st.ch ??= 0;
  st.n ??= 0;
  st.seen ??= {};
  return st;
};
export const storyDone = (save, gal) => storyState(save).ch >= chapters(gal).length;
export const currentChapter = (save, gal) => chapters(gal)[storyState(save).ch] || null;

// Un suceso de la galaxia: { type: 'reach'|'dock'|'kill'|'base'|'boss'|'choice', sys?, boss?, pick? }
// Devuelve el capítulo si se acaba de completar (y avanza al siguiente).
export function storyEvent(save, gal, ev) {
  const ch = currentChapter(save, gal);
  if (!ch) return null;
  const g = ch.goal, st = storyState(save);
  const hit = g.kind === ev.type && (g.sys === undefined || g.sys === ev.sys) && (!g.boss || g.boss === ev.boss);
  if (!hit) return null;
  if (g.kind === 'choice') st.choice = ev.pick;
  st.n++;
  if (st.n < g.n) return null;
  st.ch++;
  st.n = 0;
  return ch;
}

// Marcador de una baliza (capítulos "reach"): un punto fijo del sistema
export const markerPos = (sysId) => ({ x: 520 + (sysId % 5) * 60, y: 140, z: -620 - (sysId % 3) * 80 });
