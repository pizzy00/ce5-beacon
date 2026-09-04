# CE-5 Beacon

A contact console for the night sky, in your pocket.

**Live:** https://pizzy00.github.io/ce5-beacon/

Pick an alien star system on a turning sky, press START, and ride Polaris to Sol to Luna to Earth, then descend on real satellite imagery onto the exact spot you are standing. A breath bar keeps the pace. A calm voice reads the first-night guide in nine languages. Each system carries a portrait of who you are calling, drawn from witness accounts. The Hubble Ultra Deep Field sits behind the chart. Nearly everything is a setting.

One HTML file, no framework, no backend, no account, nothing tracked. Installs as a home-screen app and works offline once loaded.

## Run it

Open the live link on a phone or tablet. To run it locally:

```
python -m http.server 8000
```

then open http://localhost:8000/ in Chrome. It needs to be served over http, not opened as a file, for the service worker and the tiles.

## What is in here

- `index.html` is the whole app: the star chart, the shaded Earth, the journey stages, the descent, the settings, the guide.
- `styles.css` and `sw.js` are the sheet and the service worker (offline cache).
- `voice/` holds the guide and the system read-outs, him and her, in English, Spanish, Portuguese, French, German, Russian, Chinese and Japanese.
- `sky/` holds the photographs behind the chart. `earth/` holds the day, night and cloud maps. `species/` holds the portraits. `photos/` holds the missile photographs shown after the flash. `lang/` holds the interface translations.

## Credits

- Sky photographs: Hubble Ultra Deep Field 2014, NASA, ESA, H. Teplitz and M. Rafelski (IPAC/Caltech), A. Koekemoer (STScI), R. Windhorst (ASU), Z. Levay (STScI). Hubble eXtreme Deep Field, NASA, ESA, G. Illingworth, D. Magee, P. Oesch (UCSC), R. Bouwens (Leiden) and the HUDF09 team. The Milky Way panorama, ESO / S. Brunier. All CC BY 4.0.
- Earth maps: NASA Blue Marble and Black Marble, public domain.
- Satellite tiles on the descent: their providers are credited on the map.
- Voices: generated with Qwen3-TTS on a local GPU. No real person's voice was used.
- Missile photographs: US Air Force, US Navy and Department of Defense releases, public domain.
- Built with Claude Code over three weeks of evenings, tested on a phone and a tablet before every push.

## Ideas

Open an issue. A group mode that runs the same session on several phones over a room code is next on the list.
