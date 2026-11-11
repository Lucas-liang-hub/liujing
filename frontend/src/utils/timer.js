/**
 * 计时核心：全部基于时间戳差值计算，不做 setInterval 累加。
 * 原因见技术方案 3.2：后台标签页会被浏览器节流，累加式计时必然漂移。
 */

/**
 * 已累计毫秒数
 * @param {{accumulatedMs?: number, runningSince?: number|null, now?: number}} state
 */
export function computeElapsedMs({ accumulatedMs = 0, runningSince = null, now = Date.now() } = {}) {
  const paused = Math.max(0, Number(accumulatedMs) || 0);
  if (!runningSince) return paused;
  return paused + Math.max(0, now - runningSince);
}

/**
 * 剩余秒数（向上取整，保证 25:00 起步而不是 24:59）
 * @param {number} planSec 本轮计划秒数
 * @param {number} elapsedMs 已用毫秒
 */
export function remainingSec(planSec, elapsedMs) {
  const total = Math.max(0, Number(planSec) || 0) * 1000;
  return Math.max(0, Math.ceil((total - Math.max(0, elapsedMs)) / 1000));
}

/** 进度 0~1 */
export function progressOf(planSec, elapsedMs) {
  const total = Math.max(0, Number(planSec) || 0) * 1000;
  if (!total) return 0;
  return Math.min(1, Math.max(0, Math.max(0, elapsedMs) / total));
}

/** 是否已完成本轮 */
export function isFinished(planSec, elapsedMs) {
  return remainingSec(planSec, elapsedMs) <= 0;
}

/** 毫秒 → 秒（取整，入库用） */
export function toSec(elapsedMs) {
  return Math.floor(Math.max(0, Number(elapsedMs) || 0) / 1000);
}

/** 秒 → 12 小时制时段问候，用于顶栏 */
export function timeOfDay(hour) {
  if (hour < 6) return '夜深';
  if (hour < 9) return '清晨';
  if (hour < 12) return '上午';
  if (hour < 14) return '午后';
  if (hour < 18) return '下午';
  if (hour < 23) return '夜晚';
  return '深夜';
}
