<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppHeader from '../components/AppHeader.vue';
import SceneCanvas from '../components/SceneCanvas.vue';
import SceneSwitcher from '../components/SceneSwitcher.vue';
import TaskList from '../components/TaskList.vue';
import TimerPanel from '../components/TimerPanel.vue';
import YuejianPanel from '../components/YuejianPanel.vue';
import { useSessionStore } from '../stores/session.js';
import { useSceneStore } from '../stores/scene.js';
import { useUserStore } from '../stores/user.js';
import { useYuejianStore } from '../stores/yuejian.js';
import { statsApi } from '../api/index.js';
import { formatDuration } from '../utils/format.js';
import { applyTitle } from '../utils/title.js';
import { createAmbient } from '../utils/ambient.js';

const session = useSessionStore();
const scene = useSceneStore();
const user = useUserStore();
const yuejian = useYuejianStore();

const stats = ref(null);
const toast = ref('');
let toastTimer = null;
// 音频实例同样不放进响应式
const ambient = createAmbient();

const prefs = computed(() => user.prefs);

const displayTodaySec = computed(() => {
  const base = stats.value?.todaySec || 0;
  const live = session.status === 'focus' || session.status === 'paused' ? session.elapsedSec : 0;
  return base + live;
});

const lastLine = computed(() => yuejian.lastAssistant?.content || '');

function showToast(text, ms = 3600) {
  toast.value = text;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.value = '';
  }, ms);
}

async function refreshStats() {
  try {
    stats.value = await statsApi.summary();
    return stats.value;
  } catch {
    return null;
  }
}

/* ── 标签页标题同步 ───────────────────────────── */
watch(
  [() => session.status, () => session.remaining],
  () => {
    applyTitle({ status: session.status, remaining: session.remaining, sceneName: scene.meta.name });
  },
  { immediate: true },
);

/* ── 会话事件 → 月见问候 ──────────────────────── */
watch(
  () => session.lastEvent,
  async (ev) => {
    if (!ev) return;
    const greetMap = { start: 'start', break: 'break', idle: 'idle', roundDone: 'finish', end: 'finish' };
    if (greetMap[ev.type]) await yuejian.greet(greetMap[ev.type], scene.current);
    if (ev.type === 'roundDone' || ev.type === 'end' || ev.type === 'saved') await refreshStats();
    if (ev.type === 'saveFailed') showToast(`记录保存失败：${ev.message}`);
  },
);

/* ── 音效 ─────────────────────────────────────── */
function toggleSound() {
  const on = scene.toggleSound();
  if (on) ambient.play(scene.soundType === 'none' ? 'rain' : scene.soundType);
  else ambient.stop();
}

/* ── 沉浸模式 ─────────────────────────────────── */
async function toggleFocus() {
  const next = scene.toggleFocusMode();
  try {
    if (next && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    if (!next && document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* 用户拒绝或浏览器不支持时仅切换 UI */
  }
}

function onFullscreenChange() {
  if (!document.fullscreenElement && scene.focusMode) scene.toggleFocusMode(false);
}

/* ── 结束自习 ─────────────────────────────────── */
async function handleEnd() {
  const result = await session.endSession();
  if (result?.ok) {
    showToast(`已记录 ${formatDuration(result.record.durationSec)}`);
    await refreshStats();
  } else if (result?.skipped) {
    showToast('这次不足 1 分钟，没有记录');
  } else if (result?.error) {
    showToast(`保存失败：${result.error}`);
  }
}

function handleAllDone() {
  yuejian.greet('allTasks', scene.current);
}

/* ── 快捷键 ───────────────────────────────────── */
function onKeydown(e) {
  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  if (e.code === 'Space') {
    e.preventDefault();
    if (session.status === 'idle') {
      session.start({ focusMinutes: prefs.value.focusMinutes, kind: 'pomodoro' });
    } else if (session.status === 'focus') session.pause();
    else if (session.status === 'paused') session.resume();
  }
  if (e.key.toLowerCase() === 'f') toggleFocus();
}

onMounted(async () => {
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('fullscreenchange', onFullscreenChange);

  await user.fetchProfile().catch(() => null);
  await yuejian.init();

  // 偏好同步到本地状态
  if (!scene.manual) scene.setScene(prefs.value.scene, { byUser: false });
  if (prefs.value.soundOn) {
    scene.soundType = prefs.value.sound;
    scene.toggleSound(true);
    ambient.play(prefs.value.sound === 'none' ? 'rain' : prefs.value.sound);
  }

  const summary = await refreshStats();
  if (summary) {
    if (summary.streak >= 2) yuejian.greet('streak', scene.current);
    else if (summary.activeDays > 0 && summary.streak === 0) yuejian.greet('comeback', scene.current);
    else yuejian.greet('start', scene.current);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  if (toastTimer) clearTimeout(toastTimer);
  session.dispose();
  yuejian.flush();
  ambient.destroy();
  applyTitle({ status: 'idle' });
});
</script>

<template>
  <div class="room" :class="{ immersive: scene.focusMode }">
    <SceneCanvas />

    <div class="room-body">
      <AppHeader v-if="!scene.focusMode" @toggle-sound="toggleSound" @logout="user.logout()" />

      <main class="grid">
        <aside class="col left" v-if="!scene.focusMode">
          <SceneSwitcher @change="(id) => scene.setScene(id)" />
          <TaskList @all-done="handleAllDone" />
        </aside>

        <section class="col main">
          <TimerPanel
            :today-sec="displayTodaySec"
            :goal-minutes="prefs.dailyGoalMinutes"
            :default-minutes="prefs.focusMinutes"
            :scene-name="scene.meta.name"
            @end="handleEnd"
          />

          <div class="whisper" v-if="lastLine">
            <span class="whisper-mark"></span>
            <p>{{ lastLine }}</p>
          </div>

          <button class="immersive" @click="toggleFocus">
            {{ scene.focusMode ? '退出沉浸（F）' : '沉浸模式（F）' }}
          </button>
        </section>

        <aside class="col right" v-if="!scene.focusMode">
          <YuejianPanel />
        </aside>
      </main>

      <transition name="toast">
        <div class="toast" v-if="toast">{{ toast }}</div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.room {
  height: 100%;
  position: relative;
  color: var(--text);
}

.room-body {
  position: relative;
  z-index: 10;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 248px minmax(320px, 430px) 328px;
  gap: 22px;
  padding: 8px 28px 26px;
  align-content: center;
  justify-content: center;
  animation: fade-up 620ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.col.left {
  justify-content: center;
}

.col.main {
  align-items: stretch;
  justify-content: center;
}

.col.right {
  justify-content: center;
}

.col.right :deep(.yuejian) {
  height: min(560px, 72vh);
}

.whisper {
  display: flex;
  gap: 10px;
  padding: 0 6px;
  min-height: 20px;
}

.whisper-mark {
  width: 2px;
  border-radius: 2px;
  background: linear-gradient(180deg, var(--accent), transparent);
  opacity: 0.55;
  flex: 0 0 2px;
}

.whisper p {
  font-family: var(--font-serif);
  font-size: 12.5px;
  line-height: 1.8;
  color: var(--text-dim);
  letter-spacing: 0.03em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.immersive {
  align-self: center;
  font-size: 11.5px;
  letter-spacing: 0.16em;
  color: var(--text-faint);
  padding: 4px 10px;
  transition: color var(--transition);
}

.immersive:hover {
  color: var(--text-dim);
}

/* 沉浸模式：只留计时 */
.room.immersive .grid {
  grid-template-columns: minmax(320px, 480px);
  align-content: center;
  padding-bottom: 8vh;
}

.toast {
  position: absolute;
  left: 50%;
  bottom: 26px;
  transform: translateX(-50%);
  padding: 9px 18px;
  border-radius: 999px;
  background: rgba(10, 14, 20, 0.86);
  border: 1px solid var(--line-strong);
  font-size: 12.5px;
  color: var(--text);
  backdrop-filter: blur(12px);
  box-shadow: var(--shadow);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 260ms ease, transform 260ms ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}

@media (max-width: 1180px) {
  .grid {
    grid-template-columns: 232px minmax(300px, 1fr);
    gap: 16px;
    padding: 8px 20px 22px;
  }
  .col.right {
    display: none;
  }
}

@media (max-width: 820px) {
  .room-body {
    overflow-y: auto;
  }
  .grid {
    grid-template-columns: 1fr;
    align-content: start;
    padding: 4px 16px 28px;
    gap: 16px;
  }
  .col.left {
    order: 2;
  }
  .col.main {
    order: 1;
  }
}
</style>
