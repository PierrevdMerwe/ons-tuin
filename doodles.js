/*
 * Crayon drawings for the letter, the way a child would draw us: him with spiky hair,
 * her with long hair and a red bow. Shapes are coloured in with back-and-forth strokes
 * and the whole drawing goes through the #crayon filter (wobbly lines, waxy grain).
 *
 * Each scene is 200 × 170 (the last one is wider) and fits beside a part of the letter.
 */

const INK = '#3a3346';
const SKIN = '#f6c9a2';
const HAIR_HIM = '#ab8a52'; // dirty blonde, a touch darker than hers
const HAIR_HER = '#bb9a5e'; // dirty blonde
const RED = '#e2343c';
const PINK = '#f48fb1';
const BLUE = '#3d7ed8';
const SKY = '#79c3ee';
const SEA = '#2f83d4';
const GREEN = '#4fae4a';
const LEAF = '#2f7d32';
const YELLOW = '#f7cb3d';
const ORANGE = '#f28c28';
const BROWN = '#9a5d2e';
const PURPLE = '#9c64d8';
const GRAY = '#8e959c';
const PAPER = '#fffdf6';
const SHORTS = '#566a92';

let uid = 0;
const r1 = (n) => Math.round(n * 10) / 10;

const ln = (d, colour = INK, width = 2.2) =>
  `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const circle = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
const shape = (d) => `<path d="${d}"/>`;
const solid = (el, fill, stroke = INK, width = 1.8) => el.replace(/\/>$/, ` fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"/>`);

// Colour a shape in like a crayon: strokes going back and forth inside it, then its outline.
function colour(el, crayon, [x, y, w, h], { gap = 3.2, outline = INK, width = 2 } = {}) {
  const id = `crayon-${uid++}`;
  let d = `M${x - 3} ${y - 3}`;
  for (let i = 0, yy = y - 3; yy < y + h + 4; i++, yy += gap) d += `L${i % 2 ? x - 3 : x + w + 3} ${r1(yy + gap)}`;
  return `<clipPath id="${id}">${el}</clipPath>`
    + `<path d="${d}" clip-path="url(#${id})" fill="none" stroke="${crayon}" stroke-width="${r1(gap * 1.05)}" stroke-linejoin="round" opacity="0.9"/>`
    + (outline ? el.replace(/\/>$/, ` fill="none" stroke="${outline}" stroke-width="${width}" stroke-linejoin="round"/>`) : '');
}

const heartD = (x, y, s) =>
  `M${x} ${r1(y + s * 0.9)} C${r1(x - s * 1.4)} ${r1(y - s * 0.1)} ${r1(x - s * 0.7)} ${r1(y - s * 1.1)} ${x} ${r1(y - s * 0.35)} `
  + `C${r1(x + s * 0.7)} ${r1(y - s * 1.1)} ${r1(x + s * 1.4)} ${r1(y - s * 0.1)} ${x} ${r1(y + s * 0.9)} Z`;

const heart = (x, y, s, c = RED) => colour(shape(heartD(x, y, s)), c, [x - s * 1.4, y - s * 1.1, s * 2.8, s * 2.1], { gap: Math.max(1.6, s * 0.3), width: 1.6 });

/* ---------- the two of us ---------- */

function face(x, y, lashes) {
  return `<circle cx="${x - 4.5}" cy="${y - 1}" r="1.7" fill="${INK}"/><circle cx="${x + 4.5}" cy="${y - 1}" r="1.7" fill="${INK}"/>`
    + (lashes ? ln(`M${x - 6} ${y - 1} l-2.6 -0.5 M${x + 6} ${y - 1} l2.6 -0.5`, INK, 1.1) : '') // at eye level: any higher and they read as cross eyebrows
    + `<circle cx="${x - 8}" cy="${y + 3.5}" r="2.3" fill="${PINK}" opacity="0.8"/><circle cx="${x + 8}" cy="${y + 3.5}" r="2.3" fill="${PINK}" opacity="0.8"/>`
    + ln(`M${x - 4.5} ${y + 3.5} Q${x} ${y + 8.5} ${x + 4.5} ${y + 3.5}`, INK, 1.8);
}

function bow(x, y, s = 1, c = RED) {
  return colour(shape(`M${x} ${y} L${x - 9 * s} ${y - 6 * s} L${x - 8 * s} ${y + 6 * s} Z`), c, [x - 10 * s, y - 7 * s, 11 * s, 14 * s], { gap: 2, width: 1.5 })
    + colour(shape(`M${x} ${y} L${x + 9 * s} ${y - 6 * s} L${x + 8 * s} ${y + 6 * s} Z`), c, [x - 1, y - 7 * s, 11 * s, 14 * s], { gap: 2, width: 1.5 })
    + `<circle cx="${x}" cy="${y}" r="${2.6 * s}" fill="${c}" stroke="${INK}" stroke-width="1.4"/>`;
}

function hisHead(hx, hy) {
  return colour(circle(hx, hy, 13), SKIN, [hx - 14, hy - 14, 28, 28], { gap: 2.6 })
    + colour(shape(`M${hx - 13.5} ${hy - 2} Q${hx - 14} ${hy - 17} ${hx} ${hy - 16} Q${hx + 14} ${hy - 17} ${hx + 13.5} ${hy - 2} `
      + `L${hx + 10} ${hy - 8} L${hx + 6} ${hy - 4} L${hx + 2} ${hy - 9} L${hx - 2} ${hy - 4} L${hx - 6} ${hy - 9} L${hx - 10} ${hy - 4} Z`),
    HAIR_HIM, [hx - 15, hy - 18, 30, 17], { gap: 2.4 })
    + face(hx, hy + 1, false);
}

function herHead(hx, hy) {
  return colour(shape(`M${hx - 14} ${hy - 1} Q${hx - 16} ${hy - 18} ${hx} ${hy - 17} Q${hx + 16} ${hy - 18} ${hx + 14} ${hy - 1} `
      + `L${hx + 17} ${hy + 20} Q${hx + 10} ${hy + 23} ${hx + 7} ${hy + 14} L${hx - 7} ${hy + 14} Q${hx - 10} ${hy + 23} ${hx - 17} ${hy + 20} Z`),
    HAIR_HER, [hx - 18, hy - 19, 36, 43], { gap: 2.6 })
    + colour(circle(hx, hy, 12.5), SKIN, [hx - 13, hy - 13, 26, 26], { gap: 2.6 })
    + ln(`M${hx - 12} ${hy - 3} Q${hx - 6} ${hy - 12} ${hx + 1} ${hy - 9} Q${hx + 7} ${hy - 13} ${hx + 12} ${hy - 3}`, HAIR_HER, 4.5)
    + bow(hx + 9, hy - 13)
    + face(hx, hy + 1, true);
}

const hand = ([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="${SKIN}" stroke="${INK}" stroke-width="1.4"/>`;

// (x, y) is between his feet; he's about 76 tall. left/right: where his hands end up.
function him(x, y, { shirt = BLUE, left = [x - 22, y - 33], right = [x + 22, y - 33], legs = true } = {}) {
  return [
    legs ? ln(`M${x - 5} ${y - 25} L${x - 7} ${y - 3}`, INK, 2.4) : '',
    legs ? ln(`M${x + 5} ${y - 25} L${x + 7} ${y - 3}`, INK, 2.4) : '',
    legs ? `<ellipse cx="${x - 9}" cy="${y - 2}" rx="5" ry="2.6" fill="${INK}"/><ellipse cx="${x + 9}" cy="${y - 2}" rx="5" ry="2.6" fill="${INK}"/>` : '',
    legs ? colour(shape(`M${x - 7} ${y - 30} L${x + 7} ${y - 30} L${x + 8} ${y - 19} L${x - 8} ${y - 19} Z`), SHORTS, [x - 9, y - 31, 18, 13], { gap: 2.4 }) : '',
    colour(shape(`M${x - 11} ${y - 47} Q${x} ${y - 52} ${x + 11} ${y - 47} L${x + 10} ${y - 27} L${x - 10} ${y - 27} Z`), shirt, [x - 12, y - 52, 24, 26]),
    ln(`M${x - 10} ${y - 44} L${left[0]} ${left[1]}`, INK, 2.4),
    ln(`M${x + 10} ${y - 44} L${right[0]} ${right[1]}`, INK, 2.4),
    hand(left),
    hand(right),
    ln(`M${x} ${y - 52} L${x} ${y - 48}`, INK, 2.4),
    hisHead(x, y - 62),
  ].join('');
}

// (x, y) is between her feet; she's about 76 tall, with her bow.
// left: null leaves that arm out, for when it's drawn behind someone else.
function her(x, y, { dress = PINK, left = [x - 21, y - 33], right = [x + 21, y - 33], legs = true } = {}) {
  return [
    legs ? ln(`M${x - 4} ${y - 22} L${x - 5} ${y - 3}`, INK, 2.4) : '',
    legs ? ln(`M${x + 4} ${y - 22} L${x + 5} ${y - 3}`, INK, 2.4) : '',
    legs ? `<ellipse cx="${x - 7}" cy="${y - 2}" rx="4.6" ry="2.5" fill="${RED}" stroke="${INK}" stroke-width="1.2"/><ellipse cx="${x + 7}" cy="${y - 2}" rx="4.6" ry="2.5" fill="${RED}" stroke="${INK}" stroke-width="1.2"/>` : '',
    left ? ln(`M${x - 7} ${y - 46} L${left[0]} ${left[1]}`, INK, 2.4) + hand(left) : '',
    ln(`M${x + 7} ${y - 46} L${right[0]} ${right[1]}`, INK, 2.4),
    hand(right),
    colour(shape(`M${x - 6} ${y - 50} L${x + 6} ${y - 50} L${x + 18} ${y - 20} Q${x} ${y - 16} ${x - 18} ${y - 20} Z`), dress, [x - 19, y - 51, 38, 35]),
    ln(`M${x} ${y - 52} L${x} ${y - 49}`, INK, 2.4),
    herHead(x, y - 62),
  ].join('');
}

// Sitting on the front of a couch, seen from the front: lap on the seat (seat y), shins
// hanging down in front of it to the floor. Drawn after the couch, so nothing goes into it.
function hisLap(x, seat, floor) {
  return ln(`M${x - 6} ${seat + 8} L${x - 7} ${floor - 2}`, INK, 2.4) + ln(`M${x + 6} ${seat + 8} L${x + 7} ${floor - 2}`, INK, 2.4)
    + `<ellipse cx="${x - 9}" cy="${floor}" rx="5" ry="2.6" fill="${INK}"/><ellipse cx="${x + 9}" cy="${floor}" rx="5" ry="2.6" fill="${INK}"/>`
    + colour(shape(`M${x - 11} ${seat - 5} L${x + 11} ${seat - 5} L${x + 12} ${seat + 10} L${x - 12} ${seat + 10} Z`), SHORTS, [x - 13, seat - 6, 26, 17], { gap: 2.4 });
}

function herLap(x, seat, floor) {
  return ln(`M${x - 5} ${seat + 10} L${x - 6} ${floor - 2}`, INK, 2.4) + ln(`M${x + 5} ${seat + 10} L${x + 6} ${floor - 2}`, INK, 2.4)
    + `<ellipse cx="${x - 8}" cy="${floor}" rx="4.6" ry="2.5" fill="${RED}" stroke="${INK}" stroke-width="1.2"/><ellipse cx="${x + 8}" cy="${floor}" rx="4.6" ry="2.5" fill="${RED}" stroke="${INK}" stroke-width="1.2"/>`
    + colour(shape(`M${x - 13} ${seat - 6} L${x + 13} ${seat - 6} Q${x + 19} ${seat + 5} ${x + 17} ${seat + 12} Q${x} ${seat + 16} ${x - 17} ${seat + 12} Q${x - 19} ${seat + 5} ${x - 13} ${seat - 6} Z`), PINK, [x - 19, seat - 7, 38, 23]);
}

/* ---------- bits and pieces ---------- */

function sun(x, y, r = 11, smiling = false) {
  let rays = '';
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5;
    rays += `M${r1(x + Math.cos(a) * (r + 3))} ${r1(y + Math.sin(a) * (r + 3))} L${r1(x + Math.cos(a) * (r + 9))} ${r1(y + Math.sin(a) * (r + 9))} `;
  }
  return ln(rays, ORANGE, 2.4)
    + colour(circle(x, y, r), YELLOW, [x - r, y - r, 2 * r, 2 * r], { outline: ORANGE, gap: 2.6 })
    + (smiling ? `<circle cx="${x - 3.5}" cy="${y - 2}" r="1.4" fill="${INK}"/><circle cx="${x + 3.5}" cy="${y - 2}" r="1.4" fill="${INK}"/>` + ln(`M${x - 4} ${y + 3} Q${x} ${y + 7} ${x + 4} ${y + 3}`, INK, 1.5) : '');
}

function grass(y, x0 = 0, x1 = 200) {
  let blades = '';
  for (let x = x0 + 3; x < x1; x += 7) blades += `M${x} ${y + 1} l-2 -7 M${x + 3} ${y + 1} l2 -8 `;
  return colour(shape(`M${x0} ${y} L${x1} ${y} L${x1} ${y + 18} L${x0} ${y + 18} Z`), GREEN, [x0, y, x1 - x0, 18], { outline: null, gap: 3 })
    + ln(blades, LEAF, 1.6);
}

function flower(x, y, petals = PINK) {
  let p = '';
  for (let i = 0; i < 5; i++) {
    const a = (i * 2 * Math.PI) / 5;
    p += solid(circle(r1(x + Math.cos(a) * 4.5), r1(y - 14 + Math.sin(a) * 4.5), 3.4), petals, INK, 1.2);
  }
  return ln(`M${x} ${y} L${x} ${y - 12}`, LEAF, 2) + p + solid(circle(x, y - 14, 2.6), YELLOW, INK, 1.2);
}

/* ---------- the scenes, in the order they appear in the letter ---------- */

const scenes = {
  // writing to her (with handwriting nobody can read), and a little rose growing out of it
  potlood: () => [
    sun(28, 26, 11),
    grass(152),
    solid(shape('M104 140 L170 130 L184 156 L112 166 Z'), PAPER, INK, 2),
    ln('M114 146 q3 -5 6 0 t6 0 t6 0 t6 0 t6 0 t6 0', BLUE, 1.5),
    ln('M117 153 q3 -5 6 0 t6 0 t6 0 t6 0 t6 0', BLUE, 1.5),
    ln('M121 160 q3 -4 6 0 t6 0 t6 0 t6 0', BLUE, 1.5),
    ln('M160 142 Q156 120 160 98', LEAF, 2.6),
    colour(shape('M158 124 q-14 -7 -17 3 q10 5 17 -3 Z'), GREEN, [140, 116, 19, 12], { gap: 2, width: 1.4 }),
    colour(circle(160, 90, 10), RED, [150, 80, 20, 20], { gap: 2.4 }),
    ln('M155 89 q5 -7 10 0 q-5 6 -7 1', '#9c1c22', 1.6),
    him(62, 160, { right: [100, 117] }),
    colour(shape('M80.5 98.8 L104.2 128.4 L111.3 122.8 L87.5 93.2 Z'), YELLOW, [80, 93, 32, 36], { gap: 2.4, width: 1.6 }),
    solid(shape('M104.2 128.4 L116 136 L111.3 122.8 Z'), '#e9c08a', INK, 1.4),
    solid(shape('M112.4 133.3 L116 136 L114.8 131.4 Z'), INK, INK, 1),
    solid(shape('M76.1 93.3 L80.5 98.8 L87.5 93.2 L83.1 87.7 Z'), PINK, INK, 1.4),
    hand([100, 117]),
    heart(26, 74, 6),
  ],

  // blowing out birthday candles, wishing for a girl just like her; the sun smiles
  koek: () => [
    sun(178, 24, 11, true),
    solid(shape('M22 40 q-10 -2 -6 -12 q2 -10 14 -8 q4 -12 18 -9 q8 -9 20 -2 q12 -6 18 4 q12 2 8 14 q4 10 -8 12 q-6 8 -18 4 q-10 6 -20 0 q-14 4 -20 -3 Z'), PAPER, INK, 1.8),
    solid(circle(63, 53, 4), PAPER, INK, 1.5),
    solid(circle(61, 64, 3), PAPER, INK, 1.4),
    solid(circle(58, 73, 2), PAPER, INK, 1.2),
    `<g transform="translate(46 30) scale(0.62) translate(-46 -30)">${herHead(46, 30)}</g>`,
    heart(74, 27, 7),
    grass(152),
    colour(shape('M96 118 L194 118 L194 126 L96 126 Z'), BROWN, [96, 118, 98, 8], { gap: 2.4 }),
    ln('M102 126 L102 156 M188 126 L188 156', BROWN, 3.4),
    colour(shape('M106 94 L182 94 L182 118 L106 118 Z'), PINK, [106, 94, 76, 24]),
    ln('M106 98 q4.5 6 9 0 t9 0 t9 0 t9 0 t9 0 t9 0 t9 0 t9 0 t4 0', PAPER, 3.4),
    ...[[122, BLUE], [144, YELLOW], [166, GREEN]].map(([x, c]) =>
      colour(shape(`M${x - 2.5} 78 L${x + 2.5} 78 L${x + 2.5} 94 L${x - 2.5} 94 Z`), c, [x - 3, 78, 6, 16], { gap: 2, width: 1.3 })
      + colour(shape(`M${x} 77 q-5 -5 1 -13 q2 6 5 8 q-1 5 -6 5 Z`), ORANGE, [x - 5, 63, 11, 15], { gap: 1.8, outline: RED, width: 1.2 })),
    him(56, 160, { left: [36, 128], right: [76, 124] }),
    ln('M70 100 Q84 92 100 88 M71 106 Q88 101 104 94 M69 95 Q82 84 98 81', SKY, 1.8),
  ],

  // the two of us, holding hands under a big heart
  hande: () => [
    heart(100, 44, 24),
    heart(48, 32, 7, PINK),
    heart(152, 24, 6, PINK),
    heart(164, 62, 5),
    heart(34, 70, 4),
    grass(152),
    flower(22, 156),
    flower(182, 156, YELLOW),
    him(70, 160, { right: [99, 119] }),
    her(130, 160, { left: [101, 119] }),
  ],

  // in a sea of fish, sharks and strange creatures, he caught her: his vissie with a bow
  vis: () => [
    sun(180, 22, 10),
    colour(shape('M0 124 Q12 116 25 124 T50 124 T75 124 T100 124 T125 124 T150 124 T175 124 T200 124 L200 170 L0 170 Z'), SEA, [0, 116, 200, 54], { gap: 3.4 }),
    ln('M20 142 q6 -4 12 0 M168 160 q6 -4 12 0 M70 162 q6 -4 12 0', SKY, 2),
    colour(shape('M104 125 L116 103 L124 125 Z'), GRAY, [104, 103, 20, 22], { gap: 2.4 }),
    colour(shape('M118 160 q-2 -18 14 -18 q16 0 14 18 q-4 -4 -7 0 q-3 -4 -7 0 q-3 -4 -7 0 q-4 -4 -7 0 Z'), PURPLE, [116, 142, 32, 19], { gap: 2.4 }),
    ...[[126, 149], [132, 146], [138, 149]].map(([x, y]) => solid(circle(x, y, 2.4), PAPER, INK, 1) + `<circle cx="${x}" cy="${y}" r="1" fill="${INK}"/>`),
    colour(`<ellipse cx="182" cy="148" rx="8" ry="5"/>`, YELLOW, [174, 143, 16, 10], { gap: 2, width: 1.4 }),
    solid(shape('M174 148 L167 143 L167 153 Z'), YELLOW, INK, 1.4),
    colour(shape('M0 108 L88 108 L88 116 L0 116 Z'), BROWN, [0, 108, 88, 8], { gap: 2.4 }),
    ln('M10 116 L10 142 M78 116 L78 142', BROWN, 3.6),
    ln('M72 76 L150 16', BROWN, 2.6),
    ln('M150 16 Q158 70 156 122', INK, 1),
    solid(circle(156, 121, 3), RED, INK, 1.2),
    colour(`<ellipse cx="26" cy="80" rx="15" ry="9"/>`, ORANGE, [10, 70, 32, 20], { gap: 2.4 }),
    colour(shape('M12 80 L1 71 L2 89 Z'), ORANGE, [0, 70, 13, 20], { gap: 2, width: 1.6 }),
    `<circle cx="34" cy="78" r="1.6" fill="${INK}"/>`,
    ln('M33 83 Q37 86 40 82', INK, 1.4),
    bow(28, 71, 0.7),
    him(50, 110, { left: [16, 86], right: [72, 76] }),
    heart(30, 54, 5),
    heart(16, 44, 4, PINK),
  ],

  // on the couch with my nerdy series, sharing the popcorn
  tv: () => [
    ln('M172 112 L166 126 M172 112 L178 126', INK, 2.2),
    ln('M166 72 L156 56 M178 72 L188 56', INK, 1.8),
    colour(shape('M148 72 L196 72 L196 112 L148 112 Z'), GRAY, [148, 72, 48, 40], { gap: 2.6 }),
    solid(shape('M153 77 L191 77 L191 107 L153 107 Z'), '#24346e', INK, 1.4),
    ...[[160, 84], [184, 86], [166, 100], [186, 101]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.1" fill="${YELLOW}"/>`),
    solid(shape('M172 82 q5 6 4 15 l-8 0 q-1 -9 4 -15 Z'), PAPER, INK, 1),
    ln('M170 98 l2 5 l2 -5', ORANGE, 2),
    colour(shape('M14 86 Q14 78 24 78 L124 78 Q134 78 134 86 L134 122 L14 122 Z'), ORANGE, [14, 78, 120, 44]),
    her(98, 146, { left: [80, 106], right: [117, 113], legs: false }),
    him(46, 146, { left: [29, 113], right: [70, 106], legs: false }),
    colour(shape('M66 104 L84 104 L81 124 L69 124 Z'), PAPER, [66, 104, 18, 20], { gap: 2.2 }),
    ln('M71 104 L72 124 M77 104 L76.5 124', RED, 2.2),
    ...[[68, 101, 3.4], [74, 99, 3.6], [80, 101, 3.2], [71, 96, 3], [78, 95, 3]].map(([x, y, r]) => solid(circle(x, y, r), '#fff3c8', INK, 1.1)),
    colour(shape('M6 116 L142 116 L142 142 L6 142 Z'), '#e07a2e', [6, 116, 136, 26]),
    colour(shape('M2 100 Q2 94 10 94 Q16 94 16 100 L16 142 L2 142 Z'), '#e07a2e', [2, 94, 14, 48], { gap: 2.6 }),
    colour(shape('M132 100 Q132 94 140 94 Q146 94 146 100 L146 142 L132 142 Z'), '#e07a2e', [132, 94, 14, 48], { gap: 2.6 }),
    ln('M10 142 L10 150 M138 142 L138 150', BROWN, 3),
    colour(`<ellipse cx="74" cy="158" rx="70" ry="7"/>`, PURPLE, [4, 151, 140, 14], { gap: 2.4, outline: null }),
    hisLap(46, 118, 156),
    herLap(98, 118, 156),
  ],

  // drukkies, games and tiktok streaks
  drukkie: () => [
    heart(30, 30, 7, PINK),
    heart(62, 16, 5),
    heart(142, 22, 6, PINK),
    heart(102, 12, 4),
    heart(176, 42, 5),
    grass(152),
    colour(shape('M14 112 q0 -8 10 -8 l12 0 q10 0 10 8 l2 10 q1 8 -6 6 l-6 -5 l-12 0 l-6 5 q-7 2 -6 -6 Z'), GRAY, [8, 104, 42, 26], { gap: 2.4 }),
    ln('M20 111 L26 111 M23 108 L23 114', INK, 1.8),
    `<circle cx="38" cy="110" r="1.8" fill="${RED}"/><circle cx="42" cy="113" r="1.8" fill="${BLUE}"/>`,
    solid(shape('M158 76 Q158 72 162 72 L180 72 Q184 72 184 76 L184 116 Q184 120 180 120 L162 120 Q158 120 158 116 Z'), '#2b2b3a', INK, 1.6),
    solid(shape('M161 77 L181 77 L181 113 L161 113 Z'), PAPER, PAPER, 0.5),
    colour(shape('M171 108 q-9 -2 -6 -12 q2 4 4 3 q-3 -9 5 -15 q0 7 5 10 q4 6 -1 11 q-2 3 -7 3 Z'), ORANGE, [163, 84, 16, 25], { gap: 2, outline: RED, width: 1.4 }),
    colour(shape('M171 107 q-4 -2 -2 -7 q2 2 3 0 q2 4 1 7 Z'), YELLOW, [168, 99, 6, 9], { gap: 1.6, outline: null }),
    ln('M111 114 L86 120', INK, 2.4), // her arm, round behind him
    him(84, 160, { right: [119, 112] }), // his arm goes round behind her, so she's drawn over it
    her(118, 160, { left: null }),
  ],

  // a year on: the two of us and our first rose (the wide one, at the very end)
  roos: () => [
    sun(30, 28, 12, true),
    heart(72, 24, 6),
    heart(196, 20, 7, PINK),
    heart(224, 52, 5),
    grass(142, 0, 260),
    flower(26, 146, YELLOW),
    flower(236, 146),
    ln('M130 146 Q126 110 130 64', LEAF, 3.2),
    colour(shape('M128 114 q-18 -10 -22 2 q12 6 22 -2 Z'), GREEN, [104, 104, 25, 14], { gap: 2, width: 1.4 }),
    colour(shape('M131 94 q18 -10 22 2 q-12 6 -22 -2 Z'), GREEN, [130, 84, 25, 14], { gap: 2, width: 1.4 }),
    colour(circle(130, 52, 15), RED, [115, 37, 30, 30], { gap: 2.6 }),
    ln('M123 51 q7 -10 14 0 q-7 9 -10 1 q2 -5 6 -1', '#991820', 1.8),
    him(88, 150, { right: [124, 112] }),
    her(172, 150, { left: [136, 112] }),
  ],
};

const WIDE = new Set(['roos']);

// The filter that makes it all look drawn in wax crayon. Put it in the page once.
export const CRAYON_FILTER = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <filter id="crayon" x="-4%" y="-4%" width="108%" height="108%">
    <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="4" result="wobble"/>
    <feDisplacementMap in="SourceGraphic" in2="wobble" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="wobbly"/>
    <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="1" seed="9" result="grain"/>
    <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.55" result="tooth"/>
    <feComposite in="wobbly" in2="tooth" operator="in"/>
  </filter>
</svg>`;

export const hasDoodle = (name) => name in scenes;

export function doodle(name) {
  const wide = WIDE.has(name);
  return `<svg viewBox="0 0 ${wide ? 260 : 200} ${wide ? 168 : 170}" role="img" aria-hidden="true"><g filter="url(#crayon)">${scenes[name]().join('')}</g></svg>`;
}

// <3 in the letter: a small heart in red ink
export const inkHeart = `<svg class="ink-heart" viewBox="-10 -10 20 20" aria-label="hartjie" role="img"><path d="${heartD(0, 0, 7)}" fill="#b3121b"/></svg>`;
