/*
 * The roots: one taproot down the middle and a side root out to every memory.
 * Top to bottom is oldest to newest, like a real root, which grows at its tip.
 * Older side roots have had longer to grow, so they've branched out more.
 */
import * as say from './words.js';

const DAY = 864e5;
const NS = 'http://www.w3.org/2000/svg';
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);
export const parseDay = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// how far a memory reaches out from its centre: sideways (where its root joins) and down
const HALF_W = { photo: 47, note: 64, song: 44, seed: 25 };
const HALF_H = { photo: 47, note: 48, song: 44, seed: 34 };
export const isSealed = (m, today) => m.kind === 'note' && m.opens && parseDay(m.opens) > today;
const shape = (m, today) => (isSealed(m, today) ? 'seed' : m.kind);

/* ---------- where everything goes ---------- */

export function layout(memories, { since, today, width }) {
  const cx = width / 2;
  const half = Math.min(width / 2 - 16, 330);

  const events = memories.map((m) => ({ type: 'memory', m, date: parseDay(m.date) }));
  for (let n = 0; ; n++) {
    const date = new Date(since.getFullYear() + n, since.getMonth(), since.getDate());
    if (date > today) break;
    events.push({ type: 'stratum', n, date });
  }
  events.sort((a, b) => a.date - b.date || (a.type === 'stratum' ? -1 : 1) || (a.m.planted || '').localeCompare(b.m.planted || ''));

  let cursor = 110;
  let prev = null;
  let memBottom = 0;
  let stratBottom = 0;
  let side = -1;
  const lastY = { [-1]: -1e9, 1: -1e9 };
  for (const e of events) {
    const gapDays = prev ? Math.max(0, (e.date - prev) / DAY) : 0;
    const gap = Math.min(190, 30 * Math.log2(1 + gapDays / 3));
    if (e.type === 'stratum') {
      e.y = Math.max(cursor + 40 + gap, memBottom + 36);
      stratBottom = e.y + 24;
    } else {
      const r = rng(hash(e.m.id));
      e.shape = shape(e.m, today);
      e.y = Math.max(cursor + 86 + gap, stratBottom + 70, lastY[side] + 184);
      e.side = side;
      e.size = HALF_W[e.shape];
      e.x = cx + side * clamp(half * (0.64 + 0.28 * r()), 70, half - e.size);
      e.seed = r() * 1e9;
      lastY[side] = e.y;
      memBottom = e.y + HALF_H[e.shape] + 52;
      side = -side;
    }
    cursor = e.y;
    prev = e.date;
  }
  const tipY = Math.max(cursor + 150, memBottom + 40, 320);
  return { events, cx, half, width, tipY, height: tipY + 190 };
}

/* ---------- drawing ---------- */

// The taproot leaves the stem straight down, exactly under it, then starts to wander.
const tapX = (L, y) => L.cx + Math.min(1, y / 90) * (8 * Math.sin(y / 150) + 4 * Math.sin(y / 53));
// About as thick as the stem where they meet, swelling below the surface, thinning to the tip.
const tapW = (L, y) => 2.6 + 12 * Math.min(1, 0.45 + y / 110) * Math.max(0, 1 - y / L.tipY) ** 0.75;

function bez(c, t) {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, d = 3 * u * t * t, e = t * t * t;
  return [a * c[0][0] + b * c[1][0] + d * c[2][0] + e * c[3][0], a * c[0][1] + b * c[1][1] + d * c[2][1] + e * c[3][1]];
}

const f = (n) => Math.round(n * 10) / 10;
const line = (pts) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}`;
const length = (pts) => pts.reduce((sum, p, i) => (i ? sum + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

// The stroke in a mask that draws itself in (see .grow in style.css).
function growPath(mask, pts, width, cls = 'grow') {
  el('path', { class: cls, d: line(pts), style: `--len: ${Math.ceil(length(pts)) + 2}`, stroke: '#fff', 'stroke-width': width, fill: 'none' }, mask);
}

// A filled outline that narrows from w0 to w1 along a list of points.
function taper(pts, w0, w1) {
  const left = [], right = [];
  pts.forEach(([x, y], i) => {
    const [px, py] = pts[Math.max(0, i - 1)], [nx, ny] = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(nx - px, ny - py) || 1;
    const w = (w0 + (w1 - w0) * (i / (pts.length - 1))) / 2;
    left.push([x - ((ny - py) / len) * w, y + ((nx - px) / len) * w]);
    right.push([x + ((ny - py) / len) * w, y - ((nx - px) / len) * w]);
  });
  return `${line(left)}L${right.reverse().map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;
}

// Like taper, but with the width given for each point's depth.
function taperBy(pts, widthAt) {
  const left = [], right = [];
  pts.forEach(([x, y], i) => {
    const [px, py] = pts[Math.max(0, i - 1)], [nx, ny] = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(nx - px, ny - py) || 1;
    const w = (i === pts.length - 1 ? 1.4 : widthAt(y)) / 2;
    left.push([x - ((ny - py) / len) * w, y + ((nx - px) / len) * w]);
    right.push([x + ((ny - py) / len) * w, y - ((nx - px) / len) * w]);
  });
  return `${line(left)}L${right.reverse().map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;
}

const sample = (c, n = 18, upto = 1) => Array.from({ length: n + 1 }, (_, i) => bez(c, (upto * i) / n));

function curve(x0, y0, angle, len, bend) {
  const x3 = x0 + Math.cos(angle) * len, y3 = y0 + Math.sin(angle) * len;
  const mx = (x0 + x3) / 2 - Math.sin(angle) * bend, my = (y0 + y3) / 2 + Math.cos(angle) * bend;
  return [[x0, y0], [mx, my], [mx, my], [x3, y3]];
}

function el(name, attrs, parent) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.append(e);
  return e;
}

export function drawRoots(container, memories, { since, today, onOpen, picture, fresh = new Set() }) {
  const L = layout(memories, { since, today, width: container.clientWidth });
  container.replaceChildren();
  container.style.height = `${L.height}px`;
  const r = rng(31);

  const svg = el('svg', { class: 'root-art', width: L.width, height: L.height, viewBox: `0 0 ${L.width} ${L.height}`, 'aria-hidden': 'true' });
  const defs = el('defs', {}, svg);
  const fade = el('linearGradient', { id: 'tap-fade', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 1 }, fade);
  el('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 }, fade);
  const tapMask = el('mask', { id: 'tap-mask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: L.width, height: L.height }, defs);
  const shown = el('rect', { x: 0, y: 0, width: L.width, height: 0, fill: '#fff' }, tapMask);
  const front = el('rect', { x: 0, y: 0, width: L.width, height: 90, fill: 'url(#tap-fade)' }, tapMask);

  // pebbles, kept clear of the taproot and the memories
  const pebbles = el('g', { class: 'pebbles' }, svg);
  const nodes = L.events.filter((e) => e.type === 'memory');
  for (let y = 70; y < L.height - 40; y += 70 + r() * 60) {
    const x = 18 + r() * (L.width - 36);
    if (Math.abs(x - L.cx) < 44 || nodes.some((n) => Math.hypot(n.x - x, n.y - y) < n.size + 46)) continue;
    el('ellipse', { cx: f(x), cy: f(y), rx: f(2.5 + r() * 6), ry: f(2 + r() * 4), transform: `rotate(${f(r() * 180)} ${f(x)} ${f(y)})`, opacity: f(0.05 + r() * 0.09) }, pebbles);
  }

  // the taproot, revealed as you scroll down it
  const tap = el('g', { class: 'taproot', mask: 'url(#tap-mask)' }, svg);
  const tapPts = [];
  for (let y = -4; y <= L.tipY; y += 8) tapPts.push([tapX(L, Math.max(y, 0)), y]);
  tapPts.push([tapX(L, L.tipY), L.tipY + 6]);
  el('path', { d: taperBy(tapPts, (y) => tapW(L, Math.max(0, y))) }, tap);
  let hairs = '';
  for (let y = 36; y < L.tipY - 20; y += 26 + r() * 30) {
    const s = r() < 0.5 ? -1 : 1;
    const c = curve(tapX(L, y) + s * tapW(L, y) * 0.4, y, Math.PI / 2 - s * (0.7 + r() * 0.6), 10 + r() * 24, (r() - 0.5) * 8);
    hairs += taper(sample(c, 6), 1.3, 0.2);
  }
  el('path', { class: 'hairs', d: hairs }, tap);

  // a side root out to every memory, each growing in when the taproot reaches it
  const laterals = [];
  nodes.forEach((e, i) => {
    const rr = rng(e.seed);
    const y0 = e.y - 54;
    const x0 = tapX(L, y0);
    const xe = e.x - e.side * (e.size + 2);
    const dist = Math.abs(xe - x0);
    const c = [[x0, y0], [x0 + e.side * dist * 0.35, y0 + 4], [xe - e.side * dist * 0.28, e.y - 20], [xe, e.y]];
    const age = Math.max(0, (today - e.date) / (365 * DAY));
    const w0 = Math.min(6.5, 3.4 + age * 1.6);

    const g = el('g', { class: 'lateral' }, svg);
    const mask = el('mask', { id: `lat-${i}`, maskUnits: 'userSpaceOnUse', x: 0, y: y0 - 80, width: L.width, height: 200 }, g);
    growPath(mask, sample(c), 16);
    const art = el('g', { mask: `url(#lat-${i})` }, g);
    let d = taper(sample(c), w0, 1.3);

    // rootlets: one to start with, more as the years go by
    const count = clamp(1 + Math.floor(age * 2.4 + rr()), 1, 6);
    for (let k = 0; k < count; k++) {
      const s = 0.22 + rr() * 0.62;
      const [px, py] = bez(c, s);
      const [qx, qy] = bez(c, s + 0.01);
      let a = Math.atan2(qy - py, qx - px) + (rr() < 0.5 ? 1 : -1) * (0.6 + rr() * 0.6);
      if (Math.sin(a) < -0.2) a = -a; // roots grow down, not up
      const len = 14 + rr() * 22 + Math.min(age, 3) * 8;
      const rc = curve(px, py, a, len, (rr() - 0.5) * 10);
      d += taper(sample(rc, 8), Math.max(1.2, w0 * 0.45), 0.25);
      growPath(mask, sample(rc, 8), 8, 'grow late');
      if (age > 1) { // and on the oldest ones, finer hairs off the rootlets
        const [hx, hy] = bez(rc, 0.55);
        const hc = curve(hx, hy, a + (rr() < 0.5 ? 0.8 : -0.8), 8 + rr() * 10, 3);
        d += taper(sample(hc, 5), 0.8, 0.15);
        growPath(mask, sample(hc, 5), 6, 'grow later');
      }
    }
    el('path', { d }, art);
    laterals.push({ y: y0, g, e });
  });

  // the growing tip
  const tip = el('g', { class: 'tip' }, svg);
  el('circle', { cx: f(tapX(L, L.tipY)), cy: f(L.tipY + 6), r: 3.2 }, tip);
  container.append(svg);

  /* ---------- the layers of soil, one per year ---------- */

  for (const e of L.events.filter((x) => x.type === 'stratum')) {
    const div = document.createElement('div');
    div.className = 'stratum';
    div.style.top = `${e.y}px`;
    const label = document.createElement('div');
    const name = document.createElement('span');
    name.textContent = e.n === 0 ? say.begin : say.year(e.n);
    const when = document.createElement('time');
    when.textContent = say.formatDate(e.date);
    label.append(name, when);
    div.append(label);
    container.append(div);
  }

  /* ---------- the memories themselves ---------- */

  const lazy = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      lazy.unobserve(entry.target);
      const img = entry.target.querySelector('img[data-src]');
      img.onload = () => img.classList.add('loaded');
      picture(img.dataset.src).then((url) => (img.src = url)).catch(() => entry.target.classList.add('broken'));
      delete img.dataset.src;
    }
  }, { rootMargin: '900px 0px' });

  const buttons = new Map();
  for (const e of nodes) {
    const m = e.m;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `memory ${e.shape} ${e.side < 0 ? 'left' : 'right'}`;
    b.style.left = `${e.x}px`;
    b.style.top = `${e.y}px`;
    b.style.setProperty('--tilt', `${(rng(e.seed)() - 0.5) * 7}deg`);
    b.dataset.id = m.id;
    const face = document.createElement('span');
    face.className = 'face';
    const label = document.createElement('span');
    label.className = 'label';
    const cap = document.createElement('span');
    cap.className = 'cap';
    const when = document.createElement('time');
    when.textContent = say.shortDate(e.date);

    if (e.shape === 'photo') {
      const img = document.createElement('img');
      img.alt = '';
      img.dataset.src = m.thumb;
      face.append(img);
      cap.textContent = m.caption || '';
      b.setAttribute('aria-label', m.caption || `foto, ${say.formatDate(e.date)}`);
      lazy.observe(b);
    } else if (e.shape === 'note') {
      face.textContent = m.text.length > 90 ? `${m.text.slice(0, 90).trimEnd()}…` : m.text;
      b.setAttribute('aria-label', `briefie, ${say.formatDate(e.date)}`);
      if (m.opens) cap.textContent = say.fromCapsule(e.date);
    } else if (e.shape === 'song') {
      const art = document.createElement('span');
      art.className = 'disc';
      if (m.song.art) {
        const img = document.createElement('img');
        img.alt = '';
        img.src = m.song.art;
        img.referrerPolicy = 'no-referrer';
        art.append(img);
      }
      face.append(art);
      cap.textContent = [m.song.title, m.song.artist].filter(Boolean).join(' · ') || 'liedjie';
      b.setAttribute('aria-label', `liedjie: ${cap.textContent}`);
    } else {
      cap.textContent = say.capsule(parseDay(m.opens));
      b.setAttribute('aria-label', say.capsuleLabel(parseDay(m.opens)));
    }
    label.append(cap, when);
    b.append(face, label);
    b.addEventListener('click', () => onOpen(m, b));
    container.append(b);
    buttons.set(m.id, b);
  }

  const end = document.createElement('div');
  end.className = 'root-tip';
  end.style.top = `${L.tipY + 34}px`;
  end.innerHTML = '<span class="now"></span><time></time>';
  end.querySelector('.now').textContent = 'vandag';
  end.querySelector('time').textContent = say.formatDate(today);
  container.append(end);

  /* ---------- growing in as you scroll ---------- */

  let next = 0;
  let depth = -1;
  return {
    layout: L,
    buttons,
    // reveal everything down to `y` (px from the top of the roots); it never shrinks back
    reveal(y, instant = false) {
      if (y <= depth) return;
      depth = y;
      shown.setAttribute('height', Math.max(0, y - 90));
      front.setAttribute('y', Math.max(0, y - 90));
      while (next < laterals.length && laterals[next].y < y - 100) { // once the taproot has fully reached it
        const { g, e } = laterals[next++];
        const now = instant && !fresh.has(e.m.id); // just planted: always let it grow in
        if (now) g.classList.add('instant');
        g.classList.add('grown');
        buttons.get(e.m.id)?.classList.add('shown', ...(now ? ['instant'] : []));
      }
      if (y > L.tipY) tip.classList.add('shown');
    },
  };
}
