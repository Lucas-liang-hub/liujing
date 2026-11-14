import { chatOnce, streamChat } from './llm.js';
import { EVENTS, pickLine, ruleReply } from './library.js';
import { buildMessages } from './prompt.js';

/**
 * 月见双轨路由（技术方案第 5 节）：
 * - 事件类（开工/收工/久坐…）永远走规则语库：稳定、零成本、不依赖网络
 * - 对话类（chat）优先走 LLM；调用方未带 llmCfg（用户没配 Key）或调用失败时无声降级到语库
 */

export function isValidEvent(event) {
  return EVENTS.includes(event);
}

export function normalizeEvent(event) {
  return isValidEvent(event) ? event : 'chat';
}

/** 周小结的固定请求：数据已在 system prompt 里注入，这里只给输出要求 */
const WEEKLY_ASK =
  '请根据我的学习数据，给我一份本周小结：先一句对整体节奏的观察，再给一条下周的具体小建议。不超过 120 字，保持月见的语气，不要罗列原始数据。';

export async function replyText({ event = 'chat', message = '', history = [], ctx = {}, maxRounds = 6, llmCfg = null } = {}) {
  const ev = normalizeEvent(event);

  if (ev === 'weekly') {
    if (llmCfg) {
      try {
        const reply = await chatOnce(buildMessages({ ctx, history: [], message: WEEKLY_ASK, maxRounds }), llmCfg);
        return { reply, source: 'llm', event: ev };
      } catch (err) {
        console.warn('[ai] 周小结 LLM 调用失败，降级到语库:', err.message);
        return { reply: pickLine({ event: ev, scene: ctx.scene, ctx }), source: 'library', event: ev, degraded: true };
      }
    }
    return { reply: pickLine({ event: ev, scene: ctx.scene, ctx }), source: 'library', event: ev };
  }

  if (ev !== 'chat') {
    return { reply: pickLine({ event: ev, scene: ctx.scene, ctx }), source: 'library', event: ev };
  }

  if (!llmCfg) {
    return { reply: ruleReply(message, ctx), source: 'library', event: ev };
  }

  try {
    const reply = await chatOnce(buildMessages({ ctx, history, message, maxRounds }), llmCfg);
    return { reply, source: 'llm', event: ev };
  } catch (err) {
    console.warn('[ai] LLM 调用失败，降级到语库:', err.message);
    return { reply: ruleReply(message, ctx), source: 'library', event: ev, degraded: true };
  }
}

/**
 * 流式回复：统一以 async generator 形式暴露增量文本
 * 规则轨也按小块切分，前端只需一套打字机逻辑。
 */
export async function* replyStream({ event = 'chat', message = '', history = [], ctx = {}, maxRounds = 6, llmCfg = null } = {}) {
  const ev = normalizeEvent(event);

  if (ev === 'weekly' && llmCfg) {
    let started = false;
    try {
      for await (const delta of streamChat(buildMessages({ ctx, history: [], message: WEEKLY_ASK, maxRounds }), llmCfg)) {
        started = true;
        yield { delta, source: 'llm' };
      }
      return;
    } catch (err) {
      console.warn('[ai] 周小结 LLM 流式失败:', err.message);
      if (!started) {
        const fallback = pickLine({ event: ev, scene: ctx.scene, ctx });
        for (let i = 0; i < fallback.length; i += 3) {
          yield { delta: fallback.slice(i, i + 3), source: 'library', degraded: true };
        }
        return;
      }
      yield { delta: '\n（网络有点不稳，小结先到这里。）', source: 'llm', degraded: true };
      return;
    }
  }

  if (ev !== 'chat' || !llmCfg) {
    const text = ev === 'chat' ? ruleReply(message, ctx) : pickLine({ event: ev, scene: ctx.scene, ctx });
    // 按 2-4 字切块，模拟打字机节奏
    for (let i = 0; i < text.length; i += 3) {
      yield { delta: text.slice(i, i + 3), source: 'library' };
    }
    return;
  }

  let started = false;
  try {
    for await (const delta of streamChat(buildMessages({ ctx, history, message, maxRounds }), llmCfg)) {
      started = true;
      yield { delta, source: 'llm' };
    }
  } catch (err) {
    console.warn('[ai] LLM 流式失败:', err.message);
    if (!started) {
      const fallback = ruleReply(message, ctx);
      for (let i = 0; i < fallback.length; i += 3) {
        yield { delta: fallback.slice(i, i + 3), source: 'library', degraded: true };
      }
    } else {
      yield { delta: '\n（网络有点不稳，我先说到这儿。）', source: 'llm', degraded: true };
    }
  }
}
