import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { app, registerUser, resetDatabase } from './helpers/setup.js';

beforeAll(async () => {
  await resetDatabase();
});

describe('POST /api/auth/register', () => {
  it('注册成功返回 token 与用户信息，且不泄露密码', async () => {
    const res = await registerUser({ username: 'alice', nickname: '爱丽丝' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toMatchObject({ username: 'alice', nickname: '爱丽丝' });
    expect(res.body.user.prefs.scene).toBe('sakura');
    expect(JSON.stringify(res.body)).not.toContain('password');
  });

  it('用户名重复返回 409', async () => {
    await registerUser({ username: 'bob' });
    const res = await registerUser({ username: 'bob' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('密码过短返回 400', async () => {
    const res = await registerUser({ username: 'carol', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('密码长度');
  });

  it('非法用户名返回 400', async () => {
    const res = await registerUser({ username: 'a b!' });
    expect(res.status).toBe(400);
  });

  it('缺少字段返回 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'dave' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('登录成功返回 token', async () => {
    await registerUser({ username: 'erin', password: 'abcdef' });
    const res = await request(app).post('/api/auth/login').send({ username: 'erin', password: 'abcdef' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.username).toBe('erin');
  });

  it('密码错误返回 401 且不区分用户名是否存在', async () => {
    await registerUser({ username: 'frank', password: 'abcdef' });
    const wrongPwd = await request(app).post('/api/auth/login').send({ username: 'frank', password: 'xxxxxx' });
    const noUser = await request(app).post('/api/auth/login').send({ username: 'ghost', password: 'abcdef' });
    expect(wrongPwd.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPwd.body.error.message).toBe(noUser.body.error.message);
  });
});

describe('profile', () => {
  it('无 token 访问返回 401', async () => {
    const res = await request(app).get('/api/auth/profile');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('伪造 token 返回 401', async () => {
    const res = await request(app).get('/api/auth/profile').set('Authorization', 'Bearer not-a-token');
    expect(res.status).toBe(401);
  });

  it('带 token 可读取资料', async () => {
    const reg = await registerUser({ username: 'gina' });
    const res = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${reg.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('gina');
  });

  it('可更新昵称与偏好，偏好做白名单过滤', async () => {
    const reg = await registerUser({ username: 'henry' });
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ nickname: '新昵称', prefs: { scene: 'deepsea', focusMinutes: 45, soundOn: true } });

    expect(res.status).toBe(200);
    expect(res.body.user.nickname).toBe('新昵称');
    expect(res.body.user.prefs).toMatchObject({ scene: 'deepsea', focusMinutes: 45, soundOn: true });
  });

  it('非法偏好返回 400', async () => {
    const reg = await registerUser({ username: 'ivy' });
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ prefs: { scene: 'not-a-scene' } });
    expect(res.status).toBe(400);
  });

  it('空更新返回 400', async () => {
    const reg = await registerUser({ username: 'jack' });
    const res = await request(app).put('/api/auth/profile').set('Authorization', `Bearer ${reg.body.token}`).send({});
    expect(res.status).toBe(400);
  });
});
