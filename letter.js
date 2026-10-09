/*
 * The anniversary letter: words sealed in garden/letter.bin (see `node tuin.mjs letter`),
 * laid out on a scroll with crayon drawings in the margins.
 *
 * In the letter's text:
 *   # My liefste …          the greeting at the top
 *   ~ 1 jaar op ons …       the sign-off
 *   {vis}                   a drawing (see doodles.js); on its own line it goes full width
 *   [lief|SUUUUPER BAIE]    a word to tap, which sends the second part across the news ticker
 *   <3                      a little heart
 * A blank line starts a new paragraph.
 */
import { doodle, hasDoodle, inkHeart } from './doodles.js';

const el = (tag, className = '') => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
};

export function renderLetter(container, text, onTap) {
  container.replaceChildren();
  let side = 0;
  let first = true;
  for (const block of text.trim().split(/\n\s*\n/)) {
    const line = block.trim().replace(/\s*\n\s*/g, ' ');
    const alone = line.match(/^\{(\w+)\}$/);
    if (line.startsWith('# ')) {
      const h = el('h2', 'greeting');
      h.textContent = line.slice(2);
      container.append(h);
      continue;
    }
    if (alone) {
      if (hasDoodle(alone[1])) {
        const d = el('div', 'doodle wide');
        d.innerHTML = doodle(alone[1]);
        container.append(d);
      }
      continue;
    }

    const signoff = line.startsWith('~ ');
    const words = (signoff ? line.slice(2) : line).replace(/\s+<3/g, '\u00a0<3'); // keep hearts with their word
    const p = el('p', signoff ? 'signoff' : first ? 'first' : '');
    if (!signoff) first = false;
    let at = 0;
    for (const m of words.matchAll(/\{(\w+)\}|\[([^\]|]+)\|([^\]]+)\]|<3/g)) {
      p.append(words.slice(at, m.index));
      at = m.index + m[0].length;
      if (m[1]) { // a drawing, alternating sides down the scroll
        if (!hasDoodle(m[1])) continue;
        const d = el('span', `doodle ${side++ % 2 ? 'left' : 'right'}`);
        d.innerHTML = doodle(m[1]);
        p.append(d);
      } else if (m[2]) {
        const b = el('button', 'tap');
        b.type = 'button';
        b.textContent = m[2];
        b.addEventListener('click', () => onTap(m[3]));
        p.append(b);
      } else {
        const h = el('span', 'heart');
        h.innerHTML = inkHeart;
        p.append(h);
      }
    }
    p.append(words.slice(at));
    container.append(p);
  }
}
