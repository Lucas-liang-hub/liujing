import request from 'supertest';
import { createApp } from '../../src/app.js';
import { getDb } from '../../src/db/index.js';
import { runMigrations } from '../../src/db/migrate.js';

/** 每个测试文件独享一个内存库：建表 + 清空 */
export async function resetDatabase() {
  await runMigrations();
  const db = await getDb();
  await db.exec('DELETE FROM study_records; DELETE FROM user_llm_keys; DELETE FROM users;');
  return db;
}

export const app = createApp();

/** 注册并返回 { token, user } */
export async function registerUser(overrides = {}) {
  const payload = { username: 'tester', password: '123456', nickname: '小测', ...overrides };
  const res = await request(app).post('/api/auth/register').send(payload);
  return res;
}

/** 注册后直接拿到 token */
export async function loginAndGetToken(overrides = {}) {
  const res = await registerUser(overrides);
  return res.body.token;
}

/** 便捷构造一条自习记录请求体 */
export function sessionBody(overrides = {}) {
  const ended = new Date();
  const started = new Date(ended.getTime() - 25 * 60 * 1000);
  return {
    scene: 'sakura',
    mode: 'pomodoro',
    startedAt: started.toISOString(),
    endedAt: ended.toISOString(),
    durationSec: 25 * 60,
    tasks: [
      { title: '背单词 50 个', done: true },
      { title: '数学真题一套', done: false },
    ],
    ...overrides,
  };
}
