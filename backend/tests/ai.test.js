import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { app, registerUser, resetDatabase } from './helpers/setup.js';
import { EVENTS } from '../src/ai/library.js';

let token;

beforeAll(async () => {
  await resetDatabase();
  const reg = await registerUser({ username: 'ai_user' });
  token = reg.body.token;
});

const chat = (body) => request(app).post('/api/ai/chat').set('Authorization', `Bearer ${token}`).send(body);

describe('GET /api/ai/config', () => {
  it('未配置 Key 时 llmEnabled=false', async () => {
    const res = await request(app).get('/api/ai/config').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.llmEnabled).toBe(false);
    expect(res.body.maxHistoryRounds).toBe(6);
  });
});

describe('POST /api/ai/chat 保底轨', () => {
  it('未登录返回 401', async () => {
    const res = await request(app).post('/api/ai/chat').send({ event: 'start' });
    expect(res.status).toBe(401);
  });

  it('所有事件类型都能产出非空文案', async () => {
    for (const event of EVENTS) {
      const res = await chat({ event, message: '测试', scene: 'sakura' });
      expect(res.status).toBe(200);
      expect(res.body.reply.length).toBeGreaterThan(4);
      expect(res.body.source).toBe('library');
    }
  });

  it('情绪关键词命中对应回应', async () => {
    const res = await chat({ message: '我好累，学不进去了' });
    expect(res.body.source).toBe('library');
    expect(res.body.reply).toMatch(/累|休息/);
  });

  it('方法类提问命中方法建议', async () => {
    const res = await chat({ message: '注意力不集中，效率很低怎么办' });
    expect(res.body.reply).toMatch(/25 分钟|回顾|拆/);
  });

  it('空消息返回 400', async () => {
    const res = await chat({ message: '   ' });
    expect(res.status).toBe(400);
  });

  it('历史结构非法返回 400', async () => {
    const res = await chat({ message: '你好', history: 'not-array' });
    expect(res.status).toBe(400);
  });

  it('非法场景返回 400', async () => {
    const res = await chat({ message: '你好', scene: 'moon' });
    expect(res.status).toBe(400);
  });

  it('SSE 流式返回 text/event-stream 并以 done 收尾', async () => {
    const res = await chat({ message: '你好', stream: true });
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('data:');
    expect(res.text).toContain('"done":true');
    expect(res.text).toContain('"delta"');
  });
});

describe('LLM 按用户配置 /api/ai/llm', () => {
  const put = (body, tk = token) => request(app).put('/api/ai/llm').set('Authorization', `Bearer ${tk}`).send(body);
  const get = (tk = token) => request(app).get('/api/ai/llm').set('Authorization', `Bearer ${tk}`);
  const del = (id, tk = token) => request(app).delete(`/api/ai/llm/${id}`).set('Authorization', `Bearer ${tk}`);
  let otherToken; // 第二个用户，用于隔离性验证

  it('未登录返回 401', async () => {
    expect((await request(app).get('/api/ai/llm')).status).toBe(401);
  });

  it('新用户默认没有任何 Key 配置（configured=false，历史为空）', async () => {
    const reg = await registerUser({ username: 'ai_fresh' });
    otherToken = reg.body.token;
    const res = await get(otherToken);
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);
    expect(res.body.active).toBeNull();
    expect(res.body.history).toEqual([]);
    const cfg = await request(app).get('/api/ai/config').set('Authorization', `Bearer ${otherToken}`);
    expect(cfg.body.llmEnabled).toBe(false);
  });

  it('空 apiKey 且从未配置过返回 400', async () => {
    expect((await put({ apiKey: '  ' })).status).toBe(400);
  });

  it('非法 baseUrl 返回 400', async () => {
    expect((await put({ apiKey: 'sk-test-12345678', baseUrl: 'not-a-url' })).status).toBe(400);
  });

  it('保存后成为本人生效配置，Key 打码，llmEnabled 变 true', async () => {
    const saved = await put({ apiKey: 'sk-abcdef1234567890abcd', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' });
    expect(saved.status).toBe(200);
    expect(saved.body.configured).toBe(true);
    expect(saved.body.active.keyMasked).toMatch(/^sk-ab\*\*\*\*abcd$/);
    expect(saved.body.active.keyMasked).not.toContain('abcdef1234567890');
    expect(saved.body.active.keyMasked).not.toBe('sk-abcdef1234567890abcd'); // 明文绝不回传

    const status = await get();
    expect(status.body.configured).toBe(true);
    expect(status.body.history).toHaveLength(1);
    expect(JSON.stringify(status.body)).not.toContain('abcdef1234567890');

    const cfg = await request(app).get('/api/ai/config').set('Authorization', `Bearer ${token}`);
    expect(cfg.body.llmEnabled).toBe(true);
    expect(cfg.body.model).toBe('deepseek-chat');
  });

  it('只换模型/地址时无需重新粘贴 Key，沿用当前 Key', async () => {
    const before = (await get()).body.active.keyMasked;
    const res = await put({ model: 'deepseek-reasoner' });
    expect(res.status).toBe(200);
    expect(res.body.active.model).toBe('deepseek-reasoner');
    expect(res.body.active.keyMasked).toBe(before); // Key 未变
    expect(res.body.configured).toBe(true);
  });

  it('用户之间互相不可见：乙看不到甲的历史，也删不掉甲的记录', async () => {
    const mine = await get();
    const theirs = await get(otherToken);
    expect(mine.body.history.length).toBeGreaterThan(0);
    expect(theirs.body.history).toHaveLength(0); // 乙的账号里没有甲的任何记录

    const myActiveId = mine.body.active.id;
    const stolen = await del(myActiveId, otherToken);
    expect(stolen.status).toBe(400); // 无权删除
    expect((await get()).body.history.length).toBeGreaterThan(0); // 甲的记录还在
  });

  it('删除生效那条后回落到上一条历史；全部删光则回到规则语库保底', async () => {
    // 再存一条，使历史为 [新的, 旧的]，生效 = 新的
    const saved = await put({ apiKey: 'sk-zzzz999988887777aaa', model: 'deepseek-chat' });
    const activeId = saved.body.active.id;
    let status = await get();
    expect(status.body.history).toHaveLength(3);
    expect(status.body.history[0].keyMasked).toMatch(/^sk-zz\*\*\*\*7aaa$/); // 新→旧排列

    let res = await del(activeId);
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(true); // 回落到上一条
    expect(res.body.active.keyMasked).toMatch(/^sk-ab\*\*\*\*abcd$/);

    // 逐条删光
    for (const row of res.body.history) {
      res = await del(row.id);
    }
    expect(res.body.configured).toBe(false);
    expect(res.body.active).toBeNull();
    expect(res.body.history).toEqual([]);
    const cfg = await request(app).get('/api/ai/config').set('Authorization', `Bearer ${token}`);
    expect(cfg.body.llmEnabled).toBe(false);
  });

  it('测试连接优先使用表单里未保存的候选配置', async () => {
    const originalFetch = globalThis.fetch;
    const seen = {};
    globalThis.fetch = async (url, opts) => {
      seen.url = url;
      seen.auth = opts?.headers?.Authorization;
      seen.model = JSON.parse(opts.body).model;
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '连接正常' } }] }),
        text: async () => '',
      };
    };

    try {
      const res = await request(app)
        .post('/api/ai/llm/test')
        .set('Authorization', `Bearer ${token}`)
        .send({ apiKey: 'sk-candidate-99998888', baseUrl: 'https://example.com/v1', model: 'candidate-model' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.tested.model).toBe('candidate-model');
      expect(seen.url).toBe('https://example.com/v1/chat/completions');
      expect(seen.auth).toBe('Bearer sk-candidate-99998888');
      expect(seen.model).toBe('candidate-model');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
