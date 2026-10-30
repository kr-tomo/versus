import { WEAPONS, WEAPON_IDS, MAPS, MAP_IDS, WIN_OPTIONS, TIME_OPTIONS, MAX_POWER, MAX_REACH, SUPERS } from './config.js';
import { computeLayout } from './layout.js';
import { loadTheme } from './assets.js';
import { InputManager } from './input.js';
import { Game } from './game.js';
import { AI } from './ai.js';
import { Stage } from './stage.js';
import { MenuNav, pickNext } from './menu.js';

const $ = s => document.querySelector(s);
const stageEl = $('#stage'), controls = $('#controls'), pauseBtn = $('#pauseBtn'), exitBtn = $('#exitBtn'), hints = $('#hints');
const LABEL = { left: '◀', right: '▶', attack: '공격', guard: '방어', jump: '점프' };
const MODE_LABEL = { '2p': '2인 대전', easy: '컴퓨터 · 쉬움', hard: '컴퓨터 · 어려움' };
// default focus and the B button for each activeScreen
const SCREENS = {
  title:   { focus: '#title [data-mode]', back: null },
  setup:   { focus: () => `#setup .side[data-player="0"] [data-w="${settings.weapons[0]}"]`, back: () => show('title') },
  pause:   { focus: '#resumeBtn', back: () => setPaused(false) },
  confirm: { focus: '#cancelQuitBtn', back: () => setPaused(false) },
  result:  { focus: '#againBtn', back: () => quitToMenu() }
};
const HINTS = {
  title: 'Ⓐ 선택',
  setup: 'Ⓐ 결정 · Ⓑ 뒤로 · LB/RB 맵 · ☰ 시작',
  pause: 'Ⓐ 선택 · Ⓑ/☰ 계속하기',
  confirm: 'Ⓐ 선택 · Ⓑ 계속하기',
  result: 'Ⓐ 선택 · Ⓑ 메뉴로'
};

const store = {
  load() { try { return JSON.parse(localStorage.getItem('versus.settings')) || {}; } catch { return {}; } },
  save(v) { try { localStorage.setItem('versus.settings', JSON.stringify(v)); } catch { /* storage unavailable */ } }
};
const settings = Object.assign({ mode: '2p', weapons: ['sword', 'axe'], map: 'random', wins: 3, time: 90, sound: true }, store.load());

let theme, stage, input, nav, game = null, ai = null, paused = false, resultShown = false, activeScreen = 'title';
const focused = new Map(); // activeScreen id → last focused element

/* ---------- screens ---------- */
function show(id) {
  activeScreen = id;
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  const playing = id === null || id === 'pause' || id === 'result' || id === 'confirm';
  stageEl.hidden = controls.hidden = !playing;
  pauseBtn.hidden = exitBtn.hidden = id !== null;
  if (id) setFocus(focused.get(id)?.isConnected && !focused.get(id).hidden ? focused.get(id) : defaultFocus(id), false);
  nav?.sync(input.pads());
  updateHints();
}

function defaultFocus(id) {
  const f = SCREENS[id]?.focus;
  return f ? $(typeof f === 'function' ? f() : f) : null;
}

function focusables() {
  const el = activeScreen && document.getElementById(activeScreen);
  return el ? [...el.querySelectorAll('button')].filter(b => b.offsetParent !== null && !b.disabled) : [];
}

// Focusing a portrait or a map selects it right away (live preview); everything else waits for A.
function setFocus(el, select = true) {
  if (!el) return;
  document.querySelector('.nav-focus')?.classList.remove('nav-focus');
  el.classList.add('nav-focus');
  focused.set(activeScreen, el);
  if (select && (el.dataset.w || el.dataset.map)) el.click();
}

function updateHints() {
  const pads = input?.pads().length || 0;
  const text = activeScreen && pads ? HINTS[activeScreen] + (activeScreen === 'setup' && settings.mode === '2p' && pads > 1 ? ' · P2 패드 ◀▶ 캐릭터' : '') : '';
  hints.textContent = text;
  hints.hidden = !text;
}

/* ---------- gamepad / keyboard menu actions ---------- */
function onNav(action, src, repeat) {
  if (activeScreen === null) {
    // fighting: only pause / exit
    if (repeat) return false;
    if (action === 'start' || (src === 'kb' && action === 'back')) { setPaused(true); return true; }
    if (action === 'select') { setPaused(true, 'confirm'); return true; }
    return false;
  }
  document.body.classList.add('nav');

  // in 2P setup the second pad picks P2's fighter directly
  if (activeScreen === 'setup' && settings.mode === '2p' && src === 1) {
    if (action === 'left' || action === 'right') { cycleWeapon(1, action === 'left' ? -1 : 1); stage.play('move'); }
    else if (action === 'start') startFromSetup();
    return true;
  }
  if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
    const items = focusables(), cur = items.indexOf(document.querySelector('.nav-focus'));
    if (cur < 0) { setFocus(items[0] || defaultFocus(activeScreen)); return true; }
    const next = pickNext(items.map(b => { const r = b.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }), cur, action);
    if (next !== cur) { setFocus(items[next]); stage.play('move'); }
    return true;
  }
  if (repeat) return true;
  if (action === 'ok') { const el = document.querySelector('.nav-focus'); if (el && !el.hidden) { stage.play('select'); el.click(); } return true; }
  if (action === 'back') { const b = SCREENS[activeScreen]?.back; if (b) { stage.play('back'); b(); } return true; }
  if (action === 'start') {
    if (activeScreen === 'setup') startFromSetup();
    else if (activeScreen === 'pause' || activeScreen === 'confirm') setPaused(false);
    else if (activeScreen === 'title') document.querySelector('.nav-focus')?.click();
    return true;
  }
  if (activeScreen === 'setup' && (action === 'prev' || action === 'next')) {
    const ids = [...MAP_IDS, 'random'], i = ids.indexOf(settings.map);
    settings.map = ids[(i + (action === 'prev' ? -1 : 1) + ids.length) % ids.length];
    refreshSetup(); stage.play('move');
    return true;
  }
  return false;
}

function cycleWeapon(p, d) {
  settings.weapons[p] = WEAPON_IDS[(WEAPON_IDS.indexOf(settings.weapons[p]) + d + WEAPON_IDS.length) % WEAPON_IDS.length];
  refreshSetup();
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
  $('#soundBtn').onclick = () => { settings.sound = !settings.sound; stage.setMuted(!settings.sound); refreshSetup(); };
  $('#setup .back').onclick = () => show('title');
  $('#startBtn').onclick = startFromSetup;
}

function startFromSetup() { enterFullscreen(); startGame(); }

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
  $('#soundBtn').innerHTML = `<small>효과음</small>${settings.sound ? '켜짐' : '꺼짐'}`;
  store.save(settings);
  updateHints();
}

/* ---------- game ---------- */
function readInputs() {
  const [a, b] = game.fighters;
  return [input.read(0), ai ? ai.update(1 / 120, b, a, game) : input.read(1)];
}

function startGame() {
  game = new Game({ ...settings, weapons: [...settings.weapons] });
  ai = settings.mode === '2p' ? null : new AI(settings.mode);
  input.players = settings.mode === '2p' ? 2 : 1;
  paused = false; resultShown = false;
  $('#loading').hidden = false;
  show(null);
  onResize();
  const current = game;
  stage.startFight({ game, theme, readInputs, onLoaded: () => { if (game === current) $('#loading').hidden = true; } });
}

function quitToMenu() { stage.stopFight(); game = null; paused = false; show('setup'); refreshSetup(); }

function setPaused(v, id = 'pause') {
  if (!game || resultShown) return;
  if (v === paused && (!v || activeScreen === id)) return;
  paused = v;
  if (v) stage.pause();
  else {
    // buttons still held from the menu must not count as fresh presses
    game.fighters.forEach((f, i) => { if (i === 0 || !ai) f.prevInput = { ...input.read(i) }; });
    stage.resume();
  }
  show(v ? id : null);
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
  const layout = computeLayout(W, H, { players: input.players });
  const v = layout.view, dpr = Math.min(devicePixelRatio || 1, 3);
  Object.assign(stageEl.style, { left: `${il + v.x}px`, top: `${it + v.y}px`, width: `${v.w}px`, height: `${v.h}px` });
  stage.resize(Math.round(v.w * dpr), Math.round(v.h * dpr));
  controls.innerHTML = layout.buttons.map(b =>
    `<div class="pad p${b.player} a-${b.action}" data-player="${b.player}" data-action="${b.action}" style="left:${il + b.x - b.r}px;top:${it + b.y - b.r}px;width:${b.r * 2}px;height:${b.r * 2}px;font-size:${Math.round(b.r * (b.action === 'left' || b.action === 'right' ? 0.7 : 0.5))}px">${LABEL[b.action]}</div>`).join('');
  // pause and exit sit under the round timer, between the two super gauges
  const ps = Math.round(Math.max(30, v.h * 0.085)), gap = Math.round(ps * 0.2), top = it + v.y + v.h * (46 / 360);
  Object.assign(pauseBtn.style, { left: `${il + v.x + v.w / 2 - ps - gap / 2}px`, top: `${top}px`, width: `${ps}px`, height: `${ps}px`, fontSize: `${ps * 0.42}px` });
  Object.assign(exitBtn.style, { left: `${il + v.x + v.w / 2 + gap / 2}px`, top: `${top}px`, width: `${ps}px`, height: `${ps}px`, fontSize: `${ps * 0.42}px` });
  updatePadUI();
}

function updatePadUI() {
  const pads = new Set(input.padPlayers());
  for (const el of controls.querySelectorAll('.pad')) el.classList.toggle('off', pads.has(+el.dataset.player));
  updateHints();
}

/* ---------- loop: pads for the menus, match end ---------- */
let last = 0;
function frame(ts) {
  const dt = Math.min(0.1, (ts - last) / 1000 || 0);
  last = ts;
  input.pollPads();
  nav.poll(dt, input.pads());
  if (game && !paused && game.phase === 'matchEnd' && game.phaseT > 1.6 && !resultShown) showResult();
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
  stage = new Stage(stageEl);
  [theme] = await Promise.all([loadTheme('classic'), stage.ready]);
  stage.setMuted(!settings.sound);
  input = new InputManager();
  input.onPadsChanged = updatePadUI;
  input.bindTouch(controls);
  nav = new MenuNav(onNav);
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
  $('#againBtn').onclick = startGame;
  $('#menuBtn').onclick = quitToMenu;
  addEventListener('pointerdown', () => document.body.classList.remove('nav'));
  addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', () => { if (document.hidden && game && !paused) setPaused(true); });
  $('#loading').hidden = true;
  window.versus = { stage, get game() { return game; } }; // debugging handle
  show('title');
  onResize();
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
}

boot();
