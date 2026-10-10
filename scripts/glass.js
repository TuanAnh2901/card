// Liquid Glass + Rain. Raw WebGL for refraction, layered CSS for the rest.
// No dependencies: the whole effect is ~12KB of JS against what a Three.js
// build would cost.
//
// Four modes:
//   glass4   - 4 rings of CSS backdrop-filter
//   glass16  - 16 rings, the waldbach technique. Heavy; the panel reports FPS.
//   refract  - one WebGL pass with real lensing at the rim
//   off      - no effect
//
// Options: theme, blur, layer count, rain on/off, rain intensity, animation.

const STORE = 'lg-cfg';
const MAX_GLASS = 8;
const MAX_LAYERS = 16;
const sel = (s) => document.querySelector(s);
const els = (s) => [...document.querySelectorAll(s)];

const state = Object.assign(
  {
    mode: 'glass4',
    theme: 'violet',
    blur: 16,
    layers: 4,
    rain: true,
    rainAmt: 0.6,
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
uniform float u_rain;
uniform float u_rainAmt;
uniform vec3  u_tint;
uniform vec4  u_rect[${MAX_GLASS}];   // framebuffer px, y from top
uniform float u_radius[${MAX_GLASS}];
uniform int   u_count;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
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

  // Rim lensing: strongest right at the edge, gone by the time we are inside.
  float t = smoothstep(0.0, rr * .55, -d);
  float e = 1.6;
  vec2 n = normalize(vec2(
    sdRoundBox(local + vec2(e, 0.0), half_, rr) - sdRoundBox(local - vec2(e, 0.0), half_, rr),
    sdRoundBox(local + vec2(0.0, e), half_, rr) - sdRoundBox(local - vec2(0.0, e), half_, rr)
  ) + 1e-6);

  vec2 offset = n * (1.0 - t) * 26.0 / u_res;

  // Rain: falling streaks plus beads that slide down the inside face.
  float wet = 0.0;
  if (u_rain > .5) {
    float col = floor((local.x + half_.x) / 13.0);
    float seed = hash11(col);
    float speed = .30 + seed * .75;
    float phase = fract(u_time * speed * .35 + seed);
    float streakX = fract((local.x + half_.x) / 13.0) - .5;
    float fall = fract((local.y + half_.y) / (half_.y * 2.0) + phase);
    float band = smoothstep(.055, 0.0, abs(streakX)) *
                 smoothstep(.0, .12, fall) * smoothstep(.95, .45, fall);
    float bead = smoothstep(.10, 0.0, length(vec2(streakX * 13.0, (fall - .62) * half_.y * 1.4)));

    offset += vec2(streakX * 5.0, 0.0) * (band * .8 + bead * 1.4) / u_res;
    wet = clamp(band * .55 + bead * .9, 0.0, 1.0) * u_rainAmt;
  }

  vec3 col = texture2D(u_bg, clamp(uv + offset, .001, .999)).rgb;
  col = mix(col, col * u_tint * 1.55, .45);
  col = mix(col, u_tint, .10 + wet * .07);

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
      rain: ctx.getUniformLocation(prog, 'u_rain'),
      rainAmt: ctx.getUniformLocation(prog, 'u_rainAmt'),
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
      c.uniform1f(u.rain, state.rain && !frozen ? 1 : 0);
      c.uniform1f(u.rainAmt, state.rainAmt);
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
    if (state.mode !== 'glass4' && state.mode !== 'glass16') return;

    el.classList.add('lg-layered');
    const n = state.mode === 'glass16' ? MAX_LAYERS : Math.max(2, state.layers);
    const cs = getComputedStyle(el);
    const radius = cs.borderTopLeftRadius;
    const blur = state.blur;

    for (let i = 0; i < n; i++) {
      // Outer rings blur more, which is what reads as refraction at a bezel.
      const step = i / n;
      const ring = document.createElement('span');
      ring.className = 'lg-ring';
      ring.style.cssText =
        `position:absolute;inset:${-step * 10}px;border-radius:${radius};` +
        `pointer-events:none;` +
        `-webkit-backdrop-filter:blur(${(blur * (0.35 + step * 0.9)).toFixed(1)}px) ` +
        `saturate(${(165 + step * 120).toFixed(0)}%);` +
        `backdrop-filter:blur(${(blur * (0.35 + step * 0.9)).toFixed(1)}px) ` +
        `saturate(${(165 + step * 120).toFixed(0)}%);` +
        `-webkit-mask-image:radial-gradient(closest-side, transparent ${(step * 100).toFixed(0)}%, ` +
        `#000 ${(step * 100 + 100 / n).toFixed(0)}%);` +
        `mask-image:radial-gradient(closest-side, transparent ${(step * 100).toFixed(0)}%, ` +
        `#000 ${(step * 100 + 100 / n).toFixed(0)}%)`;
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

const MODES = [
  ['glass4', 'Glass 4', '4 CSS rings'],
  ['glass16', 'Glass 16', '16 rings, heavy'],
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

      <label class="lg-field" id="lg-layers-row"><span>Layers</span>
        <input type="range" id="lg-layers" min="2" max="16" step="1" value="${state.layers}" />
        <output id="lg-layers-val">${state.layers}</output>
      </label>

      <div class="lg-divider"></div>

      <label class="lg-check"><input type="checkbox" id="lg-rain" ${state.rain ? 'checked' : ''} />
        <span>Rain</span></label>
      <label class="lg-field" id="lg-rain-amt-row"><span>Amount</span>
        <input type="range" id="lg-rain-amt" min="0" max="1" step="0.05" value="${state.rainAmt}" />
        <output id="lg-rain-amt-val">${state.rainAmt}</output>
      </label>

      <label class="lg-check"><input type="checkbox" id="lg-anim" ${state.animate ? 'checked' : ''} />
        <span>Animation</span></label>

      <p class="lg-note" id="lg-fps">—</p>
      <p class="lg-note" id="lg-note"></p>
    </div>`;

  const note = sel('#lg-note');
  let warn = '';
  if (!supportsWebGL) warn = 'Refract needs WebGL.';
  else if (state.mode === 'glass16') warn = '16 filters per surface. FPS above.';
  if (warn) note.textContent = warn;
  const lr = sel('#lg-layers-row');
  if (state.mode === 'glass16') lr.style.display = 'none';
  const rr = sel('#lg-rain-amt-row');
  if (!state.rain) rr.style.display = 'none';

  const apply = () => {
    document.documentElement.dataset.lg = state.mode;
    document.documentElement.dataset.lgtheme = state.theme;
    document.documentElement.style.setProperty(
      '--glass-blur',
      `${state.blur}px saturate(${165 + state.blur}%)`
    );
    sel('#lg-dot').dataset.mode = state.mode;
    sel('#lg-layers-row').style.display = state.mode === 'glass16' ? 'none' : '';
    sel('#lg-rain-amt-row').style.display = state.rain ? '' : 'none';
    sel('#lg-blur-val').textContent = state.blur;
    sel('#lg-layers-val').textContent = state.layers;
    sel('#lg-rain-amt-val').textContent = state.rainAmt;

    els('.lg-mode').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.mode === state.mode))
    );
    sel('#lg-theme').value = state.theme;

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
  sel('#lg-layers').addEventListener('input', (e) => {
    state.layers = +e.target.value;
    apply();
  });
  sel('#lg-rain').addEventListener('change', (e) => {
    state.rain = e.target.checked;
    apply();
  });
  sel('#lg-rain-amt').addEventListener('input', (e) => {
    state.rainAmt = +e.target.value;
    sel('#lg-rain-amt-val').textContent = state.rainAmt;
    save();
  });
  sel('#lg-anim').addEventListener('change', (e) => {
    state.animate = e.target.checked;
    apply();
  });

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

// 16 filters per surface is the one setting that can make the page feel bad.
// Report it rather than letting the user discover it by accident.
addEventListener('resize', () => {
  if (state.mode === 'glass4' || state.mode === 'glass16') applyLayers();
});
