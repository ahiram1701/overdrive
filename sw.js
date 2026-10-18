// Service worker cache-first: el juego funciona sin conexión tras la primera carga.
// El workflow de despliegue sustituye 'overdrive-v1' por 'overdrive-<sha>' en cada publicación.
const CACHE = 'overdrive-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/main.js',
  './js/state.js',
  './js/rng.js',
  './js/save.js',
  './js/audio.js',
  './js/fx.js',
  './js/upgrades.js',
  './js/player.js',
  './js/world.js',
  './js/render.js',
  './js/game.js',
  './js/ui.js',
  './js/input.js',
  './js/missions.js',
  './js/abilities.js',
  './js/pacing.js',
  './js/progress.js',
  './js/mesh3d.js',
  './js/cosmetics.js',
  './js/shipdraw.js',
  './js/bosses.js',
  './js/campaign.js',
  './js/cosfx.js',
  './js/modifiers.js',
  './js/balance.js',
  './js/arenaData.js',
  './js/arena.js',
  './js/arenaRender.js',
  './js/expedition.js',
  './js/race.js',
  './js/space3d.js',
  './js/galaxyData.js',
  './js/galaxy.js',
  './js/galaxyMissions.js',
  './js/galaxyEvents.js',
  './js/economy.js',
  './js/factions.js',
  './js/crafting.js',
  './js/story.js',
  './js/market.js',
  './js/outposts.js',
  './js/galaxyWorld.js',
  './js/tips.js',
  './js/galaxyThreat.js',
  './js/galmap.js',
  './js/spaceGame.js',
  './js/spaceRender.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }))
  );
});
