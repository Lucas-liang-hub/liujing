import { describe, expect, it } from 'vitest';
import {
  addDays,
  computeStreak,
  parseTime,
  recentDateKeys,
  startOfWeek,
  toDateKey,
  toLocalDateTime,
} from '../src/utils/time.js';
import { buildContext, buildMessages, buildSystemPrompt, trimHistory } from '../src/ai/prompt.js';
import { greetingByHour, listLines, pickLineAt, renderTemplate, ruleReply, SCENES } from '../src/ai/library.js';
import { normalizeEvent } from '../src/ai/service.js';
import { computeGrowth } from '../src/utils/growth.js';

describe('时间工具', () => {
  it('toLocalDateTime 输出本地时间字符串', () => {
    const d = new Date(2026, 10, 11, 9, 5, 3);
    expect(toLocalDateTime(d)).toBe('2026-11-11 09:05:03');
  });

  it('toDateKey 只保留日期', () => {
    expect(toDateKey(new Date(2026, 0, 2, 23, 59))).toBe('2026-01-02');
  });

  it('parseTime 兼容空格分隔的时间字符串', () => {
    expect(parseTime('2026-11-11 09:00:00')).toBeInstanceOf(Date);
    expect(parseTime('2026-11-11T09:00:00')).toBeInstanceOf(Date);
    expect(parseTime('乱码')).toBeNull();
  });

  it('startOfWeek 返回本周一 00:00', () => {
    const wed = new Date(2026, 10, 11, 15, 30);
    const monday = startOfWeek(wed);
    expect(monday.getDay()).toBe(1);
    expect(monday.getHours()).toBe(0);
  });

  it('recentDateKeys 返回升序且末位为今天', () => {
    const keys = recentDateKeys(3, new Date(2026, 10, 11, 12));
    expect(keys).toEqual(['2026-11-09', '2026-11-10', '2026-11-11']);
  });
});

describe('computeStreak 连续打卡', () => {
  const now = new Date(2026, 10, 11, 12, 0); // 2026-11-11
  const key = (d) => toDateKey(addDays(now, -d));

  it('无记录返回 0', () => {
    expect(computeStreak([], now)).toBe(0);
  });

  it('只有今天 → 1', () => {
    expect(computeStreak([key(0)], now)).toBe(1);
  });

  it('今天+昨天+前天 → 3', () => {
    expect(computeStreak([key(0), key(1), key(2)], now)).toBe(3);
  });

  it('今天未打卡但昨天有 → 从昨天算，不断签', () => {
    expect(computeStreak([key(1), key(2)], now)).toBe(2);
  });

  it('断签超过一天 → 0', () => {
    expect(computeStreak([key(2), key(3)], now)).toBe(0);
  });

  it('乱序输入也能正确计数', () => {
    expect(computeStreak([key(2), key(0), key(1)], now)).toBe(3);
  });
});

describe('月见 prompt 组装', () => {
  const ctx = buildContext({
    user: { nickname: '勇康' },
    scene: 'deepsea',
    now: new Date(2026, 10, 11, 9, 0),
    stats: {
      todaySec: 75 * 60,
      weekSec: 300 * 60,
      totalSec: 42 * 3600,
      streak: 5,
      activeDays: 20,
      tasks: { todayTotal: 4, todayDone: 3 },
    },
  });

  it('上下文注入计算结果正确', () => {
    expect(ctx.todayMin).toBe(75);
    expect(ctx.taskRate).toBe(75);
    expect(ctx.sceneName).toBe('深海静流');
    expect(ctx.nickname).toBe('勇康');
  });

  it('system prompt 包含人设与真实数据', () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain('月见');
    expect(prompt).toContain('勇康');
    expect(prompt).toContain('今日已专注 75 分钟');
    expect(prompt).toContain('连续打卡 5 天');
    expect(prompt).toContain('深海静流');
  });

  it('没有任务时不编造完成率', () => {
    const empty = buildContext({ user: { nickname: 'A' }, stats: {} });
    expect(buildSystemPrompt(empty)).toContain('还没有建立任务清单');
  });

  it('trimHistory 只保留最近 6 轮并过滤非法项', () => {
    const history = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `m${i}`,
    }));
    history.push({ role: 'system', content: 'ignore me' });
    history.push({ role: 'user' });
    const trimmed = trimHistory(history, 6);
    expect(trimmed).toHaveLength(12);
    expect(trimmed[0].content).toBe('m8');
    expect(trimmed.every((m) => typeof m.content === 'string')).toBe(true);
  });

  it('buildMessages 首条为 system，末条为当前用户消息', () => {
    const messages = buildMessages({ ctx, history: [], message: '在吗' });
    expect(messages[0].role).toBe('system');
    expect(messages[messages.length - 1]).toEqual({ role: 'user', content: '在吗' });
  });
});

describe('语库', () => {
  it('6 个场景都有名称', () => {
    expect(Object.keys(SCENES)).toHaveLength(6);
  });

  it('场景专属文案会被并入候选池', () => {
    const sakura = listLines('start', 'sakura');
    const star = listLines('start', 'star');
    expect(sakura.length).toBeGreaterThan(star.length - 1);
    expect(sakura.some((l) => l.includes('樱花'))).toBe(true);
  });

  it('模板变量被替换', () => {
    const line = renderTemplate('今天已专注 {todayMin} 分钟，连续 {streak} 天', {
      todaySec: 3600,
      streak: 7,
    });
    expect(line).toBe('今天已专注 60 分钟，连续 7 天');
  });

  it('未知变量原样保留', () => {
    expect(renderTemplate('你好 {unknown}', {})).toBe('你好 {unknown}');
  });

  it('pickLineAt 确定性取用', () => {
    const a = pickLineAt({ event: 'finish', scene: 'autumn', index: 0 });
    const b = pickLineAt({ event: 'finish', scene: 'autumn', index: 0 });
    expect(a).toBe(b);
  });

  it('问候语随时段变化', () => {
    expect(greetingByHour(7)).toBe('早');
    expect(greetingByHour(20)).toBe('晚上好');
    expect(greetingByHour(2)).toBe('夜深了');
  });

  it('ruleReply 无关键词时仍给出一句', () => {
    expect(ruleReply('随便说点什么', { scene: 'star' }).length).toBeGreaterThan(4);
  });

  it('非法事件降级为 chat', () => {
    expect(normalizeEvent('unknown-event')).toBe('chat');
    expect(normalizeEvent('start')).toBe('start');
  });
});

describe('成长值体系', () => {
  it('专注分钟与打卡天数正确累加', () => {
    // 90 分钟专注 + 3 天打卡 = 90 + 60 = 150 分
    const g = computeGrowth({ totalSec: 90 * 60, activeDays: 3 });
    expect(g.points).toBe(150);
    expect(g.level).toBe('涓滴');
    expect(g.nextName).toBe('溪流');
  });

  it('等级阈值正确推进', () => {
    expect(computeGrowth({ totalSec: 0, activeDays: 0 }).level).toBe('涓滴');
    expect(computeGrowth({ totalSec: 400 * 60, activeDays: 0 }).level).toBe('溪流');
    expect(computeGrowth({ totalSec: 8000 * 60, activeDays: 40 }).points).toBe(8800);
    expect(computeGrowth({ totalSec: 8000 * 60, activeDays: 40 }).level).toBe('沧海');
  });

  it('最高级没有下一级', () => {
    const g = computeGrowth({ totalSec: 100000 * 60, activeDays: 999 });
    expect(g.level).toBe('沧海');
    expect(g.nextName).toBeNull();
    expect(g.nextAt).toBeNull();
  });

  it('非法输入归零', () => {
    expect(computeGrowth({ totalSec: -5, activeDays: -1 }).points).toBe(0);
    expect(computeGrowth({}).points).toBe(0);
  });
});

describe('周小结（weekly 事件）', () => {
  it('语库模板注入周数据', () => {
    const line = pickLineAt({
      event: 'weekly',
      scene: 'star',
      index: 0,
      ctx: { weekMin: 240, activeDays: 4, totalHours: 12.5, streak: 2 },
    });
    expect(line).toContain('240');
    expect(line).toContain('4');
  });

  it('weekly 是合法事件', () => {
    expect(normalizeEvent('weekly')).toBe('weekly');
  });
});
