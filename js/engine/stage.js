// =========================================================
// 舞台 —— 背景 + 人物立绘 + 真·帧动画
// 人物动画由「绿幕逐帧生成 → 抠像对齐」得到的多帧透明序列驱动：
//   idle 帧序列按乒乓顺序交叉淡入（呼吸/摇摆），是真正的帧动画而非单纯变换。
//   叠加极轻微的浮动 + 入场/移动/说话强调 + 事件情绪反应。
// =========================================================
import { CHARACTERS } from '../data/characters.js';
import { BACKGROUNDS } from '../data/config.js';

const POS = { farleft: 24, left: 33, center: 50, right: 67, farright: 76 };

// 乒乓播放序列：0,1,2,1 → 循环（呼吸往返）
function pingpong(n) {
  if (n <= 1) return [0];
  const seq = [];
  for (let i = 0; i < n; i++) seq.push(i);
  for (let i = n - 2; i >= 1; i--) seq.push(i);
  return seq;
}

class Stage {
  constructor() { this.chars = new Map(); this.running = false; }

  init() {
    this.bgA = document.getElementById('stageBg');
    this.bgB = document.getElementById('stageBgNext');
    this.tint = document.getElementById('stageTint');
    this.layer = document.getElementById('stageChars');
    this.particles = document.getElementById('stageParticles');
    this.flashEl = document.getElementById('stageFlash');
    this.stageEl = this.layer.parentElement;
    this._activeBg = this.bgA;
    if (!this.running) { this.running = true; this.t0 = performance.now(); this.lastNow = this.t0; this._loop(); }
  }

  // ---------------- 背景 ----------------
  setBackground(key, opts = {}) {
    const url = BACKGROUNDS[key] || key;
    const show = this._activeBg === this.bgA ? this.bgB : this.bgA;
    const hide = this._activeBg;
    show.style.backgroundImage = `url("${url}")`;
    show.classList.toggle('kenburns', !!opts.kenburns);
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
    const rises = type === 'spark';          // 光点上升；花瓣/雪花下落
    const n = type === 'petal' ? 16 : type === 'snow' ? 30 : 18;
    for (let i = 0; i < n; i++) {
      const e = document.createElement('div');
      e.className = type;
      e.style.left = Math.random() * 100 + '%';
      const dur = (type === 'petal' ? 9 : type === 'snow' ? 10 : 7) + Math.random() * 7;
      e.style.animationDuration = dur + 's';
      e.style.animationDelay = -Math.random() * dur + 's';
      if (type === 'petal') e.style.transform = `scale(${0.6 + Math.random() * 0.8})`;
      else if (type === 'snow') e.style.transform = `scale(${0.5 + Math.random() * 1.1})`;
      else { e.style.bottom = '0'; e.style.top = 'auto'; }
      this.particles.appendChild(e);
    }
  }

  // ---------------- 人物 ----------------
  _outfitOf(def, outfit) {
    const o = def.outfits || {};
    const key = outfit && o[outfit] ? outfit : (def.defaultOutfit || Object.keys(o)[0]);
    return o[key] ? { key, ...o[key] } : null;
  }

  showChar(id, pos = 'center', outfit = null) {
    const def = CHARACTERS[id];
    if (!def) return;
    let c = this.chars.get(id);
    const od = this._outfitOf(def, outfit);

    if (c && od && c.outfitKey !== od.key) { // 切换服装：移除重建
      c.el.remove(); this.chars.delete(id); c = null;
    }

    if (!c) {
      const el = document.createElement('div');
      el.className = 'char';
      const frames = od ? od.frames : 1;
      let imgs = '';
      for (let i = 0; i < frames; i++) {
        const src = od ? `${od.dir}/frame_${String(i).padStart(2, '0')}.webp` : def.sprite;
        imgs += `<img class="cf" src="${src}" alt="${def.name}" draggable="false">`;
      }
      el.innerHTML = `<div class="char-inner"><div class="blush"></div>${imgs}<div class="emote"></div></div>`;
      this.layer.appendChild(el);
      const frameEls = [...el.querySelectorAll('img.cf')];
      c = {
        id, el, inner: el.querySelector('.char-inner'),
        frameEls, playlist: pingpong(frameEls.length),
        fps: od ? (od.fps || 1.0) : 1.0,
        outfitKey: od ? od.key : null,
        blushEl: el.querySelector('.blush'), emoteEl: el.querySelector('.emote'),
        scale: def.scale || 1, offsetY: def.offsetY || 0,
        phase: Math.random() * 100,
        floatPhase: Math.random() * Math.PI * 2,
        floatRate: 0.5 + Math.random() * 0.25,
        breathPhase: Math.random() * Math.PI * 2,
        breathRate: 1.45 + Math.random() * 0.45, // 呼吸周期 ~3.5–4.5s，各角色略有差异
        leftCur: POS[pos] ?? 50, leftTgt: POS[pos] ?? 50,
        enter: 0, enterFrom: (pos.includes('right')) ? 1 : (pos.includes('left') ? -1 : (Math.random() < 0.5 ? -1 : 1)),
        speaking: false, blush: false, reaction: null, shown: true,
      };
      this.chars.set(id, c);
      this._renderFrames(c); // 仅显示首帧立绘
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

  // 仅显示首帧立绘——呼吸感完全由 _loop 的连续 transform（脚底锚定的轻微缩放+起伏）驱动。
  // 因此没有任何帧切换、没有 opacity 渐隐渐现，呼吸却是连续平滑的。
  _renderFrames(c) {
    c.frameEls.forEach((el, k) => { el.style.opacity = k === 0 ? '1' : '0'; });
  }

  // ---------------- 主循环 ----------------
  _loop() {
    const now = performance.now();
    let dt = (now - this.lastNow) / 1000;
    this.lastNow = now;
    if (dt > 0.1) dt = 0.1; // 防止后台标签回来时跳变
    const t = (now - this.t0) / 1000;
    const stageH = this.stageEl ? this.stageEl.clientHeight : 720;

    for (const c of this.chars.values()) {
      // —— 入场 / 位置 ——
      c.enter += (1 - c.enter) * Math.min(1, dt * 6);
      const enterMiss = 1 - c.enter;
      c.leftCur += (c.leftTgt - c.leftCur) * Math.min(1, dt * 7);
      c.el.style.left = c.leftCur + '%';

      // —— 连续呼吸：脚底锚定的轻微缩放 + 起伏，模拟胸腔呼吸；无帧切换、无渐隐渐现 ——
      const breath = Math.sin(t * c.breathRate + c.breathPhase); // 呼吸主曲线（~4s 周期）
      const drift = Math.sin(t * c.floatRate + c.floatPhase);    // 更慢的有机漂移，避免机械感
      const amp = c.speaking ? 1.35 : 1.0;                       // 说话者呼吸更明显些
      let dx = enterMiss * c.enterFrom * 70 + drift * 0.6;
      let dy = (c.offsetY / 100) * stageH + breath * 1.7 * amp + drift * 1.0;
      let rot = breath * 0.16 * amp + drift * 0.12;
      let scaleMul = 1 + (breath * 0.5 + 0.5) * 0.012 * amp;      // 吸气微微膨胀(≤~1.2%)、呼气回落

      if (c.speaking) dy += -1.5; // 说话时略上抬（强调）

      // —— 事件情绪反应（短暂）——
      if (c.reaction) {
        const rt = (now - c.reaction.start) / 1000;
        const dur = this._reactDur(c.reaction.type);
        const p = rt / dur;
        if (p >= 1) c.reaction = null;
        else {
          const env = Math.sin(Math.min(p, 1) * Math.PI);
          switch (c.reaction.type) {
            case 'bounce': dy -= Math.abs(Math.sin(p * Math.PI * 2)) * 22 * (1 - p); break;
            case 'shake':  dx += Math.sin(p * Math.PI * 16) * 11 * (1 - p); break;
            case 'nod':    rot += Math.sin(p * Math.PI * 4) * 3.4 * env; dy += env * 4; break;
            case 'tremble':dx += Math.sin(p * Math.PI * 26) * 3.6 * (1 - p); break;
            case 'pop':    scaleMul = 1 + env * 0.05; break;
          }
        }
      }

      // 整体淡入/淡出交由 CSS .show 过渡；此处只驱动位移/旋转/缩放
      c.inner.style.transform =
        `translateX(${dx.toFixed(2)}px) translateY(${dy.toFixed(2)}px) rotate(${rot.toFixed(3)}deg) scale(${(c.scale * scaleMul).toFixed(4)})`;
    }
    requestAnimationFrame(() => this._loop());
  }

  _reactDur(type) { return type === 'bounce' ? 0.85 : type === 'shake' ? 0.6 : type === 'nod' ? 0.7 : type === 'pop' ? 0.4 : 0.6; }
}

export const stage = new Stage();
