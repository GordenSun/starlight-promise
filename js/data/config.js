// =========================================================
// 游戏全局配置
// =========================================================

export const GAME = {
  title: '群星之约',
  titleEn: 'Starlight Promise',
  version: '1.0.0',
  totalDays: 12,            // 日常阶段总天数
  saveSlots: 6,
  storageKey: 'starlight_promise_v1',
};

// 可前往的约会地点 —— 每个地点对应一位女主
export const LOCATIONS = [
  { id: 'cafe',      name: '微光咖啡书屋', bg: 'cafe',      heroine: 'suqing',     desc: '书香与咖啡交织的午后角落' },
  { id: 'court',     name: '天台篮球场',   bg: 'court',     heroine: 'xiakui',     desc: '汗水、阳光与笑声的舞台' },
  { id: 'musichall', name: '白鸢琴室',     bg: 'musichall', heroine: 'bairuoxue',  desc: '清冷琴音回荡的水晶大厅' },
  { id: 'library',   name: '星海图书馆',   bg: 'library',   heroine: 'shenzhixia', desc: '时间在书页间静静停驻' },
  { id: 'penthouse', name: '云顶酒廊',     bg: 'penthouse', heroine: 'lingye',     desc: '只在夜色里苏醒的秘密' },
];

// 背景资源表
export const BACKGROUNDS = {
  title:      'assets/backgrounds/bg_title.jpg',
  cafe:       'assets/backgrounds/bg_cafe.jpg',
  campus:     'assets/backgrounds/bg_campus.jpg',
  city_night: 'assets/backgrounds/bg_city_night.jpg',
  penthouse:  'assets/backgrounds/bg_penthouse.jpg',
  park:       'assets/backgrounds/bg_park.jpg',
  court:      'assets/backgrounds/bg_court.jpg',
  library:    'assets/backgrounds/bg_library.jpg',
  apartment:  'assets/backgrounds/bg_apartment.jpg',
  musichall:  'assets/backgrounds/bg_musichall.jpg',
};

export const DEFAULT_SETTINGS = {
  textSpeed: 2,     // 0 慢 / 1 中 / 2 快 / 3 瞬间
  autoSpeed: 1,     // 0 慢 / 1 中 / 2 快
  bgmVolume: 0.5,
  sfxVolume: 0.7,
  fullscreen: false,
};

export const TEXT_SPEED_MS = [55, 32, 16, 0];
export const AUTO_DELAY_MS = [2600, 1700, 1000];

export const LOADING_TIPS = [
  '正在点亮星空…',
  '正在为她们整理裙摆…',
  '正在冲泡一杯热可可…',
  '正在调试这台命运的左轮…',
  '正在把流星折成许愿的形状…',
  '提示：不同的回答，会让她的心意悄悄改变。',
  '提示：在「设置」里可以调节文字速度与音量。',
  '提示：通关后可在「回忆画廊」回看珍藏的瞬间。',
];

// 画廊分区
export const GALLERY = {
  characters: 'characters',
  scenes: 'scenes',
  cg: 'cg',
};
