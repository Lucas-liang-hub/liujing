/**
 * 月见「保底轨」：规则语库。
 * 零外部依赖，无网络无 API Key 时系统依然完整可用（技术方案 5.1）。
 * 文案基调：温柔、安静、克制、不聒噪，尊重用户正在专注的状态。
 */

export const SCENES = {
  sakura: { name: '樱花漫舞', short: '樱花' },
  star: { name: '星河长夜', short: '星夜' },
  frost: { name: '霜花初凝', short: '霜花' },
  firefly: { name: '萤火微光', short: '萤火' },
  deepsea: { name: '深海静流', short: '深海' },
  autumn: { name: '秋日慢行', short: '秋日' },
};

export const EVENTS = ['start', 'finish', 'idle', 'break', 'streak', 'allTasks', 'comeback', 'chat'];

const LINES = {
  start: [
    '开始了。{sceneName}已经为你亮起来，接下来的时间只属于你和眼前这一页。',
    '{greeting}。不用急着进入状态，先把书翻开，剩下的交给时间。',
    '我在这儿。你专注的时候我不会出声，需要的时候再叫我。',
    '又一个开始了。今天的你已经比昨天更靠近想要的那个自己一点。',
    '先把手机翻过去，我们一起安静 {focusMin} 分钟。',
  ],
  finish: [
    '辛苦了，这段时间你一共专注了 {todayMin} 分钟。起身走两步，喝口水。',
    '结束了。{sceneName}陪你走完了这一段，把它记下来，它不会白费。',
    '收工。今天的每一分钟都已经存进你的记录里，明天回来它们还在。',
    '累了吧。允许自己休息，休息也是学习的一部分。',
  ],
  idle: [
    '已经连续专注很久了，肩颈还撑得住吗？起身活动一下，我等你回来。',
    '眼睛也该歇一歇了。看看远处，二十秒就好。',
    '这个时间点容易犯困，要不要换成霜花场景，让节奏慢一点？',
    '记得喝水。专注很重要，但你不必勉强自己一直紧绷。',
  ],
  break: [
    '休息一下吧，我给计时器按了暂停，剩下的时间不会跑掉。',
    '停下来不是放弃，是为了走得更远一点。',
    '去窗边站一会儿，回来我们继续。',
  ],
  streak: [
    '连续 {streak} 天了。你可能没觉得有什么变化，但数据记得。',
    '{streak} 天，这个数字很难得。今天也把它守住吧。',
    '又见面了，第 {streak} 天。习惯大概就是这样长出来的。',
  ],
  allTasks: [
    '任务全部划掉了。今天该做的你都做了，可以安心收工。',
    '清单清空了。这种踏实的疲惫感，就是今天最好的收获。',
    '都完成了。要不要把这份心情记下来？下次动摇的时候看看它。',
  ],
  comeback: [
    '你回来了。中间空了一段没关系，重新开始的时间永远是现在。',
    '有几天没见，我没有催你。今天能坐下来，就已经很好。',
    '断掉的连续天数可以重新长回来，不着急。',
  ],
  chat: [
    '我在听。你慢慢说。',
    '嗯，我记下了。要不要先做一件最小的、五分钟就能完成的事？',
    '不用把状态调整到完美才开始，开始了状态会自己来。',
    '如果现在很累，就先休息十分钟。我不会因为你不学而失望。',
    '你已经在做了，这比"准备好再做"要难得多。',
  ],
};

/** 场景专属文案：让陪伴语"看得见当前的氛围" */
const SCENE_LINES = {
  sakura: {
    start: ['樱花开得很轻，落下来的时候几乎没有声音。就像现在这样开始吧。'],
    finish: ['花瓣落了满地。你今天的专注也是一点点攒起来的。'],
    idle: ['抬头看看飘着的花瓣，让眼睛离开屏幕一会儿。'],
  },
  star: {
    start: ['星星已经挂上去了。今晚的安静，够你写完这一章。'],
    finish: ['星轨走完了一圈。你今天也在自己的轨道上走了一段。'],
    idle: ['抬头看看星空吧，屏幕之外还有很大的世界。'],
  },
  frost: {
    start: ['霜花慢慢结起来，需要很久。你的进度也一样，慢一点没关系。'],
    finish: ['霜结了一层，又化了一点。时间就是这样留下的。'],
    idle: ['天冷了，手边有热水吗？'],
  },
  firefly: {
    start: ['萤火虫亮起来了，一只两只。微弱的光也能照亮一小片地方。'],
    finish: ['萤火散了。你那点不肯熄灭的劲头，我看见了。'],
    idle: ['光点在暗处慢慢飞。你也该让眼睛休息一下了。'],
  },
  deepsea: {
    start: ['潜下去了。深海很安静，只剩你自己的呼吸和翻页的声音。'],
    finish: ['上浮。这段安静的时间，海底替你收好了。'],
    idle: ['憋得太久了，浮上来换口气吧。'],
  },
  autumn: {
    start: ['风把叶子吹下来了，一片接一片。我们就照这个节奏来。'],
    finish: ['这一段落下了。秋天就是这样，一点点收起来。'],
    idle: ['风有点凉，起来走走，别一直坐着。'],
  },
};

/** 时间问候语 */
export function greetingByHour(hour) {
  if (hour < 5) return '夜深了';
  if (hour < 9) return '早';
  if (hour < 12) return '上午好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  if (hour < 23) return '晚上好';
  return '夜深了';
}

/** 取某事件下可用的全部文案（场景专属优先） */
export function listLines(event, scene) {
  const base = LINES[event] || LINES.chat;
  const extra = SCENE_LINES[scene]?.[event] || [];
  return [...extra, ...base];
}

/** 模板变量替换（缺省值保证任何时候都能出句子） */
export function renderTemplate(line, ctx = {}) {
  const vars = {
    greeting: ctx.greeting || greetingByHour(new Date().getHours()),
    sceneName: ctx.sceneName || SCENES[ctx.scene]?.name || '这里',
    todayMin: Math.max(0, Math.round(ctx.todaySec / 60) || 0),
    streak: ctx.streak || 1,
    nickname: ctx.nickname || '你',
    focusMin: ctx.focusMin || 25,
  };
  return line.replace(/\{(\w+)\}/g, (match, key) => (vars[key] === undefined ? match : String(vars[key])));
}

/**
 * 随机取一条（可排除刚说过的，避免重复）
 * @param {{event: string, scene?: string, ctx?: object, exclude?: string[]}} opts
 */
export function pickLine({ event, scene, ctx = {}, exclude = [] } = {}) {
  const pool = listLines(event, scene).filter((line) => !exclude.includes(line));
  const usable = pool.length ? pool : listLines(event, scene);
  const picked = usable[Math.floor(Math.random() * usable.length)];
  return renderTemplate(picked, ctx);
}

/** 确定性取用（测试与"每日一句"场景） */
export function pickLineAt({ event, scene, ctx = {}, index = 0 } = {}) {
  const pool = listLines(event, scene);
  return renderTemplate(pool[((index % pool.length) + pool.length) % pool.length], ctx);
}

/** 无 LLM 时的聊天兜底：关键词命中 → 情绪/方法类回应 */
const CHAT_RULES = [
  { keys: ['累', '困', '疲惫', '撑不住', '没力气'], reply: '累了就先停下来。你现在需要的不是更强的意志，是十分钟的休息。' },
  { keys: ['焦虑', '慌', '来不及', '赶不上', '怕'], reply: '焦虑通常是因为任务太大块了。把它拆成今天能完成的一小步，先做那一步。' },
  { keys: ['不想学', '学不进去', '没动力', '摆烂', '放弃'], reply: '不想学的时候，只做五分钟。五分钟之后要停也可以，多数时候你会继续。' },
  { keys: ['效率', '方法', '怎么学', '记不住', '注意力'], reply: '试试 25 分钟只做一件事，结束后立刻记一行"刚学到了什么"。记忆靠回顾，不靠时长。' },
  { keys: ['考不上', '失败', '没用', '来不及了'], reply: '结果不由今天一天决定，但今天这一天你可以决定。先把手边这一页看完。' },
  { keys: ['谢谢', '感谢', '有你'], reply: '不用谢。我只是在这儿陪着，真正坐下来的是你。' },
  { keys: ['你好', '在吗', '月见'], reply: '我在。今天的场景还合适吗？要不要换个氛围试试。' },
];

export function ruleReply(message = '', ctx = {}) {
  const text = String(message);
  const hit = CHAT_RULES.find((rule) => rule.keys.some((k) => text.includes(k)));
  if (hit) return hit.reply;
  const base = pickLine({ event: 'chat', scene: ctx.scene, ctx });
  return base;
}

/** 事件 → 触发条件（供前端/文档对齐） */
export const EVENT_TRIGGERS = {
  start: '开始一次专注',
  finish: '结束一次专注',
  idle: '连续专注 ≥ 45 分钟',
  break: '手动暂停',
  streak: '连续打卡 ≥ 2 天时进入自习室',
  allTasks: '当天任务全部完成',
  comeback: '断签后重新进入',
  chat: '用户主动对话',
};
