/**
 * 成就徽章：由统计结果在前端推导（决策见 PROJECT.md，不新增数据库表）。
 * 每个徽章给出 unlocked 与 progress，未解锁的也能看到"还差多少"。
 */

const ratio = (value, target) => (target <= 0 ? 1 : Math.min(1, Math.max(0, value / target)));

export const BADGES = [
  {
    id: 'first',
    glyph: '初',
    name: '初次入座',
    desc: '完成第一次自习',
    progress: (s) => ratio(s.totalSessions || 0, 1),
    unlocked: (s) => (s.totalSessions || 0) >= 1,
  },
  {
    id: 'streak3',
    glyph: '三',
    name: '三日不断',
    desc: '连续打卡 3 天',
    progress: (s) => ratio(s.streak || 0, 3),
    unlocked: (s) => (s.streak || 0) >= 3,
  },
  {
    id: 'streak7',
    glyph: '七',
    name: '七日成习',
    desc: '连续打卡 7 天',
    progress: (s) => ratio(s.streak || 0, 7),
    unlocked: (s) => (s.streak || 0) >= 7,
  },
  {
    id: 'streak30',
    glyph: '恒',
    name: '三十日不辍',
    desc: '连续打卡 30 天',
    progress: (s) => ratio(s.streak || 0, 30),
    unlocked: (s) => (s.streak || 0) >= 30,
  },
  {
    id: 'hours10',
    glyph: '时',
    name: '十时之约',
    desc: '累计专注 10 小时',
    progress: (s) => ratio(s.totalSec || 0, 10 * 3600),
    unlocked: (s) => (s.totalSec || 0) >= 10 * 3600,
  },
  {
    id: 'hours50',
    glyph: '积',
    name: '五十时功',
    desc: '累计专注 50 小时',
    progress: (s) => ratio(s.totalSec || 0, 50 * 3600),
    unlocked: (s) => (s.totalSec || 0) >= 50 * 3600,
  },
  {
    id: 'hours100',
    glyph: '厚',
    name: '百小时',
    desc: '累计专注 100 小时',
    progress: (s) => ratio(s.totalSec || 0, 100 * 3600),
    unlocked: (s) => (s.totalSec || 0) >= 100 * 3600,
  },
  {
    id: 'tasksClear',
    glyph: '清',
    name: '清单清空',
    desc: '某一天把任务全部划掉',
    progress: (s, h, live) => (anyDayCleared(s, live) ? 1 : 0),
    unlocked: (s, h, live) => anyDayCleared(s, live),
  },
  {
    id: 'earlyBird',
    glyph: '晨',
    name: '晨光',
    desc: '在清晨 5-8 点自习过',
    progress: () => 0,
    unlocked: (s, heatmap) => hasHourRange(heatmap, 5, 8),
  },
  {
    id: 'nightOwl',
    glyph: '夜',
    name: '夜航',
    desc: '在深夜 22 点后自习过',
    progress: () => 0,
    unlocked: (s, heatmap) => hasHourRange(heatmap, 22, 23) || hasHourRange(heatmap, 0, 1),
  },
];

function hasHourRange(heatmap, from, to) {
  if (!Array.isArray(heatmap)) return false;
  return heatmap.some((c) => c.hour >= from && c.hour <= to && (c.sec || 0) > 0);
}

/**
 * 是否有任意一天把任务清单全部完成。
 * 判定优先级：
 * 1. 服务器 cleared 标志（当天任一快照达成 done>=total>0，口径最准）
 * 2. 今日实时清单（最后一项刚勾上、还没入库时也能立即解锁）
 * 3. 兜底：今日聚合 tasksDone>=todayTotal（兼容旧数据）
 * @param {object} summary 统计接口返回体
 * @param {{total:number, done:number}} [live] 今日实时清单状态（来自 session store）
 */
function anyDayCleared(summary, live) {
  const daily = Array.isArray(summary.daily) ? summary.daily : [];
  if (daily.some((d) => d.cleared === 1 || d.cleared === true)) return true;
  // 兜底：无 cleared 字段的旧数据沿用求和口径（done>=total 只可能发生在全部快照清空时）
  if (daily.some((d) => d.cleared === undefined && (d.tasksTotal || 0) > 0 && (d.tasksDone || 0) >= (d.tasksTotal || 0))) return true;
  if (live && live.total > 0 && live.done >= live.total) return true;
  const today = summary.tasks || {};
  if (today.cleared === 1 || today.cleared === true) return true;
  return (today.todayTotal || 0) > 0 && (today.todayDone || 0) >= (today.todayTotal || 0);
}

/**
 * @param {object} summary /api/stats/summary 返回体
 * @param {Array<{weekday:number,hour:number,sec:number}>} heatmapCells
 * @param {{total:number, done:number}} [liveTasks] 今日实时清单（可选，勾完最后一项无需入库即可解锁）
 */
export function evaluateBadges(summary = {}, heatmapCells = [], liveTasks = null) {
  return BADGES.map((badge) => {
    const unlocked = Boolean(badge.unlocked(summary, heatmapCells, liveTasks));
    const progress = unlocked ? 1 : Number(badge.progress(summary, heatmapCells, liveTasks).toFixed(2));
    return {
      id: badge.id,
      glyph: badge.glyph,
      name: badge.name,
      desc: badge.desc,
      unlocked,
      progress,
    };
  });
}

export function countUnlocked(badges = []) {
  return badges.filter((b) => b.unlocked).length;
}
