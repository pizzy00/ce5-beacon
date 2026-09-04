/* CE-5 Beacon · the Earth on the graphics chip (09-04, behind a setting, off by default).
   The same recipe as renderGlobe in the console (orthographic disc, tilt then spin, Lambert with a soft terminator,
   ocean sheen on blue texels, city lights past the terminator, clouds on their own rotation, a blue rim and a faint
   haze, an analytic limb) written once as a fragment shader, so the two globes match to a few levels. Everything the
   console draws over the disc keeps using orthPt, which is the same projection. Context loss or a thrown draw sets
   fail and the console goes back to the drawn globe on its own. */
window.EARTHGL = (() => {
  const G = { ready: false, fail: false, ms: 0, buf: 0, why: "" };
  let cv = null, gl = null, prog = null, U = {}, quad = null;
  const texes = (typeof WeakMap === "function") ? new WeakMap() : null;
  const VS = "attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }";
  const FS = [
    "precision highp float;",
    "uniform sampler2D uDay, uNight, uCloud;",
    "uniform float uC, uInv, uSp, uCp, uRotU, uCldU, uCloudAmt, uNightAmt, uRimK, uSpecK, uHasNight, uHasCloud;",
    "uniform vec3 uSun, uHalf;",
    "const float PI = 3.14159265358979; const float TAU = 6.28318530717959;",
    "float sm(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }",
    "void main() {",
    "  float nx = (gl_FragCoord.x - uC) * uInv, ny = (gl_FragCoord.y - uC) * uInv;",
    "  float r2 = nx * nx + ny * ny, rr = sqrt(r2);",
    "  float cov = clamp((1.0 - rr) * uC + 0.5, 0.0, 1.0);",
    "  if (cov <= 0.0) discard;",
    "  vec2 vn = vec2(nx, ny); float nz;",
    "  if (r2 >= 1.0) { vn /= rr; nz = 0.0; } else nz = sqrt(1.0 - r2);",
    "  float s = clamp(vn.y * uCp + nz * uSp, -1.0, 1.0);",
    "  float v = 0.5 - asin(s) / PI;",
    "  float u = (atan(vn.x, nz * uCp - vn.y * uSp) + PI) / TAU;",
    "  vec3 n3 = vec3(vn, nz);",
    "  float lam = dot(uSun, n3);",
    "  float t = sm(-0.055, 0.055, lam), d = max(lam, 0.0);",
    "  float sh = 0.055 + 0.945 * t * (0.38 + 0.62 * pow(d, 0.55));",
    "  float nf = (1.0 - sm(-0.11, 0.05, lam)) * uNightAmt;",
    "  float atm = sm(-0.42, 0.95, lam);",
    "  vec2 uv = vec2(fract(u + uRotU), v);",
    "  vec3 col = texture2D(uDay, uv).rgb * 255.0;",
    "  if (uSpecK > 0.0 && col.b > col.r + 16.0 && col.b > col.g + 6.0 && lam > 0.0) {",
    "    float ndh = dot(uHalf, n3);",
    "    if (ndh > 0.5) { float sp = pow(ndh, 48.0) * uSpecK; col += vec3(sp, sp * 1.02, sp * 1.05); }",
    "  }",
    "  col *= sh;",
    "  if (uHasNight > 0.5 && nf > 0.004) col += texture2D(uNight, uv).rgb * 255.0 * nf;",
    "  if (uHasCloud > 0.5 && uCloudAmt > 0.0) {",
    "    vec4 ct = texture2D(uCloud, vec2(fract(u + uCldU), v));",
    "    float caf = (ct.a > 0.999 ? ct.r : ct.a) * uCloudAmt;",
    "    if (caf > 0.004) { float cs = sh * 255.0, im = 1.0 - caf; col = vec3(col.r * im + cs * caf, col.g * im + cs * caf, col.b * im + cs * 1.04 * caf); }",
    "  }",
    "  float e = 1.0 - nz, e2 = e * e, e4 = e2 * e2, rim = e4 * e4;",
    "  if (rim > 0.002) { float ra = rim * uRimK * (0.10 + 1.05 * atm); col += vec3(70.0, 190.0, 255.0) * ra; }",
    "  float haze = e2 * 0.11 * sh; col += vec3(34.0, 92.0, 150.0) * haze;",
    "  col = clamp(col / 255.0, 0.0, 1.0);",
    "  gl_FragColor = vec4(col * cov, cov);",
    "}"
  ].join("\n");
  const fail = (why) => { G.fail = true; G.ready = false; G.why = why || "fail"; };
  function shader(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("shader: " + gl.getShaderInfoLog(s));
    return s;
  }
  function init() {
    if (G.ready || G.fail) return G.ready;
    try {
      cv = document.createElement("canvas"); cv.width = cv.height = 64;
      const opts = { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false, depth: false, stencil: false, powerPreference: "high-performance" };
      gl = cv.getContext("webgl", opts) || cv.getContext("experimental-webgl", opts);
      if (!gl) { fail("no webgl"); return false; }
      cv.addEventListener("webglcontextlost", (e) => { e.preventDefault(); fail("context lost"); }, false);
      prog = gl.createProgram();
      gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link: " + gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const p = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(p); gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
      for (const k of ["uDay", "uNight", "uCloud", "uC", "uInv", "uSp", "uCp", "uRotU", "uCldU", "uCloudAmt", "uNightAmt", "uRimK", "uSpecK", "uHasNight", "uHasCloud", "uSun", "uHalf"]) U[k] = gl.getUniformLocation(prog, k);
      gl.uniform1i(U.uDay, 0); gl.uniform1i(U.uNight, 1); gl.uniform1i(U.uCloud, 2);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      G.ready = true; return true;
    } catch (e) { fail(String(e && e.message || e)); return false; }
  }
  const pot = (n) => n > 0 && (n & (n - 1)) === 0;
  function texOf(src) {                                          // one GL texture per source canvas, re-uploaded when the canvas is redrawn (ver)
    if (!src) return null;
    let e = texes ? texes.get(src) : (src.__glTex || null);
    const ver = src.__ver || 0;
    if (e && e.w === src.width && e.h === src.height && e.ver === ver) return e.t;
    const t = e ? e.t : gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    const mip = pot(src.width) && pot(src.height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, mip ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (mip) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
    else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    e = { t, w: src.width, h: src.height, ver };
    if (texes) texes.set(src, e); else src.__glTex = e;
    return t;
  }
  /* opt = { tex, night, clouds, R, dpr, rot, tilt, sun, cloudRot, cloudAmt, nightAmt, rimAmt, spec } · the same names renderGlobe takes */
  G.draw = (opt) => {
    if (G.fail || !opt || !opt.tex) return null;
    if (!G.ready && !init()) return null;
    try {
      const t0 = performance.now();
      const ow = Math.max(2, Math.round(2 * opt.R * (opt.dpr || 1))), size = Math.min(2048, ow);
      if (cv.width !== size) { cv.width = cv.height = size; }
      gl.viewport(0, 0, size, size);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texOf(opt.tex));
      const nt = opt.night ? texOf(opt.night) : null, ct = opt.clouds ? texOf(opt.clouds) : null;
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, nt || texOf(opt.tex));
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, ct || texOf(opt.tex));
      const s = opt.sun || { x: -0.55, y: 0.32, z: 0.77 }, sl = Math.hypot(s.x, s.y, s.z) || 1;
      const sx = s.x / sl, sy = s.y / sl, sz = s.z / sl;
      let hx = sx, hy = sy, hz = sz + 1; const hl = Math.hypot(hx, hy, hz) || 1; hx /= hl; hy /= hl; hz /= hl;
      const rot = opt.rot || 0, tilt = opt.tilt || 0, p0 = tilt * Math.PI / 180;
      const cloudRot = opt.cloudRot === undefined ? rot : opt.cloudRot;
      gl.uniform1f(U.uC, size / 2); gl.uniform1f(U.uInv, 2 / size);
      gl.uniform1f(U.uSp, Math.sin(p0)); gl.uniform1f(U.uCp, Math.cos(p0));
      gl.uniform1f(U.uRotU, (((-rot / 360) % 1) + 1) % 1); gl.uniform1f(U.uCldU, (((-cloudRot / 360) % 1) + 1) % 1);
      gl.uniform1f(U.uCloudAmt, ct ? (opt.cloudAmt === undefined ? 1 : opt.cloudAmt) : 0);
      gl.uniform1f(U.uNightAmt, opt.nightAmt === undefined ? 1 : opt.nightAmt);
      gl.uniform1f(U.uRimK, (opt.rimAmt === undefined ? 1 : opt.rimAmt) * (1 + 0.95 * (sz < 0 ? -sz : 0)));
      gl.uniform1f(U.uSpecK, opt.spec === false ? 0 : 0.34 * 255);
      gl.uniform1f(U.uHasNight, nt ? 1 : 0); gl.uniform1f(U.uHasCloud, ct ? 1 : 0);
      gl.uniform3f(U.uSun, sx, sy, sz); gl.uniform3f(U.uHalf, hx, hy, hz);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (gl.isContextLost()) { fail("context lost"); return null; }
      G.ms = performance.now() - t0; G.buf = size;
      return cv;
    } catch (e) { fail(String(e && e.message || e)); return null; }
  };
  G.canvas = () => cv;
  return G;
})();
