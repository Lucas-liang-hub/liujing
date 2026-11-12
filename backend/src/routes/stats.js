import { Router } from 'express';
import { recordDao, statsDao } from '../dao/index.js';
import { asyncHandler } from '../middleware/error.js';
import {
  addDays,
  computeStreak,
  recentDateKeys,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toLocalDateTime,
} from '../utils/time.js';
import { computeGrowth } from '../utils/growth.js';

const router = Router();

/**
 * GET /api/stats/summary
 * 一次返回首页/统计页所需全部聚合：日/周/月时长、累计、连续打卡、今日任务、近 14 天、场景分布
 */
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const now = new Date();
    const dayStart = startOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);
    const begin = new Date('2000-01-01T00:00:00');
    const tomorrow = addDays(dayStart, 1);

    const [today, week, month, all, daily, scenes, dateKeys, todayTaskInfo] = await Promise.all([
      statsDao.totals(userId, toLocalDateTime(dayStart), toLocalDateTime(tomorrow)),
      statsDao.totals(userId, toLocalDateTime(weekStart), toLocalDateTime(tomorrow)),
      statsDao.totals(userId, toLocalDateTime(monthStart), toLocalDateTime(tomorrow)),
      statsDao.totals(userId, toLocalDateTime(begin), toLocalDateTime(tomorrow)),
      statsDao.dailyTotals(userId, toLocalDateTime(addDays(dayStart, -13)), toLocalDateTime(tomorrow)),
      statsDao.sceneTotals(userId, toLocalDateTime(addDays(dayStart, -29))),
      recordDao.listDateKeys(userId),
      statsDao.todayTasks(userId, toLocalDateTime(dayStart), toLocalDateTime(tomorrow)),
    ]);

    // 近 14 天补零，前端可直接画柱状图
    const dailyMap = new Map(daily.map((d) => [d.date, d]));
    const dailySeries = recentDateKeys(14, now).map((date) => {
      const hit = dailyMap.get(date);
      return {
        date,
        sec: hit?.sec || 0,
        sessions: hit?.sessions || 0,
        tasksDone: hit?.tasksDone || 0,
        tasksTotal: hit?.tasksTotal || 0,
        cleared: hit?.cleared || 0,
      };
    });

    // 今日任务率以「最后一条快照」为准（反映当前清单状态）
    const taskRate = todayTaskInfo.tasksTotal ? todayTaskInfo.tasksDone / todayTaskInfo.tasksTotal : 0;

    res.json({
      todaySec: today.sec,
      todaySessions: today.sessions,
      weekSec: week.sec,
      monthSec: month.sec,
      totalSec: all.sec,
      totalSessions: all.sessions,
      streak: computeStreak(dateKeys, now),
      activeDays: dateKeys.length,
      growth: computeGrowth({ totalSec: all.sec, activeDays: dateKeys.length }),
      tasks: {
        todayTotal: todayTaskInfo.tasksTotal,
        todayDone: todayTaskInfo.tasksDone,
        todayRate: Math.round(taskRate * 100) / 100,
        cleared: todayTaskInfo.cleared, // 今天任一时点曾全部完成
      },
      daily: dailySeries,
      scenes,
      generatedAt: toLocalDateTime(now),
    });
  }),
);

/**
 * GET /api/stats/heatmap?days=90
 * 7(周一→周日) × 24 小时矩阵，值=累计专注秒数
 */
router.get(
  '/heatmap',
  asyncHandler(async (req, res) => {
    const days = Math.min(365, Math.max(7, Number.parseInt(req.query.days, 10) || 90));
    const now = new Date();
    const from = addDays(startOfDay(now), -(days - 1));
    const rows = await statsDao.heatmap(req.user.id, toLocalDateTime(from));

    const cells = Array.from({ length: 7 }, (_, weekday) =>
      Array.from({ length: 24 }, (_, hour) => ({ weekday, hour, sec: 0 })),
    );
    for (const row of rows) {
      const wd = Math.min(6, Math.max(0, row.weekday));
      const hr = Math.min(23, Math.max(0, row.hour));
      cells[wd][hr].sec += row.sec;
    }

    const flat = cells.flat();
    res.json({
      days,
      maxSec: flat.reduce((max, cell) => Math.max(max, cell.sec), 0),
      cells: flat,
    });
  }),
);

export default router;
