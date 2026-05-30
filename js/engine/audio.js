// =========================================================
// 程序化音频引擎 —— 用 Web Audio API 实时生成背景音乐与音效
// 不依赖任何外部音频文件，纯算法合成（五声音阶 + 柔和音色 + 混响）
// =========================================================

const A4 = 440;
const noteToFreq = (midi) => A4 * Math.pow(2, (midi - 69) / 12);

// 各音乐主题：根音(midi)、音阶(相对半音)、和弦进行(根音偏移)、速度、音色
const THEMES = {
  title:    { root: 57, scale: [0,2,4,7,9],  prog: [0,5,-3,2],  bpm: 60, pad: 'sine',     lead: 'triangle', bass: -12, warmth: 0.55, density: 0.5 },
  day:      { root: 60, scale: [0,2,4,7,9],  prog: [0,7,5,9],   bpm: 84, pad: 'triangle', lead: 'triangle', bass: -12, warmth: 0.4,  density: 0.7 },
  romance:  { root: 58, scale: [0,2,4,7,9],  prog: [0,5,9,7],   bpm: 68, pad: 'sine',     lead: 'sine',     bass: -12, warmth: 0.6,  density: 0.55 },
  lingye:   { root: 56, scale: [0,3,5,7,10], prog: [0,-2,3,5],  bpm: 72, pad: 'sawtooth', lead: 'triangle', bass: -12, warmth: 0.5,  density: 0.6 },
  bairuoxue:{ root: 59, scale: [0,2,3,7,9],  prog: [0,5,-3,-1], bpm: 64, pad: 'sine',     lead: 'sine',     bass: -12, warmth: 0.45, density: 0.5 },
  sad:      { root: 55, scale: [0,2,3,7,10], prog: [0,-2,-4,-5],bpm: 58, pad: 'sine',     lead: 'sine',     bass: -12, warmth: 0.5,  density: 0.4 },
  hope:     { root: 60, scale: [0,2,4,7,9],  prog: [0,9,5,7],   bpm: 76, pad: 'triangle', lead: 'triangle', bass: -12, warmth: 0.5,  density: 0.65 },
};

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.bgmVol = 0.5;
    this.sfxVol = 0.7;
    this.theme = null;
    this.themeName = null;
    this.timer = null;
    this.nextStep = 0;
    this.step = 0;
    this.chordIndex = 0;
  }

  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);

    // 混响
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this._makeImpulse(2.0, 2.4);
    this.revGain = this.ctx.createGain();
    this.revGain.gain.value = 0.32;
    this.reverb.connect(this.revGain).connect(this.master);

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = this.bgmVol;
    this.bgmGain.connect(this.master);
    this.bgmGain.connect(this.reverb);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVol;
    this.sfxGain.connect(this.master);
    this.sfxGain.connect(this.reverb);

    this.ready = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    if (this.ready && this.themeName && !this.timer) {
      this.nextStep = this.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this._scheduler(), 60);
    }
  }

  _makeImpulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = rate * seconds;
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  setBgmVolume(v) { this.bgmVol = v; if (this.bgmGain) this._ramp(this.bgmGain.gain, v); }
  setSfxVolume(v) { this.sfxVol = v; if (this.sfxGain) this.sfxGain.gain.value = v; }
  _ramp(param, v, t = 0.3) { const now = this.ctx.currentTime; param.cancelScheduledValues(now); param.setTargetAtTime(v, now, t); }

  playBgm(name) {
    this.init(); this.resume();
    if (!this.ready) return;
    if (this.themeName === name) return;
    this.themeName = name;
    this.theme = THEMES[name] || THEMES.day;
    this.step = 0; this.chordIndex = 0;
    if (this.bgmGain) this._ramp(this.bgmGain.gain, this.bgmVol);
    if (!this.timer) {
      this.nextStep = this.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this._scheduler(), 60);
    }
  }

  stopBgm() {
    if (this.bgmGain) this._ramp(this.bgmGain.gain, 0, 0.6);
    this.themeName = null;
    setTimeout(() => { if (!this.themeName && this.timer) { clearInterval(this.timer); this.timer = null; } }, 800);
  }

  _scheduler() {
    if (!this.theme) return;
    if (this.ctx.state !== 'running') return;        // 未唤醒时不调度
    if (this.nextStep < this.ctx.currentTime - 0.5) this.nextStep = this.ctx.currentTime + 0.1; // 防止恢复后爆发
    const t = this.theme;
    const spb = 60 / t.bpm;          // 每拍秒数
    const stepDur = spb / 2;         // 八分音符为一步
    while (this.nextStep < this.ctx.currentTime + 0.5) {
      this._scheduleStep(this.nextStep);
      this.nextStep += stepDur;
      this.step++;
      if (this.step % 16 === 0) this.chordIndex = (this.chordIndex + 1) % t.prog.length;
    }
  }

  _scheduleStep(time) {
    const t = this.theme;
    const chordRoot = t.root + t.prog[this.chordIndex];
    const bar = Math.floor(this.step / 16);
    const inBar = this.step % 16;

    // 和弦铺底（每两小节换一次）—— 在每小节首拍触发
    if (inBar === 0) {
      const triad = [0, t.scale[2], t.scale[4]];
      triad.forEach((iv, i) => this._pad(noteToFreq(chordRoot + iv), time, 16 * (60 / t.bpm / 2), 0.06 - i * 0.01));
      // 低音
      this._bass(noteToFreq(chordRoot + t.bass), time, 2 * (60 / t.bpm), 0.12);
    }

    // 旋律/琶音：按密度概率从音阶中选音
    if (Math.random() < t.density && inBar % 2 === 0) {
      const oct = (Math.random() < 0.4 ? 12 : 0) + (Math.random() < 0.15 ? 12 : 0);
      const deg = t.scale[Math.floor(Math.random() * t.scale.length)];
      this._lead(noteToFreq(chordRoot + 12 + deg + oct), time, stepDurOf(t) * (Math.random() < 0.3 ? 2 : 1), 0.07);
    }
  }

  _voice(type, freq, time, dur, peak, target, attack = 0.02, release = null) {
    if (!this.ready) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    const rel = release ?? dur * 0.6;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(peak, time + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur + rel);
    o.connect(g).connect(target);
    o.start(time); o.stop(time + dur + rel + 0.05);
  }

  _pad(freq, time, dur, peak) {
    // 双振荡轻微失谐，更柔和
    this._voice(this.theme.pad, freq, time, dur, peak, this.bgmGain, 0.6, dur * 0.5);
    this._voice(this.theme.pad, freq * 1.005, time, dur, peak * 0.7, this.bgmGain, 0.7, dur * 0.5);
  }
  _lead(freq, time, dur, peak) {
    const g = this.ctx.createGain();
    g.connect(this.bgmGain);
    this._voice(this.theme.lead, freq, time, dur, peak, g, 0.01, dur * 0.8);
  }
  _bass(freq, time, dur, peak) {
    this._voice('sine', freq, time, dur, peak, this.bgmGain, 0.04, dur * 0.4);
  }

  // ============ 音效 ============
  sfx(name) {
    this.init(); this.resume();
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    switch (name) {
      case 'hover':   this._blip(880, now, 0.05, 0.05, 'sine'); break;
      case 'click':   this._blip(523, now, 0.07, 0.12, 'triangle'); this._blip(784, now + 0.02, 0.07, 0.08, 'sine'); break;
      case 'confirm': this._arp([523, 659, 784, 1047], now, 0.09, 0.12); break;
      case 'cancel':  this._blip(330, now, 0.12, 0.12, 'sine'); this._blip(247, now + 0.05, 0.14, 0.1, 'sine'); break;
      case 'select':  this._blip(659, now, 0.06, 0.1, 'triangle'); break;
      case 'type':    this._blip(2000 + Math.random() * 400, now, 0.012, 0.02, 'square'); break;
      case 'heart':   this._arp([659, 880, 1047, 1319], now, 0.1, 0.14); break;
      case 'unlock':  this._arp([784, 1047, 1319, 1568, 2093], now, 0.08, 0.13); break;
      case 'transition': this._sweep(now); break;
      case 'meteor':  this._sweepDown(now); break;
    }
  }

  _blip(freq, time, dur, peak, type = 'sine') {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(peak * this.sfxVol, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g).connect(this.master);
    o.start(time); o.stop(time + dur + 0.02);
  }
  _arp(freqs, time, gap, peak) { freqs.forEach((f, i) => this._blip(f, time + i * gap, 0.18, peak, 'triangle')); }
  _sweep(time) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(400, time); o.frequency.exponentialRampToValueAtTime(1600, time + 0.4);
    g.gain.setValueAtTime(0.0001, time); g.gain.linearRampToValueAtTime(0.12 * this.sfxVol, time + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, time + 0.5);
    o.connect(g).connect(this.master); o.start(time); o.stop(time + 0.55);
  }
  _sweepDown(time) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(1800, time); o.frequency.exponentialRampToValueAtTime(300, time + 0.6);
    g.gain.setValueAtTime(0.0001, time); g.gain.linearRampToValueAtTime(0.1 * this.sfxVol, time + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, time + 0.7);
    o.connect(g).connect(this.master); o.start(time); o.stop(time + 0.75);
  }
}

function stepDurOf(t) { return (60 / t.bpm) / 2; }

export const audio = new AudioEngine();
