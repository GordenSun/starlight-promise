// =========================================================
// 约会中枢 —— 地点选择网格 + 结局抉择界面
// =========================================================
import { BACKGROUNDS, GAME } from '../data/config.js';
import { CHARACTERS, CONFESS_THRESHOLD, stageOf, MAX_AFFECTION } from '../data/characters.js';
import { audio } from './audio.js';
import * as ui from './ui.js';

class Hub {
  init(game) { this.game = game; this.layer = document.getElementById('hubLayer'); }

  render(state, plan) {
    const remaining = GAME.totalDays - state.day + 1;
    const cards = plan.map((p, i) => {
      const bg = BACKGROUNDS[p.loc.bg];
      const affPct = Math.round((p.aff / MAX_AFFECTION) * 100);
      const stg = stageOf(p.aff).label;
      let badgeCls = 'lc-badge', badgeTxt = p.label;
      if (p.badgeType === 'heart') badgeCls += '', badgeTxt = '❤ 可表白';
      else if (p.badgeType === 'soft') badgeCls += ' done';
      return `
        <div class="loc-card" data-i="${i}">
          <div class="lc-bg" style="background-image:url('${bg}')"></div>
          <div class="lc-grad"></div>
          <div class="${badgeCls}">${badgeTxt}</div>
          <div class="lc-body">
            <div class="lc-name">${p.loc.name}</div>
            <div class="lc-who"><span class="lc-dot" style="color:${p.def.color}"></span>${p.def.name} · ${p.def.archetype}　<span style="color:${p.def.color}">${stg} ${affPct}%</span></div>
            <div class="lc-desc">${p.loc.desc}</div>
          </div>
        </div>`;
    }).join('');

    this.layer.innerHTML = `
      <div class="hub-head">
        <div>
          <div class="hub-title">今天，想去见谁？</div>
          <div class="hub-sub">星海市的霓虹亮起，挑一处地方，让心动多走一步。</div>
        </div>
        <div class="hub-day">
          <div class="big">第 ${Math.min(state.day, GAME.totalDays)} 天</div>
          <div class="small">距结局还有 ${Math.max(0, remaining)} 天</div>
        </div>
      </div>
      <div class="hub-grid">${cards}</div>
      <div class="hub-foot">
        <button class="hub-btn" id="hubAff">♥ 心动一览</button>
        <button class="hub-btn" id="hubSave">⌘ 保存进度</button>
        <button class="hub-btn primary" id="hubFinale">✦ 迎来结局之夜</button>
      </div>`;
    this.layer.classList.remove('hidden');

    this.layer.querySelectorAll('.loc-card').forEach(card => {
      card.addEventListener('mouseenter', () => audio.sfx('hover'));
      card.addEventListener('click', () => this.game.selectLocation(+card.dataset.i));
    });
    this.layer.querySelector('#hubAff').onclick = () => { audio.sfx('click'); ui.openAffection(state); };
    this.layer.querySelector('#hubSave').onclick = () => { audio.sfx('click'); ui.openSaveLoad('save', this.game); };
    this.layer.querySelector('#hubFinale').onclick = () => { audio.sfx('confirm'); this._confirmFinale(state); };
  }

  _confirmFinale(state) {
    const eligible = Object.keys(state.affection).filter(id => state.affection[id] >= CONFESS_THRESHOLD && state.eventsDone[id] >= 1);
    const msg = eligible.length
      ? '夜色渐深，是时候把心意说出口了。确定要迎来结局之夜吗？'
      : '现在还没有人对你足够心动……确定要结束这段日常吗？（将走向独自一人的结局）';
    ui.confirm('结局之夜', msg, () => this.game.showFinale());
  }

  // ---------------- 结局抉择 ----------------
  renderFinale(state, met, onPick) {
    audio.playBgm('romance');
    this.game.showScreen('game');
    document.getElementById('topbar').classList.remove('show');
    const items = met.map(m => {
      const can = m.aff >= CONFESS_THRESHOLD;
      const pct = Math.round((m.aff / MAX_AFFECTION) * 100);
      return `
        <div class="loc-card ${can ? '' : ''}" data-id="${m.id}" style="${can ? '' : 'opacity:.6;'}">
          <div class="lc-bg" style="background-image:url('${m.def.sprite}');background-position:top center;background-size:cover;filter:brightness(.8)"></div>
          <div class="lc-grad"></div>
          <div class="lc-badge ${can ? '' : 'lock'}">${can ? '❤ 可告白' : '心意尚浅'}</div>
          <div class="lc-body">
            <div class="lc-name">${m.def.name}</div>
            <div class="lc-who"><span class="lc-dot" style="color:${m.def.color}"></span>${m.def.archetype} · 好感 ${pct}%</div>
          </div>
        </div>`;
    }).join('');

    this.layer.innerHTML = `
      <div class="hub-head"><div>
        <div class="hub-title">命运的十字路口</div>
        <div class="hub-sub">流星即将再次划过夜空。这一次，你想牵起谁的手？</div>
      </div></div>
      <div class="hub-grid">${items || '<p style="color:var(--ink-dim);padding:20px">你还没有与任何人产生交集……</p>'}</div>
      <div class="hub-foot">
        <button class="hub-btn" id="finNone">（谁也不选，独自仰望星空）</button>
      </div>`;
    this.layer.classList.remove('hidden');

    this.layer.querySelectorAll('.loc-card').forEach(card => {
      const id = card.dataset.id;
      const m = met.find(x => x.id === id);
      card.addEventListener('mouseenter', () => audio.sfx('hover'));
      card.addEventListener('click', () => {
        if (m.aff >= CONFESS_THRESHOLD) { this.layer.classList.add('hidden'); onPick(id); }
        else this.game.toast(`${m.def.name} 对你的心意还不够深……`, '');
      });
    });
    this.layer.querySelector('#finNone').onclick = () => { audio.sfx('cancel'); this.layer.classList.add('hidden'); onPick(null); };
  }
}

export const hub = new Hub();
