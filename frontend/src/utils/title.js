import { formatClock } from './format.js';

export const APP_NAME = '流境';
export const DEFAULT_TITLE = '流境 · 沉浸式自习室';

/**
 * 标签页标题同步（技术方案 3.2 第 3 条）
 * 纯函数，便于单测；真正的 DOM 写入由 applyTitle 负责。
 */
export function buildTitle({ status = 'idle', remaining = 0, sceneName = '' } = {}) {
  const clock = formatClock(remaining);
  switch (status) {
    case 'focus':
      return `${clock} · ${sceneName || '专注中'} · ${APP_NAME}`;
    case 'paused':
      return `已暂停 ${clock} · ${APP_NAME}`;
    case 'break':
      return `休息 ${clock} · ${APP_NAME}`;
    case 'finished':
      return `完成了 · ${APP_NAME}`;
    default:
      return DEFAULT_TITLE;
  }
}

/** 写入 document.title，值未变化时跳过（避免高频 DOM 写） */
export function applyTitle(payload, doc = typeof document !== 'undefined' ? document : null) {
  const next = buildTitle(payload);
  if (doc && doc.title !== next) doc.title = next;
  return next;
}
