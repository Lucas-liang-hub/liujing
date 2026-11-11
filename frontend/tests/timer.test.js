import { describe, expect, it } from 'vitest';
import { computeElapsedMs, isFinished, progressOf, remainingSec, toSec, timeOfDay } from '../src/utils/timer.js';

describe('computeElapsedMs 时间戳差值计时', () => {
  it('未运行时返回已累计值', () => {
    expect(computeElapsedMs({ accumulatedMs: 5000, runningSince: null })).toBe(5000);
  });

  it('运行中 = 累计 + 当前片段', () => {
    expect(computeElapsedMs({ accumulatedMs: 5000, runningSince: 1000, now: 4000 })).toBe(8000);
  });

  it('即使 now 早于 runningSince 也不会倒退', () => {
    expect(computeElapsedMs({ accumulatedMs: 2000, runningSince: 5000, now: 1000 })).toBe(2000);
  });

  it('默认参数可用', () => {
    expect(computeElapsedMs()).toBe(0);
  });
});

describe('remainingSec', () => {
  it('刚开始时等于总时长', () => {
    expect(remainingSec(1500, 0)).toBe(1500);
  });

  it('向上取整，避免起步即 24:59', () => {
    expect(remainingSec(1500, 500)).toBe(1500);
    expect(remainingSec(1500, 1000)).toBe(1499);
  });

  it('不会出现负数', () => {
    expect(remainingSec(1500, 99999999)).toBe(0);
  });
});

describe('progressOf', () => {
  it('0 / 0.5 / 1 三个关键点', () => {
    expect(progressOf(1000, 0)).toBe(0);
    expect(progressOf(1000, 500000)).toBe(0.5);
    expect(progressOf(1000, 1000000)).toBe(1);
  });

  it('超出范围被截断', () => {
    expect(progressOf(1000, 99999999)).toBe(1);
    expect(progressOf(0, 100)).toBe(0);
  });
});

describe('isFinished / toSec', () => {
  it('剩余为 0 视为结束', () => {
    expect(isFinished(60, 60000)).toBe(true);
    expect(isFinished(60, 59000)).toBe(false);
  });

  it('toSec 向下取整', () => {
    expect(toSec(1999)).toBe(1);
    expect(toSec(0)).toBe(0);
  });
});

describe('timeOfDay', () => {
  it('时段划分', () => {
    expect(timeOfDay(3)).toBe('夜深');
    expect(timeOfDay(7)).toBe('清晨');
    expect(timeOfDay(10)).toBe('上午');
    expect(timeOfDay(13)).toBe('午后');
    expect(timeOfDay(16)).toBe('下午');
    expect(timeOfDay(20)).toBe('夜晚');
    expect(timeOfDay(23)).toBe('深夜');
  });
});
