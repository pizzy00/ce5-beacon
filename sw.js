/* CE-5 Beacon service worker.
   The console has to come up with no signal at all: the shell, the imagery, the dictionaries
   and the two data files are all held locally. Live things (the travellers board, the satellite
   tiles of your own roof) are tried on the network first and simply fall away when there is none. */

const VER = "ce5-v3";
const SHELL = VER + "-shell";
const LIVE = VER + "-live";

/* everything the experience needs to run alone */
const PRECACHE = [
  "./",
  "./index.html",
  "./styles.css?v=12",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./earth/day.jpg",
  "./earth/night.jpg",
  "./earth/clouds.jpg",
  "./pursue.json",
  "./uso.json",
  "./lang/es.json", "./lang/fr.json", "./lang/pt.json", "./lang/de.json", "./lang/zh.json",
  "./lang/ru.json", "./lang/ja.json", "./lang/hi.json", "./lang/ar.json",
  "./photos/mm3-launch-2019.jpg", "./photos/mm3-launch-2025.jpg", "./photos/mm3-reentry.jpg",
  "./photos/mm3-silo-1989.jpg", "./photos/mm3-silo-2012.jpg", "./photos/peacekeeper-cold.jpg",
  "./photos/peacekeeper-launch.jpg", "./photos/titan-silo.jpg",
  "./photos/trident-nebraska-2008.jpg", "./photos/trident-rhodeisland-2019.jpg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) =>
      /* one bad file must not sink the whole install */
      Promise.all(PRECACHE.map((u) => c.add(u).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== LIVE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => { if (e.data === "skipWaiting") self.skipWaiting(); });

function isLive(url) {                                           // the board and the maps: always try the sky first
  return /api\.github\.com|raw\.githubusercontent\.com|nominatim|arcgisonline|tile\./.test(url);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = req.url;

  if (isLive(url)) {                                             // network first, cached copy as a lifeline
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok && /raw\.githubusercontent|api\.github/.test(url)) {
          const copy = res.clone();
          caches.open(LIVE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  if (url.startsWith(self.location.origin)) {                    // our own files: cache first, then refresh behind you
    e.respondWith(
      caches.match(req).then((hit) => {                          // exact URL, ?v= and all: a bumped version misses on purpose
        const net = fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => caches.match(req, { ignoreSearch: true }));   // no signal: any cached copy of this file will do
        return hit || net;
      })
    );
  }
});
