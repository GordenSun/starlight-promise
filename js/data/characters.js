// =========================================================
// 角色设定 —— 5 位女主 + 男主角
// 主题色 color/color2 用于对话框、好感度条与界面强调色
// scale / offsetY 用于在舞台上微调立绘大小与垂直位置
// =========================================================

export const PROTAGONIST = {
  id: 'me',
  defaultName: '林深',
  color: '#7fb6ff',
};

export const CHARACTERS = {
  // —— 1. 魅惑御姐 ——
  lingye: {
    id: 'lingye',
    name: '凌夜',
    archetype: '魅惑御姐',
    color: '#b48cff',
    color2: '#ffd56b',
    sprite: 'assets/characters/char_lingye.webp',
    scale: 1.0, offsetY: 0,
    age: 27,
    title: '夜色与星辰的主宰',
    likes: '醇酒、博弈、率直的人',
    intro: '云顶酒廊的神秘主人。优雅、危险、令人沉沦，仿佛把整座城市的夜色都揽在身上。',
    quote: '心动这种东西……要赌就赌大的，小朋友。',
  },

  // —— 2. 清纯大学生 ——
  suqing: {
    id: 'suqing',
    name: '苏晴',
    archetype: '清纯学妹',
    color: '#ff9ec7',
    color2: '#ffe1b0',
    sprite: 'assets/characters/char_suqing.webp',
    scale: 0.97, offsetY: 0,
    age: 20,
    title: '午后阳光里的书签',
    likes: '小说、热可可、晴天',
    intro: '微光书屋的兼职店员，文学系大二的女孩。笑起来像晒过太阳的棉被，温暖又干净。',
    quote: '那个……如果你也喜欢这本书，要不要……一起读完它？',
  },

  // —— 3. 元气少女 ——
  xiakui: {
    id: 'xiakui',
    name: '夏葵',
    archetype: '元气少女',
    color: '#ff9a3c',
    color2: '#ffe14d',
    sprite: 'assets/characters/char_xiakui.webp',
    scale: 1.03, offsetY: 2,
    age: 19,
    title: '永不熄火的小太阳',
    likes: '篮球、布丁、一切好玩的事',
    intro: '天台球场的常客，体育生兼校园主播。嗓门大、跑得快、笑得比阳光还灿烂。',
    quote: '喂喂别发呆啦！接住——这球进了，你就请我吃布丁！',
  },

  // —— 4. 高冷傲娇 ——
  bairuoxue: {
    id: 'bairuoxue',
    name: '白若雪',
    archetype: '高冷傲娇',
    color: '#7fd4ff',
    color2: '#e7f3ff',
    sprite: 'assets/characters/char_bairuoxue.webp',
    scale: 1.0, offsetY: 0,
    age: 22,
    title: '触手生寒的钢琴公主',
    likes: '古典乐、独处、（嘴上说不喜欢的）甜食',
    intro: '白鸢琴室的天才钢琴家，名门千金。一身寒霜拒人千里，可指尖流出的旋律却那样孤独。',
    quote: '别误会，我只是……碰巧多冲了一杯咖啡而已。哼。',
  },

  // —— 5. 温柔知性学姐 ——
  shenzhixia: {
    id: 'shenzhixia',
    name: '沈知夏',
    archetype: '知性学姐',
    color: '#86d6a6',
    color2: '#f0e4c0',
    sprite: 'assets/characters/char_shenzhixia.webp',
    scale: 0.99, offsetY: 0,
    age: 24,
    title: '书页间的温柔时光',
    likes: '旧书、红茶、雨声',
    intro: '星海图书馆的研究员，温柔得像午后的一缕风。她总能读懂你没说出口的那句话。',
    quote: '别急，时间还很长。在我这里，你可以慢慢来。',
  },
};

// 关系阶段（按好感度分段）
export const AFFECTION_STAGES = [
  { min: 0,  key: 'stranger', label: '初次相识' },
  { min: 20, key: 'aware',    label: '心生在意' },
  { min: 40, key: 'crush',    label: '怦然心动' },
  { min: 60, key: 'amour',    label: '恋人未满' },
  { min: 85, key: 'lover',    label: '两情相悦' },
];

export const CONFESS_THRESHOLD = 50; // 可表白所需好感度
export const MAX_AFFECTION = 100;

export function stageOf(value) {
  let s = AFFECTION_STAGES[0];
  for (const st of AFFECTION_STAGES) if (value >= st.min) s = st;
  return s;
}

export const HEROINE_IDS = ['suqing', 'xiakui', 'bairuoxue', 'shenzhixia', 'lingye'];
