// =========================================================
// 界面层 —— 标题菜单 / 设置 / 存读档 / 好感度 / 回放 / 画廊 / 确认框
// =========================================================
import * as save from './save.js';
import { audio } from './audio.js';
import { CHARACTERS, HEROINE_IDS, PROTAGONIST, stageOf, MAX_AFFECTION } from '../data/characters.js';
import { GAME, BACKGROUNDS, LOCATIONS, DEFAULT_SETTINGS } from '../data/config.js';

let game = null;
const overlay = () => document.getElementById('overlay');

export function init(g) {
  game = g;
  // 标题菜单
  document.getElementById('titleMenu').querySelectorAll('.tbtn').forEach(btn => {
    btn.addEventListener('mouseenter', () => audio.sfx('hover'));
    btn.addEventListener('click', () => {
      audio.resume(); audio.sfx('click');
      const a = btn.dataset.action;
      if (a === 'new') openNewGame();
      else if (a === 'continue') doContinue();
      else if (a === 'gallery') openGallery();
      else if (a === 'settings') openSettings();
      else if (a === 'about') openAbout();
    });
  });
}

// ---------------- 标题 ----------------
let shootTimer = null;
export function showTitle() {
  document.getElementById('titleBg').style.backgroundImage = `url("${BACKGROUNDS.title}")`;
  const cont = document.querySelector('.tbtn[data-action="continue"]');
  if (save.hasAnySave()) cont.classList.remove('locked'); else cont.classList.add('locked');
  // 流星
  const layer = document.getElementById('titleShooting');
  if (shootTimer) clearInterval(shootTimer);
  const spawn = () => {
    const s = document.createElement('div');
    s.className = 'shoot';
    s.style.left = (10 + Math.random() * 70) + '%';
    s.style.top = (5 + Math.random() * 40) + '%';
    s.style.animation = `shootacross ${1.6 + Math.random() * 1.2}s ease-in forwards`;
    layer.appendChild(s);
    setTimeout(() => s.remove(), 3200);
  };
  shootTimer = setInterval(() => { if (!document.getElementById('screen-title').classList.contains('hidden')) spawn(); }, 2200);
}

function doContinue() {
  const st = save.readAuto() || firstSlotState();
  if (!st) { game.toast('还没有存档哦', ''); return; }
  game.loadState(st);
}
function firstSlotState() { for (const s of save.slotList()) if (s.data) return save.readSlot(s.slot); return null; }

// ---------------- 新游戏（输入名字） ----------------
function openNewGame() {
  show(`
    <div class="panel" style="max-width:560px">
      <div class="panel-head"><div class="panel-title">序章 · 你的名字</div><button class="panel-close" data-close>✕</button></div>
      <div class="panel-body">
        <p style="color:var(--ink-soft);line-height:1.8;margin-bottom:18px">流星划过的那一夜，你来到了星海市。<br>在故事开始前——告诉我，该怎么称呼你？</p>
        <input id="nameInput" type="text" maxlength="8" value="${PROTAGONIST.defaultName}"
          style="width:100%;padding:.8em 1em;border-radius:12px;background:rgba(255,255,255,.08);border:1px solid var(--line);color:#fff;font-size:18px;text-align:center;letter-spacing:.1em;outline:none">
        <div style="display:flex;gap:12px;margin-top:22px">
          <button class="menu-item" style="flex:1" data-close>再想想</button>
          <button class="menu-item" style="flex:1;border-color:var(--gold);color:var(--gold)" id="startBtn">开 始 故 事</button>
        </div>
      </div>
    </div>`);
  const input = document.getElementById('nameInput');
  input.focus(); input.select();
  const start = () => { const n = input.value.trim() || PROTAGONIST.defaultName; closeOverlay(); audio.sfx('confirm'); game.startNewGame(n); };
  document.getElementById('startBtn').onclick = start;
  input.addEventListener('keydown', e => { if (e.key === 'Enter') start(); });
}

// ---------------- 设置 ----------------
export function openSettings() {
  const s = save.getSettings();
  const seg = (name, opts, val) => `<div class="seg" data-seg="${name}">${opts.map((o, i) => `<button data-v="${i}" class="${i === val ? 'on' : ''}">${o}</button>`).join('')}</div>`;
  show(`
    <div class="panel">
      <div class="panel-head"><div class="panel-title">设置</div><button class="panel-close" data-close>✕</button></div>
      <div class="panel-body">
        <div class="set-row"><div><label>文字速度</label><div class="desc">对话逐字显示的快慢</div></div><div class="set-ctrl">${seg('textSpeed', ['慢', '中', '快', '瞬'], s.textSpeed)}</div></div>
        <div class="set-row"><div><label>自动播放速度</label><div class="desc">开启自动时每句停留时长</div></div><div class="set-ctrl">${seg('autoSpeed', ['慢', '中', '快'], s.autoSpeed)}</div></div>
        <div class="set-row"><div><label>背景音乐</label><div class="desc">程序化生成的环境配乐</div></div><div class="set-ctrl"><input type="range" id="bgmVol" min="0" max="1" step="0.05" value="${s.bgmVolume}"><span class="set-val" id="bgmVal">${Math.round(s.bgmVolume * 100)}</span></div></div>
        <div class="set-row"><div><label>音效</label><div class="desc">点击、心动等提示音</div></div><div class="set-ctrl"><input type="range" id="sfxVol" min="0" max="1" step="0.05" value="${s.sfxVolume}"><span class="set-val" id="sfxVal">${Math.round(s.sfxVolume * 100)}</span></div></div>
        <div class="set-row" style="border:none"><div><label>全屏</label><div class="desc">沉浸式体验</div></div><div class="set-ctrl"><button class="menu-item" id="fsBtn" style="padding:.5em 1.2em">切换全屏</button></div></div>
      </div>
    </div>`);
  overlay().querySelectorAll('[data-seg]').forEach(segEl => {
    segEl.querySelectorAll('button').forEach(b => b.onclick = () => {
      segEl.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); audio.sfx('select');
      save.saveSettings({ [segEl.dataset.seg]: +b.dataset.v });
    });
  });
  const bgm = document.getElementById('bgmVol'), sfx = document.getElementById('sfxVol');
  bgm.oninput = () => { document.getElementById('bgmVal').textContent = Math.round(bgm.value * 100); audio.setBgmVolume(+bgm.value); save.saveSettings({ bgmVolume: +bgm.value }); };
  sfx.oninput = () => { document.getElementById('sfxVal').textContent = Math.round(sfx.value * 100); audio.setSfxVolume(+sfx.value); };
  sfx.onchange = () => { save.saveSettings({ sfxVolume: +sfx.value }); audio.sfx('select'); };
  document.getElementById('fsBtn').onclick = () => { toggleFullscreen(); audio.sfx('click'); };
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}

// ---------------- 菜单（游戏内） ----------------
export function openMenu(state) {
  show(`
    <div class="panel" style="max-width:480px">
      <div class="panel-head"><div class="panel-title">菜单</div><button class="panel-close" data-close>✕</button></div>
      <div class="panel-body"><div class="menu-list">
        <button class="menu-item" data-close>继续游戏</button>
        <button class="menu-item" id="mSave">保存进度</button>
        <button class="menu-item" id="mLoad">读取存档</button>
        <button class="menu-item" id="mSettings">设置</button>
        <button class="menu-item" id="mGallery">回忆画廊</button>
        <button class="menu-item danger" id="mTitle">返回标题</button>
      </div></div>
    </div>`);
  document.getElementById('mSave').onclick = () => { audio.sfx('click'); openSaveLoad('save', game); };
  document.getElementById('mLoad').onclick = () => { audio.sfx('click'); openSaveLoad('load', game); };
  document.getElementById('mSettings').onclick = () => { audio.sfx('click'); openSettings(); };
  document.getElementById('mGallery').onclick = () => { audio.sfx('click'); openGallery(); };
  document.getElementById('mTitle').onclick = () => confirm('返回标题', '未保存的进度将会丢失（自动存档会保留到上一个节点）。确定返回标题吗？', () => { closeOverlay(); game.toTitle(); });
}

// ---------------- 存 / 读 档 ----------------
export function openSaveLoad(mode, g) {
  const slots = save.slotList();
  const cells = slots.map(s => {
    const d = s.data;
    if (d) return `<div class="save-slot" data-slot="${s.slot}" data-has="1">
        <div class="slot-no">存档 ${s.slot}</div>
        <div class="slot-info">${d.meta.summary || '游戏进度'}</div>
        <div class="slot-time">${save.fmtTime(d.meta.time)}</div></div>`;
    return `<div class="save-slot" data-slot="${s.slot}"><div class="slot-no">存档 ${s.slot}</div><div class="slot-info slot-empty">— 空 —</div></div>`;
  }).join('');
  show(`
    <div class="panel">
      <div class="panel-head"><div class="panel-title">${mode === 'save' ? '保存进度' : '读取存档'}</div><button class="panel-close" data-close>✕</button></div>
      <div class="panel-body"><div class="save-grid">${cells}</div></div>
    </div>`);
  overlay().querySelectorAll('.save-slot').forEach(cell => {
    const slot = +cell.dataset.slot;
    cell.onclick = () => {
      if (mode === 'save') {
        save.writeSlot(slot, g.state, g._summary());
        audio.sfx('confirm'); g.toast('已保存 ♥', 'heart'); openSaveLoad('save', g);
      } else {
        if (!cell.dataset.has) { audio.sfx('cancel'); return; }
        const st = save.readSlot(slot);
        audio.sfx('confirm'); closeOverlay(); g.loadState(st);
      }
    };
  });
}

// ---------------- 好感度面板 ----------------
export function openAffection(state) {
  const rows = HEROINE_IDS.map(id => {
    const def = CHARACTERS[id];
    const a = state.affection[id] || 0;
    const pct = Math.round((a / MAX_AFFECTION) * 100);
    const stg = stageOf(a).label;
    return `<div class="aff-row">
      <div class="aff-ava"><img src="${def.sprite}" alt=""></div>
      <div class="aff-main">
        <div class="aff-name"><div><b style="color:${def.color}">${def.name}</b><span class="arch">${def.archetype}</span></div><span class="pct" style="color:${def.color}">${pct}%</span></div>
        <div class="aff-bar"><i style="width:${pct}%;background:linear-gradient(90deg,${def.color},${def.color2})"></i></div>
        <div class="aff-stage">当前关系：${stg}</div>
      </div></div>`;
  }).join('');
  show(`<div class="panel"><div class="panel-head"><div class="panel-title">♥ 心动一览</div><button class="panel-close" data-close>✕</button></div>
    <div class="panel-body"><div class="aff-list">${rows}</div></div></div>`);
}

// ---------------- 回放记录 ----------------
export function openLog(state) {
  const items = (state.history || []).slice(-80).map(h => {
    if (h.type === 'narr') return `<div class="log-item narr"><div class="txt">${esc(h.text)}</div></div>`;
    return `<div class="log-item"><div class="who">${esc(h.who || '——')}</div><div class="txt">${esc(h.text)}</div></div>`;
  }).reverse().join('') || '<p style="color:var(--ink-dim)">还没有对话记录。</p>';
  show(`<div class="panel"><div class="panel-head"><div class="panel-title">☰ 对话回放</div><button class="panel-close" data-close>✕</button></div>
    <div class="panel-body"><div class="log-list">${items}</div></div></div>`);
}

// ---------------- 画廊 ----------------
const GAL = {
  characters: HEROINE_IDS.map(id => ({ id, img: CHARACTERS[id].sprite, cap: CHARACTERS[id].name + ' · ' + CHARACTERS[id].archetype, type: 'chars' })),
  scenes: Object.keys(BACKGROUNDS).map(k => ({ id: k, img: BACKGROUNDS[k], cap: sceneName(k), type: 'bgs' })),
  cg: HEROINE_IDS.map(id => ({ id: 'cg_' + id + '_end', img: 'assets/cg/cg_' + id + '_end.jpg', cap: CHARACTERS[id].name + ' · 结局', type: 'cg' })),
};
function sceneName(k) {
  const loc = LOCATIONS.find(l => l.bg === k); if (loc) return loc.name;
  return ({ title: '群星之夜', campus: '樱花校园', city_night: '霓虹夜街', park: '黄昏河滨', apartment: '我的小屋' })[k] || k;
}

export function openGallery(tab = 'characters') {
  const g = save.getGlobal();
  const render = (t) => {
    const list = GAL[t];
    const cells = list.map(item => {
      let unlocked = true;
      if (t === 'characters') unlocked = true; // 立绘默认可看
      if (t === 'scenes') unlocked = g.bgs.includes(item.id) || true;
      if (t === 'cg') unlocked = g.cg.includes(item.id);
      if (unlocked) return `<div class="gal-cell" data-img="${item.img}" data-cap="${item.cap}"><img src="${item.img}" onerror="this.parentElement.classList.add('locked')"><div class="cap">${item.cap}</div></div>`;
      return `<div class="gal-cell locked"><div class="lockicon">🔒</div><div class="cap">？？？</div></div>`;
    }).join('');
    return `<div class="gal-grid">${cells}</div>`;
  };
  show(`<div class="panel"><div class="panel-head"><div class="panel-title">回忆画廊</div><button class="panel-close" data-close>✕</button></div>
    <div class="panel-body">
      <div class="gal-tabs">
        <button class="gal-tab on" data-tab="characters">角色立绘</button>
        <button class="gal-tab" data-tab="scenes">场景原画</button>
        <button class="gal-tab" data-tab="cg">结局 CG</button>
      </div>
      <div id="galContent">${render('characters')}</div>
    </div></div>`);
  const content = document.getElementById('galContent');
  const bind = () => content.querySelectorAll('.gal-cell:not(.locked)').forEach(c => {
    c.onclick = () => { audio.sfx('select'); viewImage(c.dataset.img, c.dataset.cap); };
  });
  bind();
  overlay().querySelectorAll('.gal-tab').forEach(tb => tb.onclick = () => {
    overlay().querySelectorAll('.gal-tab').forEach(x => x.classList.remove('on'));
    tb.classList.add('on'); audio.sfx('select');
    content.innerHTML = render(tb.dataset.tab); bind();
  });
}

function viewImage(src, cap) {
  const v = document.createElement('div');
  v.className = 'viewer';
  v.innerHTML = `<button class="vclose">✕</button><img src="${src}"><div class="vcap">${cap || ''}</div>`;
  v.querySelector('.vclose').onclick = () => v.remove();
  v.addEventListener('click', e => { if (e.target === v) v.remove(); });
  document.getElementById('game-root').appendChild(v);
}

// ---------------- 关于 ----------------
export function openAbout() {
  show(`<div class="panel" style="max-width:600px"><div class="panel-head"><div class="panel-title">关于本作</div><button class="panel-close" data-close>✕</button></div>
    <div class="panel-body" style="line-height:1.9;color:var(--ink-soft)">
      <p><b style="color:var(--gold)">《群星之约 · Starlight Promise》</b></p>
      <p>一款二次元恋爱视觉小说。在星海市，与五位性格迥异的她相遇，用每一次选择，靠近一颗心。</p>
      <p style="margin-top:14px">五位女主：<br>
        ❀ 苏晴 · 清纯学妹　❀ 夏葵 · 元气少女　❀ 白若雪 · 高冷傲娇<br>
        ❀ 沈知夏 · 知性学姐　❀ 凌夜 · 魅惑御姐</p>
      <p style="margin-top:14px;color:var(--ink-dim);font-size:13px">
        美术：全部立绘由 AI 生成「绿幕背景」后，经程序化抠像得到透明人物，再以逐帧算法驱动呼吸、摇摆等活体动画。<br>
        音乐与音效：Web Audio 实时程序化合成，无任何外部音频文件。<br>
        版本 v${GAME.version}</p>
    </div></div>`);
}

// ---------------- 通用 ----------------
export function confirm(title, msg, onYes) {
  show(`<div class="panel" style="max-width:480px"><div class="panel-head"><div class="panel-title">${title}</div><button class="panel-close" data-close>✕</button></div>
    <div class="panel-body"><p style="color:var(--ink-soft);line-height:1.8;margin-bottom:20px">${msg}</p>
      <div style="display:flex;gap:12px"><button class="menu-item" style="flex:1" data-close>取消</button>
      <button class="menu-item" style="flex:1;border-color:var(--gold);color:var(--gold)" id="yesBtn">确定</button></div></div></div>`);
  document.getElementById('yesBtn').onclick = () => { audio.sfx('confirm'); closeOverlay(); onYes(); };
}

export function show(html) {
  const o = overlay();
  o.className = 'overlay';
  o.innerHTML = html;
  o.classList.remove('hidden');
  o.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { audio.sfx('cancel'); closeOverlay(); });
  o.onclick = (e) => { if (e.target === o) closeOverlay(); };
}
export function closeOverlay() { const o = overlay(); o.classList.add('hidden'); o.innerHTML = ''; }
function esc(t) { return (t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
