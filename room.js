/* CE-5 Beacon · the room: one phone leads, the others follow (09-04).
   A thin wrapper over PeerJS (vendor/peerjs/peerjs.min.js, the free public signalling server). Star shape: the host owns the
   room id, every follower connects to it, the host fans messages out. Nothing here ever carries a location: the console
   sends timing, the chosen system and the host's setup code, and that is all. Swap this file for a Worker-backed one
   later; the console only ever calls host / join / leave / send / now and reads code / role / peers / ok. */
window.ROOM = (() => {
  const R = { code: "", role: "", peers: 0, ok: false, onMsg: null, onState: null, onJoin: null, busy: false };
  const LETTERS = "BCDFGHJKLMNPQRSTVWXZ";                       // no vowels: no words
  const mkCode = () => { let c = ""; for (let i = 0; i < 4; i++) c += LETTERS[Math.floor(Math.random() * LETTERS.length)]; return c; };
  const ID = (c) => "ce5-beacon-" + String(c || "").toUpperCase();
  let peer = null, conns = [], hostConn = null, offset = 0, pongs = [], synced = false, pending = [];
  const state = (s, x) => { if (R.onState) { try { R.onState(s, x); } catch (e) {} } };
  const reset = () => { R.code = ""; R.role = ""; R.peers = 0; R.ok = false; R.busy = false; conns = []; hostConn = null; offset = 0; pongs = []; synced = false; pending = []; };
  const mkPeer = (id) => {
    const opts = { debug: 0, config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" }] } };
    return id ? new Peer(id, opts) : new Peer(opts);
  };
  function handle(c, m) {
    if (!m || typeof m !== "object") return;
    if (m.t === "ping") { try { c.send({ t: "pong", a: m.a, b: Date.now() }); } catch (e) {} return; }
    if (m.t === "pong") { const now = Date.now(), rtt = now - m.a; pongs.push({ rtt, off: m.b - (m.a + rtt / 2) }); return; }
    if (hostConn && !synced) { pending.push(m); return; }   // the hello can land before the clock is set: hold it
    if (R.onMsg) { try { R.onMsg(m, c); } catch (e) {} }
  }
  function wire(c) {
    c.on("data", (m) => handle(c, m));
    c.on("close", () => { if (R.role === "host") { conns = conns.filter((x) => x !== c); R.peers = conns.length; state("peers", R.peers); } else lost(); });
    c.on("error", () => { if (R.role !== "host") lost(); });
  }
  function lost() { if (!R.ok) return; R.ok = false; state("lost"); }
  function sync() {                                              // three round trips, keep the tightest: host time = local time + offset
    return new Promise((res) => {
      pongs = []; let n = 0;
      const one = () => { try { hostConn.send({ t: "ping", a: Date.now() }); } catch (e) {} if (++n < 3) setTimeout(one, 250); };
      one();
      setTimeout(() => { if (pongs.length) { pongs.sort((a, b) => a.rtt - b.rtt); offset = pongs[0].off; } res(offset); }, 1400);
    });
  }
  R.host = () => new Promise((res, rej) => {
    if (typeof Peer !== "function") return rej(new Error("no peer library"));
    R.leave(); R.busy = true;
    let tries = 0;
    const attempt = () => {
      const code = mkCode(); peer = mkPeer(ID(code));
      peer.on("open", () => { R.code = code; R.role = "host"; R.ok = true; R.busy = false; state("hosting", code); res(code); });
      peer.on("connection", (c) => {
        conns.push(c); wire(c);
        c.on("open", () => { R.peers = conns.length; state("peers", R.peers); if (R.onJoin) { try { R.onJoin(c); } catch (e) {} } });
      });
      peer.on("error", (e) => {
        if (e && e.type === "unavailable-id" && tries++ < 5) { try { peer.destroy(); } catch (x) {} attempt(); return; }   // that code is taken: roll again
        if (!R.ok) { R.busy = false; rej(e); } else state("lost");
      });
      peer.on("disconnected", () => { try { peer.reconnect(); } catch (e) {} });
    };
    attempt();
  });
  R.join = (code) => new Promise((res, rej) => {
    if (typeof Peer !== "function") return rej(new Error("no peer library"));
    code = String(code || "").toUpperCase().replace(/[^A-Z]/g, "");
    if (code.length !== 4) return rej(new Error("bad code"));
    R.leave(); R.busy = true;
    let done = false;
    const fail = (e) => { if (done) return; done = true; R.busy = false; try { if (peer) peer.destroy(); } catch (x) {} peer = null; rej(e || new Error("no room")); };
    peer = mkPeer();
    peer.on("open", () => {
      hostConn = peer.connect(ID(code), { reliable: true });
      wire(hostConn);
      hostConn.on("open", () => { R.code = code; R.role = "follower"; R.ok = true; sync().then(() => { done = true; synced = true; R.busy = false; state("joined", code); res(code); const q = pending; pending = []; q.forEach((m) => handle(hostConn, m)); }); });
    });
    peer.on("error", (e) => { if (!done) fail(e); else if (e && e.type !== "peer-unavailable") lost(); });
    setTimeout(() => fail(new Error("timeout")), 12000);
  });
  R.send = (m) => {
    try {
      if (R.role === "host") conns.forEach((c) => { if (c.open) c.send(m); });
      else if (hostConn && hostConn.open) hostConn.send(m);
    } catch (e) {}
  };
  R.now = () => Date.now() + offset;
  R.leave = () => { const had = R.ok; try { if (peer) peer.destroy(); } catch (e) {} peer = null; reset(); if (had) state("left"); };
  return R;
})();
