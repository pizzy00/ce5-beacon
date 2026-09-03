/* THE ROSEN BRIDGE — a fold through an Einstein-Rosen throat, drawn in WebGL (three.js r160).
   Loaded only when the stage is switched on. index.html drives it: BRIDGE.start(canvas), BRIDGE.draw(p, t, W, H, DPR),
   BRIDGE.stop(). If WebGL is missing or the context is lost, BRIDGE.fail goes true and the 2D fallback takes over.

   What you are looking at: the throat is one long curved tube seen from the inside. Its wall is a shader: quantum
   foam (value noise) boiling on the surface, a lattice of energy filaments, and rings of light rushing toward you as
   spacetime is pulled through the neck. A cloud of dust falls with you. Near the end the far mouth blooms white. */
(function () {
  const B = window.BRIDGE = { ready: false, fail: false, start: null, stop: null, draw: null };
  let R = null, scene, cam, tube, dust, mouth, cvs, w = 0, h = 0, pr = 1, lastT = 0, running = false;

  const VERT = `
    uniform float uT;
    varying vec2 vUv;
    varying float vZ;
    void main() {
      vUv = uv;
      vec3 p = position;
      float d = -p.z;                                   // depth down the throat (the camera sits at z = 0 looking down -z)
      float bend = smoothstep(0.0, 90.0, d);           // straight where we are, bending further in
      p.x += sin(d * 0.021 + uT * 0.35) * 7.0 * bend;
      p.y += cos(d * 0.016 - uT * 0.27) * 5.0 * bend;
      vZ = d;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`;

  const FRAG = `
    precision highp float;
    uniform float uT, uSpeed, uOpen, uExit;
    varying vec2 vUv;
    varying float vZ;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    void main() {
      float a = vUv.x * 6.28318;                       // around the wall
      float d = vZ;                                    // down the throat
      float flow = d * 0.012 - uT * uSpeed;            // everything streams toward the eye
      // quantum foam: two octaves of noise boiling on the wall
      float n = noise(vec2(a * 2.2, flow * 3.0)) * 0.6 + noise(vec2(a * 5.0 + uT * 0.4, flow * 7.0)) * 0.4;
      float foam = smoothstep(0.45, 0.95, n);
      // filaments: a twisted lattice of energy lines
      float lat = sin(a * 9.0 + d * 0.06 + uT * 1.7) * sin(d * 0.11 - uT * 5.0 * uSpeed + a * 2.0);
      float fil = pow(max(0.0, lat), 10.0);
      // rings of light pulled through the neck
      float ring = pow(1.0 - abs(fract(flow * 1.6) * 2.0 - 1.0), 14.0);
      float e = foam * 0.9 + fil * 1.6 + ring * 2.2;
      // depth: the wall dims with distance but never dies (the far side is lit), the last few metres by the eye fade
      float fog = mix(0.32, 1.0, exp(-d * 0.006)) * smoothstep(2.0, 14.0, d);
      vec3 deep = vec3(0.16, 0.04, 0.42);
      vec3 mid = vec3(0.22, 0.88, 1.0);
      vec3 hot = vec3(1.0, 0.96, 0.90);
      vec3 col = mix(deep, mid, clamp(e, 0.0, 1.0));
      col = mix(col, hot, clamp((e - 1.0) * 0.6, 0.0, 1.0));
      // the light of the other side, down the throat
      col += vec3(0.45, 0.75, 1.0) * smoothstep(140.0, 400.0, d) * 0.5;
      // the far mouth blooms white as we arrive
      col = mix(col, hot, uExit * smoothstep(60.0, 260.0, d));
      float alpha = clamp(e * 1.1 + 0.16, 0.0, 1.0) * fog * uOpen;
      gl_FragColor = vec4(col * alpha * 1.5, alpha);
    }`;

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
      uniforms: { uT: { value: 0 }, uSpeed: { value: 0.6 }, uOpen: { value: 0 }, uExit: { value: 0 } },
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
      uniforms: { uPr: { value: 1 }, uOp: { value: 0 } },
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
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.06, d) * vA * uOp;
          gl_FragColor = vec4(vec3(0.62, 0.91, 1.0) * a, a);
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

    cvs.addEventListener("webglcontextlost", (e) => { e.preventDefault(); B.fail = true; B.ready = false; }, false);
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
      const open = sm(0, 0.12, p);                       // the throat blooms
      const speed = 0.35 + sm(0.08, 0.6, p) * 2.4;       // then we fall faster and faster
      const exit = sm(0.84, 0.97, p);                    // the far mouth
      const u = tube.material.uniforms;
      u.uT.value = t; u.uSpeed.value = speed; u.uOpen.value = open * (1 - exit * 0.6); u.uExit.value = exit;

      // the eye: a slow roll and a drift, as if the fall had no floor
      cam.rotation.z = Math.sin(t * 0.31) * 0.22 + t * 0.05 * speed * 0.15;
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
