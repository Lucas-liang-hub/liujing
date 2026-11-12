/**
 * 成长值体系（产品设计文档 P1 激励系统）。
 * 口径：专注 1 分钟 +1 分，每个有记录的打卡日 +20 分；等级以流水的意象命名。
 */

export const GROWTH_LEVELS = [
  { min: 0, name: '涓滴' },
  { min: 300, name: '溪流' },
  { min: 1200, name: '江河' },
  { min: 3000, name: '湖泊' },
  { min: 8000, name: '沧海' },
];

/** @returns {{points:number, level:string, nextName:string|null, nextAt:number|null}} */
export function computeGrowth({ totalSec = 0, activeDays = 0 } = {}) {
  const sec = Math.max(0, Math.floor(Number(totalSec) || 0));
  const days = Math.max(0, Math.floor(Number(activeDays) || 0));
  const points = Math.floor(sec / 60) + days * 20;

  let idx = 0;
  for (let i = 0; i < GROWTH_LEVELS.length; i += 1) {
    if (points >= GROWTH_LEVELS[i].min) idx = i;
  }
  const next = GROWTH_LEVELS[idx + 1] || null;
  return { points, level: GROWTH_LEVELS[idx].name, nextName: next?.name || null, nextAt: next?.min ?? null };
}
