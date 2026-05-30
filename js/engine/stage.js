// =========================================================
// 舞台 —— 背景 + 人物立绘 + 逐帧程序化动画
// 动画完全由 requestAnimationFrame 每帧计算 transform 生成：
//   呼吸(scaleY) + 摇摆(rotate/位移) + 入场 + 说话浮动 + 情绪反应(雀跃/惊吓/点头)
// 配合抠像得到的透明 PNG，即为「序列帧」式的活体立绘动画。
// =========================================================
import { CHARACTERS } from '../data/characters.js';
import { BACKGROUNDS } from '../data/config.js';

const POS = { farleft: 24, left: 33, center: 50, right: 67, farright: 76 };

class Stage {
  constructor() { this.chars = new Map(); this.running = false; this.cur = 'bg2'; }

  init() {
    this.bgA = document.getElementById('stageBg');
    this.bgB = document.getElementById('stageBgNext');
    this.tint = document.getElementById('stageTint');
    this.layer = document.getElementById('stageChars');
    this.particles = document.getElementById('stageParticles');
    this.flashEl = document.getElementById('stageFlash');
    this.stageEl = this.layer.parentElement;
    this._activeBg = this.bgA;
    if (!this.running) { this.running = true; this.t0 = performance.now(); this._loop(); }
  }

  // ---------------- 背景 ----------------
  setBackground(key, opts = {}) {
    const url = BACKGROUNDS[key] || key;
    const show = this._activeBg === this.bgA ? this.bgB : this.bgA;
    const hide = this._activeBg;
    show.style.backgroundImage = `url("${url}")`;
    show.classList.toggle('kenburns', !!opts.kenburns);
    // 强制重绘后淡入
    void show.offsetWidth;
    show.classList.add('show');
    hide.classList.remove('show');
    this._activeBg = show;
    this.setTint(opts.tint || null);
    if (opts.particles !== undefined) this.setParticles(opts.particles);
  }

  setTint(type) {
    this.tint.className = 'stage-tint';
    if (type) { void this.tint.offsetWidth; this.tint.classList.add(type); }
  }

  flash() { this.flashEl.classList.remove('flash'); void this.flashEl.offsetWidth; this.flashEl.classList.add('flash'); }

  setParticles(type) {
    if (this._ptype === type) return;
    this._ptype = type;
    this.particles.innerHTML = '';
    if (!type) return;
    const n = type === 'petal' ? 16 : 18;
    for (let i = 0; i < n; i++) {
      const e = document.createElement('div');
      e.className = type === 'petal' ? 'petal' : 'spark';
      e.style.left = Math.random() * 100 + '%';
      const dur = (type === 'petal' ? 9 : 7) + Math.random() * 7;
      e.style.animationDuration = dur + 's';
      e.style.animationDelay = -Math.random() * dur + 's';
      if (type === 'petal') e.style.transform = `scale(${0.6 + Math.random() * 0.8})`;
      else { e.style.bottom = '0'; e.style.top = 'auto'; }
      this.particles.appendChild(e);
    }
  }

  // ---------------- 人物 ----------------
  showChar(id, pos = 'center', expr = 'normal') {
    const def = CHARACTERS[id];
    if (!def) return;
    let c = this.chars.get(id);
    if (!c) {
      const el = document.createElement('div');
      el.className = 'char';
      el.innerHTML = `<div class="blush"></div><img src="${def.sprite}" alt="${def.name}"><div class="emote"></div>`;
      this.layer.appendChild(el);
      c = {
        id, el, img: el.querySelector('img'),
        blushEl: el.querySelector('.blush'), emoteEl: el.querySelector('.emote'),
        scale: def.scale || 1, offsetY: def.offsetY || 0,
        phase: Math.random() * Math.PI * 2,
        breathe: 0.85 + Math.random() * 0.2,
        sway: 0.8 + Math.random() * 0.25,
        leftCur: POS[pos] ?? 50, leftTgt: POS[pos] ?? 50,
        enter: 0, enterFrom: pos.includes('right') || pos === 'center' ? 1 : -1,
        speaking: false, blush: false, reaction: null, shown: true, opacity: 0,
      };
      this.chars.set(id, c);
    } else {
      c.leftTgt = POS[pos] ?? 50; c.shown = true;
    }
    requestAnimationFrame(() => c.el.classList.add('show'));
  }

  hideChar(id) {
    const c = this.chars.get(id); if (!c) return;
    c.shown = false; c.el.classList.remove('show');
    setTimeout(() => { if (!c.shown) { c.el.remove(); this.chars.delete(id); } }, 600);
  }

  hideAll() { for (const id of [...this.chars.keys()]) this.hideChar(id); }

  move(id, pos) { const c = this.chars.get(id); if (c) c.leftTgt = POS[pos] ?? 50; }

  setSpeaker(id) {
    for (const [cid, c] of this.chars) {
      c.speaking = cid === id;
      c.el.classList.toggle('dim', id != null && cid !== id);
      c.el.classList.toggle('speaking', cid === id);
    }
  }

  clearDim() { for (const c of this.chars.values()) { c.el.classList.remove('dim'); c.speaking = false; c.el.classList.remove('speaking'); } }

  emote(id, sym) {
    const c = this.chars.get(id); if (!c) return;
    c.emoteEl.textContent = sym;
    c.emoteEl.classList.remove('play'); void c.emoteEl.offsetWidth; c.emoteEl.classList.add('play');
  }

  blush(id, on = true) { const c = this.chars.get(id); if (!c) return; c.blush = on; c.el.classList.toggle('blushing', on); }

  react(id, type) { const c = this.chars.get(id); if (!c) return; c.reaction = { type, start: performance.now() }; }

  reset() { this.hideAll(); this.setParticles(null); this.setTint(null); this.clearDim(); }

  // ---------------- 主循环（逐帧计算 transform） ----------------
  _loop() {
    const now = performance.now();
    const t = (now - this.t0) / 1000;
    const stageH = this.stageEl ? this.stageEl.clientHeight : 720;
    for (const c of this.chars.values()) {
      // 入场过渡
      c.enter += (1 - c.enter) * 0.08;
      const enterMiss = 1 - c.enter;
      // 位置插值
      c.leftCur += (c.leftTgt - c.leftCur) * 0.12;
      c.el.style.left = c.leftCur + '%';

      // 呼吸
      const breath = Math.sin(t * c.breathe + c.phase);
      const scaleY = 1 + breath * 0.013;
      const scaleBob = 1 + breath * 0.004;
      // 摇摆
      const sway = Math.sin(t * c.sway * 0.6 + c.phase);
      let rot = sway * 0.7;
      let dx = sway * 4 + enterMiss * c.enterFrom * 80;
      let dy = (c.offsetY / 100) * stageH;
      // 说话浮动
      if (c.speaking) dy += -Math.abs(Math.sin(t * 7)) * 3 - 2;

      // 情绪反应
      if (c.reaction) {
        const rt = (now - c.reaction.start) / 1000;
        const p = rt / this._reactDur(c.reaction.type);
        if (p >= 1) c.reaction = null;
        else {
          const env = Math.sin(Math.min(p, 1) * Math.PI); // 0→1→0 包络
          switch (c.reaction.type) {
            case 'bounce': dy -= Math.abs(Math.sin(p * Math.PI * 3)) * 26 * (1 - p); break;
            case 'shake':  dx += Math.sin(p * Math.PI * 18) * 12 * (1 - p); break;
            case 'nod':    rot += Math.sin(p * Math.PI * 4) * 4 * env; dy += env * 4; break;
            case 'tremble':dx += Math.sin(p * Math.PI * 26) * 4 * (1 - p); break;
            case 'pop':    { const s = 1 + env * 0.06; rot += sway * 0; c._popS = s; } break;
          }
        }
      }
      const pop = c._popS || 1; c._popS = 1;

      const sc = c.scale * scaleBob * pop;
      c.el.style.transform =
        `translate(-50%, ${dy}px) translateX(${dx}px) rotate(${rot.toFixed(3)}deg) scale(${sc.toFixed(4)}) scaleY(${scaleY.toFixed(4)})`;
    }
    requestAnimationFrame(() => this._loop());
  }

  _reactDur(type) { return type === 'bounce' ? 0.9 : type === 'shake' ? 0.6 : type === 'nod' ? 0.7 : type === 'pop' ? 0.4 : 0.6; }
}

export const stage = new Stage();
