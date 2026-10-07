/*
 * Where the memories live: encrypted files in garden/ in this same repo.
 *
 *   garden/seed.json      the salt, plus the GitHub key sealed with the password
 *   garden/memories.bin   everything planted, plus the decorations and the idea board (sealed JSON)
 *   garden/photos/…       full photos, garden/thumbs/… small ones (sealed JPEGs)
 *
 * Reading goes through GitHub Pages like any other file. Planting writes one
 * commit to the repo through the GitHub API, with the key from seed.json. There
 * is deliberately no way to delete or change anything from the site.
 */
import { deriveKey, fromBase64, open, openJSON, seal, sealJSON, toBase64 } from './crypto.js';

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const API = LOCAL ? '/__github' : 'https://api.github.com'; // dev.mjs pretends to be GitHub
export const MANIFEST = 'garden/memories.bin';

export async function loadSeed() {
  const res = await fetch('garden/seed.json', { cache: 'no-cache' });
  if (!res.ok) return null;
  return res.json();
}

export async function keyFor(seed, password) {
  return deriveKey(password, seed.salt, seed.iter);
}

// The GitHub key + repo, if this is the right key. Throws if it isn't.
export async function openSeed(seed, key) {
  return openJSON(key, fromBase64(seed.keys));
}

/* ---------- remembering the key on this device ---------- */

// The derived key itself (not the password) goes in IndexedDB. It can't be read
// back out as bytes, only used by this site.
function db() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('roos', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('keys');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function keyStore(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('keys', mode);
    const req = fn(tx.objectStore('keys'));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const rememberKey = (key) => keyStore('readwrite', (s) => s.put(key, 'garden')).catch(() => {});
export const recallKey = () => keyStore('readonly', (s) => s.get('garden')).catch(() => null);
export const forgetKey = () => keyStore('readwrite', (s) => s.delete('garden')).catch(() => {});

/* ---------- the garden ---------- */

export class KeyError extends Error {}

export function openGarden(key, secrets) {
  const [owner, repo] = secrets.repo.split('/');
  const branch = secrets.branch || 'main';
  const urls = new Map();

  async function gh(path, { method = 'GET', body, raw = false } = {}) {
    const res = await fetch(`${API}/repos/${owner}/${repo}/${path}`, {
      method,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${secrets.token}`,
        Accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body && JSON.stringify(body),
    });
    if (res.status === 401) throw new KeyError('the GitHub key expired or was revoked');
    return res;
  }

  async function ghJSON(path, opts) {
    const res = await gh(path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || `GitHub said ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // Straight from the repo: fresh even before GitHub Pages has redeployed.
  async function fromRepo(path, ref = branch) {
    const res = await gh(`contents/${path}?ref=${encodeURIComponent(ref)}`, { raw: true });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub said ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async function fromPages(path, fresh = false) {
    const res = await fetch(path, fresh ? { cache: 'no-cache' } : {});
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`couldn't load ${path} (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }

  // { memories, decor, ideas }, filling in what older files don't have yet
  const withDefaults = (data) => ({ v: 1, ...data, memories: data?.memories ?? [], decor: data?.decor ?? [], ideas: data?.ideas ?? [] });

  async function upload(bytes) {
    const { sha } = await ghJSON('git/blobs', { method: 'POST', body: { content: toBase64(bytes), encoding: 'base64' } });
    return sha;
  }

  return {
    secrets,

    async load() {
      let bytes;
      try {
        bytes = await fromRepo(MANIFEST);
      } catch (err) {
        if (!(err instanceof KeyError)) console.warn(err);
        bytes = await fromPages(MANIFEST, true); // the key's gone or GitHub is down: Pages still works
      }
      return withDefaults(bytes ? await openJSON(key, bytes) : null);
    },

    // A sealed picture as an object URL. Pages first; very new files come from the repo.
    async picture(path) {
      if (!urls.has(path)) {
        urls.set(path, (async () => {
          const sealed = (await fromPages(path).catch(() => null)) ?? (await fromRepo(path));
          if (!sealed) throw new Error(`missing ${path}`);
          return URL.createObjectURL(new Blob([await open(key, sealed)], { type: 'image/jpeg' }));
        })());
        urls.get(path).catch(() => urls.delete(path));
      }
      return urls.get(path);
    },

    // Keep the uploader's own copy so new photos show before Pages catches up.
    cache(path, blob) {
      urls.set(path, Promise.resolve(URL.createObjectURL(blob)));
    },

    /*
     * Change the garden in one commit: upload `files`, then re-read the list from the
     * repo, let `mutate` change it, and commit. The commit has to fast-forward, so if
     * the other phone got in first, it goes again on top of theirs.
     */
    async change(mutate, message, files = [], onProgress = () => {}) {
      const blobs = [];
      for (const [n, f] of files.entries()) {
        onProgress({ step: 'upload', done: n, total: files.length });
        blobs.push({ path: f.path, sha: await upload(await seal(key, f.bytes)) });
      }
      onProgress({ step: 'commit', done: files.length, total: files.length });

      for (let attempt = 0; attempt < 4; attempt++) {
        const ref = await ghJSON(`git/ref/heads/${branch}`);
        const head = ref.object.sha;
        const commit = await ghJSON(`git/commits/${head}`);
        const current = withDefaults(await fromRepo(MANIFEST, head).then((b) => (b ? openJSON(key, b) : null)));
        const next = mutate(structuredClone(current));
        const listSha = await upload(await sealJSON(key, next));
        const tree = await ghJSON('git/trees', {
          method: 'POST',
          body: {
            base_tree: commit.tree.sha,
            tree: [...blobs, { path: MANIFEST, sha: listSha }].map(({ path, sha }) => ({ path, mode: '100644', type: 'blob', sha })),
          },
        });
        const made = await ghJSON('git/commits', { method: 'POST', body: { message, tree: tree.sha, parents: [head] } });
        try {
          await ghJSON(`git/refs/heads/${branch}`, { method: 'PATCH', body: { sha: made.sha, force: false } });
          return next;
        } catch (err) {
          if (err.status !== 422) throw err; // 422: someone else got in first
        }
      }
      throw new Error('the garden was busy, try again in a moment');
    },

    // Plant new memories. `items` is [{ memory, files: [{ path, bytes }] }]. Only ever adds.
    plant(items, message, onProgress) {
      return this.change((g) => {
        const have = new Set(g.memories.map((m) => m.id));
        g.memories.push(...items.map((i) => i.memory).filter((m) => !have.has(m.id)));
        return g;
      }, message, items.flatMap((i) => i.files), onProgress);
    },
  };
}
