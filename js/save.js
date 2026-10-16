// Guardado persistente. localStorage puede fallar (modo privado), así que todo va en try/catch.
const KEY = 'overdrive-save-v1';

const reducedMotion = (() => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
})();

const DEFAULTS = {
  gems: 0,
  best: 0,
  bestDist: 0,
  daily: { key: '', best: 0 },
  ships: ['viper'],
  ship: 'viper',
  meta: { shield: false, card: false },
  settings: { sound: true, vibe: true, fx: !reducedMotion, text: 'normal' },
  runs: 0,
  missions: { key: '', list: [] },
};

function merge(base, src) {
  for (const k in src) {
    if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && base[k] && typeof base[k] === 'object') {
      merge(base[k], src[k]);
    } else if (k in base) {
      base[k] = src[k];
    }
  }
  return base;
}

function load() {
  const data = JSON.parse(JSON.stringify(DEFAULTS));
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) merge(data, JSON.parse(raw));
  } catch { /* sin almacenamiento: se juega igual */ }
  return data;
}

export const save = load();

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignorar */ }
}
