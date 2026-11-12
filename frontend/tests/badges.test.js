import { describe, expect, it } from 'vitest';
import { BADGES, countUnlocked, evaluateBadges } from '../src/utils/badges.js';

const get = (badges, id) => badges.find((b) => b.id === id);

describe('evaluateBadges', () => {
  it('空数据时全部未解锁，进度为 0', () => {
    const badges = evaluateBadges({}, []);
    expect(badges).toHaveLength(BADGES.length);
    expect(badges.every((b) => !b.unlocked)).toBe(true);
    expect(badges.every((b) => b.progress === 0)).toBe(true);
  });

  it('完成一次自习解锁"初次入座"', () => {
    const badges = evaluateBadges({ totalSessions: 1 }, []);
    expect(get(badges, 'first').unlocked).toBe(true);
  });

  it('连续 7 天解锁前两枚打卡徽章，第三枚仍未解锁', () => {
    const badges = evaluateBadges({ streak: 7 }, []);
    expect(get(badges, 'streak3').unlocked).toBe(true);
    expect(get(badges, 'streak7').unlocked).toBe(true);
    expect(get(badges, 'streak30').unlocked).toBe(false);
    expect(get(badges, 'streak30').progress).toBeCloseTo(0.23, 2);
  });

  it('累计时长按阶梯解锁', () => {
    const badges = evaluateBadges({ totalSec: 12 * 3600 }, []);
    expect(get(badges, 'hours10').unlocked).toBe(true);
    expect(get(badges, 'hours50').unlocked).toBe(false);
    expect(get(badges, 'hours50').progress).toBeCloseTo(0.24, 2);
  });

  it('近 14 天里有一天任务全清即解锁', () => {
    const badges = evaluateBadges(
      { daily: [{ tasksTotal: 3, tasksDone: 3 }, { tasksTotal: 2, tasksDone: 1 }] },
      [],
    );
    expect(get(badges, 'tasksClear').unlocked).toBe(true);
  });

  it('快照求和导致 done<total 时，cleared 标志仍能解锁', () => {
    // 真实场景：上午快照 2/3、下午快照 3/3，求和 5/6，但当天曾清空
    const badges = evaluateBadges(
      { daily: [{ tasksDone: 5, tasksTotal: 6, cleared: 1 }], tasks: { todayDone: 3, todayTotal: 3, cleared: 1 } },
      [],
    );
    expect(get(badges, 'tasksClear').unlocked).toBe(true);
  });

  it('任务没做完且无 cleared 标志不解锁', () => {
    const badges = evaluateBadges(
      { daily: [{ tasksTotal: 3, tasksDone: 2, cleared: 0 }], tasks: { todayTotal: 3, todayDone: 2, cleared: 0 } },
      [],
    );
    expect(get(badges, 'tasksClear').unlocked).toBe(false);
  });

  it('今日实时清单全部勾完，无需入库即解锁', () => {
    // 服务器数据还是旧的（快照 1/3），但当前清单已全部划掉
    const badges = evaluateBadges(
      { daily: [{ tasksTotal: 3, tasksDone: 1 }], tasks: { todayTotal: 3, todayDone: 1 } },
      [],
      { total: 3, done: 3 },
    );
    expect(get(badges, 'tasksClear').unlocked).toBe(true);
  });

  it('实时清单没做完不影响判定', () => {
    const badges = evaluateBadges({}, [], { total: 3, done: 2 });
    expect(get(badges, 'tasksClear').unlocked).toBe(false);
  });

  it('清晨与深夜时段由热力图判定', () => {
    const early = evaluateBadges({}, [{ weekday: 0, hour: 6, sec: 600 }]);
    expect(get(early, 'earlyBird').unlocked).toBe(true);
    expect(get(early, 'nightOwl').unlocked).toBe(false);

    const late = evaluateBadges({}, [{ weekday: 4, hour: 23, sec: 600 }]);
    expect(get(late, 'nightOwl').unlocked).toBe(true);
  });

  it('零秒的时段不算解锁', () => {
    const badges = evaluateBadges({}, [{ weekday: 0, hour: 6, sec: 0 }]);
    expect(get(badges, 'earlyBird').unlocked).toBe(false);
  });

  it('countUnlocked 统计已获得数量', () => {
    const badges = evaluateBadges({ totalSessions: 3, streak: 7, totalSec: 11 * 3600 }, []);
    expect(countUnlocked(badges)).toBe(4); // first + streak3 + streak7 + hours10
  });

  it('已解锁的 progress 恒为 1', () => {
    const badges = evaluateBadges({ totalSessions: 1, streak: 30 }, []);
    const unlocked = badges.filter((b) => b.unlocked);
    expect(unlocked.every((b) => b.progress === 1)).toBe(true);
  });
});
