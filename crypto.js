/*
 * The lock on the garden, shared by the site and tuin.mjs.
 *
 * The password is stretched into one AES key (PBKDF2, salt in garden/seed.json).
 * Every file in garden/ is that key + a fresh random IV: [12-byte iv][ciphertext].
 * The repo can be public: without the password it's all noise.
 */

export const ITERATIONS = 250_000;

// Phones capitalise, and a date can be typed many ways:
// 2024/03/15, 15-3-2024, 15 March 2024 and 15032024 all become 2024-03-15.
const MONTHS = [/^jan/, /^feb/, /^ma[ar]/, /^apr/, /^(may|mei)/, /^jun/, /^jul/, /^aug/, /^sep/, /^o[ck]t/, /^nov/, /^de[cs]/];
const isDate = ([, m, d]) => +m >= 1 && +m <= 12 && +d >= 1 && +d <= 31;

function asDate(s) {
  const parts = s
    .replace(/(\d)(st|nd|rd|th|ste|de)\b/g, '$1')
    .replace(/[a-z]+/g, (w) => {
      const i = MONTHS.findIndex((re) => re.test(w));
      return i < 0 ? ` ${w} ` : ` ${i + 1} `;
    })
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  let ymd = null;
  if (parts.length === 1 && /^\d{8}$/.test(parts[0])) {
    const n = parts[0];
    ymd = [n.slice(0, 4), n.slice(4, 6), n.slice(6)];
    if (!isDate(ymd)) ymd = [n.slice(4), n.slice(2, 4), n.slice(0, 2)];
  } else if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) {
    if (parts[0].length === 4) ymd = parts;
    else if (parts[2].length === 4) ymd = +parts[1] > 12 ? [parts[2], parts[0], parts[1]] : [parts[2], parts[1], parts[0]];
  }
  return ymd && isDate(ymd) ? ymd.map((p, i) => String(+p).padStart(i ? 2 : 4, '0')).join('-') : null;
}

export function normalize(pw) {
  const s = pw.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
  return asDate(s) ?? s;
}

export function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function deriveKey(password, salt, iterations = ITERATIONS) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(normalize(password)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: typeof salt === 'string' ? fromBase64(salt) : salt, iterations, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function seal(key, bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  const out = new Uint8Array(12 + data.length);
  out.set(iv);
  out.set(data, 12);
  return out;
}

// Throws if the key is wrong (AES-GCM checks itself).
export async function open(key, sealed) {
  const bytes = sealed instanceof Uint8Array ? sealed : new Uint8Array(sealed);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) }, key, bytes.subarray(12)));
}

export const sealJSON = (key, value) => seal(key, new TextEncoder().encode(JSON.stringify(value)));
export const openJSON = async (key, sealed) => JSON.parse(new TextDecoder().decode(await open(key, sealed)));
