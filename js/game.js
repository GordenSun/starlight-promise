// =========================================================
// 顶层游戏控制器 —— 串联场景流程、约会中枢、结局、界面切换
// =========================================================
import { stage } from './engine/stage.js';
import { vn } from './engine/vn.js';
import { audio } from './engine/audio.js';
import { hub } from './engine/hub.js';
import * as ui from './engine/ui.js';
import * as save from './engine/save.js';
import { CHARACTERS, HEROINE_IDS, CONFESS_THRESHOLD, stageOf } from './data/characters.js';
import { GAME, LOCATIONS, BACKGROUNDS } from './data/config.js';
import { SCENES } from './data/story.js';

class Game {
  constructor() { this.state = null; this.pending = null; this.cgOpen = false; }

  init() {
    stage.init();
    vn.init(SCENES, this);
    hub.init(this);
    ui.init(this);

    this.screens = {
      title: document.getElementById('screen-title'),
      game: document.getElementById('screen-game'),
    };
    this.topbar = document.getElementById('topbar');
    this.dayChip = document.getElementById('dayChip');
    this.locChip = document.getElementById('locChip');
    this.toastEl = document.getElementById('toast');
    this.overlay = document.getElementById('overlay');

    this._wireInput();
    this._wireTopbar();

    // 测试辅助：window.__test.jump('date_suqing_1')
    window.vn = vn;
    window.stage = stage;
    window.__test = {
      jump: (s, step = 0) => {
        this.state = this.state || save.newState('测试');
        this.pending = { heroine: (SCENES[s]?.heroine) || 'suqing', kind: 'date' };
        this.state.phase = 'story'; this.hubOpen = false;
        document.getElementById('hubLayer').classList.add('hidden');
        document.querySelectorAll('.ending-card,.chapter-card').forEach(e => e.remove());
        this.showScreen('game'); this.topbar.classList.add('show'); stage.reset();
        vn.start(this.state, s, step);
      },
    };

    // 应用设置音量
    const s = save.getSettings();
    audio.setBgmVolume(s.bgmVolume); audio.setSfxVolume(s.sfxVolume);
  }

  // ---------------- 输入 ----------------
  _wireInput() {
    document.getElementById('screen-game').addEventListener('click', (e) => {
      if (e.target.closest('button, .choices-layer, .hub-layer, .overlay, .topbar, .chapter-card, .viewer, .narration-box a')) return;
      if (this.cgOpen) return;
      if (!this.hubOpen) { audio.resume(); vn.advance(); }
    });
    document.addEventListener('keydown', (e) => {
      if (this.screens.title.classList.contains('hidden') === false) return;
      const isAdvance = e.code === 'Space' || e.code === 'Enter' || e.key === ' ' || e.key === 'Enter';
      // CG 展示时：空格 / 回车 / Esc 关闭并继续
      if (this.cgOpen) {
        if (isAdvance || e.key === 'Escape') { e.preventDefault(); this.hideCG(); vn.advance(); }
        return;
      }
      if (this.overlay.classList.contains('hidden') === false) { if (e.key === 'Escape') ui.closeOverlay(); return; }
      if (this.hubOpen) return;
      if (isAdvance) { e.preventDefault(); vn.advance(); }
      else if (e.key === 'Escape') this.openMenu();
      else if (e.key === 'Control') vn.setSkip(true);
    });
    document.addEventListener('keyup', (e) => { if (e.key === 'Control') vn.setSkip(false); });
  }

  _wireTopbar() {
    document.getElementById('btnMenu').onclick = () => { audio.sfx('click'); this.openMenu(); };
    document.getElementById('btnAffection').onclick = () => { audio.sfx('click'); ui.openAffection(this.state); };
    document.getElementById('btnLog').onclick = () => { audio.sfx('click'); ui.openLog(this.state); };
    document.getElementById('btnAuto').onclick = (e) => { const on = !vn.auto; vn.setAuto(on); e.currentTarget.classList.toggle('active', on); audio.sfx('select'); };
    document.getElementById('btnSkip').onclick = (e) => { const on = !vn.skip; vn.setSkip(on); e.currentTarget.classList.toggle('active', on); audio.sfx('select'); };
  }

  // ---------------- 屏幕 ----------------
  showScreen(name) {
    for (const k in this.screens) this.screens[k].classList.toggle('hidden', k !== name);
  }

  toTitle() {
    audio.playBgm('title');
    vn.setAuto(false); vn.setSkip(false);
    document.getElementById('btnAuto').classList.remove('active');
    document.getElementById('btnSkip').classList.remove('active');
    this.hubOpen = false;
    this.showScreen('title');
    ui.showTitle();
  }

  // ---------------- 游戏流程 ----------------
  startNewGame(name) {
    this.state = save.newState(name);
    HEROINE_IDS.forEach(id => save.unlock('chars', id)); // 角色画廊在序章后逐步解锁；此处保留
    this.state.metHeroines = [];
    this.showScreen('game');
    this.topbar.classList.remove('show');
    this.hubOpen = false;
    stage.reset();
    vn.start(this.state, 'prologue', 0);
  }

  loadState(state) {
    this.state = state;
    this.showScreen('game');
    this.hubOpen = false;
    if (state.phase === 'hub') { this.enterHub(); }
    else { this.topbar.classList.add('show'); stage.reset(); vn.start(state, state.scene, state.step); }
    this.refreshTopbar();
  }

  // ---------------- 约会中枢 ----------------
  enterHub() {
    this.state.phase = 'hub';
    this.hubOpen = true;
    this.showScreen('game');
    audio.playBgm('day');
    this.topbar.classList.add('show');
    this.locChip.textContent = '星海市 · 日常';
    this.refreshTopbar();
    // 关闭对话层
    document.getElementById('dialogueBox').classList.remove('show');
    document.getElementById('narrationBox').classList.remove('show');
    document.getElementById('choicesLayer').classList.add('hidden');
    stage.hideAll();
    stage.setBackground('city_night', { tint: 'night' });
    // 天数耗尽 → 结局
    if (this.state.day > GAME.totalDays) { this.showFinale(); return; }
    hub.render(this.state, this.buildHubPlan());
    save.autosave(this.state, this._summary());
  }

  buildHubPlan() {
    const DATES = GAME.datesPerHeroine;
    return LOCATIONS.map(loc => {
      const h = loc.heroine;
      const done = this.state.eventsDone[h] || 0;
      const aff = this.state.affection[h] || 0;
      let kind, label, badgeType = 'go';
      if (done >= DATES && aff >= CONFESS_THRESHOLD) { kind = 'confess'; label = '❤ 向她表白'; badgeType = 'heart'; }
      else if (done >= DATES) { kind = 'hang'; label = '再多走近一点'; badgeType = 'soft'; }
      else { kind = 'date'; label = `第 ${done + 1} / ${DATES} 次约会`; }
      return { loc, heroine: h, def: CHARACTERS[h], done, aff, kind, label, badgeType };
    });
  }

  selectLocation(index) {
    const plan = this.buildHubPlan()[index];
    audio.sfx('confirm');
    const h = plan.heroine;
    let scene;
    if (plan.kind === 'confess') scene = 'confess_' + h;
    else if (plan.kind === 'date') scene = `date_${h}_${plan.done + 1}`;
    else scene = 'hang_' + h;
    this.pending = { heroine: h, kind: plan.kind, loc: plan.loc };
    this.hubOpen = false;
    this.state.phase = 'story';
    this.state.returnScene = '__hub__';
    document.querySelector('#hubLayer').classList.add('hidden');
    this.locChip.textContent = plan.loc.name;
    stage.reset();
    if (!SCENES[scene]) { console.warn('缺少场景', scene); scene = 'hang_' + h; }
    vn.start(this.state, scene, 0);
  }

  finishEvent() {
    const p = this.pending; this.pending = null;
    if (!p) { this.enterHub(); return; }
    if (p.kind === 'confess') return; // 表白场景会直接进入结局
    if (p.kind === 'date') this.state.eventsDone[p.heroine] = Math.min(GAME.datesPerHeroine, (this.state.eventsDone[p.heroine] || 0) + 1);
    this.state.day += 1;
    save.autosave(this.state, this._summary());
    this.enterHub();
  }

  // ---------------- 结局选择 ----------------
  showFinale() {
    this.hubOpen = true;
    const met = HEROINE_IDS
      .map(id => ({ id, def: CHARACTERS[id], aff: this.state.affection[id] || 0, done: this.state.eventsDone[id] || 0 }))
      .filter(x => x.done > 0)
      .sort((a, b) => b.aff - a.aff);
    hub.renderFinale(this.state, met, (id) => {
      if (id === null) { this.showEnding({ type: 'NORMAL END', title: '独自仰望的星空', heroine: null, text: '这一年，你与许多人擦肩。流星依旧会来，而属于你的那场心动，或许就在下一次抬头时。' }); return; }
      audio.sfx('heart');
      this.hubOpen = false;
      this.pending = { heroine: id, kind: 'confess' };
      this.state.phase = 'story';
      stage.reset();
      vn.start(this.state, 'confess_' + id, 0);
    });
  }

  // ---------------- 结局 ----------------
  showEnding(data) {
    if (data.heroine) { save.markCleared(data.heroine); save.unlock('cg', 'cg_' + data.heroine + '_end'); }
    const card = document.createElement('div');
    card.className = 'ending-card';
    const isTrue = (data.type || '').includes('TRUE') || data.heroine;
    card.innerHTML = `
      <div class="ec-inner">
        <div class="ec-type">${data.type || 'ENDING'}</div>
        <div class="ec-title">${data.title}</div>
        <div class="ec-text">${vn._sub(data.text || '')}</div>
        <button class="hub-btn primary" id="endBack">回到星空之下</button>
      </div>`;
    document.getElementById('screen-game').appendChild(card);
    audio.playBgm(data.heroine ? 'romance' : 'sad');
    card.querySelector('#endBack').onclick = () => { audio.sfx('click'); card.remove(); this.toTitle(); };
  }

  // ---------------- CG ----------------
  showCG(id) {
    this.cgOpen = true;
    const url = `assets/cg/${id}.jpg`;
    this.overlay.className = 'overlay';
    this.overlay.innerHTML = `<div class="viewer" id="cgView">
        <div class="cg-stage"><div class="cg-loading"><span class="cg-spinner"></span><span>结局插画载入中…</span></div></div>
        <div class="vcap" id="cgCap"></div>
      </div>`;
    this.overlay.classList.remove('hidden');
    const view = this.overlay.querySelector('#cgView');
    const cgStage = view.querySelector('.cg-stage');
    const cap = view.querySelector('#cgCap');

    // 图片就绪前：点击无效，不显示「点击继续」，无法跳过
    view.onclick = (e) => { e.stopPropagation(); };

    const ready = (failed) => {
      cap.textContent = failed ? '插画暂未能载入 · 点击继续' : '点击继续';
      cap.classList.add('ready');
      view.onclick = () => { audio.sfx('click'); this.hideCG(); vn.advance(); };
    };

    const img = new Image();
    img.alt = 'CG';
    let tries = 0;
    const attempt = () => { tries++; img.src = tries === 1 ? url : `${url}?retry=${tries}-${Date.now()}`; };
    img.onload = () => { cgStage.innerHTML = ''; cgStage.appendChild(img); ready(false); };
    img.onerror = () => {
      if (tries < 3) { setTimeout(attempt, 600); }
      else { cgStage.innerHTML = '<div class="cg-loading"><span>结局插画暂未能载入</span></div>'; ready(true); }
    };
    attempt();
    save.unlock('cg', id);
  }
  hideCG() { this.cgOpen = false; this.overlay.classList.add('hidden'); this.overlay.innerHTML = ''; }

  // ---------------- 菜单 ----------------
  openMenu() { ui.openMenu(this.state); }

  // ---------------- 顶栏 / 提示 ----------------
  refreshTopbar() {
    if (!this.state) return;
    if (this.state.phase === 'hub') this.dayChip.textContent = `第 ${Math.min(this.state.day, GAME.totalDays)} / ${GAME.totalDays} 天`;
    else if (this.pending) this.dayChip.textContent = CHARACTERS[this.pending.heroine]?.name || '';
    else this.dayChip.textContent = '序章';
  }

  toast(msg, type = '') {
    clearTimeout(this._toastTimer);
    this.toastEl.className = 'toast ' + type;
    this.toastEl.textContent = msg;
    // 动态定位到对白框/旁白框正上方；无可见对话框时回退到 CSS 默认位置
    const box = document.querySelector('.dialogue-box, .narration-box');
    const r = box ? box.getBoundingClientRect() : null;
    if (r && r.height > 0 && r.top > 0 && r.top < window.innerHeight) {
      this.toastEl.style.bottom = (window.innerHeight - r.top + 12) + 'px';
    } else {
      this.toastEl.style.bottom = '';
    }
    this.toastEl.classList.remove('hidden');
    void this.toastEl.offsetWidth;
    this.toastEl.classList.add('show');
    this._toastTimer = setTimeout(() => { this.toastEl.classList.remove('show'); }, 1800);
  }

  _summary() {
    if (this.state.phase === 'hub') {
      const top = HEROINE_IDS.map(id => ({ id, a: this.state.affection[id] })).sort((x, y) => y.a - x.a)[0];
      return `第${this.state.day}天 · 最心动：${CHARACTERS[top.id].name}(${top.a})`;
    }
    return this.pending ? `与${CHARACTERS[this.pending.heroine].name}的故事` : '序章';
  }

  // 供存档摘要 / 标题继续判断
  hasSave() { return save.hasAnySave(); }
}

export const game = new Game();
