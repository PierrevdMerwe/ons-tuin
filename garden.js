/*
 * The rose bush, drawn on a canvas.
 *
 * Everything about it follows from one number: its age in years since the day
 * we planted it, where every anniversary is a whole number. The same age always
 * gives the same bush, so coming back tomorrow it's grown a little, never changed.
 *
 *   year 1: one rose, in full bloom on the first anniversary
 *   year n: n new roses bloom across the year, the last one on the anniversary
 *           (1, 3, 6, 10, 15 … roses), plus leafy shoots that fill the bush out
 */

const TAU = Math.PI * 2;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeOut = (t) => 1 - (1 - clamp(t, 0, 1)) ** 3;

function rng(seed) { // mulberry32: the same seed gives the same bush everywhere
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- time ---------- */

const anniversary = (since, n) => new Date(since.getFullYear() + n, since.getMonth(), since.getDate());

// Years since `since`; 1.0 is exactly the first anniversary (at midnight).
export function ageOn(date, since) {
  if (date <= since) return 0;
  let n = date.getFullYear() - since.getFullYear();
  if (anniversary(since, n) > date) n--;
  const a = anniversary(since, n);
  return n + (date - a) / (anniversary(since, n + 1) - a);
}

export function dateAtAge(age, since) {
  const n = Math.floor(age);
  const a = anniversary(since, n);
  return new Date(+a + (age - n) * (anniversary(since, n + 1) - a));
}

/* ---------- the plan: what grows where, and when ---------- */

const STEM = 300;      // height of the first rose, in plant units
const HEAD = 34;       // radius of a rose in full bloom
const LEAF = 50;       // length of a compound leaf
const LAST_YEAR = 11;  // 66 roses; after that the bush keeps its shape
const SHOOTS = 110;

// One colour per anniversary year, so the bush is a little record of the years.
const PALETTES = [
  { deep: '#45061a', mid: '#8c1630', light: '#b8304a', edge: '#e2788a', line: '#28030c' }, // 1: deep red
  { deep: '#7a2342', mid: '#c4577b', light: '#e797b0', edge: '#fad6e0', line: '#4a1428' }, // 2: rose pink
  { deep: '#94505c', mid: '#d99ea3', light: '#f1cdcb', edge: '#fff2ee', line: '#64343c' }, // 3: blush
  { deep: '#97452a', mid: '#df8b66', light: '#f3bf9e', edge: '#fee8d8', line: '#5a2715' }, // 4: apricot
  { deep: '#3a0819', mid: '#761535', light: '#aa3758', edge: '#dc8da1', line: '#22030d' }, // 5: wine
  { deep: '#86405a', mid: '#d48aa3', light: '#efbccd', edge: '#fde5ee', line: '#57243a' }, // 6: soft pink
];

const LEAF_TONES = {
  green: { dark: '#2c4527', mid: '#46663a', light: '#7c9b5f', vein: '#b3c895', stem: '#3d5631' },
  sage: { dark: '#2a4232', mid: '#44634a', light: '#7a977c', vein: '#b5c8ad', stem: '#3b5440' },
  young: { dark: '#5b2620', mid: '#8b4630', light: '#be7d55', vein: '#e2b183', stem: '#6c3426' }, // new rose growth is bronze-red
};

function bez(c, t) {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, d = 3 * u * t * t, e = t * t * t;
  return { x: a * c[0].x + b * c[1].x + d * c[2].x + e * c[3].x, y: a * c[0].y + b * c[1].y + d * c[2].y + e * c[3].y };
}

function bezAngle(c, t) {
  const u = 1 - t;
  const dx = 3 * u * u * (c[1].x - c[0].x) + 6 * u * t * (c[2].x - c[1].x) + 3 * t * t * (c[3].x - c[2].x);
  const dy = 3 * u * u * (c[1].y - c[0].y) + 6 * u * t * (c[2].y - c[1].y) + 3 * t * t * (c[3].y - c[2].y);
  return Math.atan2(dy, dx);
}

function bezLength(c) {
  let len = 0, prev = c[0];
  for (let i = 1; i <= 24; i++) {
    const p = bez(c, i / 24);
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return len;
}

// When does a cane growing from `born` over `dur` years reach fraction s of its length?
const reachAt = (cane, s) => cane.born + cane.dur * (1 - Math.cbrt(1 - s));

function makePlan() {
  const roses = [];
  const canes = [];

  for (let n = 1; n <= LAST_YEAR; n++) {
    for (let j = 0; j < n; j++) {
      const k = roses.length;
      const r = rng(1000 + k * 7919);
      const bloomAt = k === 0 ? 1 : n - 1 + (j + 1) / n;
      const rose = {
        k, year: n, bloomAt,
        budAt: k === 0 ? 0.6 : bloomAt - 0.3,
        openAt: k === 0 ? 0.86 : bloomAt - 0.09,
        pal: (n - 1) % PALETTES.length,
        variant: Math.floor(r() * 4),
        size: k === 0 ? 1.08 : 0.86 + r() * 0.24,
        tilt: (r() - 0.5) * 0.5,
      };
      rose.target = placeRose(k, n, roses, r);
      const cane = growCane(rose, canes, r, n);
      rose.cane = cane;
      roses.push(rose);
    }
  }

  // leafy shoots that fill the bush out, more of them every year
  for (let i = 0; i < SHOOTS; i++) {
    const r = rng(50000 + i * 104729);
    const born = 1 + (i / 7) ** 0.8;
    const parents = canes.filter((c) => c.rose && reachAt(c, 0.8) < born);
    if (!parents.length) continue;
    const parent = parents[Math.floor(r() * parents.length)];
    const s = 0.22 + r() * 0.58;
    const p0 = bez(parent.c, s);
    const a0 = bezAngle(parent.c, s);
    const out = Math.abs(p0.x) < 20 ? (r() < 0.5 ? -1 : 1) : Math.sign(p0.x);
    const dir = a0 + out * (0.55 + r() * 0.5);
    const len = 45 + r() * 80;
    const p3 = { x: p0.x + Math.cos(dir) * len, y: p0.y + Math.sin(dir) * len };
    const c = [p0, { x: p0.x + Math.cos(dir) * len * 0.35, y: p0.y + Math.sin(dir) * len * 0.35 }, { x: p3.x - Math.cos(dir) * len * 0.3, y: p3.y + len * 0.12 }, p3];
    const cane = { c, len: bezLength(c), born, dur: 0.07, parent, kids: [], leaves: [], thorns: [], shoot: true, phase: r() * TAU };
    parent.kids.push(cane);
    const count = 2 + Math.floor(r() * 3);
    for (let l = 0; l < count; l++) {
      const ls = l === count - 1 ? 1 : 0.3 + (l / count) * 0.6;
      cane.leaves.push({ s: ls, side: l % 2 ? 1 : -1, off: ls === 1 ? (r() - 0.5) * 0.4 : 0.7 + r() * 0.4, scale: 0.7 + r() * 0.45, tone: r() < 0.5 ? 'green' : 'sage', phase: r() * TAU });
    }
    for (const leaf of cane.leaves) leaf.born = reachAt(cane, Math.min(leaf.s, 0.98)) + 0.004;
    canes.push(cane);
  }

  return { roses, canes };
}

function placeRose(k, n, roses, r) {
  if (k === 0) return { x: 6, y: -STEM };
  const ry = STEM + 110 * (n - 1) ** 0.8; // an upright, vase-shaped bush
  const rx = 72 + 60 * (n - 1) ** 0.7;
  const meanX = roses.reduce((s, q) => s + q.target.x, 0) / roses.length;
  let best = null;
  let bestScore = -Infinity;
  for (let a = 0; a < 16; a++) {
    const phi = (r() * 2 - 1) * 1.22;
    const d = 0.72 + 0.28 * Math.sqrt(r());
    const p = { x: Math.sin(phi) * rx * d, y: -Math.cos(phi) * ry * d };
    if (p.y > -120) p.y = -120 - r() * 40;
    const near = Math.min(...roses.map((q) => Math.hypot(q.target.x - p.x, (q.target.y - p.y) * 1.2)));
    const score = Math.min(near, HEAD * 4.2) - (meanX * p.x) / (rx * 3);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

function growCane(rose, canes, r, n) {
  const t = rose.target;
  const born = rose.k === 0 ? 0.015 : Math.max(rose.bloomAt - 0.62, n - 1 + 0.02);
  const dur = rose.k === 0 ? 0.58 : 0.34;

  // Grow from the crown, or (once the bush is older) branch off an older cane.
  let parent = null;
  let s = 0;
  let p0 = { x: clamp(t.x * 0.1, -24, 24) + (r() - 0.5) * 16, y: 0 };
  if (n >= 3 && r() < 0.55) {
    let bestCost = Infinity;
    for (const c of canes) {
      if (!c.rose) continue;
      for (let cs = 0.3; cs <= 0.71; cs += 0.1) {
        const p = bez(c.c, cs);
        if (p.y - t.y < 130 || Math.sign(p.x || 1) !== Math.sign(t.x || 1) || reachAt(c, cs) > rose.bloomAt - 0.65) continue;
        const cost = Math.hypot(p.x - t.x, p.y - t.y) + Math.abs(p.x - t.x) * 0.6;
        if (cost < bestCost) {
          bestCost = cost;
          parent = c;
          s = cs;
          p0 = p;
        }
      }
    }
  }

  const dx = t.x - p0.x;
  const dy = t.y - p0.y;
  const len = Math.hypot(dx, dy);
  let tan;
  if (parent) {
    const a = bezAngle(parent.c, s) + Math.sign(dx || 1) * 0.35;
    tan = { x: Math.cos(a), y: Math.sin(a) };
  } else {
    const m = Math.hypot(dx * 0.38, len);
    tan = { x: (dx * 0.38) / m, y: -len / m };
  }
  const c = rose.k === 0
    ? [{ x: 0, y: 0 }, { x: -9, y: -110 }, { x: 14, y: -205 }, t]
    : [p0, { x: p0.x + tan.x * len * 0.38, y: p0.y + tan.y * len * 0.38 }, { x: t.x - dx * 0.12, y: t.y + len * 0.32 }, t];

  const cane = { c, len: bezLength(c), born, dur, parent, kids: [], leaves: [], thorns: [], rose, phase: r() * TAU };
  if (parent) parent.kids.push(cane);

  // compound leaves up the cane, the last one just under the flower
  const step = 40 / cane.len;
  let side = r() < 0.5 ? 1 : -1;
  for (let ls = 0.2 + r() * step; ls < 0.86; ls += step * (0.85 + r() * 0.4)) {
    cane.leaves.push({ s: ls, side, off: 0.75 + r() * 0.35, scale: (1.05 + r() * 0.2) * (1 - ls * 0.25), tone: r() < 0.6 ? 'green' : 'sage', phase: r() * TAU });
    side = -side;
  }
  cane.leaves.push({ s: 0.9, side, off: 0.95, scale: 0.7, tone: 'green', phase: r() * TAU });
  for (const leaf of cane.leaves) leaf.born = reachAt(cane, leaf.s) + 0.006;

  // prickles, which on a rose point slightly downwards
  for (let ts = 0.04 + r() * 0.04; ts < 0.84; ts += (16 + r() * 14) / cane.len) {
    cane.thorns.push({ s: ts, side: r() < 0.5 ? -1 : 1, size: 0.8 + r() * 0.5 });
  }

  canes.push(cane);
  return cane;
}

/* ---------- painting: rose heads, buds and leaves, cached as sprites ---------- */

function petalPath(g, r, w) {
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(-w * 0.55, -r * 0.14, -w * 0.64, -r * 0.78, -w * 0.3, -r * 0.96);
  g.quadraticCurveTo(-w * 0.14, -r * 1.05, 0, -r * 0.99); // a soft notch at the top, like a real petal
  g.quadraticCurveTo(w * 0.14, -r * 1.05, w * 0.3, -r * 0.96);
  g.bezierCurveTo(w * 0.64, -r * 0.78, w * 0.55, -r * 0.14, 0, 0);
  g.closePath();
}

const BLOOM_LAYERS = [
  { r: 1.0, n: 5, w: 1.0, show: 0.55 },
  { r: 0.85, n: 5, w: 0.98, show: 0.35 },
  { r: 0.69, n: 5, w: 0.95, show: 0.15 },
  { r: 0.54, n: 4, w: 0.98, show: -1 },
  { r: 0.4, n: 4, w: 1.02, show: -1 },
  { r: 0.27, n: 3, w: 1.12, show: -1 },
];

// A rose seen from a little above. open: 0 = a tight centre, 1 = full bloom.
function paintBloom(g, open, pal, variant) {
  const R = HEAD;
  const px = g.getTransform().a; // shadows are in canvas pixels, not units
  const spread = 0.56 + 0.44 * open;
  const rot = variant * 0.71;
  const jr = rng(77 + variant);

  g.save();
  g.translate(0, -HEAD * 0.34 * spread);
  g.scale(1, 0.84);

  // sepals peeking out from behind the outer petals
  if (open > 0.45) {
    g.save();
    g.globalAlpha = smooth(0.45, 0.8, open);
    for (let i = 0; i < 5; i++) {
      g.save();
      g.rotate(rot + 0.35 + (i * TAU) / 5);
      const L = R * 1.14 * spread;
      g.beginPath();
      g.moveTo(-R * 0.08, 0);
      g.quadraticCurveTo(-R * 0.16, -L * 0.6, 0, -L);
      g.quadraticCurveTo(R * 0.16, -L * 0.6, R * 0.08, 0);
      g.fillStyle = '#3f5e34';
      g.fill();
      g.restore();
    }
    g.restore();
  }

  BLOOM_LAYERS.forEach((L, i) => {
    const a = L.show < 0 ? 1 : smooth(L.show, L.show + 0.25, open);
    if (a <= 0) return;
    const r = R * L.r * spread * (0.82 + 0.18 * a);
    const cy = -i * R * 0.045 * spread; // inner petals sit higher: the cup has depth
    const tilt = i < 3 ? 0.12 : 0.06;    // petals facing us look longer than the ones behind

    g.save();
    g.translate(0, cy);
    if (i > 0) { // soft shadow this layer casts on the one below
      const sh = g.createRadialGradient(0, R * 0.04, r * 0.45, 0, R * 0.04, r * 1.2);
      sh.addColorStop(0, 'rgba(40, 6, 14, 0.34)');
      sh.addColorStop(1, 'rgba(40, 6, 14, 0)');
      g.fillStyle = sh;
      g.beginPath();
      g.arc(0, R * 0.04, r * 1.2, 0, TAU);
      g.fill();
    }

    const grad = g.createRadialGradient(0, 0, 0, 0, 0, r * 1.1);
    grad.addColorStop(0, pal.deep);
    grad.addColorStop(0.42, pal.mid);
    grad.addColorStop(0.82, pal.light);
    grad.addColorStop(1, pal.edge);

    for (let j = 0; j < L.n; j++) {
      const ang = rot + i * 0.63 + (j * TAU) / L.n + (jr() - 0.5) * 0.45;
      const pr = r * (0.88 + jr() * 0.18) * (1 - tilt * Math.cos(ang));
      const w = pr * L.w * (0.92 + jr() * 0.16);
      g.save();
      g.globalAlpha = a;
      g.rotate(ang);
      if (i === 0) {
        g.shadowColor = 'rgba(30, 10, 10, 0.18)';
        g.shadowBlur = R * 0.24 * px;
        g.shadowOffsetY = R * 0.07 * px;
      }
      petalPath(g, pr, w);
      g.fillStyle = grad;
      g.fill();
      g.shadowColor = 'transparent';
      g.lineWidth = R * 0.016;
      g.strokeStyle = pal.line;
      g.globalAlpha = a * 0.22;
      g.stroke();
      if (i < 3) { // the rolled-back rim of the petal catching the light
        g.globalAlpha = a * 0.3;
        g.beginPath();
        g.moveTo(-w * 0.26, -pr * 0.93);
        g.quadraticCurveTo(-w * 0.12, -pr * 1.0, 0, -pr * 0.96);
        g.quadraticCurveTo(w * 0.12, -pr * 1.0, w * 0.26, -pr * 0.93);
        g.lineWidth = pr * 0.045;
        g.lineCap = 'butt';
        g.strokeStyle = pal.edge;
        g.stroke();
      }
      g.restore();
    }
    g.restore();
  });

  // light from the upper left, shade on the lower right: gives the head volume
  g.save();
  g.globalCompositeOperation = 'source-atop';
  const vol = g.createLinearGradient(-R, -R * 1.2, R, R);
  vol.addColorStop(0, 'rgba(255, 238, 236, 0.2)');
  vol.addColorStop(0.5, 'rgba(255, 238, 236, 0)');
  vol.addColorStop(1, 'rgba(40, 0, 12, 0.32)');
  g.fillStyle = vol;
  g.fillRect(-R * 1.6, -R * 1.6, R * 3.2, R * 3.2);
  g.restore();

  g.translate(0, -BLOOM_LAYERS.length * R * 0.045 * spread);
  // the heart: petals still wrapped in a tight spiral
  const hr = R * 0.15 * spread;
  const hg = g.createRadialGradient(0, 0, 0, 0, 0, hr);
  hg.addColorStop(0, pal.line);
  hg.addColorStop(1, pal.deep);
  g.fillStyle = hg;
  g.beginPath();
  g.arc(0, 0, hr, 0, TAU);
  g.fill();
  g.lineCap = 'round';
  for (let j = 0; j < 4; j++) {
    const a0 = rot + j * 1.9;
    g.beginPath();
    g.arc(0, 0, R * (0.035 + j * 0.032) * spread, a0, a0 + 3.4);
    g.strokeStyle = pal.light;
    g.globalAlpha = 0.65 - j * 0.1;
    g.lineWidth = R * 0.03;
    g.stroke();
  }
  g.restore();
}

function sepal(g, angle, len, wd, tone) {
  g.save();
  g.rotate(angle);
  g.beginPath();
  g.moveTo(-wd * 0.3, 0);
  g.bezierCurveTo(-wd, -len * 0.3, -wd * 0.35, -len * 0.78, 0, -len);
  g.bezierCurveTo(wd * 0.15, -len * 0.72, wd * 0.8, -len * 0.32, wd * 0.3, 0);
  g.closePath();
  const grad = g.createLinearGradient(0, 0, 0, -len);
  grad.addColorStop(0, tone.dark);
  grad.addColorStop(0.6, tone.mid);
  grad.addColorStop(1, tone.light);
  g.fillStyle = grad;
  g.fill();
  g.lineWidth = len * 0.02;
  g.strokeStyle = tone.dark;
  g.globalAlpha = 0.5;
  g.stroke();
  g.restore();
}

// A closed bud from the side. size: 0 = tiny, 1 = ready to open; loosen: petals parting.
function paintBud(g, size, loosen, pal) {
  const h = HEAD * 1.35 * (0.32 + 0.68 * size);
  const w = h * (0.44 + loosen * 0.2);
  const tone = LEAF_TONES.green;

  g.fillStyle = tone.dark;
  g.beginPath();
  g.ellipse(0, -h * 0.05, w * 0.3, h * 0.11, 0, 0, TAU);
  g.fill();

  // back sepals
  sepal(g, -0.55 - loosen * 0.5, h * 0.55, w * 0.32, tone);
  sepal(g, 0.55 + loosen * 0.5, h * 0.55, w * 0.32, tone);

  g.beginPath();
  g.moveTo(0, -h * 0.08);
  g.bezierCurveTo(-w * 0.78, -h * 0.18, -w * 0.62, -h * 0.74, 0, -h);
  g.bezierCurveTo(w * 0.62, -h * 0.74, w * 0.78, -h * 0.18, 0, -h * 0.08);
  const grad = g.createLinearGradient(0, -h * 0.1, 0, -h);
  grad.addColorStop(0, pal.deep);
  grad.addColorStop(0.45, pal.mid);
  grad.addColorStop(1, pal.light);
  g.fillStyle = grad;
  g.fill();
  g.lineWidth = h * 0.012;
  g.strokeStyle = pal.line;
  g.globalAlpha = 0.35;
  g.stroke();

  // the seam where the outer petal wraps around
  g.beginPath();
  g.moveTo(-w * 0.06, -h * 0.97);
  g.bezierCurveTo(w * 0.38, -h * 0.76, w * 0.32, -h * 0.36, -w * 0.22, -h * 0.2);
  g.lineWidth = h * 0.02;
  g.globalAlpha = 0.4;
  g.stroke();
  g.globalAlpha = 1;

  if (loosen > 0) { // the outer petals start to curl away
    for (const side of [-1, 1]) {
      g.save();
      g.scale(side, 1);
      g.beginPath();
      g.moveTo(w * 0.18, -h * 0.25);
      g.bezierCurveTo(w * (0.75 + loosen * 0.4), -h * 0.38, w * (0.7 + loosen * 0.5), -h * (0.78 - loosen * 0.08), w * (0.2 + loosen * 0.4), -h * (0.92 - loosen * 0.1));
      g.quadraticCurveTo(w * 0.35, -h * 0.55, w * 0.18, -h * 0.25);
      g.fillStyle = side < 0 ? pal.deep : pal.mid;
      g.globalAlpha = smooth(0, 0.3, loosen);
      g.fill();
      g.lineWidth = h * 0.012;
      g.strokeStyle = pal.line;
      g.globalAlpha *= 0.4;
      g.stroke();
      g.restore();
    }
    g.globalAlpha = 1;
  }

  // the front sepal wrapping the base
  sepal(g, 0.04, h * (0.48 - loosen * 0.1), w * 0.38, tone);
}

function leafletPath(g, len) {
  // a serrated, pointed oval along +x
  const w = len * 0.5;
  const top = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    top.push({ x: len * t, y: -w * 0.5 * Math.sin(Math.PI * t ** 0.85) * (1 - 0.15 * t) });
  }
  g.beginPath();
  g.moveTo(0, 0);
  for (let i = 1; i < top.length; i++) {
    const p = top[i], q = top[i - 1];
    g.lineTo((p.x + q.x) / 2 + len * 0.02, (p.y + q.y) / 2 - len * 0.022 * (i > 2 && i < 12 ? 1 : 0));
    g.lineTo(p.x, p.y);
  }
  for (let i = top.length - 2; i >= 0; i--) {
    const p = top[i], q = top[i + 1];
    g.lineTo((p.x + q.x) / 2 + len * 0.02, -(p.y + q.y) / 2 + len * 0.022 * (i > 1 && i < 11 ? 1 : 0));
    g.lineTo(p.x, -p.y);
  }
  g.closePath();
}

function leaflet(g, x, y, ang, len, tone) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  leafletPath(g, len);
  const grad = g.createLinearGradient(0, -len * 0.25, 0, len * 0.25);
  grad.addColorStop(0, tone.light);
  grad.addColorStop(0.5, tone.mid);
  grad.addColorStop(1, tone.dark);
  g.fillStyle = grad;
  g.fill();
  g.lineWidth = len * 0.022;
  g.strokeStyle = tone.dark;
  g.globalAlpha = 0.55;
  g.stroke();
  g.globalAlpha = 0.7;
  g.beginPath();
  g.moveTo(len * 0.04, 0);
  g.quadraticCurveTo(len * 0.5, -len * 0.02, len * 0.94, 0);
  g.strokeStyle = tone.vein;
  g.lineWidth = len * 0.024;
  g.stroke();
  g.globalAlpha = 0.3;
  g.lineWidth = len * 0.012;
  for (let i = 1; i <= 4; i++) {
    const vx = len * (0.15 + i * 0.16);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(vx, 0);
      g.quadraticCurveTo(vx + len * 0.08, s * len * 0.08, vx + len * 0.14, s * len * 0.15);
      g.stroke();
    }
  }
  g.restore();
}

// A rose leaf: two pairs of leaflets and one at the tip, pointing along +x.
function paintLeaf(g, tone) {
  const L = LEAF;
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(L * 0.45, -L * 0.03, L * 0.8, 0);
  g.lineWidth = L * 0.03;
  g.lineCap = 'round';
  g.strokeStyle = tone.stem;
  g.stroke();
  for (const [x, s] of [[0.3, 0.34], [0.58, 0.38]]) {
    leaflet(g, L * x, 0, -0.82, L * s, tone);
    leaflet(g, L * x, 0, 0.82, L * s, tone);
  }
  leaflet(g, L * 0.78, 0, 0.02, L * 0.42, tone);
}

// One rose head on its own (for the lock screen). stage: 0–1 bud, 1–2 opening.
// Painted around the top of its stem at (0, 0), in units where a full bloom is ~70 wide.
export function paintRose(g, stage, year = 1, variant = 0) {
  const pal = PALETTES[(year - 1) % PALETTES.length];
  // The bloom unfurls out of the top of the loosening bud, then settles onto the stem
  // while what's left of the bud shrinks away behind it (fading it would show through).
  const gone = smooth(1.28, 1.5, stage);
  if (gone < 1) {
    g.save();
    g.scale(1 - gone * 0.7, 1 - gone * 0.7);
    paintBud(g, Math.min(stage, 1), clamp((stage - 1) / 0.3, 0, 1), pal);
    g.restore();
  }
  if (stage > 1.1) {
    g.save();
    g.globalAlpha *= smooth(1.1, 1.18, stage);
    g.translate(0, -HEAD * 0.62 * (1 - smooth(1.25, 1.7, stage)));
    paintBloom(g, 0.08 + 0.92 * smooth(1.12, 2, stage), pal, variant);
    g.restore();
  }
}

/* ---------- the scene: sky by time of day ---------- */

const SKY = [ // hour, top, horizon
  [0, '#0c1322', '#232c45'],
  [4.6, '#121a30', '#2f3655'],
  [5.8, '#59679a', '#e5b6a5'],
  [7.2, '#b8c9d6', '#f5e2d2'],
  [10, '#cfdce2', '#f7efe5'],
  [16, '#d2dbde', '#f8eee2'],
  [17.8, '#c7b6c3', '#f5d3b5'],
  [19.1, '#675a87', '#e6a28f'],
  [20.4, '#1c2440', '#454163'],
  [24, '#0c1322', '#232c45'],
];

function mix(c1, c2, t) {
  const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
  const ch = (v, s) => (v >> s) & 255;
  const m = (s) => Math.round(lerp(ch(a, s), ch(b, s), t));
  return `rgb(${m(16)}, ${m(8)}, ${m(0)})`;
}

function skyAt(hour) {
  let i = 0;
  while (SKY[i + 1][0] < hour) i++;
  const [h0, t0, b0] = SKY[i], [h1, t1, b1] = SKY[i + 1];
  const t = (hour - h0) / (h1 - h0);
  return { top: mix(t0, t1, t), horizon: mix(b0, b1, t) };
}

// 0 in daylight, 1 at night, easing through dawn and dusk.
const nightness = (h) => 1 - smooth(4.8, 6.6, h) + smooth(19, 20.6, h);

/* ---------- the garden ---------- */

export function createGarden(canvas, { onFrame } = {}) {
  const g = canvas.getContext('2d');
  const plan = makePlan();
  const sprites = new Map();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, dpr = 1, ground = 0, top = 120;
  let age = 0;        // what's drawn
  let frameAge = 0;   // the age the camera frames (the end of a replay)
  let scale = 1;
  let hourOverride = null;
  let running = false;
  let raf = 0;
  let replay = null;
  let lastT = 0;
  let hits = [];
  const petals = [];
  const motes = Array.from({ length: 16 }, (_, i) => {
    const r = rng(900 + i);
    return { x: r(), y: r(), sp: 0.3 + r() * 0.7, ph: r() * TAU, size: 0.6 + r() * 1.2 };
  });
  const stars = Array.from({ length: 90 }, (_, i) => {
    const r = rng(300 + i);
    return { x: r(), y: r() ** 1.6 * 0.75, size: 0.4 + r() * 1.1, ph: r() * TAU };
  });

  const visibleRoses = (a) => plan.roses.filter((r) => r.cane.born < a);

  function fitScale(a) {
    const roses = visibleRoses(Math.max(a, 0.02));
    let minY = -STEM - HEAD * 2, maxX = HEAD * 2;
    for (const r of roses) {
      minY = Math.min(minY, r.target.y - HEAD * 2);
      maxX = Math.max(maxX, Math.abs(r.target.x) + HEAD * 1.6);
    }
    for (const c of plan.canes) {
      if (c.shoot && c.born < a) maxX = Math.max(maxX, Math.abs(c.c[3].x) + LEAF * 0.6);
    }
    const availH = Math.max(120, ground - top);
    return Math.min(availH / -minY, W / (maxX * 2), availH / (STEM + HEAD * 2.4));
  }

  // groundY: where the soil starts; topY: where the bush may reach up to (below the title)
  function resize(groundY, topY = top) {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = rect.width;
    H = rect.height;
    ground = groundY ?? H * 0.85;
    top = topY;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    scale = fitScale(frameAge);
    sprites.clear();
    if (!running) draw(performance.now());
  }

  /* sprites */

  function sprite(key, wUnits, hUnits, ox, oy, paint) {
    const px = scale * dpr;
    const full = `${key}@${px.toFixed(3)}`;
    let s = sprites.get(full);
    if (!s) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(wUnits * px));
      c.height = Math.max(1, Math.ceil(hUnits * px));
      const cg = c.getContext('2d');
      cg.scale(px, px);
      cg.translate(ox, oy);
      paint(cg);
      s = { c, ox, oy, px };
      sprites.set(full, s);
    }
    return s;
  }

  function roseSprite(rose, st) {
    const q = Math.round(st * 40) / 40;
    return sprite(`rose${rose.pal}.${rose.variant}.${q}`, HEAD * 2.8, HEAD * 2.9, HEAD * 1.4, HEAD * 2.1, (cg) => paintRose(cg, q, rose.pal + 1, rose.variant));
  }

  const leafSprite = (tone) => sprite(`leaf.${tone}`, LEAF * 1.05, LEAF * 0.72, 0, LEAF * 0.36, (cg) => paintLeaf(cg, LEAF_TONES[tone]));

  // Sprites are painted at the current scale, so k is only the per-item size.
  function drawSprite(s, x, y, angle, k, alpha = 1) {
    const cos = Math.cos(angle) * k * dpr, sin = Math.sin(angle) * k * dpr;
    g.setTransform(cos, sin, -sin, cos, x * dpr, y * dpr);
    g.globalAlpha = alpha;
    g.drawImage(s.c, -s.ox * s.px / dpr, -s.oy * s.px / dpr, s.c.width / dpr, s.c.height / dpr);
  }

  /* the bush */

  const cx = () => W / 2;
  const sx = (x) => cx() + x * scale;
  const sy = (y) => ground + y * scale;

  // wind: depends only on height, so branches stay attached to their canes
  function sway(y, t) {
    if (reduceMotion) return 0;
    const h = clamp(-y / 600, 0, 2) ** 1.5;
    return h * (4.5 * Math.sin(t * 0.7 - y * 0.0025) + 1.6 * Math.sin(t * 1.9 + 1.3));
  }

  function caneGrowth(c, a) {
    return easeOut((a - c.born) / c.dur);
  }

  function caneWidth(c, a) {
    const old = clamp((a - c.born) / 2.5, 0, 1) ** 0.7;
    const kids = c.kids.filter((k) => k.born < a).length;
    return c.shoot ? 1.5 + old * 0.8 : 2.4 + old * 2.2 + kids * 0.45;
  }

  function caneColor(c, a) {
    const old = clamp((a - c.born) / 4, 0, 1);
    return c.shoot ? '#4a6838' : mix('#456a37', '#5b5638', old);
  }

  function drawCane(c, a, t) {
    const grow = caneGrowth(c, a);
    if (grow <= 0) return null;
    const steps = Math.max(3, Math.ceil((c.len * grow) / 9));
    const w0 = caneWidth(c, a) * lerp(0.45, 1, grow);
    const w1 = Math.max(1.1, w0 * 0.55);
    const L = [], R = [];
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const s = (grow * i) / steps;
      const p = bez(c.c, s);
      const ang = bezAngle(c.c, s);
      const x = sx(p.x + sway(p.y, t)), y = sy(p.y);
      const w = (lerp(w0, w1, i / steps) * scale) / 2;
      const nx = -Math.sin(ang) * w, ny = Math.cos(ang) * w;
      L.push(x + nx, y + ny);
      R.push(x - nx, y - ny);
      pts.push({ x, y, ang, w });
    }
    g.beginPath();
    g.moveTo(L[0], L[1]);
    for (let i = 2; i < L.length; i += 2) g.lineTo(L[i], L[i + 1]);
    for (let i = R.length - 2; i >= 0; i -= 2) g.lineTo(R[i], R[i + 1]);
    g.closePath();
    g.fillStyle = caneColor(c, a);
    g.fill();

    // a thin highlight down one side gives the cane some roundness
    g.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const hx = p.x - Math.sin(p.ang) * p.w * 0.45, hy = p.y + Math.cos(p.ang) * p.w * 0.45;
      i ? g.lineTo(hx, hy) : g.moveTo(hx, hy);
    }
    g.strokeStyle = 'rgba(190, 210, 150, 0.35)';
    g.lineWidth = Math.max(0.5, w0 * scale * 0.18);
    g.stroke();

    // prickles
    g.fillStyle = mix('#7a3a2a', '#6a5a3a', clamp((a - c.born) / 3, 0, 1));
    for (const th of c.thorns) {
      if (th.s > grow * 0.95) break;
      const p = bez(c.c, th.s);
      const ang = bezAngle(c.c, th.s);
      const x = sx(p.x + sway(p.y, t)), y = sy(p.y);
      const w = (lerp(w0, w1, th.s / Math.max(grow, 0.01)) * scale) / 2;
      const nx = -Math.sin(ang) * th.side, ny = Math.cos(ang) * th.side;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      const len = (2.4 + w0 * 0.5) * th.size * scale;
      g.beginPath();
      g.moveTo(x + nx * w - dx * len * 0.7, y + ny * w - dy * len * 0.7);
      g.lineTo(x + nx * (w + len) - dx * len * 0.55, y + ny * (w + len) - dy * len * 0.55);
      g.lineTo(x + nx * w + dx * len * 0.2, y + ny * w + dy * len * 0.2);
      g.fill();
    }
    return { grow, tip: pts[pts.length - 1] };
  }

  function drawLeaves(c, a, t) {
    for (const leaf of c.leaves) {
      if (leaf.born > a) continue;
      const p = bez(c.c, leaf.s);
      const ang = leaf.s === 1 ? bezAngle(c.c, 1) + leaf.off : bezAngle(c.c, leaf.s) + leaf.side * leaf.off;
      const flutter = reduceMotion ? 0 : Math.sin(t * 1.4 + leaf.phase) * 0.06;
      const k = leaf.scale * easeOut((a - leaf.born) / 0.05);
      const youth = 1 - smooth(0.02, 0.14, a - leaf.born);
      const x = sx(p.x + sway(p.y, t)), y = sy(p.y);
      drawSprite(leafSprite(leaf.tone), x, y, ang + flutter, k);
      if (youth > 0.01) drawSprite(leafSprite('young'), x, y, ang + flutter, k, youth);
    }
  }

  function roseStage(rose, a) {
    if (a < rose.budAt - 0.04) return -1;
    if (a < rose.openAt) return smooth(rose.budAt - 0.04, rose.openAt, a);
    return 1 + smooth(rose.openAt, rose.bloomAt, a);
  }

  function drawSprout(a, t) {
    // the first two round seed leaves, before the true leaves take over
    const fade = 1 - smooth(0.07, 0.14, a);
    if (fade <= 0) return;
    const c = plan.roses[0].cane;
    const p = bez(c.c, Math.min(caneGrowth(c, a), 0.06));
    const x = sx(p.x + sway(p.y, t)), y = sy(p.y);
    const k = easeOut((a - 0.015) / 0.03) * 13 * scale;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalAlpha = fade;
    g.fillStyle = '#6b8f4e';
    for (const side of [-1, 1]) {
      g.beginPath();
      g.ellipse(x + side * k * 0.9, y - k * 0.2, k, k * 0.5, side * -0.35, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  function drawBush(a, t) {
    hits = [];
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const heads = [];
    for (const c of plan.canes) {
      if (c.born >= a) continue;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalAlpha = 1;
      const res = drawCane(c, a, t);
      if (res && c.rose) heads.push({ rose: c.rose, tip: res.tip, grow: res.grow });
    }
    for (const c of plan.canes) if (c.born < a) drawLeaves(c, a, t);
    drawSprout(a, t);

    heads.sort((p, q) => p.tip.y - q.tip.y);
    for (const { rose, tip } of heads) {
      const st = roseStage(rose, a);
      if (st < 0) continue;
      const lean = (tip.ang + Math.PI / 2) * 0.5 + rose.tilt * smooth(1, 2, st);
      const bob = reduceMotion ? 0 : Math.sin(t * 1.1 + rose.k) * 0.03;
      drawSprite(roseSprite(rose, st), tip.x, tip.y, lean + bob, rose.size);
      hits.push({ rose, x: tip.x, y: tip.y - HEAD * 0.4 * scale * rose.size, r: HEAD * scale * rose.size * (st > 1 ? 1 : 0.6), st });
    }
    g.globalAlpha = 1;
  }

  /* sky, light and little moving things */

  function currentHour() {
    if (hourOverride != null) return hourOverride;
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  }

  function drawSky(t, hour, night) {
    const sky = skyAt(hour);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const grad = g.createLinearGradient(0, 0, 0, ground);
    grad.addColorStop(0, sky.top);
    grad.addColorStop(1, sky.horizon);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    if (night > 0.02) {
      for (const s of stars) {
        const tw = reduceMotion ? 0.8 : 0.55 + 0.45 * Math.sin(t * 1.3 + s.ph);
        g.globalAlpha = night * tw * 0.9;
        g.fillStyle = '#fff8e8';
        g.beginPath();
        g.arc(s.x * W, s.y * ground, s.size, 0, TAU);
        g.fill();
      }
      // the moon
      const mx = W * 0.16, my = top + (ground - top) * 0.1; // under the title, off to the side
      const mg = g.createRadialGradient(mx, my, 0, mx, my, 90);
      mg.addColorStop(0, 'rgba(255, 246, 225, 0.35)');
      mg.addColorStop(1, 'rgba(255, 246, 225, 0)');
      g.globalAlpha = night;
      g.fillStyle = mg;
      g.fillRect(mx - 90, my - 90, 180, 180);
      g.fillStyle = '#fbf3df';
      g.beginPath();
      g.arc(mx, my, 13, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
    }

    if (night < 0.98) { // a soft sun glow travelling across the day
      const d = clamp((hour - 5.5) / 14, 0, 1);
      const x = W * lerp(0.12, 0.88, d);
      const y = ground * (0.5 - Math.sin(Math.PI * d) * 0.32);
      const r = Math.max(W, ground) * 0.6;
      const sg = g.createRadialGradient(x, y, 0, x, y, r);
      sg.addColorStop(0, `rgba(255, 238, 205, ${0.55 * (1 - night)})`);
      sg.addColorStop(1, 'rgba(255, 238, 205, 0)');
      g.fillStyle = sg;
      g.fillRect(0, 0, W, ground);
    }

    // a haze along the horizon
    const hz = g.createLinearGradient(0, ground - 90, 0, ground);
    hz.addColorStop(0, 'rgba(255, 250, 240, 0)');
    hz.addColorStop(1, `rgba(255, 250, 240, ${0.35 * (1 - night)})`);
    g.fillStyle = hz;
    g.fillRect(0, ground - 90, W, 90);
  }

  // a few tufts of grass, gathered around the foot of the bush
  function drawGrass(t) {
    const r = rng(42);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineCap = 'round';
    const tufts = [-46, -30, 26, 44, ...Array.from({ length: 9 }, () => (r() - 0.5) * W * 0.95)];
    for (const tx of tufts) {
      const x0 = cx() + tx;
      const blades = 3 + Math.floor(r() * 4);
      const tall = Math.abs(tx) < 60 ? 1.3 : 0.8 + r() * 0.5;
      for (let b = 0; b < blades; b++) {
        const x = x0 + (b - blades / 2) * 1.6;
        const h = (6 + r() * 11) * tall;
        const lean = (b - blades / 2) * 2.2 + (r() - 0.5) * 3 + (reduceMotion ? 0 : Math.sin(t * 0.9 + x * 0.02) * 1.2);
        g.beginPath();
        g.moveTo(x, ground + 3);
        g.quadraticCurveTo(x + lean * 0.25, ground - h * 0.55, x + lean, ground - h);
        g.strokeStyle = r() < 0.5 ? '#557046' : '#7a9160';
        g.lineWidth = 0.9 + r() * 0.6;
        g.stroke();
      }
    }
  }

  function drawAir(t, dt, night, a) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reduceMotion) return;
    // fireflies at night, pollen in the light
    for (const m of motes) {
      const x = ((m.x + Math.sin(t * 0.1 * m.sp + m.ph) * 0.08) % 1) * W;
      const y = ground - (((m.y + t * 0.012 * m.sp) % 1) * (ground - top * 0.5)) * 0.9;
      if (night > 0.3) {
        const blink = Math.max(0, Math.sin(t * 1.6 * m.sp + m.ph));
        const fg = g.createRadialGradient(x, y, 0, x, y, 9);
        fg.addColorStop(0, `rgba(235, 255, 160, ${0.85 * night * blink})`);
        fg.addColorStop(1, 'rgba(235, 255, 160, 0)');
        g.fillStyle = fg;
        g.fillRect(x - 9, y - 9, 18, 18);
      } else {
        g.globalAlpha = 0.35 * (1 - night);
        g.fillStyle = '#fffaf0';
        g.beginPath();
        g.arc(x, y, m.size, 0, TAU);
        g.fill();
        g.globalAlpha = 1;
      }
    }

    // now and then a petal lets go of an open rose and drifts down
    const open = hits.filter((h) => h.st >= 1.9);
    if (open.length && dt && Math.random() < dt / 7) {
      const h = open[Math.floor(Math.random() * open.length)];
      const pal = PALETTES[h.rose.pal];
      petals.push({ x: h.x, y: h.y, vx: (Math.random() - 0.5) * 12, vy: 6, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 2, size: HEAD * scale * 0.32, color: Math.random() < 0.5 ? pal.light : pal.mid, life: 0 });
    }
    for (let i = petals.length - 1; i >= 0; i--) {
      const p = petals[i];
      p.life += dt;
      p.vy = Math.min(p.vy + 10 * dt, 26);
      p.x += (p.vx + Math.sin(p.life * 1.7) * 16) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.y > ground + 6) {
        petals.splice(i, 1);
        continue;
      }
      g.setTransform(dpr * Math.cos(p.rot), dpr * Math.sin(p.rot), -dpr * Math.sin(p.rot) * 0.6, dpr * Math.cos(p.rot) * 0.6, p.x * dpr, p.y * dpr);
      g.fillStyle = p.color;
      g.globalAlpha = 0.9 * (1 - smooth(ground - 30, ground + 6, p.y));
      petalPath(g, p.size, p.size * 0.9);
      g.fill();
      g.globalAlpha = 1;
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(now) {
    const t = now / 1000;
    const dt = lastT ? Math.min(0.1, t - lastT) : 0;
    lastT = t;

    if (replay) {
      const p = clamp((now - replay.start) / replay.ms, 0, 1);
      age = lerp(replay.from, replay.to, replay.ease(p));
      if (p >= 1) {
        const done = replay.done;
        replay = null;
        done();
      }
    }

    const hour = currentHour();
    const night = nightness(hour);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    drawSky(t, hour, night);
    drawBush(age, t);
    drawGrass(t);
    if (night > 0.02) { // dim the garden with the light
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = `rgba(14, 20, 40, ${0.38 * night})`;
      g.fillRect(0, 0, W, H);
    }
    drawAir(t, dt, night, age);
    onFrame?.(age);
  }

  function loop(now) {
    draw(now);
    if (running) raf = requestAnimationFrame(loop);
  }

  return {
    resize,
    start() {
      if (running) return;
      running = true;
      lastT = 0;
      raf = requestAnimationFrame(loop);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    // jump straight to an age (in years since planting)
    setAge(a) {
      age = frameAge = a;
      scale = fitScale(frameAge);
      sprites.clear();
      if (!running) draw(performance.now());
    },
    // grow from one age to another over `ms` milliseconds
    grow(from, to, ms) {
      frameAge = to;
      scale = fitScale(frameAge);
      sprites.clear();
      return new Promise((done) => {
        if (reduceMotion || ms <= 0) {
          age = to;
          if (!running) draw(performance.now());
          return done();
        }
        replay = { from, to, ms, start: performance.now(), ease: (p) => p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2, done };
        if (!running) this.start();
      });
    },
    skip() {
      if (replay) replay.start = -1e9;
    },
    setHour(h) {
      hourOverride = h;
    },
    get age() {
      return age;
    },
    // the rose under a point on the canvas (css px), if any
    roseAt(x, y) {
      let best = null;
      for (const h of hits) {
        const d = Math.hypot(h.x - x, h.y - y);
        if (d < Math.max(h.r, 22) && (!best || d < best.d)) best = { ...h, d };
      }
      return best && { year: best.rose.year, k: best.rose.k, bloomAt: best.rose.bloomAt, open: best.st >= 2 };
    },
    // counts for the info panel
    stats(a = age) {
      const bloomed = plan.roses.filter((r) => r.bloomAt <= a + 1e-9).length;
      const next = plan.roses.find((r) => r.bloomAt > a + 1e-9);
      return { bloomed, nextBloomAt: next?.bloomAt ?? null, nextYear: next?.year ?? null };
    },
  };
}
