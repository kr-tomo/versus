import { WEAPONS, WEAPON_IDS, MAPS, MAP_IDS, WIN_OPTIONS, TIME_OPTIONS, MAX_POWER, MAX_REACH, SUPERS } from './config.js';
import { computeLayout } from './layout.js';
import { loadTheme } from './assets.js';
import { Renderer } from './render.js';
import { InputManager } from './input.js';
import { Game } from './game.js';
import { AI } from './ai.js';

const STEP = 1 / 120;
const $ = s => document.querySelector(s);
const canvas = $('#view'), controls = $('#controls'), pauseBtn = $('#pauseBtn'), exitBtn = $('#exitBtn');
const LABEL = { left: '◀', right: '▶', attack: '공격', guard: '방어', jump: '점프' };
const MODE_LABEL = { '2p': '2인 대전', easy: '컴퓨터 · 쉬움', hard: '컴퓨터 · 어려움' };

const store = {
  load() { try { return JSON.parse(localStorage.getItem('versus.settings')) || {}; } catch { return {}; } },
  save(v) { try { localStorage.setItem('versus.settings', JSON.stringify(v)); } catch { /* storage unavailable */ } }
};
const settings = Object.assign({ mode: '2p', weapons: ['sword', 'axe'], map: 'random', wins: 3, time: 90 }, store.load());

let theme, renderer, input, game = null, ai = null, paused = false, resultShown = false, layout = null;

/* ---------- screens ---------- */
function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  const playing = id === null || id === 'pause' || id === 'result' || id === 'confirm';
  canvas.hidden = controls.hidden = !playing;
  pauseBtn.hidden = exitBtn.hidden = id !== null;
}

function buildTitle() {
  for (const b of document.querySelectorAll('#title [data-mode]')) {
    b.onclick = () => { settings.mode = b.dataset.mode; refreshSetup(); show('setup'); };
  }
}

function statBars(w) {
  const s = WEAPONS[w], total = s.startup + s.active + s.recovery;
  const rows = [['파워', s.power / MAX_POWER], ['리치', s.reach / MAX_REACH], ['속도', Math.min(1, 0.27 / total)]];
  return rows.map(([k, v]) => `<span>${k}</span><i><b style="width:${Math.round(v * 100)}%"></b></i>`).join('');
}

function buildSetup() {
  for (const side of document.querySelectorAll('#setup .side')) {
    const p = +side.dataset.player;
    side.querySelector('.roster').innerHTML = WEAPON_IDS.map(w =>
      `<button class="portrait" data-w="${w}" style="--c:${theme.characters[w].color}"><img src="${theme.base + theme.characters[w].portrait}" alt=""><span>${WEAPONS[w].name}</span></button>`).join('');
    side.querySelector('.roster').onclick = e => {
      const b = e.target.closest('[data-w]');
      if (b) { settings.weapons[p] = b.dataset.w; refreshSetup(); }
    };
  }
  const maps = $('#setup .maps');
  maps.innerHTML = MAP_IDS.map(id => `<button class="map" data-map="${id}"><img src="${theme.base + theme.maps[id].far}" alt=""><span>${MAPS[id].name}</span></button>`).join('')
    + `<button class="map" data-map="random"><div class="rand">?</div><span>랜덤</span></button>`;
  maps.onclick = e => { const b = e.target.closest('[data-map]'); if (b) { settings.map = b.dataset.map; refreshSetup(); } };
  $('#winsBtn').onclick = () => { settings.wins = WIN_OPTIONS[(WIN_OPTIONS.indexOf(settings.wins) + 1) % WIN_OPTIONS.length]; refreshSetup(); };
  $('#timeBtn').onclick = () => { settings.time = TIME_OPTIONS[(TIME_OPTIONS.indexOf(settings.time) + 1) % TIME_OPTIONS.length]; refreshSetup(); };
  $('#setup .back').onclick = () => show('title');
  $('#startBtn').onclick = () => { enterFullscreen(); startGame(); };
}

function refreshSetup() {
  if (!WIN_OPTIONS.includes(settings.wins)) settings.wins = 3;
  if (!TIME_OPTIONS.includes(settings.time)) settings.time = 90;
  settings.weapons = settings.weapons.map(w => WEAPON_IDS.includes(w) ? w : 'sword');
  $('#setup .mode-label').textContent = MODE_LABEL[settings.mode];
  for (const side of document.querySelectorAll('#setup .side')) {
    const p = +side.dataset.player, w = settings.weapons[p], c = theme.characters[w];
    side.querySelector('.who').textContent = p === 0 ? 'P1' : settings.mode === '2p' ? 'P2' : 'CPU';
    for (const b of side.querySelectorAll('[data-w]')) b.classList.toggle('on', b.dataset.w === w);
    side.querySelector('.info').innerHTML = `<div class="name">${c.name} <small>${c.title} · ${WEAPONS[w].name}</small></div><div class="bars">${statBars(w)}</div><div class="super">필살기 · ${SUPERS[w].name}</div>`;
  }
  for (const b of document.querySelectorAll('#setup [data-map]')) b.classList.toggle('on', b.dataset.map === settings.map);
  $('#winsBtn').innerHTML = `<small>승수</small>${settings.wins}승`;
  $('#timeBtn').innerHTML = `<small>시간</small>${settings.time}초`;
  store.save(settings);
}

/* ---------- game ---------- */
async function startGame() {
  game = new Game({ ...settings, weapons: [...settings.weapons] });
  ai = settings.mode === '2p' ? null : new AI(settings.mode);
  input.players = settings.mode === '2p' ? 2 : 1;
  paused = false; resultShown = false;
  $('#loading').hidden = false;
  show(null);
  onResize();
  await renderer.prepare(game);
  $('#loading').hidden = true;
}

function quitToMenu() { game = null; paused = false; show('setup'); refreshSetup(); }

function setPaused(v, screen = 'pause') {
  if (!game || resultShown) return;
  paused = v;
  show(v ? screen : null);
}

function showResult() {
  resultShown = true;
  const w = game.winner, who = w === 0 ? 'P1' : settings.mode === '2p' ? 'P2' : 'CPU';
  $('#resultText').innerHTML = `${who} 승리<small>${theme.characters[game.fighters[w].weapon].name} · ${game.wins[0]} : ${game.wins[1]}</small>`;
  show('result');
}

/* ---------- layout ---------- */
function safeInsets() {
  const cs = getComputedStyle($('#safe'));
  return ['Top', 'Right', 'Bottom', 'Left'].map(k => parseFloat(cs[`padding${k}`]) || 0);
}

function onResize() {
  const [it, ir, ib, il] = safeInsets();
  const W = innerWidth - il - ir, H = innerHeight - it - ib;
  layout = computeLayout(W, H, { players: input.players });
  const v = layout.view, dpr = Math.min(devicePixelRatio || 1, 3);
  Object.assign(canvas.style, { left: `${il + v.x}px`, top: `${it + v.y}px`, width: `${v.w}px`, height: `${v.h}px` });
  canvas.width = Math.round(v.w * dpr);
  canvas.height = Math.round(v.h * dpr);
  controls.innerHTML = layout.buttons.map(b =>
    `<div class="pad p${b.player} a-${b.action}" data-player="${b.player}" data-action="${b.action}" style="left:${il + b.x - b.r}px;top:${it + b.y - b.r}px;width:${b.r * 2}px;height:${b.r * 2}px;font-size:${Math.round(b.r * (b.action === 'left' || b.action === 'right' ? 0.7 : 0.5))}px">${LABEL[b.action]}</div>`).join('');
  // pause and exit sit under the round timer, between the two super gauges
  const ps = Math.round(Math.max(30, v.h * 0.085)), gap = Math.round(ps * 0.2), top = it + v.y + v.h * (46 / 360);
  Object.assign(pauseBtn.style, { left: `${il + v.x + v.w / 2 - ps - gap / 2}px`, top: `${top}px`, width: `${ps}px`, height: `${ps}px`, fontSize: `${ps * 0.42}px` });
  Object.assign(exitBtn.style, { left: `${il + v.x + v.w / 2 + gap / 2}px`, top: `${top}px`, width: `${ps}px`, height: `${ps}px`, fontSize: `${ps * 0.42}px` });
  updatePadUI();
  if (game) renderer.prepare(game);
}

function updatePadUI() {
  const pads = new Set(input.padPlayers());
  for (const el of controls.querySelectorAll('.pad')) el.classList.toggle('off', pads.has(+el.dataset.player));
}

/* ---------- loop ---------- */
let last = 0, acc = 0, startHeld = false;
function frame(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0);
  last = ts;
  input.pollPads();
  const start = input.padPressed(9);
  if (start && !startHeld && game) setPaused(!paused);
  startHeld = start;
  if (game && !paused && renderer.sprites) {
    acc += dt;
    while (acc >= STEP) {
      const [a, b] = game.fighters;
      const inputs = [input.read(0), ai ? ai.update(STEP, b, a, game) : input.read(1)];
      game.update(STEP, inputs);
      acc -= STEP;
    }
    if (game.phase === 'matchEnd' && game.phaseT > 1.6 && !resultShown) showResult();
  }
  if (game) renderer.draw(game);
  requestAnimationFrame(frame);
}

/* ---------- platform ---------- */
function preventZoom() {
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'contextmenu']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', e => { if (e.touches.length > 1 || (e.scale && e.scale !== 1)) e.preventDefault(); }, { passive: false });
  let lastEnd = 0;
  document.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastEnd < 350 && !e.target.closest('button')) e.preventDefault();
    lastEnd = now;
  }, { passive: false });
}

async function enterFullscreen() {
  if (!matchMedia('(pointer: coarse)').matches) return;
  try { await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }); } catch { /* not supported */ }
  try { await screen.orientation?.lock?.('landscape'); } catch { /* not supported */ }
}

async function boot() {
  theme = await loadTheme('classic');
  renderer = new Renderer(canvas, theme);
  input = new InputManager();
  input.onPadsChanged = updatePadUI;
  input.bindTouch(controls);
  buildTitle();
  buildSetup();
  refreshSetup();
  preventZoom();
  pauseBtn.onclick = () => setPaused(true);
  exitBtn.onclick = () => setPaused(true, 'confirm');
  $('#resumeBtn').onclick = () => setPaused(false);
  $('#quitBtn').onclick = quitToMenu;
  $('#confirmQuitBtn').onclick = quitToMenu;
  $('#cancelQuitBtn').onclick = () => setPaused(false);
  addEventListener('keydown', e => {
    if ((e.code === 'Escape' || e.code === 'KeyP') && game && !e.repeat) setPaused(!paused);
  });
  $('#againBtn').onclick = startGame;
  $('#menuBtn').onclick = quitToMenu;
  addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', () => { if (document.hidden && game && !paused) setPaused(true); });
  show('title');
  onResize();
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
}

boot();
