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

describe('LLM 运行时配置 /api/ai/llm', () => {
  const put = (body) => request(app).put('/api/ai/llm').set('Authorization', `Bearer ${token}`).send(body);
  const get = () => request(app).get('/api/ai/llm').set('Authorization', `Bearer ${token}`);
  const del = () => request(app).delete('/api/ai/llm').set('Authorization', `Bearer ${token}`);

  it('未登录返回 401', async () => {
    expect((await request(app).get('/api/ai/llm')).status).toBe(401);
  });

  it('空 apiKey 返回 400', async () => {
    expect((await put({ apiKey: '  ' })).status).toBe(400);
  });

  it('非法 baseUrl 返回 400', async () => {
    expect((await put({ apiKey: 'sk-test-12345678', baseUrl: 'not-a-url' })).status).toBe(400);
  });

  it('保存后状态为 runtime 且 Key 打码，llmEnabled 变 true', async () => {
    const saved = await put({ apiKey: 'sk-abcdef1234567890abcd', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' });
    expect(saved.status).toBe(200);
    expect(saved.body.source).toBe('runtime');
    expect(saved.body.keyMasked).toMatch(/^sk-ab\*\*\*\*abcd$/);
    expect(saved.body.keyMasked).not.toContain('abcdef1234567890');

    const status = await get();
    expect(status.body.configured).toBe(true);
    expect(status.body.source).toBe('runtime');
    expect(status.body.model).toBe('deepseek-chat');

    const cfg = await request(app).get('/api/ai/config').set('Authorization', `Bearer ${token}`);
    expect(cfg.body.llmEnabled).toBe(true);
  });

  it('删除后回落 env，llmEnabled 回到 .env 的状态', async () => {
    const res = await del();
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('env');
    const cfg = await request(app).get('/api/ai/config').set('Authorization', `Bearer ${token}`);
    expect(cfg.body.llmEnabled).toBe(false); // 测试环境未配 .env Key
  });
});
