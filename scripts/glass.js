// Liquid Glass. No WebGL any more: a fixed full-viewport canvas can never sit
// behind specific DOM text while staying above that text's own background, so
// refract-as-overlay was unfixable. See docs/superpowers/specs/2026-10-10-liquidglass-council.md
//
// Two modes: glass and off. Options: theme, blur, animation.
//
// The refraction lives in CSS on a ::after at z-index:-1, which the parent
// measurement showed keeps its own text pixel-identical. Chromium gets real
// feDisplacementMap lensing through backdrop-filter:url(#lgRefract); everyone
// else falls back to plain blur, because the url() declaration is dropped at
// parse time where unsupported and the preceding blur() still stands.

const STORE = 'lg-cfg';
const sel = (s) => document.querySelector(s);
const els = (s) => [...document.querySelectorAll(s)];

const state = Object.assign(
  { mode: 'glass', theme: 'violet', blur: 14, animate: true },
  JSON.parse(localStorage.getItem(STORE) || '{}')
);
const save = () => localStorage.setItem(STORE, JSON.stringify(state));

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// ------------------------------------------------------------- displacement map

// One radial map, stretched to each element's box by the filter's
// preserveAspectRatio="none". Encoding the outward surface normal: 128 is no
// displacement, and the rim reads as a lens because it reaches ~158 toward the
// edge. A single shared map keeps generation off the resize path.
function buildDisplacementMap() {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 128;
    d[i + 1] = 128;
    d[i + 2] = 0;
    d[i + 3] = 255;
  }
  const R = S / 2;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x - R;
      const dy = y - R;
      const dist = Math.hypot(dx, dy);
      if (dist > R || dist < 1) continue;
      // 0 at the centre, 1 at the rim: the bevel profile of the pane.
      const k = 1 - dist / R;
      const mag = k * k * 34;
      const i = (y * S + x) * 4;
      d[i] = Math.max(0, Math.min(255, Math.round(128 - (dx / dist) * mag)));
      d[i + 1] = Math.max(0, Math.min(255, Math.round(128 - (dy / dist) * mag)));
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = c.toDataURL();
  const fe = sel('#lgDisp');
  if (!fe) return null;
  fe.setAttribute('href', url);
  fe.setAttribute('xlink:href', url);
  // Chromium-only support check, used only to label the control panel.
  return CSS.supports('backdrop-filter', 'url(#lgRefract)') ? 'refract' : 'blur';
}

// ---------------------------------------------------------------------- panel

const THEMES = [
  ['violet', 'Violet'],
  ['abyss', 'Abyss'],
  ['crimson', 'Crimson'],
  ['emerald', 'Emerald'],
  ['frost', 'Frost'],
];

const MODES = [
  ['glass', 'Glass', 'translucent glass'],
  ['off', 'Off', 'no effect'],
];

function buildPanel(engine) {
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

      <p class="lg-note" id="lg-engine"></p>
      <p class="lg-note" id="lg-fps">—</p>
    </div>`;

  const note = sel('#lg-note');
  const engineNote = sel('#lg-engine');
  if (engineNote) {
    engineNote.textContent =
      engine === 'refract'
        ? 'Refraction active.'
        : 'This browser uses the blur fallback.';
  }

  const apply = () => {
    document.documentElement.dataset.lg = state.mode;
    document.documentElement.dataset.lgtheme = state.theme;
    document.documentElement.dataset.lganim = state.animate ? 'on' : 'off';
    document.documentElement.style.setProperty(
      '--glass-blur-amount',
      `${state.blur}px`
    );
    sel('#lg-dot').dataset.mode = state.mode;
    sel('#lg-blur-val').textContent = state.blur;
    els('.lg-mode').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.mode === state.mode))
    );
    sel('#lg-theme').value = state.theme;
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

// ------------------------------------------------------------------ fps meter

let fpsFrames = 0;
let fpsMark = performance.now();

function fpsLoop() {
  fpsFrames++;
  const now = performance.now();
  if (now - fpsMark > 500) {
    const fps = Math.round((fpsFrames * 1000) / (now - fpsMark));
    fpsFrames = 0;
    fpsMark = now;
    const out = sel('#lg-fps');
    if (out) {
      out.textContent = fps + ' fps' + (fps < 45 ? '  · slow' : '');
      out.dataset.slow = String(fps < 45);
    }
  }
  requestAnimationFrame(fpsLoop);
}

// ------------------------------------------------------------------------ boot

const engine = buildDisplacementMap();
buildPanel(engine);
bindRipple();
requestAnimationFrame(fpsLoop);

// Nothing to rebuild on resize: the one displacement map is shared and the CSS
// layers are pseudo-elements, so no per-host JS state can go stale.
