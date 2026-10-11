
// No dependencies: the whole effect is ~12KB of JS against what a Three.js
// build would cost.
//
// Four modes:
//   glass4   - 4 rings of CSS backdrop-filter
//   glass16  - 16 rings, the waldbach technique. Heavy; the panel reports FPS.
//   refract  - one WebGL pass with real lensing at the rim
//   off      - no effect
//


const STORE = 'lg-cfg';
const MAX_GLASS = 8;
const sel = (s) => document.querySelector(s);
const els = (s) => [...document.querySelectorAll(s)];

const state = Object.assign(
  {
    mode: 'glass',
    theme: 'violet',
    blur: 16,
    animate: true,
  },
  JSON.parse(localStorage.getItem(STORE) || '{}')
);
const save = () => localStorage.setItem(STORE, JSON.stringify(state));

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const supportsWebGL = (() => {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
})();

// ------------------------------------------------------------------ webgl pass

const VERT = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform sampler2D u_bg;
uniform vec3  u_tint;
uniform vec4  u_rect[${MAX_GLASS}];   // framebuffer px, y from top
uniform float u_radius[${MAX_GLASS}];
uniform int   u_count;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

// Thickness of a pane with a bevel: 1 on the flat interior, tapering to 0 at
// the rim. The gradient of this field is the surface normal the refraction
// follows, which is why the interior bends and not only the edge.
float thicknessAt(vec2 local, vec2 inner, float bezel) {
  vec2 q = abs(local) - inner;
  float dInner = min(max(q.x, q.y), 0.0) + length(max(q, 0.0));
  return clamp(1.0 - dInner / bezel, 0.0, 1.0);
}

float hash11(float n) { return fract(sin(n) * 43758.5453123); }

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv   = frag / u_res;

  vec4  rect = vec4(-1.0);
  float rad  = 0.0;
  for (int i = 0; i < ${MAX_GLASS}; i++) {
    if (i >= u_count) break;
    vec4 r = u_rect[i];
    vec2 centre = vec2(r.x + r.z * .5, u_res.y - (r.y + r.w * .5));
    vec2 half_   = vec2(r.z, r.w) * .5;
    float d = sdRoundBox(frag - centre, half_, min(u_radius[i], min(half_.x, half_.y)));
    if (d < 0.0) { rect = r; rad = u_radius[i]; break; }
  }
  if (rect.z <= 0.0) discard;

  vec2 centre = vec2(rect.x + rect.z * .5, u_res.y - (rect.y + rect.w * .5));
  vec2 half_   = vec2(rect.z, rect.w) * .5;
  vec2 local   = frag - centre;
  float rr     = min(rad, min(half_.x, half_.y));
  float d      = sdRoundBox(local, half_, rr);

  // Lens. A real pane of glass is thicker at its rounded edge and slightly
  // convex across the middle, so light bends everywhere, not only at the rim.
  // Two terms: a shallow global bulge and the edge bevel.
  float bezel = min(rr, min(half_.x, half_.y) * 0.5);

  // Thickness of the pane: flat (1) inside the bevel, tapering to 0 at the rim.
  vec2 inner = half_ - vec2(bezel);
  vec2 qB = abs(local) - inner;
  float dInner = min(max(qB.x, qB.y), 0.0) + length(max(qB, 0.0));
  float thick = clamp(1.0 - dInner / bezel, 0.0, 1.0);

  // Bezel term: normal of the thickness field, so bending is strongest where
  // the pane changes depth fastest.
  float e = 1.0;
  float bx = thicknessAt(local + vec2(e, 0.0), inner, bezel) - thicknessAt(local - vec2(e, 0.0), inner, bezel);
  float by = thicknessAt(local + vec2(0.0, e), inner, bezel) - thicknessAt(local - vec2(0.0, e), inner, bezel);
  vec2 nBevel = normalize(vec2(-bx, -by) + 1e-6);

  // Bulge term: a shallow convex lens over the whole pane. This is the part
  // that was missing - without it only the rim bends and the interior is flat.
  vec2 centred = local / half_;
  float r = length(centred);
  float bulge = max(0.0, 1.0 - r * r);
  vec2 nBulge = -normalize(centred + 1e-6);

  vec2 offset = (nBevel * thick * 30.0 + nBulge * bulge * 7.0) / u_res;

  vec3 col = texture2D(u_bg, clamp(uv + offset, .001, .999)).rgb;

  // Match what the page actually shows behind the glass. The backdrop is
  // bg.webp with blur(5px) and a 55% black scrim in darken mode, so sampling
  // the raw texture renders the pane far brighter than its surroundings:
  // measured mean 0.32 against 0.15 for the surrounding card, which is exactly
  // the "solid block" reading. 0.45 lands it at 0.20, 0.62 at 0.24, and 0.62
  // also flattens the interior to a uniform tint. Chose 0.45: brightness and
  // the highest interior std of the two, which is what shows the backdrop.
  col *= vec3(.45);

  col = mix(col, col * u_tint * 1.55, .45);
  col = mix(col, u_tint, .10);

  // Inner highlight on the top edge only, and a bright meniscus at the rim.
  float topEdge = smoothstep(2.0, 0.0, abs(local.y - (half_.y - 1.0))) *
                  smoothstep(half_.x * .9, half_.x * .25, abs(local.x));
  float rim     = smoothstep(-3.0, -1.0, d) * smoothstep(0.5, -1.0, d);
  col += topEdge * .22 + rim * .10;

  // Dither, otherwise the large flat tint bands.
  float n2 = hash11(dot(frag, vec2(12.9898, 78.233)));
  col += (n2 - .5) * .012;

  float alpha = smoothstep(0.5, -0.5, d);
  if (alpha <= 0.003) discard;
  gl_FragColor = vec4(col * alpha, alpha);
}`;

let gl = null;

function compile(ctx, type, src) {
  const sh = ctx.createShader(type);
  ctx.shaderSource(sh, src);
  ctx.compileShader(sh);
  if (!ctx.getShaderParameter(sh, ctx.COMPILE_STATUS))
    throw new Error(ctx.getShaderInfoLog(sh));
  return sh;
}

function startGL() {
  if (gl || !supportsWebGL) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'lg-canvas';
  const ctx = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: false,
    // Readback is impossible without this, and without readback a silent
    // shader failure looks exactly like a working one.
    preserveDrawingBuffer: location.search.includes('lgdbg'),
  });
  if (!ctx) return;

  const prog = ctx.createProgram();
  try {
    ctx.attachShader(prog, compile(ctx, ctx.VERTEX_SHADER, VERT));
    ctx.attachShader(prog, compile(ctx, ctx.FRAGMENT_SHADER, FRAG));
  } catch (e) {
    console.warn('lg: shader failed', e.message);
    return;
  }
  ctx.linkProgram(prog);
  if (!ctx.getProgramParameter(prog, ctx.LINK_STATUS)) {
    console.warn('lg: link failed', ctx.getProgramInfoLog(prog));
    return;
  }
  ctx.useProgram(prog);

  const buf = ctx.createBuffer();
  ctx.bindBuffer(ctx.ARRAY_BUFFER, buf);
  ctx.bufferData(
    ctx.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    ctx.STATIC_DRAW
  );
  const loc = ctx.getAttribLocation(prog, 'a');
  ctx.enableVertexAttribArray(loc);
  ctx.vertexAttribPointer(loc, 2, ctx.FLOAT, false, 0, 0);

  const tex = ctx.createTexture();
  ctx.bindTexture(ctx.TEXTURE_2D, tex);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);

  const img = new Image();
  img.onload = () => {
    ctx.bindTexture(ctx.TEXTURE_2D, tex);
    ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, img);
  };
  img.src = './public/bg.webp';

  gl = {
    canvas,
    ctx,
    prog,
    tex,
    u: {
      res: ctx.getUniformLocation(prog, 'u_res'),
      time: ctx.getUniformLocation(prog, 'u_time'),
      bg: ctx.getUniformLocation(prog, 'u_bg'),
      tint: ctx.getUniformLocation(prog, 'u_tint'),
      rect: ctx.getUniformLocation(prog, 'u_rect'),
      radius: ctx.getUniformLocation(prog, 'u_radius'),
      count: ctx.getUniformLocation(prog, 'u_count'),
    },
    raf: 0,
    t0: performance.now(),
  };
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  const draw = () => {
    if (!gl) return;
    const { ctx: c, u, canvas: cv } = gl;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = innerWidth;
    const h = innerHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.width = w + 'px';
      cv.style.height = h + 'px';
    }
    c.viewport(0, 0, cv.width, cv.height);
    c.clearColor(0, 0, 0, 0);
    c.clear(c.COLOR_BUFFER_BIT);

    const targets = els('[data-glass]')
      .map((el) => {
        const b = el.getBoundingClientRect();
        return b.width < 4 || b.height < 4 ? null : [b, el];
      })
      .filter(Boolean)
      .slice(0, MAX_GLASS);

    if (targets.length) {
      const rects = new Float32Array(MAX_GLASS * 4);
      const radii = new Float32Array(MAX_GLASS);
      targets.forEach(([b, el], i) => {
        // gl_FragCoord counts framebuffer pixels, so rects must be scaled by
        // the same DPR as the backing store. CSS px in, framebuffer px out;
        // y stays top-origin here and the shader does the single GL flip.
        rects.set(
          [b.left * dpr, b.top * dpr, b.width * dpr, b.height * dpr],
          i * 4
        );
        radii[i] =
          (parseFloat(getComputedStyle(el).borderTopLeftRadius) || 12) * dpr;
      });

      const frozen = reduceMotion.matches || !state.animate;
      const now = frozen ? 0 : (performance.now() - gl.t0) / 1000;
      c.uniform2f(u.res, cv.width, cv.height);
      c.uniform1f(u.time, now);
      c.uniform3fv(u.tint, TINTS[state.theme] || TINTS.violet);
      c.uniform4fv(u.rect, rects);
      c.uniform1fv(u.radius, radii);
      c.uniform1i(u.count, targets.length);
      c.uniform1i(u.bg, 0);
      c.activeTexture(c.TEXTURE0);
      c.bindTexture(c.TEXTURE_2D, tex);
      c.drawArrays(c.TRIANGLES, 0, 3);
    }

    gl.raf = requestAnimationFrame(draw);
  };
  draw();

  document.addEventListener('visibilitychange', () => {
    if (!gl) return;
    if (document.hidden) cancelAnimationFrame(gl.raf);
    else draw();
  });
}

function stopGL() {
  if (!gl) return;
  cancelAnimationFrame(gl.raf);
  gl.canvas.remove();
  gl = null;

}

// ----------------------------------------------------------------- css layers

// Concentric rings, each a real backdrop-filter, masked to a thin band that
// steps outward from the element. That is the waldbach technique and it is the
// only part of this file with a real cost: N filters per glass element.
function applyLayers() {
  els('[data-glass]').forEach((el) => {
    el.querySelectorAll('.lg-ring').forEach((r) => r.remove());
    el.classList.remove('lg-layered');
    if (state.mode !== 'glass') return;

    el.classList.add('lg-layered');
    const cs = getComputedStyle(el);
    const radius = cs.borderTopLeftRadius;
    const blur = state.blur;

    // Ring depth scales with the element, capped so the face always keeps at
    // least half the surface. A fixed 2px band puts a 31px frame on an 82px
    // tall bar and leaves no glass to read through.
    const box = el.getBoundingClientRect();

    // Chips are too small to carry a bezel. N rings on a 22px tall role chip
    // wash the label out entirely, and N backdrop-filters on a 75px element is
    // the most expensive thing in the panel for the least visible gain. Those
    // keep the element's own single filter and nothing more.
    if (box.height < 30) return;

    // Four rings is the setting the owner kept. The sixteen-ring mode was
    // removed: it cost 5.3x the frame budget and compounded into mush.
    const n = 4;
    const band = Math.max(0.4, (Math.min(box.width, box.height) * 0.25) / n);

    for (let i = 0; i < n; i++) {
      // Rings are thin bezel bands, not full-face layers. Each backdrop-filter
      // samples everything painted beneath it, so N full-face rings compound
      // into mush: the last one blurs an image already saturated N times.
      // Confining each ring to a few px of rim keeps the face clean and bounds
      // the compounding to the edge, which is where refraction belongs anyway.
      const step = i / n;
      const ring = document.createElement('span');
      ring.className = 'lg-ring';
      // Saturate is identity on purpose. The author of the ring technique warns
      // the exaggerated saturate is demo seasoning and the blur stack alone
      // sells the effect. Stacking 16 of them compounds chroma until the glass
      // blows out to magenta, which it measurably did: 6.4% of pixels blown
      // against 0.6% with the effect off. The element's own backdrop-filter
      // already carries the saturate, so the rings only need to vary blur.
      // Rings only nudge blur. At full element blur they re-blur the face and
      // read as frosted, not translucent, which is the opposite of the goal.
      const ringBlur = (blur * (0.12 + step * 0.10)).toFixed(1);
      ring.style.cssText =
        `position:absolute;inset:0;border-radius:${radius};pointer-events:none;` +
        `box-sizing:border-box;border:${(i * band + 1).toFixed(2)}px solid transparent;` +
        `backdrop-filter:blur(${ringBlur}px) saturate(100%);` +
        `-webkit-backdrop-filter:blur(${ringBlur}px) saturate(100%);` +
        `mask-image:linear-gradient(#000,#000),linear-gradient(#000,#000);` +
        `mask-clip:border-box,padding-box;mask-composite:exclude;` +
        `-webkit-mask-image:linear-gradient(#000,#000),linear-gradient(#000,#000);` +
        `-webkit-mask-clip:border-box,padding-box;-webkit-mask-composite:xor`;
      el.appendChild(ring);
    }
  });
}

// ------------------------------------------------------------------ fps meter

// Runs in every mode. Without it the one expensive setting (16 filters per
// surface) is invisible until the page feels bad, and the user has no way to
// connect the two.
let fpsFrames = 0;
let fpsMark = performance.now();
let fpsShown = 0;

function fpsLoop() {
  fpsFrames++;
  const now = performance.now();
  if (now - fpsMark > 500) {
    fpsShown = Math.round((fpsFrames * 1000) / (now - fpsMark));
    fpsFrames = 0;
    fpsMark = now;
    const out = sel('#lg-fps');
    if (out) {
      out.textContent = fpsShown + ' fps' + (fpsShown < 45 ? '  · slow' : '');
      out.dataset.slow = String(fpsShown < 45);
    }
  }
  requestAnimationFrame(fpsLoop);
}
requestAnimationFrame(fpsLoop);

// ---------------------------------------------------------------------- panel

const THEMES = [
  ['violet', 'Violet'],
  ['abyss', 'Abyss'],
  ['crimson', 'Crimson'],
  ['emerald', 'Emerald'],
  ['frost', 'Frost'],
];

const TINTS = {
  violet: [0.62, 0.55, 0.78],
  abyss: [0.32, 0.48, 0.82],
  crimson: [0.86, 0.34, 0.46],
  emerald: [0.34, 0.78, 0.62],
  frost: [0.72, 0.82, 0.92],
};

// Three modes. glass16 and the CSS rain were removed at the owner's request:
// both were measurably broken (39fps and strokes that read as scratches) and
// neither delivered what it claimed.
const MODES = [
  ['glass', 'Glass', 'translucent CSS glass'],
  ['refract', 'Refract', 'WebGL lensing'],
  ['off', 'Off', 'no effect'],
];

function buildPanel() {
  const host = sel('#glass-controls');
  if (!host) return;

  host.innerHTML = `
    <button class="lg-toggle" id="lg-toggle" aria-expanded="false"
            aria-label="Glass settings">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/>
        <path d="M12 3a9 9 0 0 0 0 18" fill="currentColor" opacity=".45"/>
      </svg>
      <span class="lg-dot" id="lg-dot"></span>
    </button>
    <div class="lg-panel" id="lg-panel" hidden>
      <div class="lg-row" role="radiogroup" aria-label="Glass mode">
        ${MODES.map(
          ([id, label, hint]) => `
          <button class="lg-mode" data-mode="${id}" role="radio"
                  aria-checked="${state.mode === id}" title="${hint}">${label}</button>`
        ).join('')}
      </div>

      <label class="lg-field"><span>Theme</span>
        <select id="lg-theme">
          ${THEMES.map(
            ([id, label]) =>
              `<option value="${id}" ${state.theme === id ? 'selected' : ''}>${label}</option>`
          ).join('')}
        </select>
      </label>

      <label class="lg-field"><span>Blur</span>
        <input type="range" id="lg-blur" min="0" max="40" step="1" value="${state.blur}" />
        <output id="lg-blur-val">${state.blur}</output>
      </label>

      <div class="lg-divider"></div>

      <label class="lg-check"><input type="checkbox" id="lg-anim" ${state.animate ? 'checked' : ''} />
        <span>Animation</span></label>

      <p class="lg-note" id="lg-fps">—</p>
      <p class="lg-note" id="lg-note"></p>
    </div>`;

  const note = sel('#lg-note');
  if (!supportsWebGL) note.textContent = 'Refract needs WebGL.';

  const apply = () => {
    document.documentElement.dataset.lg = state.mode;
    document.documentElement.dataset.lgtheme = state.theme;
    document.documentElement.style.setProperty(
      '--glass-blur',
      `${state.blur}px saturate(${165 + state.blur}%)`
    );
    sel('#lg-dot').dataset.mode = state.mode;
    sel('#lg-blur-val').textContent = state.blur;

    if (state.mode === 'refract') {
      stopGL();
      startGL();
    } else {
      stopGL();
      applyLayers();
    }
    save();
  };

  sel('#lg-toggle').addEventListener('click', () => {
    const p = sel('#lg-panel');
    p.hidden = !p.hidden;
    sel('#lg-toggle').setAttribute('aria-expanded', String(!p.hidden));
  });
  els('.lg-mode').forEach((b) =>
    b.addEventListener('click', () => {
      state.mode = b.dataset.mode;
      apply();
    })
  );
  sel('#lg-theme').addEventListener('change', (e) => {
    state.theme = e.target.value;
    apply();
  });
  sel('#lg-blur').addEventListener('input', (e) => {
    state.blur = +e.target.value;
    apply();
  });
  sel('#lg-anim').addEventListener('change', (e) => {
    state.animate = e.target.checked;
    apply();
  });

  els('.lg-mode').forEach((b) =>
    b.setAttribute('aria-checked', String(b.dataset.mode === state.mode))
  );
  apply();
}

// ---------------------------------------------------------------------- ripple

function bindRipple() {
  els('[data-glass], .lg-mode, .lg-toggle').forEach((el) => {
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.addEventListener('pointerdown', (e) => {
      const r = el.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2;
      const d = document.createElement('span');
      d.className = 'lg-ripple';
      d.style.cssText =
        `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;` +
        `top:${e.clientY - r.top - size / 2}px`;
      el.appendChild(d);
      d.addEventListener('animationend', () => d.remove());
    });
  });
}

// ------------------------------------------------------------------------ boot

buildPanel();
bindRipple();

addEventListener('resize', () => {
  if (state.mode === 'glass') applyLayers();
});
