/* THE ROSEN BRIDGE — a fold through an Einstein-Rosen throat, drawn in WebGL (three.js r160).
   Loaded only when the stage is switched on. index.html drives it: BRIDGE.start(canvas), BRIDGE.draw(p, t, W, H, DPR),
   BRIDGE.stop(), BRIDGE.set(look, style). If WebGL is missing or the context is lost, BRIDGE.fail goes true and the 2D
   fallback takes over.

   What you are looking at: the throat is one long curved tube seen from the inside. Its wall is a shader: quantum
   foam (value noise) boiling on the surface, a lattice of energy filaments, and rings of light rushing toward you as
   spacetime is pulled through the neck. A cloud of dust falls with you. Near the end the far mouth blooms white.

   Looks (the colours) and styles (the motion) are his settings: LOOKS / STYLES below. */
(function () {
  const B = window.BRIDGE = { ready: false, fail: false, start: null, stop: null, draw: null, set: null, look: "cyan", style: "throat" };
  let R = null, scene, cam, tube, dust, mouth, cvs, w = 0, h = 0, pr = 1, lastT = 0, running = false;
  let trav = null, tails = null, heads = null;                    // the other travellers
  const NT = 36;
  function spawnT(i, first) {                                     // a new streak: most come at us, some overtake, some cut straight across
    const P = trav.pos, V = trav.vel, k = Math.random(), sp = 110 + Math.random() * 260;
    const r = 1.2 + Math.random() * 4.6, th = Math.random() * 6.2832;
    let x = Math.cos(th) * r, y = Math.sin(th) * r, z, vx = (Math.random() - 0.5) * 10, vy = (Math.random() - 0.5) * 10, vz;
    if (k < 0.5) { z = first ? -Math.random() * 320 : -330; vz = sp; }                       // toward us, out of the far mouth
    else if (k < 0.72) { z = first ? -Math.random() * 320 : 6; vz = -sp * 0.8; }             // past us from behind, on down the throat
    else {                                                                                   // across: left to right, top to bottom, any angle
      const ang = Math.random() * 6.2832, s2 = sp * 0.45;
      x = -Math.cos(ang) * 7.5; y = -Math.sin(ang) * 7.5; z = -(4 + Math.random() * 70);
      vx = Math.cos(ang) * s2; vy = Math.sin(ang) * s2; vz = (Math.random() - 0.5) * 40;
    }
    P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z; V[i * 3] = vx; V[i * 3 + 1] = vy; V[i * 3 + 2] = vz;
  }
  function moveT(dt, speedK, open) {
    const P = trav.pos, V = trav.vel, tp = tails.geometry.attributes.position.array, hp = heads.geometry.attributes.position.array;
    const n = Math.round(NT * Math.min(1, 0.6 + speedK * 0.4));  // the storm carries more of them
    for (let i = 0; i < NT; i++) {
      if (i >= n) { tp[i * 6 + 2] = tp[i * 6 + 5] = hp[i * 3 + 2] = 900; continue; }   // parked far behind the eye
      let x = P[i * 3] + V[i * 3] * dt, y = P[i * 3 + 1] + V[i * 3 + 1] * dt, z = P[i * 3 + 2] + V[i * 3 + 2] * dt;
      if (z > 9 || z < -345 || Math.abs(x) > 9.5 || Math.abs(y) > 9.5) { spawnT(i, false); x = P[i * 3]; y = P[i * 3 + 1]; z = P[i * 3 + 2]; }
      P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
      const tl = 0.05;                                            // the tail: fifty milliseconds of its own travel
      tp[i * 6] = x; tp[i * 6 + 1] = y; tp[i * 6 + 2] = z;
      tp[i * 6 + 3] = x - V[i * 3] * tl; tp[i * 6 + 4] = y - V[i * 3 + 1] * tl; tp[i * 6 + 5] = z - V[i * 3 + 2] * tl;
      hp[i * 3] = x; hp[i * 3 + 1] = y; hp[i * 3 + 2] = z;
    }
    tails.geometry.attributes.position.needsUpdate = true; heads.geometry.attributes.position.needsUpdate = true;
    tails.material.opacity = 0.75 * open; heads.material.uniforms.uOp.value = open;
  }

  // deep / mid / hot colours, and whether the hue cycles on its own
  const LOOKS = {
    cyan:    { deep: [0.16, 0.04, 0.42], mid: [0.22, 0.88, 1.00], hot: [1.00, 0.96, 0.90], prism: 0, dust: [0.62, 0.91, 1.00] },
    ember:   { deep: [0.30, 0.04, 0.02], mid: [1.00, 0.50, 0.12], hot: [1.00, 0.95, 0.80], prism: 0, dust: [1.00, 0.78, 0.55] },
    violet:  { deep: [0.10, 0.02, 0.30], mid: [0.72, 0.32, 1.00], hot: [1.00, 0.92, 1.00], prism: 0, dust: [0.88, 0.72, 1.00] },
    emerald: { deep: [0.02, 0.16, 0.08], mid: [0.28, 1.00, 0.58], hot: [0.94, 1.00, 0.90], prism: 0, dust: [0.72, 1.00, 0.82] },
    prism:   { deep: [0.12, 0.04, 0.30], mid: [0.50, 0.80, 1.00], hot: [1.00, 1.00, 1.00], prism: 1, dust: [1.00, 1.00, 1.00] }
  };
  // twist = the wall spirals with depth, ring = how many rings, foam = how fast it boils, bend = how much the tube snakes,
  // speed = how fast everything streams, roll = how much the eye rolls
  const STYLES = {
    throat: { twist: 0.000, ring: 1.0, foam: 1.0, bend: 1.0, speed: 1.0, roll: 1.0 },
    spiral: { twist: 0.045, ring: 1.3, foam: 1.0, bend: 1.6, speed: 1.15, roll: 2.6 },
    storm:  { twist: 0.012, ring: 3.0, foam: 2.2, bend: 2.2, speed: 1.7, roll: 1.4 }
  };

  const VERT = `
    uniform float uT, uBendK;
    varying vec2 vUv;
    varying float vZ;
    void main() {
      vUv = uv;
      vec3 p = position;
      float d = -p.z;                                   // depth down the throat (the camera sits at z = 0 looking down -z)
      float bend = smoothstep(0.0, 90.0, d) * uBendK;   // straight where we are, bending further in
      p.x += sin(d * 0.021 + uT * 0.35) * 7.0 * bend;
      p.y += cos(d * 0.016 - uT * 0.27) * 5.0 * bend;
      vZ = d;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`;

  const FRAG = `
    precision highp float;
    uniform float uT, uSpeed, uOpen, uExit, uPrism, uTwist, uRingK, uFoamK;
    uniform vec3 uDeep, uMid, uHot;
    varying vec2 vUv;
    varying float vZ;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float pn(float a, float w, float k, float y) {       // noise that meets itself round the wall: w = where the tube's UV wraps
      return mix(noise(vec2(a * k, y)), noise(vec2((a - 6.28318) * k, y)), w);
    }
    vec3 hsv(float h, float s, float v) {
      vec3 k = abs(fract(vec3(h) + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
      return v * mix(vec3(1.0), clamp(k - 1.0, 0.0, 1.0), s);
    }
    void main() {
      float d = vZ;                                    // down the throat
      float a = vUv.x * 6.28318 + d * uTwist + uT * uTwist * 12.0;   // around the wall (spiralling with depth when asked)
      float flow = d * 0.012 - uT * uSpeed;            // everything streams toward the eye
      // quantum foam: two octaves of noise boiling on the wall
      float n = pn(a, vUv.x, 2.2, flow * 3.0 * uFoamK) * 0.6 + pn(a + uT * 0.08 * uFoamK, vUv.x, 5.0, flow * 7.0 * uFoamK) * 0.4;
      float foam = smoothstep(0.45, 0.95, n);
      // filaments: a twisted lattice of energy lines
      float lat = sin(a * 9.0 + d * 0.06 + uT * 1.7) * sin(d * 0.11 - uT * 5.0 * uSpeed + a * 2.0);
      float fil = pow(max(0.0, lat), 10.0);
      // rings of light pulled through the neck
      float ring = pow(1.0 - abs(fract(flow * 1.6 * uRingK) * 2.0 - 1.0), 14.0);
      float e = foam * 0.9 + fil * 1.6 + ring * 2.2;
      // depth: the wall dims with distance but never dies (the far side is lit), the last few metres by the eye fade
      float fog = mix(0.32, 1.0, exp(-d * 0.006)) * smoothstep(2.0, 14.0, d);
      vec3 mid = uMid;
      if (uPrism > 0.5) mid = hsv(fract(flow * 0.12 + a * 0.06), 0.85, 1.0);   // the prism: every colour, sliding down the throat
      vec3 col = mix(uDeep, mid, clamp(e, 0.0, 1.0));
      col = mix(col, uHot, clamp((e - 1.0) * 0.6, 0.0, 1.0));
      // the light of the other side, down the throat
      col += mid * 0.5 * smoothstep(140.0, 400.0, d) * 0.9;
      // the far mouth blooms white as we arrive
      col = mix(col, uHot, uExit * smoothstep(60.0, 260.0, d));
      float alpha = clamp(e * 1.1 + 0.16, 0.0, 1.0) * fog * uOpen;
      gl_FragColor = vec4(col * alpha * 1.5, alpha);
    }`;

  let look = LOOKS.cyan, style = STYLES.throat;
  function applyLook() {
    if (!tube) return;
    const u = tube.material.uniforms;
    u.uDeep.value.fromArray(look.deep); u.uMid.value.fromArray(look.mid); u.uHot.value.fromArray(look.hot);
    u.uPrism.value = look.prism; u.uTwist.value = style.twist; u.uRingK.value = style.ring; u.uFoamK.value = style.foam; u.uBendK.value = style.bend;
    dust.material.uniforms.uCol.value.fromArray(look.dust);
    if (heads) { heads.material.uniforms.uCol.value.fromArray(look.hot); tails.material.color.setRGB(look.mid[0] * 0.5 + 0.5, look.mid[1] * 0.5 + 0.5, look.mid[2] * 0.5 + 0.5); }
  }
  B.set = function (lk, st) {
    look = LOOKS[lk] || LOOKS.cyan; style = STYLES[st] || STYLES.throat;
    B.look = LOOKS[lk] ? lk : "cyan"; B.style = STYLES[st] ? st : "throat";
    applyLook();
  };

  function build(canvas) {
    cvs = canvas;
    R = new THREE.WebGLRenderer({ canvas: cvs, antialias: false, alpha: true, powerPreference: "high-performance" });
    R.setClearColor(0x000000, 0);
    R.autoClear = true;
    scene = new THREE.Scene();
    cam = new THREE.PerspectiveCamera(74, 1, 0.5, 700);
    cam.position.set(0, 0, 0);

    // the throat: a long open cylinder, seen from inside, laid along -z
    const g = new THREE.CylinderGeometry(6.5, 6.5, 420, 72, 160, true);
    g.rotateX(Math.PI / 2);                // length along z
    g.translate(0, 0, -200);               // from z = +10 (just behind the eye) to -410
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uT: { value: 0 }, uSpeed: { value: 0.6 }, uOpen: { value: 0 }, uExit: { value: 0 },
        uPrism: { value: 0 }, uTwist: { value: 0 }, uRingK: { value: 1 }, uFoamK: { value: 1 }, uBendK: { value: 1 },
        uDeep: { value: new THREE.Vector3() }, uMid: { value: new THREE.Vector3() }, uHot: { value: new THREE.Vector3() }
      },
      vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    tube = new THREE.Mesh(g, m);
    scene.add(tube);

    // quantum dust falling with us
    const N = 1400, pos = new Float32Array(N * 3), vel = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const r = Math.sqrt(Math.random()) * 5.2, th = Math.random() * 6.2832;
      pos[i * 3] = Math.cos(th) * r; pos[i * 3 + 1] = Math.sin(th) * r; pos[i * 3 + 2] = -Math.random() * 300;
      vel[i] = 0.6 + Math.random() * 1.4;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    dg.userData.vel = vel;
    dust = new THREE.Points(dg, new THREE.ShaderMaterial({          // soft round motes, sized by distance, never square
      uniforms: { uPr: { value: 1 }, uOp: { value: 0 }, uCol: { value: new THREE.Vector3(0.62, 0.91, 1) } },
      vertexShader: `
        uniform float uPr;
        varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float dist = max(1.0, -mv.z);
          gl_PointSize = clamp(150.0 * uPr / dist, 1.5, 22.0 * uPr);
          vA = smoothstep(1.0, 6.0, dist) * (0.35 + 0.65 * exp(-dist * 0.012));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        precision mediump float;
        uniform float uOp;
        uniform vec3 uCol;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.06, d) * vA * uOp;
          gl_FragColor = vec4(uCol * a, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    scene.add(dust);

    // the far mouth: a glowing ring that comes up to meet us
    mouth = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.9, 12, 72), new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    mouth.position.z = -300;
    scene.add(mouth);

    // other travellers: streaks of light crossing the throat in every direction, coming at us, overtaking us, cutting across
    const tp = new Float32Array(NT * 2 * 3), hp = new Float32Array(NT * 3);
    trav = { pos: new Float32Array(NT * 3), vel: new Float32Array(NT * 3), n: NT };
    for (let i = 0; i < NT; i++) spawnT(i, true);
    const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.BufferAttribute(tp, 3));
    tails = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(tails);
    const hg = new THREE.BufferGeometry(); hg.setAttribute("position", new THREE.BufferAttribute(hp, 3));
    heads = new THREE.Points(hg, new THREE.ShaderMaterial({
      uniforms: { uPr: { value: 1 }, uOp: { value: 0 }, uCol: { value: new THREE.Vector3(1, 1, 1) } },
      vertexShader: `
        uniform float uPr;
        varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float dist = max(1.0, -mv.z);
          gl_PointSize = clamp(420.0 * uPr / dist, 2.0, 64.0 * uPr);
          vA = smoothstep(0.6, 3.0, dist) * (0.25 + 0.75 * exp(-dist * 0.02));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        precision mediump float;
        uniform float uOp;
        uniform vec3 uCol;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float a = pow(smoothstep(0.5, 0.0, d), 2.2) * vA * uOp;
          gl_FragColor = vec4(mix(uCol, vec3(1.0), 0.5) * a * 1.6, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    scene.add(heads);

    cvs.addEventListener("webglcontextlost", (e) => { e.preventDefault(); B.fail = true; B.ready = false; }, false);
    applyLook();
    B.ready = true;
  }

  function size(W, H, DPR) {
    if (W === w && H === h && DPR === pr) return;
    w = W; h = H; pr = DPR;
    R.setPixelRatio(Math.min(DPR, 1.5));
    R.setSize(W, H, false);
    cam.aspect = W / H; cam.updateProjectionMatrix();
  }

  const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

  B.start = function (canvas) {
    if (B.fail) return false;
    try { if (!R) build(canvas); } catch (e) { B.fail = true; return false; }
    running = true; lastT = 0;
    return true;
  };
  B.stop = function () { running = false; };

  /* p = stage progress 0..1, t = seconds. Returns true when a frame was drawn. */
  B.draw = function (p, t, W, H, DPR) {
    if (!running || !B.ready || B.fail) return false;
    try {
      size(W, H, DPR);
      const dt = lastT ? Math.min(0.1, t - lastT) : 0.016; lastT = t;
      const open = sm(0, 0.10, p);                       // the throat blooms
      const speed = (0.5 + sm(0.06, 0.55, p) * 2.8) * style.speed;   // then we fall faster and faster
      const exit = sm(0.84, 0.97, p);                    // the far mouth
      const u = tube.material.uniforms;
      u.uT.value = t; u.uSpeed.value = speed; u.uOpen.value = open * (1 - exit * 0.6); u.uExit.value = exit;

      // the eye: a slow roll and a drift, as if the fall had no floor
      const roll = style.roll;
      cam.rotation.z = Math.sin(t * 0.31) * 0.22 * roll + t * 0.05 * speed * 0.15 * roll;
      cam.position.x = Math.sin(t * 0.7) * 0.9;
      cam.position.y = Math.cos(t * 0.53) * 0.7;
      cam.lookAt(Math.sin(t * 0.4) * 2.5, Math.cos(t * 0.33) * 1.8, -120);

      // dust falls toward us
      const a = dust.geometry.attributes.position, arr = a.array, vel = dust.geometry.userData.vel, n = vel.length;
      const step = (30 + speed * 60) * dt;
      for (let i = 0; i < n; i++) {
        let z = arr[i * 3 + 2] + step * vel[i];
        if (z > 2) z -= 300;
        arr[i * 3 + 2] = z;
      }
      a.needsUpdate = true;
      dust.material.uniforms.uOp.value = 0.9 * open;
      dust.material.uniforms.uPr.value = Math.min(DPR, 1.5);

      // the other travellers flash past
      moveT(dt, style.speed, open);
      heads.material.uniforms.uPr.value = Math.min(DPR, 1.5);

      // the far mouth rushes in at the end
      mouth.position.z = -300 + exit * 290;
      mouth.material.opacity = exit * 0.9;
      mouth.scale.setScalar(1 + exit * 3.5);
      mouth.rotation.z = t * 0.6;

      R.render(scene, cam);
      return true;
    } catch (e) { B.fail = true; return false; }
  };
})();
