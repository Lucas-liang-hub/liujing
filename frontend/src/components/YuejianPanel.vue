<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useYuejianStore } from '../stores/yuejian.js';
import { useSceneStore } from '../stores/scene.js';

const yuejian = useYuejianStore();
const scene = useSceneStore();
const draft = ref('');
const listRef = ref(null);

const quickLines = ['我有点学不进去', '帮我安排剩下的一小时', '今天效率很差'];

const modeLabel = computed(() => (yuejian.llmEnabled ? '增强对话' : '规则陪伴'));

async function scrollToBottom() {
  await nextTick();
  const el = listRef.value;
  if (el) el.scrollTop = el.scrollHeight;
}

watch(
  () => [yuejian.messages.length, yuejian.messages.at(-1)?.content?.length],
  scrollToBottom,
);

async function submit() {
  const text = draft.value.trim();
  if (!text || yuejian.typing) return;
  draft.value = '';
  await yuejian.send(text, scene.current);
}

async function quick(text) {
  if (yuejian.typing) return;
  await yuejian.send(text, scene.current);
}

async function weekly() {
  if (yuejian.typing) return;
  await yuejian.greet('weekly', scene.current);
}
</script>

<template>
  <section class="yuejian glass">
    <header class="head">
      <div class="who">
        <span class="moon"></span>
        <span class="name">月见</span>
      </div>
      <span class="mode" :class="{ live: yuejian.llmEnabled }">{{ modeLabel }}</span>
    </header>

    <div class="stream" ref="listRef">
      <div v-if="!yuejian.hasMessages" class="intro">
        <p>我在这儿。</p>
        <p class="dim">想说话的时候叫我，不想说话的时候，我就安静陪着。</p>
      </div>

      <div v-for="m in yuejian.messages" :key="m.id" class="msg" :class="m.role">
        <template v-if="m.role === 'assistant'">
          <span class="mark"></span>
          <p class="bubble">{{ m.content }}<span v-if="!m.content && yuejian.thinking" class="dots">···</span></p>
        </template>
        <p v-else class="bubble">{{ m.content }}</p>
      </div>
    </div>

    <div class="quick" v-if="yuejian.messages.length < 3">
      <button v-for="q in quickLines" :key="q" class="chip" @click="quick(q)">{{ q }}</button>
    </div>

    <div class="extras">
      <button class="chip" :disabled="yuejian.typing" title="基于本周真实学习数据生成小结" @click="weekly">
        本周小结
      </button>
    </div>

    <p v-if="yuejian.error" class="error-text">{{ yuejian.error }}</p>

    <form class="compose" @submit.prevent="submit">
      <input
        v-model="draft"
        class="input"
        maxlength="2000"
        :placeholder="yuejian.typing ? '月见正在说…' : '和月见说点什么'"
        :disabled="yuejian.typing"
      />
      <button class="send" type="submit" :disabled="!draft.trim() || yuejian.typing" aria-label="发送">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path d="M4 12l15-7-6 7 6 7-15-7z" fill="currentColor" />
        </svg>
      </button>
    </form>
  </section>
</template>

<style scoped>
.yuejian {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 16px 16px 14px;
  gap: 12px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.who {
  display: flex;
  align-items: center;
  gap: 8px;
}

.moon {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 14px var(--glow);
  animation: breathe 4.2s ease-in-out infinite;
}

.name {
  font-family: var(--font-serif);
  font-size: 14px;
  letter-spacing: 0.16em;
  color: var(--text);
}

.mode {
  font-size: 10.5px;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  border: 1px solid var(--line);
  padding: 2px 8px;
  border-radius: 999px;
}

.mode.live {
  color: var(--accent);
  border-color: var(--accent-soft);
}

.stream {
  flex: 1;
  min-height: 120px;
  max-height: 46vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-right: 4px;
}

.intro p {
  font-family: var(--font-serif);
  font-size: 13.5px;
  color: var(--text-dim);
  letter-spacing: 0.04em;
}

.intro .dim {
  margin-top: 6px;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--text-faint);
  line-height: 1.7;
}

.msg {
  display: flex;
  gap: 8px;
  animation: fade-up 320ms ease both;
}

.msg.assistant {
  align-items: flex-start;
}

.mark {
  width: 2px;
  align-self: stretch;
  border-radius: 2px;
  background: linear-gradient(180deg, var(--accent), transparent);
  opacity: 0.5;
  flex: 0 0 2px;
}

.bubble {
  font-size: 13px;
  line-height: 1.75;
  color: var(--text-dim);
  white-space: pre-wrap;
  word-break: break-word;
}

.msg.user {
  justify-content: flex-end;
}

.msg.user .bubble {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--line);
  padding: 6px 11px;
  border-radius: 12px 12px 4px 12px;
  color: var(--text);
  max-width: 86%;
}

.dots {
  color: var(--accent);
  letter-spacing: 2px;
  animation: breathe 1.4s ease-in-out infinite;
}

.quick {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.extras {
  display: flex;
  justify-content: flex-end;
}

.extras .chip {
  cursor: pointer;
  opacity: 0.85;
  transition: opacity var(--transition);
}

.extras .chip:hover {
  opacity: 1;
}

.quick .chip {
  cursor: pointer;
  transition: all var(--transition);
}

.quick .chip:hover {
  border-color: var(--line-strong);
  color: var(--text);
}

.compose {
  display: flex;
  gap: 8px;
  align-items: center;
}

.compose .input {
  padding: 9px 12px;
  font-size: 13px;
}

.send {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--accent);
  color: #0d1116;
  transition: opacity var(--transition), transform var(--transition);
}

.send:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.send:not(:disabled):hover {
  transform: scale(1.05);
}
</style>
