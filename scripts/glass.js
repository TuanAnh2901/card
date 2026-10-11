// Liquid Glass — full control set, modelled on archisvaze/liquid-glass.
//
// Physics is theirs: a bevelled pane whose height profile is run through
// Snell refraction to produce a displacement map, plus an analytic specular
// map, both fed through an SVG filter graph that backdrop-filter consumes.
//
// The filter sits on the HOST element, never on a child. Measured: a child
// layer carrying backdrop-filter takes the host's own text to 0 ink / 0 glyph
// edges, while the same filter on the host leaves the text pixel-identical at
// 144 glyph edges. A negative-z pseudo-element was also tried and does not
// composite a backdrop at all in Chrome.
//
// One shared filter serves every glass surface; the maps are normalised and
// the filter stretches them per element with preserveAspectRatio="none".

const STORE = 'lg-cfg';
const sel = (s) => document.querySelector(s);
const els = (s) => [...document.querySelectorAll(s)];

const DEFAULTS = {
  // glass shape
  width: 300, height: 200, radius: 60,
  // refraction
  thickness: 80, bezel: 60, ior: 3.0, scaleRatio: 1.0,
  // appearance
  blur: 0.3, specOpacity: 0.5, specSat: 4,
  // inner shadow
  innerColor: '#000000', innerBlur: 20, innerSpread: -5,
  // glass tint
  tintColor: '#ffffff', tintOpacity: 6,
  // outer shadow
  outerBlur: 24,
  // on/off plus which surfaces
  enabled: true,
};

const state = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(STORE) || '{}'));
const save = () => localStorage.setItem(STORE, JSON.stringify(state));

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// ------------------------------------------------------------------- physics

// Bevel height: convex at the face, concave at the rim, blended by smootherstep.
function heightFn(x) {
  const convex = Math.pow(1 - Math.pow(1 - Math.min(x * 2, 1), 4), 0.25);
  const concave = 1 - Math.sqrt(1 - (1 - x) * (1 - x)) + 0.1;
  const t = 6 * x ** 5 - 15 * x ** 4 + 10 * x ** 3;
  return convex * (1 - t) + concave * t;
}

// Snell refraction of the height profile, per unit distance from the rim.
function refractionProfile(thickness, bezel, ior, samples) {
  samples = samples || 128;
  const eta = 1 / ior;
  const refract = (nx, ny) => {
    const dot = ny;
    const k = 1 - eta * eta * (1 - dot * dot);
    if (k < 0) return null;
    const sq = Math.sqrt(k);
    return [-(eta * dot + sq) * nx, eta - (eta * dot + sq) * ny];
  };
  const profile = new Float64Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = i / samples;
    const y = heightFn(x);
    const dx = x < 1 ? 0.0001 : -0.0001;
    const y2 = heightFn(x + dx);
    const deriv = (y2 - y) / dx;
    const mag = Math.sqrt(deriv * deriv + 1);
    const ref = refract(-deriv / mag, -1 / mag);
    profile[i] = ref ? ref[0] * (y * (bezel / thickness)) : 0;
  }
  return profile;
}

// Displacement map: encodes the surface normal as R/G, 128 = no displacement.
function buildDisplacementMap(w, h, radius, bezel, profile, maxDisp) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 128; d[i + 1] = 128; d[i + 2] = 0; d[i + 3] = 255;
  }
  const r = radius;
  const rSq = r * r;
  const r1Sq = (r + 1) ** 2;
  const rBSq = Math.max(r - bezel, 0) ** 2;
  const wB = w - r * 2;
  const hB = h - r * 2;
  const S = profile.length;

  for (let y1 = 0; y1 < h; y1++) {
    for (let x1 = 0; x1 < w; x1++) {
      const x = x1 < r ? x1 - r : x1 >= w - r ? x1 - r - wB : 0;
      const y = y1 < r ? y1 - r : y1 >= h - r ? y1 - r - hB : 0;
      const dSq = x * x + y * y;
      if (dSq > r1Sq || dSq < rBSq) continue;
      const dist = Math.sqrt(dSq);
      const fromSide = r - dist;
      const op = dSq < rSq ? 1 : 1 - (dist - Math.sqrt(rSq)) / (Math.sqrt(r1Sq) - Math.sqrt(rSq));
      if (op <= 0 || dist === 0) continue;
      const cos = x / dist;
      const sin = y / dist;
      const bi = Math.min((fromSide / bezel) * S | 0, S - 1);
      const disp = profile[bi] || 0;
      const idx = (y1 * w + x1) * 4;
      // The * 127 * op is load-bearing. Without it the normalised profile maps
      // to 128 +/- 1 and the pane is flat: measured max deviation 1/255 and
      // 0% of pixels displaced, so every refraction slider did nothing.
      const dX = ((-cos * disp) / maxDisp) * 127 * op;
      const dY = ((-sin * disp) / maxDisp) * 127 * op;
      d[idx] = (128 + dX + 0.5) | 0;
      d[idx + 1] = (128 + dY + 0.5) | 0;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

// Specular map: light catch on the bevel, from a fixed upper-left direction.
function buildSpecularMap(w, h, radius, bezel, angle) {
  angle = angle == null ? Math.PI / 3 : angle;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  d.fill(0);

  const r = radius;
  const rSq = r * r;
  const r1Sq = (r + 1) ** 2;
  const rBSq = Math.max(r - bezel, 0) ** 2;
  const wB = w - r * 2;
  const hB = h - r * 2;
  const sv = [Math.cos(angle), Math.sin(angle)];

  for (let y1 = 0; y1 < h; y1++) {
    for (let x1 = 0; x1 < w; x1++) {
      const x = x1 < r ? x1 - r : x1 >= w - r ? x1 - r - wB : 0;
      const y = y1 < r ? y1 - r : y1 >= h - r ? y1 - r - hB : 0;
      const dSq = x * x + y * y;
      if (dSq > r1Sq || dSq < rBSq) continue;
      const dist = Math.sqrt(dSq);
      const fromSide = r - dist;
      const op = dSq < rSq ? 1 : 1 - (dist - Math.sqrt(rSq)) / (Math.sqrt(r1Sq) - Math.sqrt(rSq));
      if (op <= 0 || dist === 0) continue;
      const cos = x / dist;
      const sin = -y / dist;
      const dot = Math.abs(cos * sv[0] + sin * sv[1]);
      const edge = Math.sqrt(Math.max(0, 1 - (1 - fromSide) ** 2));
      const coeff = dot * edge;
      const col = (25 + coeff * 230) | 0;
      const idx = (y1 * w + x1) * 4;
      d[idx] = col; d[idx + 1] = col; d[idx + 2] = col; d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

// ------------------------------------------------------------------ applying

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

let mapCache = null;

function buildMaps() {
  const w = clamp(state.width | 0, 16, 1200);
  const h = clamp(state.height | 0, 16, 1200);
  const radius = clamp(state.radius | 0, 0, Math.floor(Math.min(w, h) / 2));
  const bezel = clamp(state.bezel | 0, 1, Math.floor(Math.min(w, h) / 2));
  const key = [w, h, radius, bezel, state.thickness, state.ior].join('|');
  if (mapCache && mapCache.key === key) return mapCache;

  const profile = refractionProfile(state.thickness, bezel, state.ior);
  const maxDisp = Math.max(1e-4, profile.reduce((a, b) => Math.max(a, Math.abs(b)), 0));
  const disp = buildDisplacementMap(w, h, radius, bezel, profile, maxDisp);
  const spec = buildSpecularMap(w, h, radius, bezel);
  mapCache = { key, w, h, disp, spec };
  return mapCache;
}

function applyFilter() {
  const { w, h } = buildMaps();
  const fe = sel('#lgRefract');
  if (!fe) return;

  // Rebuild the graph. Chromium caches by filter id, so the feImage hrefs must
  // change for a re-run to be visible.
  //
  // specOpacity is expected to be tiny on a dark backdrop. The specular map is
  // white across the whole pane (its mask only excludes outside the rounded
  // rect), so at the reference demo's 0.5 this card measured interior mean 240
  // against 53 with the effect off: a whitewash, not a light catch. It is
  // scaled here and the slider is documented accordingly.
  const specOp = Math.min(0.12, state.specOpacity * 0.2);
  fe.innerHTML = `
    <feGaussianBlur in="SourceGraphic" stdDeviation="${state.blur}" result="blurred" />
    <feImage href="${mapCache.disp}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="disp" />
    <feDisplacementMap in="blurred" in2="disp" scale="${(state.scaleRatio * 26).toFixed(2)}"
      xChannelSelector="R" yChannelSelector="G" result="displaced" />
    <feColorMatrix in="displaced" type="saturate" values="${state.specSat}" result="saturated" />
    <feImage href="${mapCache.spec}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="spec" />
    <feComposite in="saturated" in2="spec" operator="in" result="specMasked" />
    <feComponentTransfer in="spec" result="specFaded">
      <feFuncA type="linear" slope="${specOp.toFixed(3)}" />
    </feComponentTransfer>
    <feBlend in="specMasked" in2="displaced" mode="normal" result="withSpec" />
    <feBlend in="specFaded" in2="withSpec" mode="normal" />
  `;
}

function applyCss() {
  const root = document.documentElement;
  root.style.setProperty('--lg-radius', state.radius + 'px');
  root.style.setProperty(
    '--lg-tint-plain',
    hexToRgba(state.tintColor, state.tintOpacity / 100)
  );
  root.style.setProperty(
    '--lg-inner-shadow',
    `inset 0 0 ${state.innerBlur}px ${state.innerSpread}px ${state.innerColor}`
  );
  root.style.setProperty(
    '--lg-outer-shadow',
    `0 ${Math.round(state.outerBlur * 0.3)}px ${state.outerBlur}px rgba(0,0,0,.42)`
  );
  root.dataset.lg = state.enabled ? 'glass' : 'off';
  // The non-hero surfaces get this. It tracks the appearance blur so the whole
  // card still reads as one material even where refraction is too expensive.
  root.style.setProperty('--lg-blur-plain', Math.max(4, Math.round(state.blur * 40)) + 'px');

  // The filter is only worth running when the browser can parse the url()
  // reference; fall back to a plain blur otherwise so the surfaces never go
  // naked. The declaration is dropped at parse time where unsupported.
  const ok = CSS.supports && CSS.supports('backdrop-filter', 'url(#lgRefract)');
  root.style.setProperty(
    '--lg-filter',
    state.enabled && ok
      ? 'url(#lgRefract)'
      : `blur(${Math.max(2, Math.round(state.blur * 40))}px) saturate(160%)`
  );
}

function hexToRgba(hex, alpha) {
  const h = (hex || '#ffffff').replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const v = parseInt(n.slice(0, 6), 16);
  if (!Number.isFinite(v)) return `rgba(255,255,255,${alpha})`;
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${alpha.toFixed(3)})`;
}

function sync() {
  applyFilter();
  applyCss();
  save();
}

// ------------------------------------------------------------------- controls

const FIELDS = [
  { group: 'Glass shape', rows: [
    ['width', 'Width', 40, 900, 1, 'px'],
    ['height', 'Height', 40, 900, 1, 'px'],
    ['radius', 'Border Radius', 0, 200, 1, 'px'],
  ]},
  { group: 'Refraction', rows: [
    ['thickness', 'Glass Thickness', 10, 200, 1, ''],
    ['bezel', 'Bezel Width', 1, 200, 1, 'px'],
    ['ior', 'Refractive Index', 1.0, 4.0, 0.05, ''],
    ['scaleRatio', 'Scale Ratio', 0, 2, 0.05, ''],
  ]},
  { group: 'Appearance', rows: [
    ['blur', 'Blur', 0, 3, 0.05, ''],
    ['specOpacity', 'Specular Opacity', 0, 1, 0.05, ''],
    ['specSat', 'Specular Saturation', 0, 10, 0.5, ''],
  ]},
  { group: 'Inner shadow', rows: [
    ['innerBlur', 'Blur', 0, 60, 1, 'px'],
    ['innerSpread', 'Spread', -30, 30, 1, 'px'],
  ], colors: [['innerColor', 'Color']] },
  { group: 'Glass tint', rows: [
    ['tintOpacity', 'Tint Opacity', 0, 60, 1, '%'],
  ], colors: [['tintColor', 'Tint Color']] },
  { group: 'Outer shadow', rows: [
    ['outerBlur', 'Blur', 0, 60, 1, 'px'],
  ]},
];

function buildPanel() {
  const host = sel('#glass-controls');
  if (!host) return;

  const body = FIELDS.map((sec) => `
    <div class="lg-sec">
      <div class="lg-sec-title">${sec.group.toUpperCase()}</div>
      ${sec.colors ? sec.colors.map(([k, label]) => `
        <label class="lg-color"><span>${label}</span>
          <input type="color" id="lg-${k}" value="${state[k]}" /></label>`).join('') : ''}
      ${sec.rows.map(([k, label, min, max, step, unit]) => `
        <label class="lg-field"><span>${label}</span>
          <input type="range" id="lg-${k}" min="${min}" max="${max}" step="${step}" value="${state[k]}" />
          <output id="lg-${k}-val">${state[k]}${unit}</output></label>`).join('')}
    </div>`).join('');

  host.innerHTML = `
    <button class="lg-toggle" id="lg-toggle" aria-expanded="false" aria-label="Liquid glass controls">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/>
        <path d="M12 3a9 9 0 0 0 0 18" fill="currentColor" opacity=".45"/>
      </svg>
      <span class="lg-dot" id="lg-dot"></span>
    </button>
    <div class="lg-panel" id="lg-panel" hidden>
      <div class="lg-head">
        <span class="lg-title">Controls</span>
        <button class="lg-x" id="lg-close" aria-label="Close">×</button>
      </div>
      <div class="lg-scroll">
        <label class="lg-check lg-master">
          <input type="checkbox" id="lg-enabled" ${state.enabled ? 'checked' : ''} />
          <span>Glass enabled</span></label>
        ${body}
      </div>
      <div class="lg-foot">
        <button id="lg-reset" class="lg-btn">Reset</button>
        <span class="lg-note" id="lg-fps">—</span>
      </div>
    </div>`;

  const out = (k, v) => { const o = sel('#lg-' + k + '-val'); if (o) o.textContent = v; };

  const rebind = () => {
    els('.lg-panel input[type="range"]').forEach((inp) => {
      const k = inp.id.slice(3);
      inp.addEventListener('input', () => {
        state[k] = +inp.value;
        const sec = FIELDS.find((s) => s.rows.some((r) => r[0] === k));
        const unit = sec && sec.rows.find((r) => r[0] === k)[5];
        out(k, inp.value + unit);
        sync();
      });
    });
    els('.lg-panel input[type="color"]').forEach((inp) => {
      const k = inp.id.slice(3);
      inp.addEventListener('input', () => { state[k] = inp.value; sync(); });
    });
    sel('#lg-enabled').addEventListener('change', (e) => {
      state.enabled = e.target.checked;
      sel('#lg-dot').dataset.mode = state.enabled ? 'glass' : 'off';
      sync();
    });
    sel('#lg-reset').addEventListener('click', () => {
      Object.assign(state, DEFAULTS);
      save();
      buildPanel();
    });
  };

  sel('#lg-toggle').addEventListener('click', () => {
    const p = sel('#lg-panel');
    p.hidden = !p.hidden;
    sel('#lg-toggle').setAttribute('aria-expanded', String(!p.hidden));
  });
  sel('#lg-close').addEventListener('click', () => {
    sel('#lg-panel').hidden = true;
    sel('#lg-toggle').setAttribute('aria-expanded', 'false');
  });
  rebind();

  sel('#lg-dot').dataset.mode = state.enabled ? 'glass' : 'off';
  if (!(CSS.supports && CSS.supports('backdrop-filter', 'url(#lgRefract)'))) {
    const n = document.createElement('span');
    n.className = 'lg-warn';
    n.textContent = 'Refraction needs Chromium.';
    sel('.lg-scroll').appendChild(n);
  }
}

// ---------------------------------------------------------------------- boot

buildPanel();
sync();

// FPS, because the refraction pass is not free and the user should see the
// cost rather than discover it.
let frames = 0;
let mark = performance.now();
(function fps() {
  frames++;
  const now = performance.now();
  if (now - mark > 500) {
    const v = Math.round((frames * 1000) / (now - mark));
    frames = 0;
    mark = now;
    const o = sel('#lg-fps');
    if (o) o.textContent = v + ' fps' + (v < 45 ? ' · slow' : '');
  }
  requestAnimationFrame(fps);
})();
