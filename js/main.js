import { WEAPONS, WEAPON_IDS, MAPS, MAP_IDS, WIN_OPTIONS, TIME_OPTIONS, MAX_POWER, MAX_REACH, SUPERS, APP_VERSION, SUPPLY_MODES } from './config.js';
import { computeLayout } from './layout.js';
import { loadTheme } from './assets.js';
import { InputManager } from './input.js';
import { Game } from './game.js';
import { AI } from './ai.js';
import { Stage } from './stage.js';
import { MenuNav, pickNext } from './menu.js';
import { moveList } from './moves.js';

const $ = s => document.querySelector(s);
const stageEl = $('#stage'), controls = $('#controls'), pauseBtn = $('#pauseBtn'), exitBtn = $('#exitBtn'), hints = $('#hints');
const LABEL = { attack: '공격', guard: '방어' };
const DPAD_HTML = '<i class="arm u">▲</i><i class="arm d">▼</i><i class="arm l">◀</i><i class="arm r">▶</i><i class="hub"></i>';
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
  setup: '방향키 커서 · Ⓐ 선택 · Ⓑ 기술표 · Select 뒤로 · LB/RB 맵 · ☰ 시작',
  pause: 'Ⓐ 선택 · Ⓑ/☰ 계속하기',
  confirm: 'Ⓐ 선택 · Ⓑ 계속하기',
  result: 'Ⓐ 선택 · Ⓑ 메뉴로'
};

const store = {
  load() { try { return JSON.parse(localStorage.getItem('versus.settings')) || {}; } catch { return {}; } },
  save(v) { try { localStorage.setItem('versus.settings', JSON.stringify(v)); } catch { /* storage unavailable */ } }
};
const settings = Object.assign({ mode: '2p', weapons: ['sword', 'axe'], map: 'random', wins: 3, time: 90, sound: true, supply: 'off' }, store.load());
const SUPPLY_LABEL = { off: '없음', on: '보급', x2: '보급x2' };

let theme, stage, input, nav, game = null, ai = null, paused = false, resultShown = false, activeScreen = 'title';
const focused = new Map(); // activeScreen id → last focused element

/* ---------- screens ---------- */
function show(id) {
  closeMoveLists();
  activeScreen = id;
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  const playing = id === null || id === 'pause' || id === 'result' || id === 'confirm';
  stageEl.hidden = controls.hidden = !playing;
  pauseBtn.hidden = exitBtn.hidden = id !== null;
  if (id) setFocus(focused.get(id)?.isConnected && !focused.get(id).hidden ? focused.get(id) : defaultFocus(id));
  setP2Focus(id === 'setup' && settings.mode === '2p' && input?.pads().length > 1 ? p2Items().find(b => b.dataset.w === settings.weapons[1]) : null);
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

// The cursor only moves; a portrait or map is picked when Ⓐ (Enter) is pressed on it.
function setFocus(el) {
  if (!el) return;
  document.querySelector('.nav-focus')?.classList.remove('nav-focus');
  el.classList.add('nav-focus');
  focused.set(activeScreen, el);
}

// In 2P setup the second pad has its own cursor inside P2's roster.
const p2Items = () => [...document.querySelectorAll('#setup .side[data-player="1"] [data-w]')];
function setP2Focus(el) {
  document.querySelector('.nav-focus2')?.classList.remove('nav-focus2');
  el?.classList.add('nav-focus2');
}
const rects = items => items.map(b => { const r = b.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });

function updateHints() {
  const pads = input?.pads().length || 0;
  let text = activeScreen && pads ? HINTS[activeScreen] + (activeScreen === 'setup' && settings.mode === '2p' && pads > 1 ? ' · P2 패드는 P2 캐릭터' : '') : '';
  // no pad seen yet on the title: tell the player how to wake it up
  if (activeScreen === 'title' && !pads) text = window.isSecureContext === false
    ? '보안 연결(HTTPS)이 아니라 컨트롤러가 막혀 있을 수 있습니다'
    : '컨트롤러는 아무 버튼이나 한 번 누르면 연결됩니다';
  hints.textContent = text;
  hints.hidden = !text;
}

/* ---------- gamepad / keyboard menu actions ---------- */
/* ---------- move list popup (pad Ⓑ on the setup screen) ---------- */
const moveLists = new Map(); // pad index → popup element

// The character under this pad's cursor (or the one picked on its side) and the side it belongs to.
function moveListTarget(src) {
  const cur = document.querySelector(src === 1 && settings.mode === '2p' ? '.nav-focus2' : '.nav-focus');
  const side = cur?.closest('.side') ?? document.querySelector(`#setup .side[data-player="${src === 1 && settings.mode === '2p' ? 1 : 0}"]`);
  return { side, w: cur?.dataset.w ?? settings.weapons[+side.dataset.player] };
}

function toggleMoveList(src) {
  if (moveLists.has(src)) { closeMoveList(src); return; }
  const { side, w } = moveListTarget(src);
  openMoveList(src, side, w);
}

function closeMoveList(key) {
  moveLists.get(key)?.remove(); moveLists.delete(key); stage.play('back');
}

// key: the pad index that opened it, or 'touch<player>' when a finger (or mouse) did.
function openMoveList(key, side, w) {
  const c = theme.characters[w], ml = moveList(w), touch = typeof key === 'string';
  for (const [k, el] of moveLists) if (el.parentElement === side) { el.remove(); moveLists.delete(k); }
  const el = document.createElement('div');
  el.className = 'movelist';
  el.innerHTML = `<header><img src="${theme.base + c.portrait}" alt=""><div><b>${c.name}</b><small>${c.title} · ${ml.name}</small></div>
    <button class="ml-close" aria-label="닫기">✕</button></header>
    <div class="ml-body"><table>${ml.rows.map(r => `<tr><th>${r.kind}</th><td><b>${r.name}</b>${r.note ? `<small>${r.note}</small>` : ''}</td><td class="in">${r.input}</td></tr>`).join('')}</table></div>
    <footer>${touch ? '밀어서 스크롤 · ✕ 닫기' : '▲▼ 스크롤 · Ⓑ 닫기'}</footer>`;
  el.querySelector('.ml-close').onclick = e => { e.stopPropagation(); closeMoveList(key); };
  // finger/mouse drag scrolls the list (the page itself blocks touch panning)
  const body = el.querySelector('.ml-body');
  let drag = null;
  body.addEventListener('pointerdown', e => { drag = { y: e.clientY, top: body.scrollTop, id: e.pointerId }; body.classList.add('dragging'); body.setPointerCapture?.(e.pointerId); });
  body.addEventListener('pointermove', e => { if (drag && e.pointerId === drag.id) body.scrollTop = drag.top - (e.clientY - drag.y); });
  for (const ev of ['pointerup', 'pointercancel']) body.addEventListener(ev, () => { drag = null; body.classList.remove('dragging'); });
  side.appendChild(el);
  moveLists.set(key, el);
  stage.play('select');
}

function closeMoveLists() { for (const el of moveLists.values()) el.remove(); moveLists.clear(); }

function onNav(action, src, repeat) {
  // an open move list takes this pad's input: up/down scroll, Ⓑ closes
  if (moveLists.has(src)) {
    const body = moveLists.get(src).querySelector('.ml-body');
    if (action === 'up' || action === 'down') body.scrollTop += (action === 'up' ? -1 : 1) * body.clientHeight * 0.4;
    else if (action === 'back' && !repeat) toggleMoveList(src);
    else if (action === 'start' && !repeat) { closeMoveLists(); startFromSetup(); }
    return true;
  }
  if (activeScreen === 'setup' && src !== 'kb' && !repeat) {
    if (action === 'back') { toggleMoveList(src); return true; }
    if (action === 'select') { stage.play('back'); show('title'); return true; }
  }
  if (activeScreen === null) {
    // fighting: only pause / exit
    if (repeat) return false;
    if (action === 'start' || (src === 'kb' && action === 'back')) { setPaused(true); return true; }
    if (action === 'select') { setPaused(true, 'confirm'); return true; }
    return false;
  }
  document.body.classList.add('nav');

  // in 2P setup the second pad moves its own cursor over P2's roster and picks with Ⓐ
  if (activeScreen === 'setup' && settings.mode === '2p' && src === 1) {
    const items = p2Items(), cur = items.indexOf(document.querySelector('.nav-focus2'));
    if (cur < 0) { setP2Focus(items.find(b => b.dataset.w === settings.weapons[1]) || items[0]); return true; }
    if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
      const next = pickNext(rects(items), cur, action);
      if (next !== cur) { setP2Focus(items[next]); stage.play('move'); }
    } else if (!repeat && action === 'ok') { stage.play('select'); items[cur].click(); }
    else if (!repeat && action === 'start') startFromSetup();
    return true;
  }
  if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
    const items = focusables(), cur = items.indexOf(document.querySelector('.nav-focus'));
    if (cur < 0) { setFocus(items[0] || defaultFocus(activeScreen)); return true; }
    const next = pickNext(rects(items), cur, action);
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
      if (!b) return;
      // touching (or clicking) the character that is already picked opens its move list;
      // pad/keyboard Ⓐ clicks come in with detail 0 and only pick
      if (e.detail > 0 && settings.weapons[p] === b.dataset.w) { openMoveList(`touch${p}`, side, b.dataset.w); return; }
      settings.weapons[p] = b.dataset.w; refreshSetup();
    };
  }
  for (const r of document.querySelectorAll('#setup .roster')) r.style.setProperty('--cols', Math.ceil(WEAPON_IDS.length / 2));
  const maps = $('#setup .maps');
  maps.style.setProperty('--cols', Math.ceil((MAP_IDS.length + 1) / 2));
  maps.innerHTML = MAP_IDS.map(id => `<button class="map" data-map="${id}"><img src="${theme.base + theme.maps[id].far}" alt=""><span>${MAPS[id].name}</span></button>`).join('')
    + `<button class="map" data-map="random"><div class="rand">?</div><span>랜덤</span></button>`;
  maps.onclick = e => { const b = e.target.closest('[data-map]'); if (b) { settings.map = b.dataset.map; refreshSetup(); } };
  $('#winsBtn').onclick = () => { settings.wins = WIN_OPTIONS[(WIN_OPTIONS.indexOf(settings.wins) + 1) % WIN_OPTIONS.length]; refreshSetup(); };
  $('#timeBtn').onclick = () => { settings.time = TIME_OPTIONS[(TIME_OPTIONS.indexOf(settings.time) + 1) % TIME_OPTIONS.length]; refreshSetup(); };
  $('#soundBtn').onclick = () => { settings.sound = !settings.sound; stage.setMuted(!settings.sound); refreshSetup(); };
  $('#supplyBtn').onclick = () => { settings.supply = SUPPLY_MODES[(SUPPLY_MODES.indexOf(settings.supply) + 1) % SUPPLY_MODES.length]; refreshSetup(); };
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
  if (!SUPPLY_MODES.includes(settings.supply)) settings.supply = 'off';
  $('#supplyBtn').innerHTML = `<small>회복 아이템</small>${SUPPLY_LABEL[settings.supply]}`;
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
  try {
    stage.startFight({ game, theme, readInputs, onLoaded: () => { if (game === current) $('#loading').hidden = true; } });
  } catch (e) { $('#loading').hidden = true; report('startFight', e); }
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

// Players that need on-screen buttons: those not on a gamepad (the computer never needs them).
function touchPlayers() {
  const pads = new Set(input.padPlayers());
  return Array.from({ length: input.players }, (_, i) => i).filter(i => !pads.has(i));
}

function onResize() {
  const [it, ir, ib, il] = safeInsets();
  const W = innerWidth - il - ir, H = innerHeight - it - ib;
  const touch = touchPlayers();
  layoutKey = `${W}x${H}:${input.players}:${touch}`;
  const layout = computeLayout(W, H, { players: input.players, touch });
  const v = layout.view, dpr = Math.min(devicePixelRatio || 1, 3);
  Object.assign(stageEl.style, { left: `${il + v.x}px`, top: `${it + v.y}px`, width: `${v.w}px`, height: `${v.h}px` });
  try { stage.resize(Math.round(v.w * dpr), Math.round(v.h * dpr)); } catch (e) { report('resize', e); }
  controls.innerHTML = layout.buttons.map(b =>
    `<div class="pad p${b.player} a-${b.action}" data-player="${b.player}" data-action="${b.action}" style="left:${il + b.x - b.r}px;top:${it + b.y - b.r}px;width:${b.r * 2}px;height:${b.r * 2}px;font-size:${Math.round(b.r * 0.5)}px">${b.action === 'dpad' ? DPAD_HTML : LABEL[b.action]}</div>`).join('');
  // pause and exit sit under the round timer, between the two super gauges
  const ps = Math.round(Math.max(30, v.h * 0.085)), gap = Math.round(ps * 0.2), top = it + v.y + v.h * (46 / 360);
  Object.assign(pauseBtn.style, { left: `${il + v.x + v.w / 2 - ps - gap / 2}px`, top: `${top}px`, width: `${ps}px`, height: `${ps}px`, fontSize: `${ps * 0.42}px` });
  Object.assign(exitBtn.style, { left: `${il + v.x + v.w / 2 + gap / 2}px`, top: `${top}px`, width: `${ps}px`, height: `${ps}px`, fontSize: `${ps * 0.42}px` });
  // fingers resting on buttons that just went away must not stay pressed
  input.pointers.clear(); input.dpads.clear();
  updateHints();
}

// A gamepad connected or left: the touch buttons of a pad player disappear (or come back) and the
// main view grows into (or gives back) the space.
let layoutKey = '';
function updatePadUI() {
  const [it, ir, ib, il] = safeInsets();
  if (layoutKey !== `${innerWidth - il - ir}x${innerHeight - it - ib}:${input.players}:${touchPlayers()}`) onResize();
  else updateHints();
}

/* ---------- loop: pads for the menus, match end ---------- */
let last = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (ts - last) / 1000 || 0);
  last = ts;
  input.pollPads();
  nav.poll(dt, input.pads());
  if (game && !paused && game.phase === 'matchEnd' && game.phaseT > 1.6 && !resultShown) showResult();
}

const report = (where, e) => { console.error(where, e); window.__fatal?.(`${where}: ${e?.stack || e}`); };

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
  $('#version').textContent = APP_VERSION;
  stage = new Stage(stageEl);
  [theme] = await Promise.all([loadTheme('classic'), stage.ready]);
  stage.setMuted(!settings.sound);
  input = new InputManager();
  input.onPadsChanged = updatePadUI;
  input.bindTouch(controls);
  // menus and pads come alive first, so a later failure can't leave the controller dead
  nav = new MenuNav(onNav);
  requestAnimationFrame(frame);
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
  window.versus = { stage, input, nav, get game() { return game; } }; // debugging handle
  show('title');
  onResize();
  registerServiceWorker();
}

// When an updated worker takes over, reload once so every file comes from the same version.
function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  const sw = navigator.serviceWorker;
  let reloading = false;
  if (sw.controller) sw.addEventListener('controllerchange', () => { if (!reloading && !game) { reloading = true; location.reload(); } });
  sw.register('sw.js').catch(e => console.warn('service worker', e));
}

boot().catch(e => { $('#loading').hidden = true; report('boot', e); });
