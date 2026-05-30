// =========================================================
// 启动入口 —— 加载界面 + 资源预载 + 进入标题
// =========================================================
import { game } from './game.js';
import { audio } from './engine/audio.js';
import { BACKGROUNDS, LOADING_TIPS } from './data/config.js';
import { CHARACTERS } from './data/characters.js';

function charFrameUrls() {
  const urls = [];
  for (const c of Object.values(CHARACTERS)) {
    if (c.outfits) {
      for (const o of Object.values(c.outfits)) {
        for (let i = 0; i < o.frames; i++) urls.push(`${o.dir}/frame_${String(i).padStart(2, '0')}.webp`);
      }
    }
    if (c.sprite) urls.push(c.sprite);
  }
  return [...new Set(urls)];
}

const preloadList = [
  ...Object.values(BACKGROUNDS),
  ...charFrameUrls(),
];

function preload(onProgress) {
  return new Promise(resolve => {
    let done = 0; const total = preloadList.length;
    if (!total) return resolve();
    preloadList.forEach(src => {
      const img = new Image();
      const fin = () => { done++; onProgress(done / total); if (done >= total) resolve(); };
      img.onload = fin; img.onerror = fin; img.src = src;
    });
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('game-root');
  const fill = document.getElementById('loaderFill');
  const tip = document.getElementById('loaderTip');
  const loader = document.getElementById('loader');

  let ti = 0;
  tip.textContent = LOADING_TIPS[0];
  const tipTimer = setInterval(() => { ti = (ti + 1) % LOADING_TIPS.length; tip.textContent = LOADING_TIPS[ti]; }, 1500);

  game.init();
  window.game = game; // 便于调试/测试

  await preload(p => { fill.style.width = Math.round(p * 100) + '%'; });
  fill.style.width = '100%';
  await new Promise(r => setTimeout(r, 500));

  clearInterval(tipTimer);
  loader.classList.add('fade-out');
  root.classList.remove('loading');
  setTimeout(() => loader.classList.add('hidden'), 800);

  game.toTitle();

  // 首次用户交互时唤醒音频上下文
  const wake = () => { audio.resume(); audio.playBgm('title'); window.removeEventListener('pointerdown', wake); window.removeEventListener('keydown', wake); };
  window.addEventListener('pointerdown', wake);
  window.addEventListener('keydown', wake);
});
