/* CE-5 Beacon service worker.
   The console has to come up with no signal at all: the shell, the imagery, the dictionaries
   and the two data files are all held locally. Live things (the travellers board, the satellite
   tiles of your own roof) are tried on the network first and simply fall away when there is none. */

const VER = "ce5-v92";
const SHELL = VER + "-shell";
const LIVE = VER + "-live";

/* everything the experience needs to run alone */
const PRECACHE = [
  "./",
  "./index.html",
  "./styles.css?v=51",
  "./manifest.json",
  "./vendor/leaflet/leaflet.js?v=1",
  "./vendor/leaflet/leaflet.min.css?v=1",
  "./vendor/three/three.min.js?v=1",
  "./bridge.js?v=1",
  "./room.js?v=1",
  "./earthgl.js?v=2",
  "./vendor/peerjs/peerjs.min.js?v=1",
  "./audio/bridge.ogg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./earth/day.jpg",
  "./earth/night.jpg",
  "./earth/clouds.jpg",
  "./earth/moon.jpg",
  "./sky/hudf.jpg",
  "./species/greys-f.jpg", "./species/greys-m.jpg", "./species/nordics-f.jpg", "./species/nordics-m.jpg", "./species/sirians-f.jpg", "./species/sirians-m.jpg", "./species/arcturians-f.jpg", "./species/arcturians-m.jpg", "./species/lyrans-f.jpg", "./species/lyrans-m.jpg", "./species/orion-f.jpg", "./species/orion-m.jpg", "./species/andromedans-f.jpg", "./species/andromedans-m.jpg", "./species/reptilians-f.jpg", "./species/reptilians-m.jpg", "./species/eben-f.jpg", "./species/eben-m.jpg", "./species/archquloid-f.jpg", "./species/archquloid-m.jpg", "./species/quadloid-f.jpg", "./species/quadloid-m.jpg", "./species/trantaloid-f.jpg", "./species/trantaloid-m.jpg", "./species/trantmask-f.jpg", "./species/trantmask-m.jpg", "./species/plejaren-f.jpg", "./species/plejaren-m.jpg", "./species/oriongrey-f.jpg", "./species/oriongrey-m.jpg",
  "./voice/guide-1.mp3", "./voice/guide-2.mp3", "./voice/guide-3.mp3", "./voice/guide-4.mp3", "./voice/guide-5.mp3", "./voice/guide-6.mp3", "./voice/guide-7.mp3", "./voice/guide-8.mp3", "./voice/guide-9.mp3", "./voice/sys-zeta.mp3", "./voice/sys-plei.mp3", "./voice/sys-siri.mp3", "./voice/sys-arct.mp3", "./voice/sys-vega.mp3", "./voice/sys-orio.mp3", "./voice/sys-andr.mp3", "./voice/sys-proc.mp3", "./voice/sys-drac.mp3", "./voice/sys-erid.mp3", "./voice/sys-acen.mp3",
  "./voice/f/guide-1.mp3", "./voice/f/guide-2.mp3", "./voice/f/guide-3.mp3", "./voice/f/guide-4.mp3", "./voice/f/guide-5.mp3", "./voice/f/guide-6.mp3", "./voice/f/guide-7.mp3", "./voice/f/guide-8.mp3", "./voice/f/guide-9.mp3", "./voice/f/sys-zeta.mp3", "./voice/f/sys-plei.mp3", "./voice/f/sys-siri.mp3", "./voice/f/sys-arct.mp3", "./voice/f/sys-vega.mp3", "./voice/f/sys-orio.mp3", "./voice/f/sys-andr.mp3", "./voice/f/sys-proc.mp3", "./voice/f/sys-drac.mp3", "./voice/f/sys-erid.mp3", "./voice/f/sys-acen.mp3",
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
    caches.open(SHELL).then((c) => {
      /* four at a time, so the page's own requests (the splash portrait, the maps) are never queued behind a hundred of
         ours on a first visit; one bad file must not sink the whole install */
      const q = PRECACHE.slice();
      const worker = () => (q.length ? c.add(q.shift()).catch(() => null).then(worker) : Promise.resolve());
      return Promise.all([worker(), worker(), worker(), worker()]);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== LIVE && k !== REM).map((k) => caches.delete(k))))   // the reminder's spot survives updates
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") return self.skipWaiting();
  if (e.data && "remind" in e.data) e.waitUntil(remSave(e.data.remind ? { la: e.data.remind.la, lo: e.data.remind.lo, last: "" } : null));
});

/* v92: the good-night reminder. The spot comes from the page already rounded to a tenth of a degree and is kept here only. */
const REM = "ce5-remind", REM_URL = "ce5-remind-spot";
function remLoad() { return caches.open(REM).then((c) => c.match(REM_URL)).then((r) => (r ? r.json() : null)).catch(() => null); }
function remSave(o) {
  return caches.open(REM).then((c) => (o ? c.put(REM_URL, new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } })) : c.delete(REM_URL)));
}
function remDay(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
function remMoon(ms) {                                           // how much of the Moon is lit, 0 to 1, from the mean month: near enough for "dim or bright"
  const age = (((ms / 86400000 - 10962.76) % 29.530589) + 29.530589) % 29.530589;   // days since the new Moon of 2000-01-06 18:14 UTC
  return (1 - Math.cos(2 * Math.PI * age / 29.530589)) / 2;
}
async function remCheck(now) {
  const o = await remLoad(); if (!o) return null;
  const d = now || new Date(), h = d.getHours();
  if (o.last === remDay(d) || h < 12 || h > 21) return null;     // once a day, and only between noon and 9 PM
  const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=" + o.la + "&longitude=" + o.lo +
    "&hourly=cloud_cover&timezone=auto&forecast_days=2", { cache: "no-store" });
  const j = await r.json(), T = (j.hourly && j.hourly.time) || [], C = (j.hourly && j.hourly.cloud_cover) || [];
  const today = T.length ? T[0].slice(0, 10) : "", vals = [];
  T.forEach((t, i) => { const hh = +t.slice(11, 13); if ((t.slice(0, 10) === today && hh >= 21) || (t.slice(0, 10) !== today && hh <= 1 && vals.length < 5)) vals.push(C[i]); });
  if (!vals.length) return null;
  const cloud = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), lit = remMoon(d.getTime());
  if (cloud > 25 || lit > 0.6) return { ok: false, cloud, lit };
  o.last = remDay(d); await remSave(o);
  await self.registration.showNotification("TONIGHT LOOKS GOOD", {
    body: "Clear sky after dark (about " + cloud + "% cloud) and " + (lit < 0.15 ? "almost no Moon" : "a dim Moon") + ". A good night for the beacon.",
    icon: "icon-192.png", badge: "icon-192.png", tag: "ce5-goodnight", data: { url: "./" } });
  return { ok: true, cloud, lit };
}
self.addEventListener("periodicsync", (e) => { if (e.tag === "ce5-goodnight") e.waitUntil(remCheck().catch(() => null)); });
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then((L) => (L.length ? L[0].focus() : self.clients.openWindow("./"))));
});

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
