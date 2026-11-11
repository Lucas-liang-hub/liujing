import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { app, registerUser, resetDatabase, sessionBody } from './helpers/setup.js';

let token;

beforeAll(async () => {
  await resetDatabase();
  const reg = await registerUser({ username: 'session_user' });
  token = reg.body.token;
});

const post = (body) => request(app).post('/api/sessions').set('Authorization', `Bearer ${token}`).send(body);

describe('POST /api/sessions', () => {
  it('无 token 返回 401', async () => {
    const res = await request(app).post('/api/sessions').send(sessionBody());
    expect(res.status).toBe(401);
  });

  it('正常上报返回 201，时长以起止时间回算为准', async () => {
    const res = await post(sessionBody({ durationSec: 1490 })); // 上报值偏差 10s，在容忍区间内
    expect(res.status).toBe(201);
    expect(res.body.record.durationSec).toBe(1500);
    expect(res.body.record.tasksTotal).toBe(2);
    expect(res.body.record.tasksDone).toBe(1);
    expect(res.body.record.scene).toBe('sakura');
  });

  it('时长与起止时间偏差超过 60s 返回 400', async () => {
    const res = await post(sessionBody({ durationSec: 1600 }));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('不一致');
  });

  it('结束时间早于开始时间返回 400', async () => {
    const now = new Date();
    const res = await post(
      sessionBody({
        startedAt: now.toISOString(),
        endedAt: new Date(now.getTime() - 60000).toISOString(),
        durationSec: 60,
      }),
    );
    expect(res.status).toBe(400);
  });

  it('不足 1 分钟不入库', async () => {
    const now = new Date();
    const res = await post(
      sessionBody({
        startedAt: new Date(now.getTime() - 30000).toISOString(),
        endedAt: now.toISOString(),
        durationSec: 30,
      }),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('不足 1 分钟');
  });

  it('超过 12 小时视为异常', async () => {
    const now = new Date();
    const res = await post(
      sessionBody({
        startedAt: new Date(now.getTime() - 13 * 3600 * 1000).toISOString(),
        endedAt: now.toISOString(),
        durationSec: 13 * 3600,
      }),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('12 小时');
  });

  it('非法场景返回 400', async () => {
    const res = await post(sessionBody({ scene: 'moon' }));
    expect(res.status).toBe(400);
  });

  it('非法时间格式返回 400', async () => {
    const res = await post(sessionBody({ startedAt: 'not-a-date' }));
    expect(res.status).toBe(400);
  });

  it('任务数量超限返回 400', async () => {
    const tasks = Array.from({ length: 51 }, (_, i) => ({ title: `t${i}`, done: false }));
    const res = await post(sessionBody({ tasks }));
    expect(res.status).toBe(400);
  });

  it('接受自定义模式', async () => {
    const res = await post(sessionBody({ mode: 'custom' }));
    expect(res.status).toBe(201);
    expect(res.body.record.mode).toBe('custom');
  });
});

describe('GET /api/sessions', () => {
  it('按时间倒序分页返回', async () => {
    const res = await request(app).get('/api/sessions?page=1&pageSize=5').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.length).toBeLessThanOrEqual(5);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.page).toBe(1);
  });

  it('不同用户互相隔离', async () => {
    const other = await registerUser({ username: 'other_user' });
    const res = await request(app).get('/api/sessions').set('Authorization', `Bearer ${other.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });
});
