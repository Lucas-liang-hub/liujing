<script setup>
import { computed, onMounted, ref } from 'vue';
import { useSessionStore } from '../stores/session.js';
import { formatClock, formatDuration } from '../utils/format.js';

const props = defineProps({
  todaySec: { type: Number, default: 0 },
  goalMinutes: { type: Number, default: 120 },
  defaultMinutes: { type: Number, default: 25 },
  sceneName: { type: String, default: '' },
});

const emit = defineEmits(['start', 'pause', 'resume', 'end', 'skip-break']);

const session = useSessionStore();

const presets = [
  { min: 25, label: '番茄' },
  { min: 45, label: '深度' },
  { min: 60, label: '长时' },
];
const selectedMin = ref(25);
const customOpen = ref(false);
const customMin = ref(20);

onMounted(() => {
  const preferred = Number(props.defaultMinutes) || 25;
  if (presets.some((p) => p.min === preferred)) {
    selectedMin.value = preferred;
  } else {
    customMin.value = Math.min(180, Math.max(1, preferred));
    customOpen.value = true;
  }
});


const RADIUS = 92;
const CIRC = 2 * Math.PI * RADIUS;

const statusText = computed(() => {
  switch (session.status) {
    case 'focus':
      return session.running ? '专注中' : '已暂停';
    case 'paused':
      return '已暂停';
    case 'break':
      return '休息一下';
    default:
      return '准备好了就开始';
  }
});

const dashOffset = computed(() => CIRC * (1 - session.progress));
const clockText = computed(() => formatClock(session.remaining));
const goalPercent = computed(() => {
  const goal = Math.max(1, props.goalMinutes) * 60;
  return Math.min(100, Math.round((props.todaySec / goal) * 100));
});

function start() {
  const minutes = customOpen.value ? customMin.value : selectedMin.value;
  session.start({ focusMinutes: minutes, kind: 'pomodoro' });
  emit('start', minutes);
}

function pickPreset(min) {
  selectedMin.value = min;
  customOpen.value = false;
}

function toggleCustom() {
  customOpen.value = !customOpen.value;
}
</script>

<template>
  <section class="timer glass">
    <div class="timer-head">
      <span class="status">{{ statusText }}</span>
      <span class="scene-name">{{ sceneName }}</span>
    </div>

    <div class="dial">
      <svg viewBox="0 0 200 200" class="ring">
        <circle class="track" cx="100" cy="100" :r="RADIUS" />
        <circle
          class="bar"
          cx="100"
          cy="100"
          :r="RADIUS"
          :stroke-dasharray="CIRC"
          :stroke-dashoffset="dashOffset"
        />
      </svg>
      <div class="dial-center">
        <div class="clock" :class="{ resting: session.status === 'break' }">{{ clockText }}</div>
        <div class="sub">
          <template v-if="session.status === 'idle'">
            今日 {{ formatDuration(todaySec) }} · 目标 {{ goalMinutes }} 分钟
          </template>
          <template v-else-if="session.status === 'break'">休息结束后自动归位</template>
          <template v-else>已专注 {{ formatDuration(session.elapsedSec) }}</template>
        </div>
      </div>
    </div>

    <div class="presets" v-if="session.status === 'idle'">
      <button
        v-for="p in presets"
        :key="p.min"
        class="preset"
        :class="{ on: !customOpen && selectedMin === p.min }"
        @click="pickPreset(p.min)"
      >
        <strong>{{ p.min }}</strong>
        <span>{{ p.label }}</span>
      </button>
      <button class="preset" :class="{ on: customOpen }" @click="toggleCustom">
        <strong>自定</strong>
        <span>分钟</span>
      </button>
    </div>

    <div class="custom" v-if="session.status === 'idle' && customOpen">
      <input v-model.number="customMin" class="input" type="number" min="1" max="180" />
      <span class="hint">分钟（1-180）</span>
    </div>

    <div class="actions">
      <template v-if="session.status === 'idle'">
        <button class="btn btn-primary wide" @click="start">开始专注</button>
      </template>

      <template v-else-if="session.status === 'focus'">
        <button class="btn" @click="session.pause(); emit('pause')">暂停</button>
        <button class="btn btn-ghost" @click="emit('end')">结束自习</button>
      </template>

      <template v-else-if="session.status === 'paused'">
        <button class="btn btn-primary" @click="session.resume(); emit('resume')">继续</button>
        <button class="btn btn-ghost" @click="emit('end')">结束自习</button>
      </template>

      <template v-else-if="session.status === 'break'">
        <button class="btn btn-primary" @click="session.skipBreak(); emit('skip-break')">开始下一轮</button>
        <button class="btn btn-ghost" @click="emit('end')">结束今日</button>
      </template>
    </div>

    <div class="goal" v-if="todaySec > 0">
      <div class="goal-bar"><i :style="{ width: `${goalPercent}%` }"></i></div>
      <span class="goal-text">今日目标 {{ goalPercent }}%</span>
    </div>

    <p v-if="session.lastError" class="error-text">{{ session.lastError }}</p>
  </section>
</template>

<style scoped>
.timer {
  padding: 26px 26px 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  box-shadow: var(--shadow);
}

.timer-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  letter-spacing: 0.16em;
  color: var(--text-faint);
}

.status {
  color: var(--accent);
}

.dial {
  position: relative;
  width: min(280px, 62vw);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
}

.ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.track {
  fill: none;
  stroke: rgba(255, 255, 255, 0.07);
  stroke-width: 3;
}

.bar {
  fill: none;
  stroke: var(--accent);
  stroke-width: 3;
  stroke-linecap: round;
  filter: drop-shadow(0 0 10px var(--glow));
  transition: stroke-dashoffset 380ms linear;
}

.dial-center {
  text-align: center;
  z-index: 1;
}

.clock {
  font-family: var(--font-mono);
  font-size: clamp(38px, 9vw, 54px);
  font-weight: 300;
  letter-spacing: 0.02em;
  line-height: 1.1;
  color: #f4f7fb;
}

.clock.resting {
  color: var(--text-dim);
}

.sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-faint);
  letter-spacing: 0.04em;
}

.presets {
  display: flex;
  gap: 8px;
  width: 100%;
}

.preset {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 9px 4px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-dim);
  transition: all var(--transition);
}

.preset strong {
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 500;
}

.preset span {
  font-size: 11px;
  color: var(--text-faint);
}

.preset:hover {
  border-color: var(--line-strong);
  color: var(--text);
}

.preset.on {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--text);
}

.custom {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.custom .input {
  width: 96px;
  text-align: center;
  font-family: var(--font-mono);
}

.actions {
  display: flex;
  gap: 10px;
  width: 100%;
}

.actions .btn {
  flex: 1;
}

.wide {
  width: 100%;
}

.goal {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
}

.goal-bar {
  flex: 1;
  height: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.goal-bar i {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: 999px;
  transition: width 600ms ease;
}

.goal-text {
  font-size: 11px;
  color: var(--text-faint);
  white-space: nowrap;
}
</style>
