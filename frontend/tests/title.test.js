import { describe, expect, it, vi } from 'vitest';
import { applyTitle, buildTitle, DEFAULT_TITLE } from '../src/utils/title.js';

describe('buildTitle 标签页标题同步', () => {
  it('待机时显示默认标题', () => {
    expect(buildTitle({ status: 'idle' })).toBe(DEFAULT_TITLE);
  });

  it('专注时显示倒计时 + 场景名', () => {
    expect(buildTitle({ status: 'focus', remaining: 1500, sceneName: '樱花漫舞' })).toBe('25:00 · 樱花漫舞 · 流境');
  });

  it('专注但场景名为空时回落到"专注中"', () => {
    expect(buildTitle({ status: 'focus', remaining: 65 })).toBe('01:05 · 专注中 · 流境');
  });

  it('暂停时显示已暂停', () => {
    expect(buildTitle({ status: 'paused', remaining: 300 })).toBe('已暂停 05:00 · 流境');
  });

  it('休息时显示休息', () => {
    expect(buildTitle({ status: 'break', remaining: 120 })).toBe('休息 02:00 · 流境');
  });

  it('完成时给出完成态', () => {
    expect(buildTitle({ status: 'finished' })).toBe('完成了 · 流境');
  });
});

describe('applyTitle', () => {
  it('写入 document.title', () => {
    const doc = { title: '' };
    applyTitle({ status: 'focus', remaining: 60, sceneName: '深海静流' }, doc);
    expect(doc.title).toBe('01:00 · 深海静流 · 流境');
  });

  it('值未变化时不重复赋值', () => {
    const doc = { title: DEFAULT_TITLE };
    const spy = vi.fn();
    Object.defineProperty(doc, 'title', {
      get: () => DEFAULT_TITLE,
      set: spy,
    });
    applyTitle({ status: 'idle' }, doc);
    expect(spy).not.toHaveBeenCalled();
  });

  it('没有 document 时也不报错', () => {
    expect(() => applyTitle({ status: 'idle' }, null)).not.toThrow();
  });
});
