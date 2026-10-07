#!/usr/bin/env node
/*
 * Looking after the garden from your laptop.
 *
 *   node tuin.mjs setup          pick the password and give the site its GitHub key
 *                                (run it again to renew the key; the password stays)
 *   node tuin.mjs list           everything planted so far, with ids
 *   node tuin.mjs remove <id>…   dig something up (the only way to remove anything)
 *   node tuin.mjs export [dir]   decrypt everything into a folder, as a keepsake/backup
 *
 * TUIN_PASSWORD=… and TUIN_TOKEN=… skip the prompts (but end up in your shell history).
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ITERATIONS, deriveKey, fromBase64, normalize, open, openJSON, sealJSON, toBase64 } from './crypto.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.join(here, 'garden', 'seed.json');
const MANIFEST = path.join(here, 'garden', 'memories.bin');

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    repo: { type: 'string' },
    branch: { type: 'string', default: 'main' },
    since: { type: 'string' },
    'skip-check': { type: 'boolean', default: false },
  },
});

const rel = (p) => path.relative(process.cwd(), p) || '.';
const [command, ...args] = positionals;
const commands = { setup, list, remove, export: exportAll };

(commands[command] ?? help)(...args).catch((err) => {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
});

async function help() {
  console.log(`usage:
  node tuin.mjs setup          pick the password and give the site its GitHub key
  node tuin.mjs list           everything planted so far
  node tuin.mjs remove <id>…   dig something up
  node tuin.mjs export [dir]   decrypt everything into a folder`);
}

/* ---------- setup ---------- */

async function setup() {
  const existing = await readJSON(SEED);
  let seed, key, secrets;

  if (existing) {
    console.log('The garden is already planted, so this renews its GitHub key.');
    console.log('(The password stays the same. To start over, delete garden/ first.)\n');
    ({ key, secrets } = await unlock(existing));
    seed = existing;
  } else {
    console.log('Pick the password you will both type. Capitals, extra spaces and date formats are ignored.');
    console.log('The repo is public, so make it something a stranger could never guess.\n');
    const password = await newPassword();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    key = await deriveKey(password, salt);
    seed = { v: 1, iter: ITERATIONS, salt: toBase64(salt) };
    secrets = {};
  }

  // The day it all started. It's sealed in with the key, so the public page never shows it.
  const since = opts.since ?? secrets.since ?? (await ask('the day it all started (day/month/year): '));
  const day = normalize(since);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`"${since}" doesn't look like a date`);
  console.log(`started: ${day}`);

  const repo = opts.repo ?? secrets.repo ?? guessRepo() ?? (await ask('GitHub repo (you/name): '));
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error(`"${repo}" should look like you/name`);
  console.log(`repo: ${repo}, branch: ${opts.branch}`);

  console.log('\nNow the GitHub key, so the site can plant things in the repo:');
  console.log(`  github.com/settings/personal-access-tokens/new → only "${repo}" → Contents: Read and write`);
  const token = process.env.TUIN_TOKEN || (await askHidden('paste the token: ')).trim();
  if (!token) throw new Error('no token');
  // A classic token (ghp_…) can reach every repo you have; this one ends up in a public repo.
  if (token.startsWith('ghp_')) throw new Error('that is a classic token, which can reach all your repos. Make a fine-grained one (it starts with github_pat_) for just this repo');

  const expires = opts['skip-check'] ? null : await checkToken(repo, token);
  secrets = { since: day, repo, branch: opts.branch, token, expires };

  seed.keys = toBase64(await sealJSON(key, secrets));
  await mkdir(path.dirname(SEED), { recursive: true });
  await writeFile(SEED, `${JSON.stringify(seed, null, 2)}\n`);
  console.log(`\n✓ ${rel(SEED)}`);
  if (!(await readFile(MANIFEST).catch(() => null))) {
    await writeFile(MANIFEST, await sealJSON(key, { v: 1, memories: [] }));
    console.log(`✓ ${rel(MANIFEST)} (empty, ready for memories)`);
  }
  if (expires) console.log(`\nThe key works until ${expires}. Run "node tuin.mjs setup" again before then.`);
  console.log('Commit and push garden/, and the site will open with this password.');
}

function guessRepo() {
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: here, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return url.match(/github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?$/)?.[1] ?? null;
  } catch {
    return null;
  }
}

// Make sure the key can write to the repo, and find out when it expires.
async function checkToken(repo, token) {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const res = await fetch(`https://api.github.com/repos/${repo}`, { headers });
  if (res.status === 401) throw new Error("GitHub doesn't recognise that token");
  if (res.status === 404) throw new Error(`the token can't see ${repo}. Push the repo first, and give the token access to it`);
  if (!res.ok) throw new Error(`GitHub said ${res.status}`);
  // Writing a loose blob proves "Contents: write" without changing anything you can see.
  const blob = await fetch(`https://api.github.com/repos/${repo}/git/blobs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content: 'roos', encoding: 'utf-8' }),
  });
  if (!blob.ok) throw new Error('the token can read the repo but not write to it. Give it "Contents: Read and write"');
  // e.g. "2027-03-01 10:00:00 UTC"; absent for keys that never expire
  return res.headers.get('github-authentication-token-expiration')?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
}

/* ---------- list / remove / export ---------- */

async function loadGarden() {
  const seed = await readJSON(SEED);
  if (!seed) throw new Error(`no ${rel(SEED)} yet. Run "node tuin.mjs setup" first`);
  const { key } = await unlock(seed);
  const bytes = await readFile(MANIFEST).catch(() => null);
  const garden = bytes ? await openJSON(key, bytes) : { v: 1, memories: [] };
  return { key, garden };
}

const describe = (m) => m.caption || m.title || m.song?.title || (m.text ? `"${m.text.slice(0, 50).replace(/\s+/g, ' ')}${m.text.length > 50 ? '…' : ''}"` : '');

async function list() {
  const { garden } = await loadGarden();
  const ms = [...garden.memories].sort((a, b) => a.date.localeCompare(b.date));
  if (!ms.length) return console.log('nothing planted yet');
  for (const m of ms) console.log(`${m.date}  ${m.id.padEnd(22)} ${m.kind.padEnd(5)} ${(m.by || '').padEnd(8)} ${describe(m)}`);
  console.log(`\n${ms.length} memories`);
}

async function remove(...ids) {
  if (!ids.length) throw new Error('which one? e.g. node tuin.mjs remove 2026-02-14-k3j9x2 (see node tuin.mjs list)');
  const { key, garden } = await loadGarden();
  const gone = garden.memories.filter((m) => ids.includes(m.id));
  const missing = ids.filter((id) => !gone.some((m) => m.id === id));
  if (missing.length) throw new Error(`not in the garden: ${missing.join(', ')}`);
  for (const m of gone) console.log(`  ${m.date}  ${m.kind}  ${describe(m)}`);
  if ((await ask(`\nDig up ${gone.length === 1 ? 'this' : `these ${gone.length}`} for good? (y/n) `)).trim().toLowerCase() !== 'y') return console.log('left alone');
  garden.memories = garden.memories.filter((m) => !ids.includes(m.id));
  await writeFile(MANIFEST, await sealJSON(key, garden));
  for (const m of gone) for (const f of filesOf(m)) await rm(path.join(here, f), { force: true });
  console.log(`\n✓ removed ${gone.length}. Commit and push to make it final:`);
  console.log('  git add -A garden && git commit -m "dig something up" && git push');
}

const filesOf = (m) => [m.photo, m.thumb, m.audio].filter(Boolean);

async function exportAll(dir = path.join(here, 'private', 'export')) {
  const { key, garden } = await loadGarden();
  await mkdir(dir, { recursive: true });
  const ms = [...garden.memories].sort((a, b) => a.date.localeCompare(b.date));
  const lines = ['# ons tuin', ''];
  const safe = (s) => s.replace(/[/\\:*?"<>|]+/g, '').slice(0, 60).trim();
  for (const m of ms) {
    if (m.kind === 'photo') {
      const sealed = await readFile(path.join(here, m.photo)).catch(() => null);
      if (!sealed) {
        console.log(`  (missing ${m.photo}, run git pull?)`);
        continue;
      }
      const name = `${m.date} ${safe(m.caption || m.id)}.jpg`;
      await writeFile(path.join(dir, name), await open(key, sealed));
      lines.push(`- ${m.date}: foto "${name}"${m.by ? ` (${m.by})` : ''}`);
    } else if (m.kind === 'note') {
      lines.push(`- ${m.date}: briefie${m.by ? ` van ${m.by}` : ''}${m.opens ? ` (gaan oop op ${m.opens})` : ''}`, '', ...m.text.split('\n').map((l) => `  > ${l}`), '');
    } else if (m.kind === 'song') {
      lines.push(`- ${m.date}: liedjie "${m.song.title || m.song.url}"${m.song.artist ? ` deur ${m.song.artist}` : ''}: ${m.song.url}${m.text ? `\n  > ${m.text}` : ''}`);
    }
  }
  await writeFile(path.join(dir, 'ons-roos.md'), `${lines.join('\n')}\n`);
  console.log(`✓ ${ms.length} memories → ${rel(dir)}`);
  if (dir.startsWith(path.join(here, 'private'))) console.log('  (private/ is gitignored, so this stays on your laptop)');
}

/* ---------- passwords and prompts ---------- */

async function unlock(seed) {
  const password = process.env.TUIN_PASSWORD ?? (await askHidden('password: '));
  const key = await deriveKey(password, seed.salt, seed.iter);
  try {
    return { key, secrets: await openJSON(key, fromBase64(seed.keys)) };
  } catch {
    throw new Error("that's not the garden's password");
  }
}

async function newPassword() {
  if (process.env.TUIN_PASSWORD) return process.env.TUIN_PASSWORD;
  if (!process.stdin.isTTY) throw new Error('run this in a terminal (or set TUIN_PASSWORD)');
  for (;;) {
    const first = await askHidden('password: ');
    if (!normalize(first)) {
      console.log('  (empty, try again)');
      continue;
    }
    const second = await askHidden('again:    ');
    if (normalize(first) === normalize(second)) {
      if (normalize(first).length < 8) console.log('  (short passwords are easy to guess, and this one guards a public repo)');
      return first;
    }
    console.log("  those didn't match, try again");
  }
}

async function readJSON(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw new Error(`${rel(file)} isn't valid JSON: ${err.message}`);
  }
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    rl._writeToOutput = () => {}; // don't echo what's typed
  });
}
