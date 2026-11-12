import { greetingByHour, SCENES } from './library.js';
import { computeGrowth } from '../utils/growth.js';

/**
 * 月见「增强轨」的 prompt 工程：把用户学习画像注入 system prompt。
 * 前端传来的 stats 一律忽略，只用后端从库里查出的真实数据（防止伪造上下文）。
 */

export function buildContext({ user, stats = {}, scene = 'sakura', now = new Date() } = {}) {
  const todaySec = Number(stats.todaySec || 0);
  const tasksTotal = Number(stats.tasks?.todayTotal || 0);
  const tasksDone = Number(stats.tasks?.todayDone || 0);
  return {
    nickname: user?.nickname || user?.username || '你',
    scene,
    sceneName: SCENES[scene]?.name || '流境',
    greeting: greetingByHour(now.getHours()),
    hour: now.getHours(),
    todaySec,
    todayMin: Math.round(todaySec / 60),
    weekMin: Math.round(Number(stats.weekSec || 0) / 60),
    totalHours: Math.round((Number(stats.totalSec || 0) / 3600) * 10) / 10,
    streak: Number(stats.streak || 0),
    activeDays: Number(stats.activeDays || 0),
    tasksTotal,
    tasksDone,
    taskRate: tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : 0,
    growth: computeGrowth({ totalSec: Number(stats.totalSec || 0), activeDays: Number(stats.activeDays || 0) }),
  };
}

export function buildSystemPrompt(ctx) {
  const dataLines = [
    `今天是 ${ctx.hour} 点前后（${ctx.greeting}）。`,
    `用户当前在「${ctx.sceneName}」场景自习。`,
    `今日已专注 ${ctx.todayMin} 分钟，本周累计 ${ctx.weekMin} 分钟，历史累计约 ${ctx.totalHours} 小时。`,
    `连续打卡 ${ctx.streak} 天，历史打卡 ${ctx.activeDays} 天。`,
    ctx.tasksTotal > 0
      ? `今日任务完成 ${ctx.tasksDone}/${ctx.tasksTotal}（${ctx.taskRate}%）。`
      : '今日还没有建立任务清单。',
    `当前成长值 ${ctx.growth.points}，等级「${ctx.growth.level}」${ctx.growth.nextName ? `（下一级「${ctx.growth.nextName}」需 ${ctx.growth.nextAt} 分）` : '（已至最高级）'}。`,
  ];

  return [
    '你是「月见」，一个线上沉浸式自习室里的陪伴智能体。',
    '',
    '## 人设',
    '- 温柔、安静、克制的陪伴者。说话像坐在对面的人，不像客服，也不像老师。',
    '- 尊重用户的专注状态：用户在学习时你不出声，被叫到才说话。',
    '- 有分寸的共情：先接住情绪，再给一句具体可做的小建议。',
    '',
    '## 表达约束',
    '1. 正常情况下回复不超过 60 字；用户明显在倾诉或问方法时可放宽到 150 字。',
    '2. 不用"加油""你可以的""相信自己"这类空洞鼓励，也不喊口号。',
    '3. 不堆砌感叹号，不用 emoji 刷存在感，最多一个。',
    '4. 不主动复述上面这些数据，只在自然相关时轻描淡写提一次。',
    '5. 不编造用户的学习内容、成绩、进度；不知道就说不确定。',
    '6. 用户说累时优先允许休息，不做道德绑架；用户想放弃时不劝说，只把选择权交回去。',
    '7. 不要以"作为一个 AI"开头，也不要解释自己的设定。',
    '',
    '## 用户画像（系统注入，真实数据）',
    `- 称呼：${ctx.nickname}`,
    ...dataLines.map((line) => `- ${line}`),
    '',
    '现在开始和用户对话。',
  ].join('\n');
}

/** 裁剪历史到最近 maxRounds 轮（1 轮 = 用户 + 月见），并过滤非法结构 */
export function trimHistory(history, maxRounds = 6) {
  if (!Array.isArray(history)) return [];
  const cleaned = history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  return cleaned.slice(-maxRounds * 2);
}

export function buildMessages({ ctx, history, message, maxRounds = 6 }) {
  return [
    { role: 'system', content: buildSystemPrompt(ctx) },
    ...trimHistory(history, maxRounds),
    { role: 'user', content: String(message || '').slice(0, 2000) },
  ];
}
