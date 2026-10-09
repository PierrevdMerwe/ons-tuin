/*
 * ons tuin: the lock, then the garden.
 *
 *   garden.js  the rose bush (grows with the date)
 *   roots.js   the roots and the memories at their tips
 *   store.js   reading and planting memories (encrypted, in this repo)
 *   words.js   everything it says
 *   letter.js  the anniversary letter, with drawings from doodles.js
 *
 * Previewing: ?date=2028-06-01 shows the garden on another day, ?hour=21 at another time.
 */
import { CRAYON_FILTER } from './doodles.js';
import { ageOn, createGarden, dateAtAge, paintRose } from './garden.js';
import { renderLetter } from './letter.js';
import { drawRoots, isSealed, parseDay } from './roots.js';
import { KeyError, forgetKey, keyFor, loadSeed, openGarden, openSeed, recallKey, rememberKey } from './store.js';
import * as say from './words.js';

const $ = (sel) => document.querySelector(sel);
const DAY = 864e5;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
let since = null; // the day it all started: sealed in garden/seed.json, so only known once unlocked
const gardeners = document.body.dataset.gardeners.split(',').map((s) => s.trim()).filter(Boolean);
const herName = document.body.dataset.for;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);
const now = () => (params.get('date') ? parseDay(params.get('date')) : new Date());
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

let seed = null;
let garden = null;   // store.js: reading and planting
let sky = null;      // garden.js: the bush
let roots = null;    // roots.js: what's drawn below ground
let memories = [];
let decor = []; // decorations switched on: shared, saved in the garden
let ideas = []; // the idea board
let letterText = null; // the anniversary letter, if there is one

function take(data) {
  memories = data.memories;
  decor = data.decor;
  ideas = data.ideas;
  sky?.setDecor(decor);
}

/* ---------- toast ---------- */

let toastTimer = 0;
function toast(text, ms = 3800) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), ms);
}

/* ---------- 1. the lock ---------- */

function drawLockRose() {
  const c = $('#lockRose');
  const dpr = Math.min(2, devicePixelRatio || 1);
  const { width, height } = c.getBoundingClientRect();
  c.width = width * dpr;
  c.height = height * dpr;
  const g = c.getContext('2d');
  // a bud just about to open (how far the real one is stays behind the lock)
  const stage = 1.15;
  const k = (width / 80) * dpr;
  const stemTop = height * 0.5;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.strokeStyle = '#46663a';
  g.lineWidth = 2.2;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(width / 2 + 3, height - 4);
  g.bezierCurveTo(width / 2 - 6, height * 0.8, width / 2 + 6, height * 0.64, width / 2, stemTop);
  g.stroke();
  g.fillStyle = '#4f6f40';
  for (const [y, s] of [[0.84, -1], [0.68, 1]]) {
    g.beginPath();
    g.ellipse(width / 2 + s * 13, height * y, 12, 4.5, s * -0.5, 0, Math.PI * 2);
    g.fill();
  }
  g.setTransform(k, 0, 0, k, (width / 2) * dpr, stemTop * dpr);
  paintRose(g, Math.min(stage, 2), 1, 0);
}

let nopes = 0;
async function tryPassword(event) {
  event.preventDefault();
  const input = $('#pw');
  const button = $('#openBtn');
  const msg = $('#lockMsg');
  if (!input.value.trim()) return input.focus();
  button.disabled = true;
  msg.textContent = '…';
  try {
    const key = await keyFor(seed, input.value);
    let secrets;
    try {
      secrets = await openSeed(seed, key);
    } catch {
      msg.textContent = say.NOPE[nopes++ % say.NOPE.length];
      const form = $('#lockForm');
      form.classList.remove('shake');
      void form.offsetWidth;
      form.classList.add('shake');
      input.select();
      return;
    }
    msg.textContent = '';
    await rememberKey(key); // every device remembers; "sluit die tuin" in the ⓘ panel forgets
    input.blur();
    await enter(key, secrets);
  } finally {
    button.disabled = false;
  }
}

/* ---------- 2. the garden ---------- */

async function enter(key, secrets) {
  since = parseDay(secrets.since);
  garden = openGarden(key, secrets);
  const lock = $('#lock');
  lock.classList.add('opening');
  await new Promise((r) => setTimeout(r, reduceMotion ? 0 : 500));
  lock.hidden = true;
  document.body.classList.add('in-garden');
  const el = $('#garden');
  el.hidden = false;
  el.classList.add('arriving');
  scrollTo(0, 0);

  setupSky();
  setupHero();
  setupDialogs();
  loadMemories();
  loadLetter();

  // grow from a seed to today, the first time per visit
  const age = ageOn(now(), since);
  let first = true;
  try {
    first = !sessionStorage.getItem('roos-grown');
    sessionStorage.setItem('roos-grown', '1');
  } catch {}
  if (first && !params.has('date')) replay(Math.min(4200, 1400 + age * 2600));
  else sky.setAge(age);
}

function setupSky() {
  const hero = $('#hero');
  sky = createGarden($('#sky'), {
    onFrame: (age) => {
      if (replaying) $('#replayDate').textContent = say.formatDate(dateAtAge(age, since));
    },
  });
  if (params.has('hour')) sky.setHour(Number(params.get('hour')));

  const fit = () => {
    const h = hero.getBoundingClientRect();
    const ground = $('#soil').getBoundingClientRect().top - h.top + 4;
    const top = $('#heroText').getBoundingClientRect().bottom - h.top + 18;
    sky.resize(ground, top);
  };
  fit();
  let lastWidth = innerWidth;
  addEventListener('resize', () => {
    fit();
    if (innerWidth !== lastWidth) {
      lastWidth = innerWidth;
      renderRoots();
    }
  });

  // only animate while the sky is on screen (and the tab is open)
  let visible = true;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    visible && !document.hidden ? sky.start() : sky.stop();
  }).observe(hero);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return sky.stop();
    if (visible) sky.start();
    setupHero();
  });

  // touch a rose to see which year it's from
  let tipTimer = 0;
  $('#sky').addEventListener('click', (e) => {
    if (replaying) return sky.skip();
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const rose = sky.roseAt(x, y);
    const tip = $('#roseTip');
    if (!rose) return (tip.hidden = true);
    const bloomsOn = dateAtAge(rose.bloomAt, since);
    tip.textContent = say.roseTip(rose.year, rose.open, daysBetween(now(), bloomsOn));
    tip.style.left = `${clamp(x, 90, r.width - 90)}px`;
    tip.style.top = `${y}px`;
    tip.hidden = false;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => (tip.hidden = true), 2600);
  });
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

let replaying = false;
async function replay(ms) {
  replaying = true;
  const label = $('#replayDate');
  label.classList.add('on');
  await sky.grow(0, ageOn(now(), since), ms);
  label.classList.remove('on');
  replaying = false;
}

function setupHero() {
  const today = now();
  const age = ageOn(today, since);
  const stats = sky.stats(age);
  $('#together').textContent = say.together(Math.max(0, daysBetween(since, today)));
  const bloom = $('#bloom');
  const years = today.getFullYear() - since.getFullYear();
  const isAnniversary = years >= 1 && today.getMonth() === since.getMonth() && today.getDate() === since.getDate();
  bloom.classList.toggle('celebrate', isAnniversary);
  if (isAnniversary) {
    bloom.textContent = say.anniversary(years, herName);
  } else if (stats.nextBloomAt != null) {
    bloom.textContent = say.nextBloom(stats.bloomed === 0, daysBetween(today, dateAtAge(stats.nextBloomAt, since)));
  }
  const hour = params.has('hour') ? Number(params.get('hour')) : new Date().getHours();
  $('#hero').classList.toggle('night', hour >= 20 || hour < 6);
}

/* ---------- the roots ---------- */

async function loadMemories() {
  try {
    take(await garden.load());
  } catch (err) {
    console.error(err);
    toast(err.message);
  }
  renderRoots();
  updateInfo();
}

function renderRoots(fresh) {
  if (!garden) return;
  const before = roots;
  roots = drawRoots($('#roots'), memories, {
    since,
    today: startOfDay(now()),
    onOpen: openMemory,
    picture: (path) => garden.picture(path),
    fresh,
  });
  revealRoots(Boolean(before) || reduceMotion);
}

function revealRoots(instant = reduceMotion) {
  if (!roots) return;
  const top = $('#roots').getBoundingClientRect().top;
  roots.reveal(innerHeight * 0.86 - top, instant);
  $('#dig').classList.toggle('gone', top < innerHeight * 0.55);
}

let scrollQueued = false;
addEventListener('scroll', () => {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(() => {
    scrollQueued = false;
    revealRoots();
  });
}, { passive: true });

/* ---------- looking at a memory ---------- */

const viewable = () => memories.filter((m) => !isSealed(m, startOfDay(now()))).sort((a, b) => a.date.localeCompare(b.date) || (a.planted || '').localeCompare(b.planted || ''));
let viewing = -1;

function openMemory(m) {
  if (isSealed(m, startOfDay(now()))) return toast(say.capsuleWait(daysBetween(now(), parseDay(m.opens))));
  viewing = viewable().findIndex((x) => x.id === m.id);
  showMemory();
  const v = $('#viewer');
  if (!v.open) v.showModal();
}

function showMemory() {
  const list = viewable();
  const m = list[viewing];
  const body = $('#viewerBody');
  body.replaceChildren();
  $('#prevBtn').disabled = viewing <= 0;
  $('#nextBtn').disabled = viewing >= list.length - 1;
  if (!m) return;

  const fig = document.createElement('figure');
  const cap = document.createElement('figcaption');
  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent = [say.formatDate(parseDay(m.date)), m.by && `geplant deur ${m.by}`].filter(Boolean).join(' · ');

  if (m.kind === 'photo') {
    const img = document.createElement('img');
    img.className = 'photo';
    img.alt = m.caption || '';
    garden.picture(m.thumb).then((url) => { if (!img.src) img.src = url; }).catch(() => {});
    garden.picture(m.photo).then((url) => (img.src = url)).catch(() => {});
    fig.append(img);
    if (m.caption) cap.append(text('p', 'caption', m.caption));
  } else if (m.kind === 'note') {
    fig.append(text('div', 'paper', m.text));
    if (m.opens) cap.append(text('p', 'meta', say.fromCapsule(parseDay(m.date))));
  } else if (m.kind === 'song') {
    const embed = embedFor(m.song.url);
    if (embed) {
      const frame = document.createElement('iframe');
      frame.className = `player${embed.video ? ' video' : ''}`;
      frame.src = embed.src;
      frame.height = embed.height ?? '';
      frame.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      frame.loading = 'lazy';
      frame.title = m.song.title || 'liedjie';
      fig.append(frame);
    }
    const title = [m.song.title, m.song.artist].filter(Boolean).join(' · ');
    if (title) cap.append(text('p', 'caption', title));
    if (m.text) cap.append(text('p', 'why', m.text));
    if (!embed) {
      const a = text('a', 'listen', 'luister');
      a.href = safeUrl(m.song.url);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      cap.append(a);
    }
  }
  cap.append(meta);
  fig.append(cap);
  body.append(fig);
}

function text(tag, className, value) {
  const e = document.createElement(tag);
  e.className = className;
  e.textContent = value;
  return e;
}

const safeUrl = (u) => (/^https:\/\//i.test(u) ? u : '#');

// Spotify, YouTube and Apple Music links play right in the page.
function embedFor(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  let m;
  if (host === 'open.spotify.com' && (m = u.pathname.match(/\/(track|album|playlist|episode)\/([A-Za-z0-9]+)/))) {
    return { src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, height: m[1] === 'track' ? 152 : 352 };
  }
  const yt = youtubeId(u);
  if (yt) return { src: `https://www.youtube-nocookie.com/embed/${yt}`, video: true };
  if (host === 'music.apple.com') return { src: `https://embed.music.apple.com${u.pathname}${u.search}`, height: u.searchParams.has('i') ? 175 : 450 };
  return null;
}

function youtubeId(u) {
  const host = u.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
  if (host === 'youtube.com' || host === 'music.youtube.com') {
    return u.searchParams.get('v') || u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]+)/)?.[1] || null;
  }
  return null;
}

function step(dir) {
  const list = viewable();
  const next = viewing + dir;
  if (next < 0 || next >= list.length) return;
  viewing = next;
  showMemory();
}

/* ---------- dialogs ---------- */

let dialogsReady = false;
function setupDialogs() {
  if (dialogsReady) return;
  dialogsReady = true;

  for (const d of document.querySelectorAll('dialog')) {
    d.addEventListener('click', (e) => {
      if (e.target === d && d.classList.contains('sheet')) d.close(); // tap outside a sheet
      if (e.target.closest('[data-close]')) d.close();
    });
  }

  document.body.insertAdjacentHTML('beforeend', CRAYON_FILTER);
  $('#letterPill').addEventListener('click', openLetter);
  $('#rollUp').addEventListener('click', closeLetter);
  $('#ticker').addEventListener('click', () => $('#ticker').classList.remove('on'));
  $('#letter').addEventListener('cancel', (e) => {
    e.preventDefault(); // Esc rolls it up too
    closeLetter();
  });

  $('#infoBtn').addEventListener('click', () => {
    updateInfo();
    $('#info').showModal();
  });
  $('#replayBtn').addEventListener('click', () => {
    $('#info').close();
    scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    setTimeout(() => replay(9000), reduceMotion ? 0 : 450);
  });
  $('#lockBtn').addEventListener('click', async () => {
    await forgetKey();
    try { sessionStorage.removeItem('roos-grown'); } catch {}
    location.reload();
  });

  $('#prevBtn').addEventListener('click', () => step(-1));
  $('#nextBtn').addEventListener('click', () => step(1));
  $('#viewer').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
  $('#viewer').addEventListener('close', () => $('#viewerBody').replaceChildren()); // stops any music
  let swipe = null;
  $('#viewerBody').addEventListener('pointerdown', (e) => (swipe = { x: e.clientX, y: e.clientY }));
  $('#viewerBody').addEventListener('pointerup', (e) => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  });

  for (const b of [$('#plantFab'), $('#plantCta')]) b.addEventListener('click', openPlanting);
  setupPlanting();
  setupDecor();
  setupIdeas();
}

/* ---------- decorating: switch things on and off, seen by both of you ---------- */

let decorBefore = null;

function setupDecor() {
  const list = $('#decorList');
  for (const [id, name, sub] of say.DECOR) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'decor-item';
    b.dataset.id = id;
    b.append(text('span', 'tick', ''), text('span', 'name', name), text('span', 'sub', sub));
    b.addEventListener('click', () => {
      decor = decor.includes(id) ? decor.filter((d) => d !== id) : [...decor, id];
      sky.setDecor(decor); // shows straight away; saved when the sheet closes
      paintDecor();
    });
    list.append(b);
  }
  $('#decorBtn').addEventListener('click', () => {
    decorBefore = [...decor];
    paintDecor();
    scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    $('#decor').showModal();
  });
  $('#decor').addEventListener('close', saveDecor);
}

function paintDecor() {
  for (const b of document.querySelectorAll('.decor-item')) b.setAttribute('aria-pressed', String(decor.includes(b.dataset.id)));
}

async function saveDecor() {
  const before = decorBefore;
  decorBefore = null;
  if (!before || [...before].sort().join() === [...decor].sort().join()) return;
  const wanted = [...decor];
  try {
    take(await garden.change((g) => ({ ...g, decor: wanted }), 'versier die tuin'));
    toast(say.decorSaved);
  } catch (err) {
    console.error(err);
    decor = before;
    sky.setDecor(decor);
    toast(err instanceof KeyError ? say.keyExpired(gardeners[0]) : say.saveFailed(err.message), 6000);
  }
}

/* ---------- the idea board ---------- */

function setupIdeas() {
  $('#ideasIntro').textContent = say.ideasIntro(gardeners[0]);
  whoPicker($('#ideaWho'), 'idea-by');
  $('#ideasBtn').addEventListener('click', async () => {
    paintIdeas();
    $('#ideaMsg').textContent = '';
    $('#ideas').showModal();
    try { // fetch the latest, so the other one's ideas show up too
      take(await garden.load());
      paintIdeas();
    } catch {}
  });
  $('#ideaForm').addEventListener('submit', postIdea);
}

function paintIdeas() {
  const list = $('#ideaList');
  list.replaceChildren();
  const sorted = [...ideas].sort((a, b) => Number(Boolean(a.done)) - Number(Boolean(b.done)) || b.at.localeCompare(a.at));
  if (!sorted.length) list.append(text('li', 'empty', say.noIdeas));
  for (const idea of sorted) {
    const li = document.createElement('li');
    li.className = `idea${idea.done ? ' done' : ''}`;
    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'idea-check';
    check.setAttribute('aria-pressed', String(Boolean(idea.done)));
    check.setAttribute('aria-label', say.ideaDone);
    check.addEventListener('click', () => toggleIdea(idea.id));
    const body = document.createElement('div');
    body.append(text('p', 'idea-text', idea.text), text('p', 'idea-meta', [idea.by, say.shortDate(new Date(idea.at)), idea.done && say.ideaDone].filter(Boolean).join(' · ')));
    li.append(check, body);
    list.append(li);
  }
}

async function postIdea(event) {
  event.preventDefault();
  const words = $('#ideaText').value.trim();
  const msg = $('#ideaMsg');
  if (!words) return $('#ideaText').focus();
  const by = pickedBy('idea-by');
  store.set('roos-by', by);
  const idea = { id: newId(isoDay(now())), text: words, by, at: new Date().toISOString() };
  const go = $('#ideaGo');
  go.disabled = true;
  msg.textContent = '…';
  try {
    take(await garden.change((g) => ({ ...g, ideas: [...g.ideas, idea] }), `an idea${by ? ` (${by})` : ''}`));
    $('#ideaText').value = '';
    msg.textContent = '';
    paintIdeas();
  } catch (err) {
    console.error(err);
    msg.textContent = err instanceof KeyError ? say.keyExpired(gardeners[0]) : say.saveFailed(err.message);
  } finally {
    go.disabled = false;
  }
}

async function toggleIdea(id) {
  const idea = ideas.find((i) => i.id === id);
  if (!idea) return;
  const done = !idea.done;
  idea.done = done; // show it straight away
  paintIdeas();
  try {
    take(await garden.change((g) => ({ ...g, ideas: g.ideas.map((i) => (i.id === id ? { ...i, done } : i)) }), done ? 'an idea, done' : 'an idea, reopened'));
    paintIdeas();
  } catch (err) {
    console.error(err);
    idea.done = !done;
    paintIdeas();
    toast(err instanceof KeyError ? say.keyExpired(gardeners[0]) : say.saveFailed(err.message), 6000);
  }
}

function updateInfo() {
  if (!sky) return;
  const today = now();
  const age = ageOn(today, since);
  const stats = sky.stats(age);
  for (const el of document.querySelectorAll('[data-since-text]')) el.textContent = say.formatDate(since);
  const parts = [say.together(Math.max(0, daysBetween(since, today))), say.roses(stats.bloomed), say.memories(memories.length)];
  $('#stats').textContent = parts.join(' · ');

  const note = $('#keyNote');
  const expires = garden?.secrets.expires ? parseDay(garden.secrets.expires) : null;
  const left = expires ? daysBetween(today, expires) : null;
  note.textContent = !expires ? '' : left < 0 ? say.keyExpired(gardeners[0]) : left <= 30 ? say.keyExpiresSoon(expires, left) : say.keyUntil(expires);
  note.classList.toggle('warn', left != null && left <= 30);
  $('#infoBtn').classList.toggle('attention', (left != null && left <= 30) || letterUnread());
}

/* ---------- the anniversary letter ---------- */

const letterUnread = () => Boolean(letterText) && store.get('roos-letter-read') !== '1';

async function loadLetter() {
  try {
    letterText = await garden.letter();
  } catch (err) {
    console.warn(err);
  }
  $('#letterPill').hidden = !letterText;
  $('#letterDot').hidden = !letterUnread();
  updateInfo();
}

function openLetter() {
  const dialog = $('#letter');
  const body = $('#letterBody');
  renderLetter(body, letterText, ticker);
  $('#info').close();
  dialog.showModal();
  body.scrollTop = 0;
  // unroll down to the bottom of the screen (or to the end of the letter, if it's short)
  const room = innerHeight - 150;
  dialog.style.setProperty('--h', `${Math.max(240, Math.min(room, body.scrollHeight))}px`);
  void dialog.offsetHeight; // lay it out rolled up first, so it has something to unroll from
  dialog.classList.add('open');
  store.set('roos-letter-read', '1');
  $('#letterDot').hidden = true;
  updateInfo();
}

function closeLetter() {
  const dialog = $('#letter');
  if (!dialog.open) return;
  dialog.classList.remove('open'); // rolls back up
  $('#ticker').classList.remove('on');
  setTimeout(() => dialog.close(), reduceMotion ? 0 : 1000);
}

let tickerTimer = 0;
function ticker(message) {
  const t = $('#ticker');
  $('#tickerText').textContent = Array.from({ length: 3 }, () => message).join('   ✦   ');
  t.classList.remove('on');
  void t.offsetWidth; // restart the crawl
  t.classList.add('on');
  navigator.vibrate?.(40);
  clearTimeout(tickerTimer);
  tickerTimer = setTimeout(() => t.classList.remove('on'), 9800);
}

/* ---------- planting ---------- */

let tab = store.get('roos-tab') || 'photo';
let picked = []; // [{ file, full, thumb, w, h, date, caption }]
let planting = false;

// "geplant deur" buttons, remembering who used this phone last
function whoPicker(container, name) {
  const last = store.get('roos-by');
  gardeners.forEach((gardener, i) => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = gardener;
    input.checked = last ? last === gardener : i === 0;
    const span = document.createElement('span');
    span.textContent = gardener;
    label.append(input, span);
    container.append(label);
  });
}

const pickedBy = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value || '';

function setupPlanting() {
  for (const b of document.querySelectorAll('.tabs button')) b.addEventListener('click', () => selectTab(b.dataset.tab));

  whoPicker($('#who'), 'by');

  $('#photoInput').addEventListener('change', (e) => {
    addPhotos([...e.target.files]);
    e.target.value = '';
  });
  $('#capsule').addEventListener('change', (e) => {
    $('#opensField').hidden = !e.target.checked;
    if (e.target.checked && !$('#noteOpens').value) {
      const d = new Date(since.getFullYear() + Math.max(1, Math.ceil(ageOn(now(), since) + 0.001)), since.getMonth(), since.getDate());
      $('#noteOpens').value = isoDay(d); // the next anniversary
    }
  });
  $('#songUrl').addEventListener('change', fillSong);
  $('#plantForm').addEventListener('submit', plant);
  $('#plant').addEventListener('close', () => {
    if (!planting) resetPlanting();
  });
  $('#plant').addEventListener('cancel', (e) => planting && e.preventDefault());
}

function selectTab(name) {
  tab = name;
  store.set('roos-tab', name);
  for (const b of document.querySelectorAll('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === name));
  for (const s of document.querySelectorAll('.tab')) s.hidden = s.dataset.tab !== name;
  $('#plantMsg').textContent = '';
}

function openPlanting() {
  const today = isoDay(now());
  for (const id of ['#noteDate', '#songDate']) {
    $(id).max = today;
    if (!$(id).value) $(id).value = today;
  }
  $('#noteOpens').min = isoDay(new Date(now().getTime() + DAY));
  selectTab(tab);
  $('#plant').showModal();
}

function resetPlanting() {
  for (const p of picked) URL.revokeObjectURL(p.preview);
  picked = [];
  $('#picked').replaceChildren();
  for (const id of ['#noteText', '#noteDate', '#noteOpens', '#songUrl', '#songTitle', '#songArtist', '#songWhy', '#songDate']) $(id).value = '';
  $('#capsule').checked = false;
  $('#opensField').hidden = true;
  $('#plantMsg').textContent = '';
  songArt = null;
}

async function addPhotos(files) {
  const list = $('#picked');
  for (const file of files.slice(0, 40 - picked.length)) {
    const li = document.createElement('li');
    li.append(text('span', 'busy', `${file.name}…`));
    list.append(li);
    try {
      const p = await preparePhoto(file);
      p.preview = URL.createObjectURL(p.thumb);
      picked.push(p);
      li.replaceChildren(...photoRow(p));
    } catch (err) {
      console.warn(err);
      li.replaceChildren(text('span', 'busy', say.photoUnreadable(file.name)));
      setTimeout(() => li.remove(), 5000);
    }
  }
}

function photoRow(p) {
  const img = document.createElement('img');
  img.src = p.preview;
  img.alt = '';
  const fields = document.createElement('div');
  fields.className = 'fields';
  const caption = document.createElement('input');
  caption.placeholder = 'wat gebeur hier?';
  caption.addEventListener('input', () => (p.caption = caption.value.trim()));
  const date = document.createElement('input');
  date.type = 'date';
  date.max = isoDay(now());
  date.value = p.date || '';
  date.addEventListener('input', () => {
    p.date = date.value;
    date.classList.remove('invalid');
  });
  p.dateInput = date;
  fields.append(caption, date);
  return [img, fields];
}

// Shrink to a sensible size (and a small one for the roots). Browsers turn photos
// the right way up by themselves when drawing them.
async function preparePhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('unreadable'));
      img.src = url;
    });
    const [full, thumb, date] = await Promise.all([
      jpeg(img, 1800, 0.84),
      jpeg(img, 480, 0.8),
      exifDate(file).catch(() => null),
    ]);
    return { full, thumb, w: img.naturalWidth, h: img.naturalHeight, date, caption: '' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function jpeg(img, max, quality) {
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('jpeg'))), 'image/jpeg', quality));
}

// The day a JPEG was taken, from its EXIF data ("2026:02:14 18:03:11" → "2026-02-14").
async function exifDate(file) {
  const v = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
  if (v.getUint16(0) !== 0xffd8) return null;
  for (let off = 2; off + 4 < v.byteLength; ) {
    const marker = v.getUint16(off);
    if ((marker & 0xff00) !== 0xff00) break;
    if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) {
      const tiff = off + 10;
      const le = v.getUint16(tiff) === 0x4949;
      const u16 = (o) => v.getUint16(o, le);
      const u32 = (o) => v.getUint32(o, le);
      const entries = (start) => Array.from({ length: u16(start) }, (_, i) => start + 2 + i * 12);
      const ascii = (e) => {
        const n = u32(e + 4);
        const at = n > 4 ? tiff + u32(e + 8) : e + 8;
        return String.fromCharCode(...new Uint8Array(v.buffer, at, Math.min(n, 20)));
      };
      let found = null;
      let exif = null;
      for (const e of entries(tiff + u32(tiff + 4))) {
        if (u16(e) === 0x8769) exif = tiff + u32(e + 8);
        if (u16(e) === 0x0132) found = ascii(e);
      }
      if (exif) for (const e of entries(exif)) if (u16(e) === 0x9003) found = ascii(e);
      const m = found?.match(/^(\d{4}):(\d{2}):(\d{2})/);
      return m && m[1] !== '0000' ? `${m[1]}-${m[2]}-${m[3]}` : null;
    }
    off += 2 + v.getUint16(off + 2);
  }
  return null;
}

// Fill in the song's name (and cover) from the link, where the service allows it.
let songArt = null;
async function fillSong() {
  const raw = $('#songUrl').value.trim();
  songArt = null;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return;
  }
  const yt = youtubeId(u);
  if (yt) songArt = `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
  const sources = u.hostname.endsWith('spotify.com')
    ? [`https://open.spotify.com/oembed?url=${encodeURIComponent(raw)}`]
    : [`https://noembed.com/embed?url=${encodeURIComponent(raw)}`];
  for (const src of sources) {
    try {
      const info = await (await fetch(src)).json();
      if (info.error) continue;
      if (info.thumbnail_url) songArt = info.thumbnail_url;
      if (info.title && !$('#songTitle').value) $('#songTitle').value = info.title;
      if (info.author_name && !$('#songArtist').value && !yt) $('#songArtist').value = info.author_name;
      break;
    } catch {}
  }
}

const newId = (date) => `${date}-${Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 6)}`;

async function plant(event) {
  event.preventDefault();
  if (planting) return;
  const msg = $('#plantMsg');
  const by = pickedBy('by');
  const today = isoDay(now());
  const planted = new Date().toISOString();
  const items = [];

  const checkDate = (input) => {
    if (!input.value) return say.noDate;
    if (input.value > today) return say.tooEarly;
    return null;
  };

  if (tab === 'photo') {
    if (!picked.length) return (msg.textContent = "kies eers 'n foto of twee");
    const bad = picked.find((p) => checkDate(p.dateInput));
    if (bad) {
      bad.dateInput.classList.add('invalid');
      bad.dateInput.focus();
      return (msg.textContent = checkDate(bad.dateInput));
    }
    for (const p of picked) {
      const id = newId(p.date);
      const memory = { id, kind: 'photo', date: p.date, by, planted, caption: p.caption || undefined, photo: `garden/photos/${id}.bin`, thumb: `garden/thumbs/${id}.bin`, w: p.w, h: p.h };
      items.push({
        memory,
        files: [
          { path: memory.photo, bytes: new Uint8Array(await p.full.arrayBuffer()) },
          { path: memory.thumb, bytes: new Uint8Array(await p.thumb.arrayBuffer()) },
        ],
        blobs: { [memory.photo]: p.full, [memory.thumb]: p.thumb },
      });
    }
  } else if (tab === 'note') {
    const words = $('#noteText').value.trim();
    if (!words) return (msg.textContent = say.emptyNote);
    const problem = checkDate($('#noteDate'));
    if (problem) return (msg.textContent = problem);
    const opens = $('#capsule').checked ? $('#noteOpens').value : '';
    if ($('#capsule').checked && (!opens || opens <= today)) return (msg.textContent = "kies 'n dag in die toekoms vir die saadjie");
    const date = $('#noteDate').value;
    items.push({ memory: { id: newId(date), kind: 'note', date, by, planted, text: words, opens: opens || undefined }, files: [] });
  } else {
    const url = $('#songUrl').value.trim();
    if (!/^https:\/\/\S+$/i.test(url)) return (msg.textContent = say.badSong);
    const problem = checkDate($('#songDate'));
    if (problem) return (msg.textContent = problem);
    const date = $('#songDate').value;
    const song = { url, title: $('#songTitle').value.trim(), artist: $('#songArtist').value.trim(), art: songArt || undefined };
    items.push({ memory: { id: newId(date), kind: 'song', date, by, planted, song, text: $('#songWhy').value.trim() || undefined }, files: [] });
  }

  planting = true;
  store.set('roos-by', by);
  const go = $('#plantGo');
  go.disabled = true;
  const what = { photo: `${items.length} photo${items.length === 1 ? '' : 's'}`, note: 'a note', song: 'a song' }[tab];
  try {
    take(await garden.plant(items, `plant ${what}${by ? ` (${by})` : ''}`, (p) => (msg.textContent = say.plantProgress(p))));
    for (const item of items) for (const [path, blob] of Object.entries(item.blobs || {})) garden.cache(path, blob);
    planting = false;
    $('#plant').close();
    const ids = items.map((i) => i.memory.id);
    renderRoots(new Set(ids));
    updateInfo();
    showPlanted(ids);
    toast(say.planted(items.length));
  } catch (err) {
    console.error(err);
    msg.textContent = err instanceof KeyError ? say.keyExpired(gardeners[0]) : say.plantFailed(err.message);
  } finally {
    planting = false;
    go.disabled = false;
  }
}

// Scroll down to what was just planted, so you can watch its root grow in.
function showPlanted(ids) {
  const b = roots?.buttons.get(ids[0]);
  if (!b) return;
  const y = b.getBoundingClientRect().top + scrollY - innerHeight * 0.45;
  scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
}

/* ---------- start ---------- */

async function boot() {
  drawLockRose();
  $('#lockForm').addEventListener('submit', tryPassword);
  if (!window.crypto?.subtle) {
    $('#lockMsg').textContent = say.needsHttps;
    return;
  }
  const lock = $('#lock');
  lock.classList.add('checking');
  seed = await loadSeed().catch(() => null);
  if (!seed) {
    lock.classList.remove('checking');
    $('#lockMsg').textContent = say.notSetUp;
    $('#openBtn').disabled = true;
    return;
  }
  const key = await recallKey();
  if (key) {
    try {
      return await enter(key, await openSeed(seed, key));
    } catch {
      await forgetKey(); // the password changed since; ask again
    }
  }
  lock.classList.remove('checking');
  if (matchMedia('(pointer: fine)').matches) $('#pw').focus();
}

boot();
