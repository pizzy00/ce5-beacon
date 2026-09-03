/* CE-5 Beacon service worker.
   The console has to come up with no signal at all: the shell, the imagery, the dictionaries
   and the two data files are all held locally. Live things (the travellers board, the satellite
   tiles of your own roof) are tried on the network first and simply fall away when there is none. */

const VER = "ce5-v31";
const SHELL = VER + "-shell";
const LIVE = VER + "-live";

/* everything the experience needs to run alone */
const PRECACHE = [
  "./",
  "./index.html",
  "./styles.css?v=26",
  "./manifest.json",
  "./vendor/leaflet/leaflet.js?v=1",
  "./vendor/leaflet/leaflet.min.css?v=1",
  "./vendor/three/three.min.js?v=1",
  "./bridge.js?v=1",
  "./audio/bridge.ogg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./earth/day.jpg",
  "./earth/night.jpg",
  "./earth/clouds.jpg",
  "./species/greys-f.jpg", "./species/greys-m.jpg", "./species/nordics-f.jpg", "./species/nordics-m.jpg", "./species/sirians-f.jpg", "./species/sirians-m.jpg", "./species/arcturians-f.jpg", "./species/arcturians-m.jpg", "./species/lyrans-f.jpg", "./species/lyrans-m.jpg", "./species/orion-f.jpg", "./species/orion-m.jpg", "./species/andromedans-f.jpg", "./species/andromedans-m.jpg", "./species/reptilians-f.jpg", "./species/reptilians-m.jpg", "./species/eben-f.jpg", "./species/eben-m.jpg", "./species/archquloid-f.jpg", "./species/archquloid-m.jpg", "./species/quadloid-f.jpg", "./species/quadloid-m.jpg", "./species/trantaloid-f.jpg", "./species/trantaloid-m.jpg", "./species/trantmask-f.jpg", "./species/trantmask-m.jpg", "./species/plejaren-f.jpg", "./species/plejaren-m.jpg", "./species/oriongrey-f.jpg", "./species/oriongrey-m.jpg",
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

  if (req.mode === "navigate") {                                 // the page itself: always ask the network first,
    e.respondWith(                                               // or a returning visitor runs the previous build all session
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(SHELL).then(function (c) { c.put("./", copy); }).catch(function () {});
        }
        return res;
      }).catch(function () {
        return caches.match("./").then(function (hit) { return hit || caches.match(req); });
      })
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
