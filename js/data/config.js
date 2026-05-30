// =========================================================
// 游戏全局配置
// =========================================================

export const GAME = {
  title: '群星之约',
  titleEn: 'Starlight Promise',
  version: '2.0.0',
  totalDays: 16,            // 日常阶段总天数
  datesPerHeroine: 5,       // 每位女主可触发的剧情约会次数（之后转为日常 + 可表白）
  saveSlots: 6,
  storageKey: 'starlight_promise_v1',
};

// 可前往的约会地点 —— 每个地点对应一位女主（约会内部会切换到更多场景）
export const LOCATIONS = [
  { id: 'cafe',      name: '微光咖啡书屋', bg: 'cafe',      heroine: 'suqing',     desc: '书香与咖啡交织的午后角落' },
  { id: 'court',     name: '天台篮球场',   bg: 'court',     heroine: 'xiakui',     desc: '汗水、阳光与笑声的舞台' },
  { id: 'musichall', name: '白鸢琴室',     bg: 'musichall', heroine: 'bairuoxue',  desc: '清冷琴音回荡的水晶大厅' },
  { id: 'library',   name: '星海图书馆',   bg: 'library',   heroine: 'shenzhixia', desc: '时间在书页间静静停驻' },
  { id: 'penthouse', name: '云顶酒廊',     bg: 'penthouse', heroine: 'lingye',     desc: '只在夜色里苏醒的秘密' },
];

// 背景资源表
export const BACKGROUNDS = {
  title:       'assets/backgrounds/bg_title.jpg',
  cafe:        'assets/backgrounds/bg_cafe.jpg',
  campus:      'assets/backgrounds/bg_campus.jpg',
  city_night:  'assets/backgrounds/bg_city_night.jpg',
  penthouse:   'assets/backgrounds/bg_penthouse.jpg',
  park:        'assets/backgrounds/bg_park.jpg',
  court:       'assets/backgrounds/bg_court.jpg',
  library:     'assets/backgrounds/bg_library.jpg',
  apartment:   'assets/backgrounds/bg_apartment.jpg',
  musichall:   'assets/backgrounds/bg_musichall.jpg',
  // —— 新增：约会外景，为剧情提供更丰富的舞台 ——
  festival:    'assets/backgrounds/bg_festival.jpg',    // 夏日祭夜市
  seaside:     'assets/backgrounds/bg_seaside.jpg',     // 黄昏海边
  ferris:      'assets/backgrounds/bg_ferris.jpg',      // 夜晚摩天轮游乐园
  aquarium:    'assets/backgrounds/bg_aquarium.jpg',    // 水族馆蓝色长廊
  fireworks:   'assets/backgrounds/bg_fireworks.jpg',   // 河畔烟花夜
  snow:        'assets/backgrounds/bg_snow.jpg',        // 雪夜街道
  planetarium: 'assets/backgrounds/bg_planetarium.jpg', // 星空观测台
};

// 场景中文名（画廊用）
export const SCENE_NAMES = {
  title: '群星之夜', cafe: '微光咖啡书屋', campus: '樱花校园', city_night: '霓虹夜街',
  penthouse: '云顶酒廊', park: '黄昏河滨', court: '天台篮球场', library: '星海图书馆',
  apartment: '我的小屋', musichall: '白鸢琴室', festival: '夏日祭夜市', seaside: '黄昏海岸',
  ferris: '摩天轮之夜', aquarium: '深蓝水族馆', fireworks: '河畔烟花', snow: '初雪街道',
  planetarium: '星空观测台',
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
