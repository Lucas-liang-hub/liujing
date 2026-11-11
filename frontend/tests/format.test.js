import { describe, expect, it } from 'vitest';
import {
  dateKey,
  formatClock,
  formatDateCn,
  formatDateShort,
  formatDuration,
  formatTime,
  toHours,
  toLocalIso,
  toMinutes,
} from '../src/utils/format.js';

describe('formatClock', () => {
  it('0 秒显示 00:00', () => {
    expect(formatClock(0)).toBe('00:00');
  });

  it('25 分钟显示 25:00', () => {
    expect(formatClock(1500)).toBe('25:00');
  });

  it('不足一分钟补零', () => {
    expect(formatClock(59)).toBe('00:59');
    expect(formatClock(5)).toBe('00:05');
  });

  it('超过一小时自动切 h:mm:ss', () => {
    expect(formatClock(3661)).toBe('1:01:01');
  });

  it('非法输入按 0 处理', () => {
    expect(formatClock(null)).toBe('00:00');
    expect(formatClock(-20)).toBe('00:00');
  });
});

describe('formatDuration', () => {
  it('小于一分钟用秒', () => {
    expect(formatDuration(45)).toBe('45 秒');
  });

  it('整分钟', () => {
    expect(formatDuration(60)).toBe('1 分钟');
    expect(formatDuration(1500)).toBe('25 分钟');
  });

  it('小时 + 分钟', () => {
    expect(formatDuration(5400)).toBe('1 小时 30 分');
  });

  it('整小时不带分钟', () => {
    expect(formatDuration(7200)).toBe('2 小时');
  });
});

describe('小时/分钟换算', () => {
  it('toHours 保留一位小数', () => {
    expect(toHours(0)).toBe(0);
    expect(toHours(5400)).toBe(1.5);
    expect(toHours(3599)).toBe(1);
  });

  it('toMinutes 四舍五入', () => {
    expect(toMinutes(1500)).toBe(25);
    expect(toMinutes(89)).toBe(1);
  });
});

describe('时间展示', () => {
  it('formatTime 解析本地时间字符串', () => {
    expect(formatTime('2026-11-11 09:05:00')).toBe('09:05');
    expect(formatTime('2026-11-11T21:07:00')).toBe('21:07');
  });

  it('formatTime 对非法输入返回占位', () => {
    expect(formatTime('乱码')).toBe('--:--');
  });

  it('formatDateCn / formatDateShort 输出中文与短格式', () => {
    const d = new Date(2026, 10, 11, 8, 0);
    expect(formatDateCn(d)).toBe('11月11日');
    expect(formatDateShort(d)).toBe('11/11');
  });

  it('dateKey 输出 YYYY-MM-DD', () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 9))).toBe('2026-01-05');
  });

  it('toLocalIso 不带时区后缀（本地时间直传后端）', () => {
    const iso = toLocalIso(new Date(2026, 10, 11, 15, 4, 9));
    expect(iso).toBe('2026-11-11T15:04:09');
    expect(iso.endsWith('Z')).toBe(false);
  });
});
