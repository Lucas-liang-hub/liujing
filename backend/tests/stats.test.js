import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { app, registerUser, resetDatabase } from './helpers/setup.js';
import { recordDao } from '../src/dao/index.js';
import { addDays, toLocalDateTime } from '../src/utils/time.js';

let token;
let userId;

/** 构造一条 daysAgo 天前、hour 点开始、持续 minutes 分钟的记录 */
function recordAt(daysAgo, hour, minutes, extra = {}) {
  const start = addDays(new Date(), -daysAgo);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start.getTime() + minutes * 60000);
  return recordDao.insert({
    userId,
    scene: extra.scene || 'sakura',
    mode: 'pomodoro',
    startedAt: toLocalDateTime(start),
    endedAt: toLocalDateTime(end),
    durationSec: minutes * 60,
    tasksTotal: extra.tasksTotal ?? 0,
    tasksDone: extra.tasksDone ?? 0,
    tasks: [],
  });
}

const mine = (path) => request(app).get(path).set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  await resetDatabase();
  const reg = await registerUser({ username: 'stats_user' });
  token = reg.body.token;
  userId = reg.body.user.id;

  await recordAt(0, 9, 45, { scene: 'sakura', tasksTotal: 3, tasksDone: 2 });
  await recordAt(0, 15, 45, { scene: 'deepsea', tasksTotal: 3, tasksDone: 3 });
  await recordAt(1, 20, 30, { scene: 'star' });
  await recordAt(2, 10, 60, { scene: 'sakura' });
});

describe('GET /api/stats/summary', () => {
  it('聚合今日/累计时长与次数', async () => {
    const res = await mine('/api/stats/summary');
    expect(res.status).toBe(200);
    expect(res.body.todaySec).toBe(90 * 60);
    expect(res.body.todaySessions).toBe(2);
    expect(res.body.totalSec).toBe((90 + 30 + 60) * 60);
    expect(res.body.totalSessions).toBe(4);
    expect(res.body.weekSec).toBeGreaterThanOrEqual(res.body.todaySec);
    expect(res.body.monthSec).toBeGreaterThanOrEqual(res.body.weekSec);
  });

  it('连续打卡天数正确（今天、昨天、前天 → 3）', async () => {
    const res = await mine('/api/stats/summary');
    expect(res.body.streak).toBe(3);
    expect(res.body.activeDays).toBe(3);
  });

  it('今日任务以最后一条快照为准', async () => {
    const res = await mine('/api/stats/summary');
    expect(res.body.tasks.todayTotal).toBe(3);
    expect(res.body.tasks.todayDone).toBe(3);
    expect(res.body.tasks.todayRate).toBe(1);
  });

  it('快照求和会重复计数，但 cleared 标志正确识别当天曾清空清单', async () => {
    const res = await mine('/api/stats/summary');
    // 天聚合是快照求和（2+3=5 / 3+3=6），不能用它判断清空
    const today = res.body.daily[res.body.daily.length - 1];
    expect(today.tasksDone).toBe(5);
    expect(today.tasksTotal).toBe(6);
    // 但今天任一快照达成过 done>=total → cleared=1
    expect(today.cleared).toBe(1);
    expect(res.body.tasks.cleared).toBe(1);
  });

  it('近 14 天序列补零且末位为今天', async () => {
    const res = await mine('/api/stats/summary');
    expect(res.body.daily).toHaveLength(14);
    const last = res.body.daily[14 - 1];
    expect(last.sec).toBe(90 * 60);
    expect(res.body.daily[0].sec).toBe(0);
  });

  it('场景分布按秒数降序', async () => {
    const res = await mine('/api/stats/summary');
    expect(res.body.scenes[0].scene).toBe('sakura');
    expect(res.body.scenes[0].sec).toBe((45 + 60) * 60);
  });

  it('无 token 返回 401', async () => {
    const res = await request(app).get('/api/stats/summary');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/stats/heatmap', () => {
  it('返回 7×24=168 个格子', async () => {
    const res = await mine('/api/stats/heatmap?days=30');
    expect(res.status).toBe(200);
    expect(res.body.cells).toHaveLength(168);
    expect(res.body.maxSec).toBeGreaterThan(0);
  });

  it('今日 9 点这一格有数据', async () => {
    const res = await mine('/api/stats/heatmap?days=30');
    const weekday = (new Date().getDay() + 6) % 7; // 周一=0
    const cell = res.body.cells.find((c) => c.weekday === weekday && c.hour === 9);
    expect(cell.sec).toBeGreaterThanOrEqual(45 * 60);
  });

  it('days 参数做上下限收敛', async () => {
    const tooSmall = await mine('/api/stats/heatmap?days=1');
    expect(tooSmall.body.days).toBe(7);
    const tooBig = await mine('/api/stats/heatmap?days=9999');
    expect(tooBig.body.days).toBe(365);
  });
});
