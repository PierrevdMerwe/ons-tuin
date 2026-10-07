#!/usr/bin/env node
/*
 * Preview the garden on your laptop:
 *
 *   node dev.mjs            → http://localhost:8000
 *
 * Serves the site, and stands in for GitHub: on localhost the page plants into
 * this server instead of the real repo, which writes the files straight into
 * garden/ here. Commit them to keep them, or throw them away with
 *   git checkout garden/ && git clean -fd garden/
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 8000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

/* ---------- a tiny pretend GitHub: just the git calls the page makes ---------- */

let head = `local-${Date.now().toString(36)}`;
const commits = new Map([[head, { tree: `tree-${head}`, parents: [] }]]);
const trees = new Map();
const blobs = new Map();
const sha = (s) => createHash('sha1').update(s).digest('hex');

async function github(req, res, route) {
  const body = req.method === 'GET' ? null : JSON.parse((await readBody(req)).toString() || '{}');
  const send = (status, data) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(data));
  };
  let m;
  if ((m = route.match(/^repos\/[^/]+\/[^/]+\/git\/ref\/heads\/(.+)$/))) {
    return send(200, { ref: `refs/heads/${m[1]}`, object: { sha: head, type: 'commit' } });
  }
  if ((m = route.match(/^repos\/[^/]+\/[^/]+\/git\/commits\/([^/]+)$/)) && req.method === 'GET') {
    const c = commits.get(m[1]);
    return c ? send(200, { sha: m[1], tree: { sha: c.tree } }) : send(404, { message: 'Not Found' });
  }
  if ((m = route.match(/^repos\/[^/]+\/[^/]+\/contents\/(.+)$/))) {
    const file = safePath(decodeURIComponent(m[1].split('?')[0]));
    try {
      const data = await readFile(file); // like GitHub: the blob's id, then the bytes from git/blobs
      const id = sha(data);
      blobs.set(id, data);
      return send(200, { type: 'file', size: data.length, sha: id });
    } catch {
      return send(404, { message: 'Not Found' });
    }
  }
  if ((m = route.match(/^repos\/[^/]+\/[^/]+\/git\/blobs\/([^/?]+)$/)) && req.method === 'GET') {
    const data = blobs.get(m[1]);
    return data ? send(200, { sha: m[1], size: data.length, encoding: 'base64', content: data.toString('base64') }) : send(404, { message: 'Not Found' });
  }
  if (route.match(/^repos\/[^/]+\/[^/]+\/git\/blobs$/) && req.method === 'POST') {
    const id = sha(body.content);
    blobs.set(id, Buffer.from(body.content, body.encoding === 'base64' ? 'base64' : 'utf8'));
    return send(201, { sha: id });
  }
  if (route.match(/^repos\/[^/]+\/[^/]+\/git\/trees$/) && req.method === 'POST') {
    const id = sha(JSON.stringify(body));
    trees.set(id, body.tree);
    return send(201, { sha: id });
  }
  if (route.match(/^repos\/[^/]+\/[^/]+\/git\/commits$/) && req.method === 'POST') {
    const id = sha(JSON.stringify(body) + Math.random());
    commits.set(id, { tree: body.tree, parents: body.parents, message: body.message });
    return send(201, { sha: id });
  }
  if ((m = route.match(/^repos\/[^/]+\/[^/]+\/git\/refs\/heads\/(.+)$/)) && req.method === 'PATCH') {
    const c = commits.get(body.sha);
    if (!c) return send(422, { message: 'Object does not exist' });
    if (c.parents[0] !== head && !body.force) return send(422, { message: 'Update is not a fast forward' });
    for (const entry of trees.get(c.tree) || []) {
      const file = safePath(entry.path);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, blobs.get(entry.sha));
      console.log(`  planted ${entry.path}`);
    }
    console.log(`✓ ${c.message}`);
    head = body.sha;
    return send(200, { object: { sha: head } });
  }
  if (route.match(/^repos\/[^/]+\/[^/]+$/)) return send(200, { full_name: 'local/preview', permissions: { push: true } });
  return send(404, { message: `dev.mjs doesn't fake ${req.method} ${route}` });
}

/* ---------- static files ---------- */

function safePath(p) {
  const file = path.normalize(path.join(root, p));
  if (!file.startsWith(root + path.sep) && file !== root) throw new Error('outside the site');
  return file;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/__github/')) return await github(req, res, url.pathname.slice(10) + url.search);
    let file = safePath(decodeURIComponent(url.pathname));
    if (url.pathname.endsWith('/')) file = path.join(file, 'index.html');
    if (path.relative(root, file).split(path.sep).some((part) => part.startsWith('.') || part === 'private' || part === 'node_modules')) {
      res.writeHead(404);
      return res.end();
    }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  } catch (err) {
    res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'content-type': 'text/plain' });
    res.end(err.code === 'ENOENT' ? 'not found' : String(err.message));
  }
}).listen(port, () => {
  console.log(`the garden is at http://localhost:${port}`);
  console.log('anything planted here is written into garden/ on this laptop\n');
});
