import { Router } from 'express';
import { config } from '../config/index.js';
import { recordDao, statsDao, userDao } from '../dao/index.js';
import { buildContext } from '../ai/prompt.js';
import { isLlmEnabled, chatOnce } from '../ai/llm.js';
import { currentLlmConfigSync } from '../ai/runtime.js';
import { replyStream, replyText, normalizeEvent } from '../ai/service.js';
import { asyncHandler, badRequest } from '../middleware/error.js';
import { addDays, computeStreak, startOfDay, startOfMonth, startOfWeek, toLocalDateTime } from '../utils/time.js';
import { validateScene } from '../middleware/validate.js';
import { currentLlmConfig, setLlmOverride, clearLlmOverride, llmSource } from '../ai/runtime.js';

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

/** 当前月见的运行模式，前端用来显示"规则陪伴中 / 增强对话已启用" */
router.get('/config', (req, res) => {
  res.json({
    llmEnabled: isLlmEnabled(),
    model: isLlmEnabled() ? currentLlmConfigSync().model : null,
    maxHistoryRounds: config.limits.maxHistoryRounds,
  });
});

/** LLM 运行时配置状态（Key 只回打码值） */
router.get('/llm', asyncHandler(async (req, res) => {
  const cfg = await currentLlmConfig();
  res.json({
    configured: Boolean(cfg.apiKey),
    source: llmSource(),
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    keyMasked: maskKey(cfg.apiKey),
  });
}));

/** 热切换 LLM 配置（设置页随时换 Key / 服务商，无需重启） */
router.put(
  '/llm',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
    const baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl.trim() : '';
    const model = typeof body.model === 'string' ? body.model.trim() : '';

    if (!apiKey) throw badRequest('apiKey 不能为空');
    if (apiKey.length < 8 || apiKey.length > 200) throw badRequest('apiKey 长度不合法');
    if (baseUrl) {
      try {
        const u = new URL(baseUrl);
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error('protocol');
      } catch {
        throw badRequest('baseUrl 必须是合法的 http(s) 地址');
      }
    }
    if (model && model.length > 100) throw badRequest('model 过长');

    const saved = await setLlmOverride({
      apiKey,
      baseUrl: baseUrl || undefined,
      model: model || undefined,
    });
    res.json({
      configured: true,
      source: 'runtime',
      baseUrl: saved.baseUrl,
      model: saved.model,
      keyMasked: maskKey(saved.apiKey),
    });
  }),
);

/** 清除运行时配置，回落 .env */
router.delete(
  '/llm',
  asyncHandler(async (req, res) => {
    await clearLlmOverride();
    const cfg = await currentLlmConfig();
    res.json({
      configured: Boolean(cfg.apiKey),
      source: 'env',
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      keyMasked: maskKey(cfg.apiKey),
    });
  }),
);

/** 连通性测试：用当前配置发一条最小请求，直接暴露 Key/地址/模型是否可用 */
router.post(
  '/llm/test',
  asyncHandler(async (req, res) => {
    const cfg = await currentLlmConfig();
    if (!cfg.apiKey) throw badRequest('尚未配置 apiKey');
    try {
      const reply = await chatOnce([{ role: 'user', content: '请只回复四个字：连接正常' }]);
      res.json({ ok: true, reply: reply.slice(0, 60) });
    } catch (err) {
      res.json({ ok: false, error: err.message });
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
    const payload = { event, message, history, ctx, maxRounds: config.limits.maxHistoryRounds };

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

    let source = isLlmEnabled() ? 'llm' : 'library';
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
