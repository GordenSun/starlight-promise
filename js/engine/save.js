// =========================================================
// 存档 / 设置 / 全局解锁 —— 基于 localStorage
// =========================================================
import { GAME, DEFAULT_SETTINGS } from '../data/config.js';
import { HEROINE_IDS, PROTAGONIST } from '../data/characters.js';

const KEY = GAME.storageKey;

function loadRoot() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn('读取存档失败', e); }
  return {
    settings: { ...DEFAULT_SETTINGS },
    global: { cg: [], routes: [], chars: [], bgs: [], cleared: 0 },
    slots: {},
    auto: null,
  };
}

let root = loadRoot();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(root)); }
  catch (e) { console.warn('写入存档失败', e); }
}

// ---------- 设置 ----------
export function getSettings() { return { ...DEFAULT_SETTINGS, ...root.settings }; }
export function saveSettings(s) { root.settings = { ...root.settings, ...s }; persist(); }

// ---------- 全局解锁（跨周目保留） ----------
export function getGlobal() { return root.global; }
export function unlock(type, id) {
  const arr = root.global[type];
  if (arr && !arr.includes(id)) { arr.push(id); persist(); return true; }
  return false;
}
export function isUnlocked(type, id) { return root.global[type]?.includes(id); }
export function markCleared(heroine) {
  if (!root.global.routes.includes(heroine)) {
    root.global.routes.push(heroine);
    root.global.cleared = root.global.routes.length;
    persist();
  }
}

// ---------- 游戏状态 ----------
export function newState(name) {
  const aff = {}, ev = {};
  HEROINE_IDS.forEach(id => { aff[id] = 0; ev[id] = 0; });
  return {
    playerName: name || PROTAGONIST.defaultName,
    day: 1,
    phase: 'story',          // story | hub | ending
    affection: aff,
    eventsDone: ev,
    flags: {},
    scene: 'prologue',
    step: 0,
    returnScene: null,       // 事件结束后返回的场景（一般是 hub）
    history: [],             // 对话回放
  };
}

// ---------- 槽位 ----------
export function slotList() {
  const list = [];
  for (let i = 1; i <= GAME.saveSlots; i++) list.push({ slot: i, data: root.slots[i] || null });
  return list;
}
export function writeSlot(slot, state, summary) {
  root.slots[slot] = { state: structuredClone(state), meta: { time: Date.now(), summary } };
  persist();
}
export function readSlot(slot) { return root.slots[slot] ? structuredClone(root.slots[slot].state) : null; }
export function deleteSlot(slot) { delete root.slots[slot]; persist(); }

export function autosave(state, summary) {
  root.auto = { state: structuredClone(state), meta: { time: Date.now(), summary } };
  persist();
}
export function readAuto() { return root.auto ? structuredClone(root.auto.state) : null; }
export function hasAnySave() { return !!root.auto || Object.keys(root.slots).length > 0; }

export function fmtTime(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
