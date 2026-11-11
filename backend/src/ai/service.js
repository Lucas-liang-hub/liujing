import { isLlmEnabled, chatOnce, streamChat } from './llm.js';
import { EVENTS, pickLine, ruleReply } from './library.js';
import { buildMessages } from './prompt.js';

/**
 * 月见双轨路由（技术方案第 5 节）：
 * - 事件类（开工/收工/久坐…）永远走规则语库：稳定、零成本、不依赖网络
 * - 对话类（chat）优先走 LLM；未配置 Key 或调用失败时无声降级到语库
 */

export function isValidEvent(event) {
  return EVENTS.includes(event);
}

export function normalizeEvent(event) {
  return isValidEvent(event) ? event : 'chat';
}

export async function replyText({ event = 'chat', message = '', history = [], ctx = {}, maxRounds = 6 } = {}) {
  const ev = normalizeEvent(event);

  if (ev !== 'chat') {
    return { reply: pickLine({ event: ev, scene: ctx.scene, ctx }), source: 'library', event: ev };
  }

  if (!isLlmEnabled()) {
    return { reply: ruleReply(message, ctx), source: 'library', event: ev };
  }

  try {
    const reply = await chatOnce(buildMessages({ ctx, history, message, maxRounds }));
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
export async function* replyStream({ event = 'chat', message = '', history = [], ctx = {}, maxRounds = 6 } = {}) {
  const ev = normalizeEvent(event);

  if (ev !== 'chat' || !isLlmEnabled()) {
    const text = ev === 'chat' ? ruleReply(message, ctx) : pickLine({ event: ev, scene: ctx.scene, ctx });
    // 按 2-4 字切块，模拟打字机节奏
    for (let i = 0; i < text.length; i += 3) {
      yield { delta: text.slice(i, i + 3), source: 'library' };
    }
    return;
  }

  let started = false;
  try {
    for await (const delta of streamChat(buildMessages({ ctx, history, message, maxRounds }))) {
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
