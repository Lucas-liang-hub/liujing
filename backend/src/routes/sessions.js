import { Router } from 'express';
import { config } from '../config/index.js';
import { recordDao } from '../dao/index.js';
import { asyncHandler, badRequest } from '../middleware/error.js';
import { parseTime, toLocalDateTime } from '../utils/time.js';
import { toCount, validateMode, validateScene } from '../middleware/validate.js';

const router = Router();

const MAX_SESSION_SEC = 12 * 60 * 60; // 单次上限 12 小时，防挂机脏数据
const MIN_SESSION_SEC = 60; // 少于 1 分钟不入库

function sanitizeTasks(tasks) {
  if (tasks === undefined || tasks === null) return [];
  if (!Array.isArray(tasks)) throw badRequest('tasks 必须为数组');
  if (tasks.length > 50) throw badRequest('任务数量不能超过 50 条');
  return tasks.map((t) => {
    if (!t || typeof t !== 'object') throw badRequest('任务格式不正确');
    const title = String(t.title ?? '').trim();
    if (!title) throw badRequest('任务标题不能为空');
    if (title.length > 100) throw badRequest('任务标题最多 100 字');
    return { title, done: Boolean(t.done) };
  });
}

// POST /api/sessions —— 上报一次自习记录
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const scene = validateScene(body.scene);
    const mode = validateMode(body.mode);
    const tasks = sanitizeTasks(body.tasks);

    const started = parseTime(body.startedAt);
    const ended = parseTime(body.endedAt);
    if (!started || !ended) throw badRequest('startedAt / endedAt 格式不正确');
    if (ended.getTime() <= started.getTime()) throw badRequest('结束时间必须晚于开始时间');

    // 以起止时间戳回算为准，前端上报值只做一致性校验（容忍 ±60s）
    const derived = Math.round((ended.getTime() - started.getTime()) / 1000);
    if (body.durationSec !== undefined) {
      const reported = Number(body.durationSec);
      if (!Number.isFinite(reported) || reported < 0) throw badRequest('durationSec 不合法');
      if (Math.abs(reported - derived) > config.limits.durationTolerance) {
        throw badRequest('上报时长与起止时间不一致，请检查计时状态');
      }
    }
    if (derived < MIN_SESSION_SEC) throw badRequest('单次自习不足 1 分钟，不记录');
    if (derived > MAX_SESSION_SEC) throw badRequest('单次自习超过 12 小时，疑似异常记录');

    const done = tasks.filter((t) => t.done).length;
    const record = await recordDao.insert({
      userId: req.user.id,
      scene,
      mode,
      startedAt: toLocalDateTime(started),
      endedAt: toLocalDateTime(ended),
      durationSec: derived,
      tasksTotal: toCount(body.tasksTotal ?? tasks.length, 'tasksTotal'),
      tasksDone: toCount(body.tasksDone ?? done, 'tasksDone'),
      tasks,
    });

    res.status(201).json({ record });
  }),
);

// GET /api/sessions?page=1&pageSize=20
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      recordDao.listByUser(req.user.id, { limit: pageSize, offset }),
      recordDao.countByUser(req.user.id),
    ]);

    res.json({ items, total, page, pageSize, hasMore: offset + items.length < total });
  }),
);

export default router;
