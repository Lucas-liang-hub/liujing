import { Router } from 'express';
import { config } from '../config/index.js';
import { recordDao, statsDao, userDao } from '../dao/index.js';
import { buildContext } from '../ai/prompt.js';
import { chatOnce } from '../ai/llm.js';
import { getUserLlmConfig, llmDefaults } from '../ai/runtime.js';
import { replyStream, replyText, normalizeEvent } from '../ai/service.js';
import { asyncHandler, badRequest } from '../middleware/error.js';
import { addDays, computeStreak, startOfDay, startOfMonth, startOfWeek, toLocalDateTime } from '../utils/time.js';
import { validateScene } from '../middleware/validate.js';
import { llmKeyDao } from '../dao/index.js';

const router = Router();

/** Key 打码：只露前 5 后 4，中间 **** */
function maskKey(key) {
  if (!key) return null;
  if (key.length <= 12) return `${key.slice(0, 3)}****`;
  return `${key.slice(0, 5)}****${key.slice(-4)}`;
}

/** 从数据库读取真实画像，忽略前端传来的 stats（防伪造上下文） */
async function loadContext(userId, scene) {
  const now = new Date();
  const dayStart = startOfDay(now);
  const tomorrow = addDays(dayStart, 1);
  const [user, today, week, all, dateKeys] = await Promise.all([
    userDao.findById(userId),
    statsDao.totals(userId, toLocalDateTime(dayStart), toLocalDateTime(tomorrow)),
    statsDao.totals(userId, toLocalDateTime(startOfWeek(now)), toLocalDateTime(tomorrow)),
    statsDao.totals(userId, toLocalDateTime(new Date('2000-01-01T00:00:00')), toLocalDateTime(tomorrow)),
    recordDao.listDateKeys(userId),
  ]);

  // 今日任务完成情况复用日聚合
  const daily = await statsDao.dailyTotals(userId, toLocalDateTime(dayStart), toLocalDateTime(tomorrow));
  const tasks = { todayTotal: daily[0]?.tasksTotal || 0, todayDone: daily[0]?.tasksDone || 0 };

  return buildContext({
    user,
    scene: scene || user?.prefs?.scene || 'sakura',
    now,
    stats: {
      todaySec: today.sec,
      weekSec: week.sec,
      totalSec: all.sec,
      streak: computeStreak(dateKeys, now),
      activeDays: dateKeys.length,
      tasks,
    },
  });
}

function sanitizeHistory(history) {
  if (history === undefined) return [];
  if (!Array.isArray(history)) throw badRequest('history 必须为数组');
  return history.slice(-12);
}

/** 对外输出的 Key 一律打码，明文永不离开后端 */
function publicLlm(row) {
  return {
    id: row.id,
    baseUrl: row.baseUrl,
    model: row.model,
    keyMasked: maskKey(row.apiKey),
    createdAt: row.createdAt,
  };
}

/** 校验表单里的 baseUrl（可选字段） */
function parseBaseUrl(raw) {
  if (!raw) return '';
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('protocol');
  } catch {
    throw badRequest('baseUrl 必须是合法的 http(s) 地址');
  }
  return raw;
}

/** 当前月见的运行模式，前端用来显示"规则陪伴中 / 增强对话已启用"（按登录用户各自的 Key 判定） */
router.get('/config', asyncHandler(async (req, res) => {
  const cfg = await getUserLlmConfig(req.user.id);
  res.json({
    llmEnabled: Boolean(cfg),
    model: cfg?.model || null,
    maxHistoryRounds: config.limits.maxHistoryRounds,
  });
}));

/** 当前用户的 Key 配置状态与历史（全部打码，且只含本人记录） */
router.get('/llm', asyncHandler(async (req, res) => {
  const [rows, active] = await Promise.all([llmKeyDao.listByUser(req.user.id), getUserLlmConfig(req.user.id)]);
  res.json({
    configured: Boolean(active),
    defaults: llmDefaults(),
    active: active ? publicLlm(active) : null,
    history: rows.map(publicLlm),
  });
}));

/** 保存并启用：写入一条属于当前用户的新历史，立即生效（历史自动裁剪，最多 10 条） */
router.put(
  '/llm',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
    const baseUrl = parseBaseUrl(typeof body.baseUrl === 'string' ? body.baseUrl.trim() : '');
    const model = typeof body.model === 'string' ? body.model.trim() : '';

    // 只换模型/地址时允许不重新粘贴 Key：沿用当前生效的那把
    const current = await getUserLlmConfig(req.user.id);
    if (!apiKey && !current) throw badRequest('apiKey 不能为空');
    if (apiKey && (apiKey.length < 8 || apiKey.length > 200)) throw badRequest('apiKey 长度不合法');
    if (model && model.length > 100) throw badRequest('model 过长');

    const saved = await llmKeyDao.add(req.user.id, {
      apiKey: apiKey || current.apiKey,
      baseUrl: baseUrl || current?.baseUrl || llmDefaults().baseUrl,
      model: model || current?.model || llmDefaults().model,
    });
    res.json({ configured: true, active: publicLlm(saved) });
  }),
);

/** 删除本人的一条 Key 历史；若删的是生效那条，自动回落到倒数第二条，全删光则回到规则语库保底 */
router.delete(
  '/llm/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('id 不合法');
    const removed = await llmKeyDao.removeOwned(req.user.id, id);
    if (!removed) throw badRequest('记录不存在或无权删除');
    const [rows, active] = await Promise.all([llmKeyDao.listByUser(req.user.id), getUserLlmConfig(req.user.id)]);
    res.json({
      configured: Boolean(active),
      active: active ? publicLlm(active) : null,
      history: rows.map(publicLlm),
    });
  }),
);

/** 连通性测试：优先用请求里带的「尚未保存」的表单值，缺省回落到本人当前生效配置 */
router.post(
  '/llm/test',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const current = await getUserLlmConfig(req.user.id);

    const candidate = {};
    if (typeof body.apiKey === 'string' && body.apiKey.trim()) candidate.apiKey = body.apiKey.trim();
    const baseUrl = parseBaseUrl(typeof body.baseUrl === 'string' ? body.baseUrl.trim() : '');
    if (baseUrl) candidate.baseUrl = baseUrl;
    if (typeof body.model === 'string' && body.model.trim()) candidate.model = body.model.trim();

    const effective = {
      apiKey: candidate.apiKey || current?.apiKey || '',
      baseUrl: candidate.baseUrl || current?.baseUrl || llmDefaults().baseUrl,
      model: candidate.model || current?.model || llmDefaults().model,
    };
    if (!effective.apiKey) throw badRequest('尚未配置 apiKey');

    try {
      const reply = await chatOnce([{ role: 'user', content: '请只回复四个字：连接正常' }], effective);
      res.json({ ok: true, reply: reply.slice(0, 60), tested: { model: effective.model, baseUrl: effective.baseUrl } });
    } catch (err) {
      res.json({ ok: false, error: err.message, tested: { model: effective.model, baseUrl: effective.baseUrl } });
    }
  }),
);

/**
 * POST /api/ai/chat
 * body: { message?, event?, history?, scene?, stream? }
 * 响应：JSON { reply, source, event } 或 SSE（stream=true）
 */
router.post(
  '/chat',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const event = normalizeEvent(body.event);
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (event === 'chat' && !message) throw badRequest('消息不能为空');
    if (message.length > 2000) throw badRequest('消息过长（上限 2000 字）');

    const history = sanitizeHistory(body.history);
    const scene = body.scene ? validateScene(body.scene) : undefined;
    const ctx = await loadContext(req.user.id, scene);
    // 只用当前登录用户自己配置的 Key；没配则月见走规则语库保底
    const llmCfg = await getUserLlmConfig(req.user.id);
    const payload = { event, message, history, ctx, maxRounds: config.limits.maxHistoryRounds, llmCfg };

    if (body.stream !== true) {
      const result = await replyText(payload);
      return res.json(result);
    }

    // SSE 流式输出
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    let closed = false;
    req.on('close', () => {
      closed = true;
    });

    let source = llmCfg ? 'llm' : 'library';
    try {
      for await (const chunk of replyStream(payload)) {
        if (closed) break;
        source = chunk.source || source;
        res.write(`data: ${JSON.stringify({ delta: chunk.delta, source: chunk.source, degraded: chunk.degraded })}\n\n`);
      }
      if (!closed) {
        res.write(`data: ${JSON.stringify({ done: true, source, event })}\n\n`);
        res.end();
      }
    } catch (err) {
      console.error('[ai] SSE 输出异常:', err.message);
      if (!closed) {
        res.write(`data: ${JSON.stringify({ error: '月见暂时说不了话，请稍后再试' })}\n\n`);
        res.end();
      }
    }
  }),
);

export default router;
