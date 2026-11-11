/**
 * 场景元数据与加载器。
 * 场景模块统一导出工厂函数，返回 { init(ctx,w,h), update(dt), resize(w,h), destroy() }。
 */

export const SCENE_META = [
  {
    id: 'sakura',
    name: '樱花漫舞',
    en: 'Sakura',
    desc: '风过枝头，花瓣缓缓落下',
    accent: '#f2a3b4',
    glow: 'rgba(242, 163, 180, 0.35)',
    bg: ['#140d13', '#2a1620', '#3d1f2b'],
    mood: '轻盈 · 适合上午',
  },
  {
    id: 'star',
    name: '星河长夜',
    en: 'Star River',
    desc: '星子低垂，偶尔划过一条光',
    accent: '#a9b8ff',
    glow: 'rgba(169, 184, 255, 0.32)',
    bg: ['#070a16', '#0d1428', '#141d3a'],
    mood: '辽阔 · 适合夜间',
  },
  {
    id: 'frost',
    name: '霜花初凝',
    en: 'Frost',
    desc: '冷冽的颗粒在窗上慢慢结晶',
    accent: '#9fe6f5',
    glow: 'rgba(159, 230, 245, 0.3)',
    bg: ['#07131a', '#0e2029', '#143037'],
    mood: '清冷 · 适合清晨',
  },
  {
    id: 'firefly',
    name: '萤火微光',
    en: 'Firefly',
    desc: '暗处的光点缓慢游移',
    accent: '#f7d98a',
    glow: 'rgba(247, 217, 138, 0.34)',
    bg: ['#0a0d09', '#141a11', '#1d2617'],
    mood: '安静 · 适合傍晚',
  },
  {
    id: 'deepsea',
    name: '深海静流',
    en: 'Deep Sea',
    desc: '水压很低，光从上方落下来',
    accent: '#7fd8e8',
    glow: 'rgba(127, 216, 232, 0.28)',
    bg: ['#040d14', '#07202c', '#0a2f3d'],
    mood: '沉静 · 适合长时间',
  },
  {
    id: 'autumn',
    name: '秋日慢行',
    en: 'Autumn',
    desc: '叶子旋转着离开枝头',
    accent: '#f0b06a',
    glow: 'rgba(240, 176, 106, 0.3)',
    bg: ['#140e08', '#241708', '#34220d'],
    mood: '舒缓 · 适合下午',
  },
];

export const SCENE_IDS = SCENE_META.map((s) => s.id);

export function getSceneMeta(id) {
  return SCENE_META.find((s) => s.id === id) || SCENE_META[0];
}

const loaders = {
  sakura: () => import('./sakura.js'),
  star: () => import('./star.js'),
  frost: () => import('./frost.js'),
  firefly: () => import('./firefly.js'),
  deepsea: () => import('./deepsea.js'),
  autumn: () => import('./autumn.js'),
};

export async function loadScene(id) {
  const loader = loaders[id] || loaders.sakura;
  const mod = await loader();
  return mod.createScene;
}
