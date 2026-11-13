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

  it('空字符串昵称表示清空（前端回退显示用户名）', async () => {
    const reg = await registerUser({ username: 'kate', nickname: '大王' });
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ nickname: '', prefs: { scene: 'sakura' } });
    expect(res.status).toBe(200);
    expect(res.body.user.nickname).toBe('');
  });

  it('空更新返回 400', async () => {
    const reg = await registerUser({ username: 'jack' });
    const res = await request(app).put('/api/auth/profile').set('Authorization', `Bearer ${reg.body.token}`).send({});
    expect(res.status).toBe(400);
  });
});

describe('今日清单同步（prefs.tasks）', () => {
  const put = (reg, body) =>
    request(app).put('/api/auth/profile').set('Authorization', `Bearer ${reg.body.token}`).send(body);

  it('保存清单并回读，浅合并不影响其他偏好', async () => {
    const reg = await registerUser({ username: 'tasky' });
    await put(reg, { prefs: { focusMinutes: 40 } });
    const res = await put(reg, {
      prefs: { tasks: { date: '2026-11-12', updatedAt: 123456, items: [{ title: '背单词', done: true }, { title: '刷题', done: false }] } },
    });
    expect(res.status).toBe(200);
    expect(res.body.user.prefs.focusMinutes).toBe(40); // 未被 tasks 更新冲掉
    expect(res.body.user.prefs.tasks).toEqual({
      date: '2026-11-12',
      updatedAt: 123456,
      items: [
        { title: '背单词', done: true },
        { title: '刷题', done: false },
      ],
    });
  });

  it('清洗：空标题剔除、超长截断、done 布尔化', async () => {
    const reg = await registerUser({ username: 'taskclean' });
    const res = await put(reg, {
      prefs: { tasks: { items: [{ title: '   ' }, { title: 'x'.repeat(120), done: 'yes' }, { title: '有效' }] } },
    });
    expect(res.status).toBe(200);
    expect(res.body.user.prefs.tasks.items).toHaveLength(2);
    expect(res.body.user.prefs.tasks.items[0].title.length).toBeLessThanOrEqual(100);
    expect(res.body.user.prefs.tasks.items[0].done).toBe(true);
  });

  it('items 非数组返回 400，超 50 条返回 400', async () => {
    const reg = await registerUser({ username: 'taskbad' });
    expect((await put(reg, { prefs: { tasks: { items: 'no' } } })).status).toBe(400);
    const many = Array.from({ length: 51 }, (_, i) => ({ title: `t${i}` }));
    expect((await put(reg, { prefs: { tasks: { items: many } } })).status).toBe(400);
  });
});

describe('音效白名单（与前端素材对齐）', () => {
  it('新音效 id 均可通过校验', async () => {
    const reg = await registerUser({ username: 'soundy' });
    for (const sound of ['waves', 'summer-night', 'fireplace', 'stream', 'wind', 'rain', 'none']) {
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${reg.body.token}`)
        .send({ prefs: { sound } });
      expect(res.status).toBe(200);
      expect(res.body.user.prefs.sound).toBe(sound);
    }
  });

  it('未知音效返回 400', async () => {
    const reg = await registerUser({ username: 'soundbad' });
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ prefs: { sound: 'jazz' } });
    expect(res.status).toBe(400);
  });
});
