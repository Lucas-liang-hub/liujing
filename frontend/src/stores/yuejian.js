import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { aiApi } from '../api/index.js';

const TYPE_INTERVAL = 26; // 打字机节奏（毫秒/2字）

/**
 * 月见对话 store。
 * - 事件类问候（开工/收工/久坐…）走非流式，稳定快
 * - 聊天走 SSE 流式，前端用打字机队列渲染，两轨体验一致
 */
export const useYuejianStore = defineStore('yuejian', () => {
  const messages = ref([]); // { id, role, content, source, event, degraded, at }
  const typing = ref(false);
  const thinking = ref(false);
  const llmEnabled = ref(false);
  const error = ref('');
  const opened = ref(false);

  let seq = 0;
  let queue = '';
  let typer = null;
  let active = null;

  const lastAssistant = computed(() => [...messages.value].reverse().find((m) => m.role === 'assistant') || null);
  const hasMessages = computed(() => messages.value.length > 0);

  function push(role, content = '', extra = {}) {
    messages.value.push({ id: (seq += 1), role, content, at: Date.now(), ...extra });
    return messages.value[messages.value.length - 1];
  }

  function stopTyper() {
    if (typer) {
      clearInterval(typer);
      typer = null;
    }
  }

  function pump() {
    if (typer) return;
    typer = setInterval(() => {
      if (!queue) {
        stopTyper();
        typing.value = false;
        thinking.value = false;
        return;
      }
      const step = queue.slice(0, 2);
      queue = queue.slice(2);
      if (active) active.content += step;
    }, TYPE_INTERVAL);
  }

  /** 立刻把剩余文字吐完（用户催或组件卸载） */
  function flush() {
    if (queue && active) {
      active.content += queue;
      queue = '';
    }
    stopTyper();
    typing.value = false;
    thinking.value = false;
  }

  function say(text, extra = {}) {
    if (!text) return null;
    active = push('assistant', '', extra);
    queue += text;
    typing.value = true;
    thinking.value = false;
    pump();
    return active;
  }

  async function init() {
    try {
      const data = await aiApi.config();
      llmEnabled.value = Boolean(data.llmEnabled);
    } catch {
      llmEnabled.value = false;
    }
  }

  /** 事件问候（开工/收工/久坐/连续打卡/任务全清/断签回归） */
  async function greet(event, scene) {
    if (typing.value || !event) return;
    try {
      const data = await aiApi.chat({ event, scene });
      say(data.reply, { source: data.source, event });
    } catch (err) {
      error.value = err.message;
    }
  }

  async function send(text, scene) {
    const content = String(text || '').trim();
    if (!content || typing.value) return;

    error.value = '';
    push('user', content);

    const history = messages.value
      .filter((m) => m.content && m.role !== 'system')
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content }));

    active = push('assistant', '', { source: llmEnabled.value ? 'llm' : 'library' });
    queue = '';
    typing.value = true;
    thinking.value = true;

    try {
      await aiApi.streamChat({ message: content, event: 'chat', history, scene }, (ev) => {
        if (ev.error) {
          error.value = ev.error;
          return;
        }
        if (ev.delta) {
          thinking.value = false;
          if (ev.source && active) active.source = ev.source;
          if (ev.degraded && active) active.degraded = true;
          queue += ev.delta;
          pump();
        }
        if (ev.done && active) {
          active.source = ev.source || active.source;
        }
      });
    } catch (err) {
      error.value = err.message;
      if (active && !active.content) {
        active.content = '月见暂时联系不上，先陪你安静一会儿。';
        typing.value = false;
        thinking.value = false;
      }
    } finally {
      // 若流式内容已全部到达但打字机还没吐完，交给 pump 自然收尾
      if (!queue && !typer) {
        typing.value = false;
        thinking.value = false;
      }
    }
  }

  function reset() {
    stopTyper();
    queue = '';
    active = null;
    messages.value = [];
    typing.value = false;
    thinking.value = false;
    error.value = '';
    seq = 0;
  }

  function toggle(force) {
    opened.value = typeof force === 'boolean' ? force : !opened.value;
  }

  return {
    messages,
    typing,
    thinking,
    llmEnabled,
    error,
    opened,
    lastAssistant,
    hasMessages,
    init,
    greet,
    send,
    say,
    flush,
    reset,
    toggle,
  };
});
