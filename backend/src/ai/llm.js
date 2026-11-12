import { config } from '../config/index.js';
import { currentLlmConfigSync } from './runtime.js';

/**
 * 大模型代理（仅后端持有 Key，技术方案「不做的事」明确前端不得直连）。
 * 采用 OpenAI 兼容协议：支持 .env 静态配置 + 设置页运行时热切换。
 */

export function isLlmEnabled() {
  return Boolean(currentLlmConfigSync().apiKey);
}

function endpoint() {
  return `${currentLlmConfigSync().baseUrl}/chat/completions`;
}

function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${currentLlmConfigSync().apiKey}`,
  };
}

async function request(messages, stream) {
  const cfg = currentLlmConfigSync();
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      model: cfg.model,
      messages,
      stream,
      temperature: 0.7,
      max_tokens: 600,
    }),
    signal: AbortSignal.timeout(cfg.timeoutMs),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LLM ${res.status}: ${text.slice(0, 200)}`);
  }
  return res;
}

/** 非流式：一次性拿到完整回复 */
export async function chatOnce(messages) {
  const res = await request(messages, false);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM 返回内容为空');
  return content.trim();
}

/**
 * 流式：逐段 yield 文本增量（SSE 解析，兼容跨 chunk 断行）
 * @param {Array<{role:string, content:string}>} messages
 */
export async function* streamChat(messages) {
  const res = await request(messages, true);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 最后一行可能不完整，留到下一轮

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const delta = json?.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // 忽略无法解析的心跳/注释帧
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}
