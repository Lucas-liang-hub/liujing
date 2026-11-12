/**
 * 今日清单纯函数集 —— 存储/翻篇/清洗逻辑与 store 解耦，便于单测。
 * 「今日」语义：清单绑定日期，跨天时已完成任务清空、未完成任务顺延。
 */

export const TASKS_LIMIT = 50;
export const TITLE_LIMIT = 100;

/** 本地日期键 'YYYY-MM-DD' */
export function todayKey(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function genId() {
  return `t${Date.now()}${Math.random().toString(16).slice(2, 6)}`;
}

/** 归一化任务条目：补 id、截断标题、布尔化 done */
export function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((t, i) => ({
      id: typeof t?.id === 'string' && t.id ? t.id : `t${Date.now()}-${i}`,
      title: String(t?.title ?? '').trim().slice(0, TITLE_LIMIT),
      done: Boolean(t?.done),
    }))
    .filter((t) => t.title)
    .slice(0, TASKS_LIMIT);
}

/**
 * 清洗任意来源（localStorage / 服务器）的清单数据。
 * 兼容旧版纯数组格式（无日期、无更新时间，视作今天写入以避免误清空）。
 * @returns {{ date: string, updatedAt: number, items: Array } | null}
 */
export function sanitizeTasksPayload(raw) {
  if (Array.isArray(raw)) {
    return { date: todayKey(), updatedAt: Date.now(), items: normalizeItems(raw) };
  }
  if (!raw || typeof raw !== 'object') return null;
  const date = typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : todayKey();
  const updatedAt = Number.isFinite(Number(raw.updatedAt)) ? Math.round(Number(raw.updatedAt)) : 0;
  return { date, updatedAt, items: normalizeItems(raw.items) };
}

/**
 * 跨天翻篇：同一天原样返回；跨天则丢弃已完成、保留未完成。
 */
export function rolloverItems(items, savedDate, today) {
  const list = Array.isArray(items) ? items : [];
  if (savedDate === today) return list;
  return list.filter((t) => !t.done);
}
