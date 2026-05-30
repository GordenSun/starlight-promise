// =========================================================
// 视觉小说运行时 —— 解释执行剧本步骤
// 支持：背景/立绘/情绪、打字机对话、旁白、内心独白、分支选项、
//       好感度变更、状态标记、条件跳转、章节卡、CG、结局、回放记录。
// =========================================================
import { stage } from './stage.js';
import { audio } from './audio.js';
import { CHARACTERS, PROTAGONIST, MAX_AFFECTION } from '../data/characters.js';
import { TEXT_SPEED_MS, AUTO_DELAY_MS } from '../data/config.js';
import { getSettings, unlock } from './save.js';

class VN {
  constructor() {
    this.scenes = {};
    this.state = null;
    this.controller = null;
    this.scene = null; this.steps = []; this.labels = {}; this.index = 0;
    this.typing = false; this.waitingChoice = false; this.paused = false;
    this.auto = false; this.skip = false;
  }

  init(scenes, controller) {
    this.scenes = scenes;
    this.controller = controller;
    this.box = document.getElementById('dialogueBox');
    this.nameWrap = document.getElementById('namePlate');
    this.nameEl = document.getElementById('speakerName');
    this.textEl = document.getElementById('dialogueText');
    this.nextEl = document.getElementById('nextIndicator');
    this.narrEl = document.getElementById('narrationBox');
    this.choiceLayer = document.getElementById('choicesLayer');
  }

  // ---------- 启动 / 跳转 ----------
  start(state, sceneId, step = 0) {
    this.state = state;
    this.loadScene(sceneId, step);
    if (step > 0) this._reconstruct(step);
    this.proceed();
  }

  loadScene(id, step = 0) {
    const raw = this.scenes[id];
    if (!raw) { console.error('未找到场景：' + id); return; }
    const sc = Array.isArray(raw) ? { steps: raw } : raw;
    this.scene = id; this.steps = sc.steps; this.index = step;
    this.state.scene = id; this.state.step = step;
    this.labels = {};
    this.steps.forEach((s, i) => { if (s.label) this.labels[s.label] = i; });
    if (sc.bgm) audio.playBgm(sc.bgm);
    if (sc.bg) { stage.setBackground(sc.bg, sc); unlock('bgs', sc.bg); }
  }

  // 读档时：仅重建视觉状态（背景/立绘），不重复执行好感度等副作用
  _reconstruct(upto) {
    let bg = null, tint = null, particles = null;
    const shown = [];
    for (let i = 0; i < upto && i < this.steps.length; i++) {
      const s = this.steps[i];
      if (s.bg) { bg = s.bg; tint = s.tint ?? tint; particles = s.particles ?? particles; }
      if (s.tint !== undefined) tint = s.tint;
      if (s.particles !== undefined) particles = s.particles;
      if (s.show) { const e = shown.find(x => x.id === s.show); if (e) e.pos = s.at || e.pos; else shown.push({ id: s.show, pos: s.at || 'center' }); }
      if (s.hide) { const idx = shown.findIndex(x => x.id === s.hide); if (idx >= 0) shown.splice(idx, 1); }
      if (s.hideAll) shown.length = 0;
    }
    if (bg) stage.setBackground(bg, { tint, particles });
    shown.forEach(x => stage.showChar(x.id, x.pos));
  }

  // ---------- 主推进循环 ----------
  proceed() {
    while (true) {
      if (this.index >= this.steps.length) { this._sceneEnd(); return; }
      this.state.step = this.index;
      const r = this._exec(this.steps[this.index]);
      if (r === 'wait' || r === 'stop') return;
      if (r === 'jumped') continue;
      this.index++;
    }
  }

  advance() {
    if (this.paused || this.waitingChoice) return;
    if (this.controller?.hubOpen || this.controller?.cgOpen) return; // 中枢 / CG 展示时不推进剧本
    if (this.typing) { this._finishTyping(); return; }
    this.index++;
    this.proceed();
  }

  _sceneEnd() {
    // 场景自然结束：默认回到中枢（若在日常阶段）
    if (this.state.phase === 'hub' || this.state.returnScene) this.controller.enterHub();
    else this.controller.toTitle();
  }

  // ---------- 步骤执行 ----------
  _exec(s) {
    // —— 视觉/瞬时 ——
    if (s.bg) { stage.setBackground(s.bg, s); unlock('bgs', s.bg); return 'next'; }
    if (s.tint !== undefined && Object.keys(s).length === 1) { stage.setTint(s.tint); return 'next'; }
    if (s.particles !== undefined && Object.keys(s).length === 1) { stage.setParticles(s.particles); return 'next'; }
    if (s.show) { stage.showChar(s.show, s.at || 'center', s.expr); unlock('chars', s.show); return 'next'; }
    if (s.hide) { stage.hideChar(s.hide); return 'next'; }
    if (s.hideAll) { stage.hideAll(); return 'next'; }
    if (s.move) { stage.move(s.move, s.to); return 'next'; }
    if (s.emote) { stage.emote(s.emote, s.sym || '❤'); if (s.react) stage.react(s.emote, s.react); return 'next'; }
    if (s.react) { stage.react(s.react, s.type || 'bounce'); return 'next'; }
    if (s.blush !== undefined) { stage.blush(s.blush, s.on !== false); return 'next'; }
    if (s.bgm) { audio.playBgm(s.bgm); return 'next'; }
    if (s.sfx) { audio.sfx(s.sfx); return 'next'; }
    if (s.flash) { stage.flash(); audio.sfx('meteor'); return 'next'; }
    if (s.aff) { this._applyAff(s.aff); return 'next'; }
    if (s.set) { Object.assign(this.state.flags, s.set); return 'next'; }
    if (s.cg) { this.controller.showCG(s.cg); unlock('cg', s.cg); return 'wait'; }
    if (s.cgHide) { this.controller.hideCG(); return 'next'; }
    if (s.label !== undefined) return 'next';

    // —— 控制流 ——
    if (s.goto) { this._goto(s.goto); return 'jumped'; }
    if (s.if) { if (this.state.flags[s.if]) { this._goto(s.goto || s.then); return 'jumped'; } return 'next'; }
    if (s.ifNot) { if (!this.state.flags[s.ifNot]) { this._goto(s.goto || s.then); return 'jumped'; } return 'next'; }
    if (s.ifAff) { const { id, gte = 0 } = s.ifAff; if ((this.state.affection[id] || 0) >= gte) { this._goto(s.goto); return 'jumped'; } return 'next'; }
    if (s.hub) { this.controller.enterHub(); return 'stop'; }
    if (s.endEvent) { this.controller.finishEvent(s.endEvent); return 'stop'; }
    if (s.ending) { this.controller.showEnding(s.ending); return 'stop'; }

    // —— 阻塞 ——
    if (s.chapter) { this._chapterCard(s.chapter); return 'stop'; }
    if (s.wait) { this.paused = true; setTimeout(() => { this.paused = false; this.index++; this.proceed(); }, s.wait); return 'stop'; }
    if ('say' in s || 'narrate' in s || 'think' in s) { this._dialogue(s); return 'wait'; }
    if (s.choice) { this._choices(s); return 'wait'; }

    console.warn('未知步骤', s);
    return 'next';
  }

  _goto(target) {
    if (target in this.labels) { this.index = this.labels[target]; }
    else if (this.scenes[target]) { this.loadScene(target, 0); }
    else { console.warn('跳转目标不存在：' + target); this.index++; }
  }

  // ---------- 对话渲染 ----------
  _sub(text) { return (text || '').replace(/\{name\}/g, this.state.playerName); }

  _dialogue(s) {
    const isNarr = 'narrate' in s;
    const isThink = 'think' in s;
    let text;
    if (isNarr) text = this._sub(s.narrate);
    else if (isThink) text = '（' + this._sub(s.think) + '）';
    else text = this._sub(s.text);
    this.choiceLayer.classList.add('hidden');

    if (isNarr) {
      this.box.classList.remove('show');
      this.narrEl.classList.add('show');
      stage.setSpeaker(null);
      this._typeInto(this.narrEl, text, () => { });
      this._pushHistory('', text, 'narr');
      return;
    }

    // 说话者
    let who, color;
    if (isThink || s.say === 'me') {
      who = isThink ? '' : this.state.playerName;
      color = PROTAGONIST.color;
    } else if (CHARACTERS[s.say]) {
      who = CHARACTERS[s.say].name; color = CHARACTERS[s.say].color;
      stage.setSpeaker(s.say);
      if (s.expr) { /* 表情切换预留 */ }
      if (s.blush) stage.blush(s.say, true);
      if (s.emoteSym) stage.emote(s.say, s.emoteSym);
      if (s.reactT) stage.react(s.say, s.reactT);
    } else {
      who = this._sub(s.say); color = s.color || '#ffd98a';
      stage.setSpeaker(null);
    }

    this.narrEl.classList.remove('show');
    this.box.classList.add('show');
    document.documentElement.style.setProperty('--accent', color);
    if (CHARACTERS[s.say]?.color2) { /* 可拓展 */ }

    if (who) { this.nameWrap.classList.remove('hidden'); this.nameEl.textContent = who; this.nameWrap.style.background = `linear-gradient(120deg, ${color}, ${this._light(color)})`; }
    else { this.nameWrap.classList.add('hidden'); }

    this._typeInto(this.textEl, text, () => { });
    this._pushHistory(who, text, isThink ? 'think' : 'say');
  }

  _typeInto(el, text, done) {
    const sp = getSettings().textSpeed;
    const speed = TEXT_SPEED_MS[sp] ?? 16;
    this.nextEl.style.opacity = 0;
    this.typing = true;
    el.innerHTML = '';
    if (speed === 0 || this.skip) { el.textContent = text; this.typing = false; this._typed(done); return; }
    let i = 0;
    const cursor = '<span class="cursor">▍</span>';
    const tick = () => {
      if (!this.typing) return;
      i++;
      el.innerHTML = this._esc(text.slice(0, i)) + (i < text.length ? cursor : '');
      if (i % 2 === 0) audio.sfx('type');
      if (i < text.length) this._typeTimer = setTimeout(tick, speed);
      else { this.typing = false; this._typed(done); }
    };
    this._typeTimer = setTimeout(tick, speed);
  }

  _finishTyping() {
    clearTimeout(this._typeTimer);
    const cur = this.narrEl.classList.contains('show') ? this.narrEl : this.textEl;
    const s = this.steps[this.index];
    let full;
    if ('narrate' in s) full = this._sub(s.narrate);
    else if ('think' in s) full = '（' + this._sub(s.think) + '）';
    else full = this._sub(s.text);
    cur.innerHTML = this._esc(full);
    this.typing = false;
    this._typed(() => { });
  }

  _typed(done) {
    this.nextEl.style.opacity = 0.85;
    done && done();
    if (this.skip) { setTimeout(() => this.advance(), 40); return; }
    if (this.auto) { this._autoTimer = setTimeout(() => this.advance(), AUTO_DELAY_MS[getSettings().autoSpeed] ?? 1700); }
  }

  _esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); }
  _light(hex) {
    const n = hex.replace('#', ''); const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
    const mix = (c) => Math.round(c + (255 - c) * 0.45);
    return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
  }

  // ---------- 选项 ----------
  _choices(s) {
    this.waitingChoice = true;
    this.nextEl.style.opacity = 0;
    const layer = this.choiceLayer;
    layer.innerHTML = '';
    layer.classList.remove('hidden');
    if (s.q) { const q = document.createElement('div'); q.className = 'choice-q'; q.textContent = this._sub(s.q); layer.appendChild(q); }
    s.choice.forEach((opt, i) => {
      const b = document.createElement('button');
      b.className = 'choice-btn';
      b.innerHTML = this._esc(this._sub(opt.text));
      b.addEventListener('mouseenter', () => audio.sfx('hover'));
      b.addEventListener('click', () => this._pickChoice(opt));
      layer.appendChild(b);
      setTimeout(() => b.classList.add('in'), 60 + i * 90);
    });
  }

  _pickChoice(opt) {
    audio.sfx('confirm');
    this.waitingChoice = false;
    this.choiceLayer.classList.add('hidden');
    this.choiceLayer.innerHTML = '';
    if (opt.aff) this._applyAff(opt.aff, true);
    if (opt.set) Object.assign(this.state.flags, opt.set);
    if (opt.goto) { this._goto(opt.goto); this.proceed(); }
    else { this.index++; this.proceed(); }
  }

  // ---------- 好感度 ----------
  _applyAff(map, fromChoice = false) {
    for (const id in map) {
      const before = this.state.affection[id] || 0;
      const after = Math.max(0, Math.min(MAX_AFFECTION, before + map[id]));
      this.state.affection[id] = after;
      const d = map[id];
      if (d > 0) {
        const name = CHARACTERS[id]?.name || id;
        this.controller.toast(`${name} 好感度 +${d} ♥`, 'heart');
        audio.sfx('heart');
        if (d >= 8) stage.react(id, 'bounce');
      } else if (d < 0) {
        const name = CHARACTERS[id]?.name || id;
        this.controller.toast(`${name} 好感度 ${d}`, '');
        stage.react(id, 'tremble');
      }
    }
    this.controller.refreshTopbar();
  }

  // ---------- 章节卡 ----------
  _chapterCard(data) {
    audio.sfx('transition');
    const card = document.createElement('div');
    card.className = 'chapter-card';
    card.innerHTML = `<div class="ch-kicker">${this._esc(data.kicker || '')}</div>
      <div class="ch-title">${this._esc(this._sub(data.title))}</div><div class="ch-line"></div>`;
    document.getElementById('screen-game').appendChild(card);
    void card.offsetWidth; card.classList.add('show');
    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return; dismissed = true;
      clearTimeout(tmr); card.removeEventListener('click', dismiss);
      card.classList.remove('show');
      setTimeout(() => card.remove(), 800);
      this.index++; this.proceed();
    };
    const tmr = setTimeout(dismiss, data.hold || 2600);
    card.addEventListener('click', dismiss);
  }

  // ---------- 回放 ----------
  _pushHistory(who, text, type) {
    this.state.history.push({ who, text, type });
    if (this.state.history.length > 220) this.state.history.shift();
  }

  setAuto(on) { this.auto = on; if (!on) clearTimeout(this._autoTimer); else if (!this.typing && !this.waitingChoice) this.advance(); }
  setSkip(on) { this.skip = on; if (on && !this.waitingChoice) this.advance(); }
}

export const vn = new VN();
