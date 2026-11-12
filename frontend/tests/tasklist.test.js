import { describe, expect, it } from 'vitest';
import { normalizeItems, rolloverItems, sanitizeTasksPayload, TASKS_LIMIT, TITLE_LIMIT, todayKey } from '../src/utils/tasklist.js';

describe('todayKey', () => {
  it('生成 YYYY-MM-DD 本地日期键', () => {
    expect(todayKey(new Date(2026, 10, 12))).toBe('2026-11-12');
    expect(todayKey(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
});

describe('sanitizeTasksPayload', () => {
  it('旧版纯数组自动迁移：日期视为今天', () => {
    const data = sanitizeTasksPayload([{ title: '复习', done: true }]);
    expect(data.date).toBe(todayKey());
    expect(data.items[0].title).toBe('复习');
    expect(data.items[0].done).toBe(true);
    expect(typeof data.updatedAt).toBe('number');
  });

  it('新结构原样清洗，非法条目被过滤', () => {
    const data = sanitizeTasksPayload({
      date: '2026-11-11',
      updatedAt: 1000,
      items: [{ title: '  背单词  ', done: 1 }, { title: '   ' }, null],
    });
    expect(data.date).toBe('2026-11-11');
    expect(data.updatedAt).toBe(1000);
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toEqual({ id: expect.any(String), title: '背单词', done: true });
  });

  it('非对象输入返回 null', () => {
    expect(sanitizeTasksPayload(null)).toBeNull();
    expect(sanitizeTasksPayload('x')).toBeNull();
    expect(sanitizeTasksPayload(42)).toBeNull();
  });

  it('标题超长截断，条目超量裁剪', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ title: `任务${i}` }));
    const data = sanitizeTasksPayload({ date: '2026-11-11', updatedAt: 1, items: many });
    expect(data.items).toHaveLength(TASKS_LIMIT);
    expect(data.items[0].title.length).toBeLessThanOrEqual(TITLE_LIMIT);
  });
});

describe('rolloverItems（跨天翻篇）', () => {
  const items = [
    { id: 'a', title: '已完成', done: true },
    { id: 'b', title: '没做完', done: false },
    { id: 'c', title: '也没做完', done: false },
  ];

  it('同一天原样保留（含已完成）', () => {
    expect(rolloverItems(items, '2026-11-12', '2026-11-12')).toHaveLength(3);
  });

  it('跨天丢弃已完成，顺延未完成', () => {
    const next = rolloverItems(items, '2026-11-11', '2026-11-12');
    expect(next).toHaveLength(2);
    expect(next.every((t) => !t.done)).toBe(true);
    expect(next.map((t) => t.title)).toEqual(['没做完', '也没做完']);
  });

  it('非法输入返回空数组', () => {
    expect(rolloverItems(null, '2026-11-11', '2026-11-12')).toEqual([]);
  });
});

describe('normalizeItems', () => {
  it('补齐缺失 id 并保持稳定', () => {
    const items = normalizeItems([{ title: 'a' }, { id: 'keep', title: 'b' }]);
    expect(items[0].id).toBeTruthy();
    expect(items[1].id).toBe('keep');
  });
});
