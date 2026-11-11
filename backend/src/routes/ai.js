import { Router } from 'express';
import { config } from '../config/index.js';
import { recordDao, statsDao, userDao } from '../dao/index.js';
import { buildContext } from '../ai/prompt.js';
import { isLlmEnabled } from '../ai/llm.js';
import { replyStream, replyText, normalizeEvent } from '../ai/service.js';
import { asyncHandler, badRequest } from '../middleware/error.js';
import { addDays, computeStreak, startOfDay, startOfMonth, startOfWeek, toLocalDateTime } from '../utils/time.js';
import { validateScene } from '../middleware/validate.js';

const router = Router();

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
    model: isLlmEnabled() ? config.llm.model : null,
    maxHistoryRounds: config.limits.maxHistoryRounds,
  });
});

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
