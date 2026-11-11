/**
 * 时间工具：全系统统一使用「服务器本地时间字符串」('YYYY-MM-DD HH:mm:ss') 入库，
 * 避免 UTC 与本地时区错位导致凌晨自习被算到前一天。
 */

const pad = (n) => String(n).padStart(2, '0');

/** 任意时间值 → 'YYYY-MM-DD HH:mm:ss'（本地时区） */
export function toLocalDateTime(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** 任意时间值 → 'YYYY-MM-DD'（本地时区） */
export function toDateKey(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 安全解析时间，无法解析返回 null */
export function parseTime(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  // 兼容 'YYYY-MM-DD HH:mm:ss'（Safari 不认空格分隔，替换为 T）
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 日期加减（天） */
export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** 本周一 00:00（本地时区） */
export function startOfWeek(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=周日
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

/** 本月 1 日 00:00 */
export function startOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
}

/** 今日 00:00 */
export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 计算连续打卡天数。
 * 规则：今日已打卡 → 从今日向前连续计数；今日未打卡但昨日打卡 → 从昨日向前计数（不断签）；
 *      更早则视为断签，返回 0。
 * @param {string[]} dateKeys 已打卡日期集合（'YYYY-MM-DD'，顺序不限）
 * @param {Date} now 参考时间
 */
export function computeStreak(dateKeys = [], now = new Date()) {
  const set = new Set(dateKeys.filter(Boolean));
  if (set.size === 0) return 0;

  const today = startOfDay(now);
  let cursor = today;
  if (!set.has(toDateKey(cursor))) {
    cursor = addDays(cursor, -1);
    if (!set.has(toDateKey(cursor))) return 0;
  }

  let streak = 0;
  while (set.has(toDateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** 生成最近 n 天的日期键（含今天，升序） */
export function recentDateKeys(n, now = new Date()) {
  const keys = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    keys.push(toDateKey(addDays(startOfDay(now), -i)));
  }
  return keys;
}
