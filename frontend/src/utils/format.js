/** 秒 → mm:ss（超过 1 小时自动变 h:mm:ss） */
export function formatClock(totalSeconds) {
  const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** 秒 → 中文可读时长：1 小时 25 分 / 25 分钟 / 40 秒 */
export function formatDuration(totalSeconds) {
  const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  if (sec < 60) return `${sec} 秒`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return m > 0 ? `${h} 小时 ${m} 分` : `${h} 小时`;
  return `${m} 分钟`;
}

/** 秒 → 小时数（保留一位小数），用于累计展示 */
export function toHours(totalSeconds) {
  return Math.round(((Number(totalSeconds) || 0) / 3600) * 10) / 10;
}

/** 秒 → 分钟数（整数） */
export function toMinutes(totalSeconds) {
  return Math.round((Number(totalSeconds) || 0) / 60);
}

const pad = (n) => String(n).padStart(2, '0');

/** 本地日期字符串 'YYYY-MM-DD HH:mm:ss' 或 ISO → Date（兼容 Safari） */
export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const normalized = String(value).includes('T') ? value : String(value).replace(' ', 'T');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 时间 → 'HH:mm' */
export function formatTime(value) {
  const d = parseDate(value);
  if (!d) return '--:--';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 时间 → '11月11日' */
export function formatDateCn(value) {
  const d = parseDate(value);
  if (!d) return '--';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 时间 → 'MM/DD'（图表轴） */
export function formatDateShort(value) {
  const d = parseDate(value);
  if (!d) return '';
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/** 'YYYY-MM-DD' → 周一/周二… */
export const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/** 本地日期键 'YYYY-MM-DD' */
export function dateKey(value = new Date()) {
  const d = parseDate(value) || new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Date → 'YYYY-MM-DDTHH:mm:ss'（本地时区，不带 Z）
 * 后端按服务器本地时间解析，避免 UTC 偏移把凌晨的自习算到前一天。
 */
export function toLocalIso(value = new Date()) {
  const d = parseDate(value) || new Date();
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

