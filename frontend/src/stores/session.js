import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { sessionApi } from '../api/index.js';
import { useSceneStore } from './scene.js';
import { useUserStore } from './user.js';
import { computeElapsedMs, progressOf, remainingSec, toSec } from '../utils/timer.js';
import { toLocalIso } from '../utils/format.js';
import { rolloverItems, sanitizeTasksPayload, TASKS_LIMIT, TITLE_LIMIT, todayKey } from '../utils/tasklist.js';

const TASKS_KEY = 'liujing_tasks';
const IDLE_ALERT_MIN = 45; // 连续专注 45 分钟触发久坐提醒
const MAX_IDLE_ALERTS = 6;

function loadTasks() {
  const empty = { date: todayKey(), updatedAt: 0, items: [] };
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    const data = sanitizeTasksPayload(raw ? JSON.parse(raw) : null);
    if (!data) return empty;
    // 跨天翻篇：昨日已完成清空，未完成顺延
    const today = todayKey();
    return { date: today, updatedAt: data.updatedAt, items: rolloverItems(data.items, data.date, today) };
  } catch {
    return empty;
  }
}

/**
 * 自习会话 store —— 计时权威源（技术方案 3.2 第 3 条）
 * 所有时间读数都由时间戳差值算出，setInterval 只负责推动重绘。
 */
export const useSessionStore = defineStore('session', () => {
  const status = ref('idle'); // idle | focus | paused | break
  const mode = ref('pomodoro'); // pomodoro | custom
  const planSec = ref(25 * 60);
  const accumulatedMs = ref(0);
  const runningSince = ref(null);
  const tick = ref(Date.now());
  const startedAt = ref(null);

  const tasksMeta = ref(loadTasks());
  const tasks = ref(tasksMeta.value.items);
  const tasksDate = ref(tasksMeta.value.date);
  const tasksUpdatedAt = ref(tasksMeta.value.updatedAt);
  const saving = ref(false);
  const lastError = ref('');
  const lastSaved = ref(null);
  const lastEvent = ref(null); // { id, type, at }

  let timer = null;
  let idleAlerts = 0;
  let eventSeq = 0;

  const elapsedMs = computed(() =>
    computeElapsedMs({ accumulatedMs: accumulatedMs.value, runningSince: runningSince.value, now: tick.value }),
  );
  const remaining = computed(() => remainingSec(planSec.value, elapsedMs.value));
  const progress = computed(() => progressOf(planSec.value, elapsedMs.value));
  const elapsedSec = computed(() => toSec(elapsedMs.value));
  const running = computed(() => runningSince.value !== null);
  const isActive = computed(() => status.value !== 'idle');
  const tasksTotal = computed(() => tasks.value.length);
  const tasksDone = computed(() => tasks.value.filter((t) => t.done).length);
  const allTasksDone = computed(() => tasksTotal.value > 0 && tasksDone.value === tasksTotal.value);

  function emit(type, extra = {}) {
    eventSeq += 1;
    lastEvent.value = { id: eventSeq, type, at: Date.now(), ...extra };
  }

  function startTick() {
    if (timer) return;
    timer = setInterval(() => {
      tick.value = Date.now();
      guard();
    }, 250);
  }

  function stopTick() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  /** 每帧守卫：完成提醒、久坐提醒 */
  function guard() {
    if (status.value === 'focus') {
      if (remaining.value <= 0) {
        completeRound();
        return;
      }
      const minutes = Math.floor(elapsedMs.value / 60000);
      if (idleAlerts < MAX_IDLE_ALERTS && minutes >= IDLE_ALERT_MIN * (idleAlerts + 1)) {
        idleAlerts += 1;
        emit('idle', { minutes });
      }
    } else if (status.value === 'break' && remaining.value <= 0) {
      reset();
      emit('breakDone');
    }
  }

  /** 开始一轮专注 */
  function start({ focusMinutes = 25, customSec = null, kind = 'pomodoro' } = {}) {
    mode.value = kind;
    planSec.value = Math.max(60, Math.round(customSec ?? focusMinutes * 60));
    accumulatedMs.value = 0;
    runningSince.value = Date.now();
    startedAt.value = new Date();
    idleAlerts = 0;
    tick.value = Date.now();
    status.value = 'focus';
    lastSaved.value = null;
    lastError.value = '';
    startTick();
    emit('start');
  }

  function pause() {
    if (status.value !== 'focus') return;
    accumulatedMs.value = computeElapsedMs({
      accumulatedMs: accumulatedMs.value,
      runningSince: runningSince.value,
      now: Date.now(),
    });
    runningSince.value = null;
    status.value = 'paused';
    stopTick();
    emit('break');
  }

  function resume() {
    if (status.value !== 'paused') return;
    runningSince.value = Date.now();
    status.value = 'focus';
    tick.value = Date.now();
    startTick();
    emit('resume');
  }

  /**
   * 入库一段专注。
   * 口径：净专注时长（累计 elapsed），startedAt 由 endedAt - durationSec 反推，
   * 保证后端"时长回算校验"自洽（暂停间隙不计入）。
   */
  async function saveRecord({ silent = false } = {}) {
    const durationSec = elapsedSec.value;
    // 30 秒以下视为误触不入库，避免零碎记录污染统计
    if (durationSec < 30) return { skipped: true, reason: 'too-short' };

    const sceneStore = useSceneStore();
    const endedAt = new Date();
    const beginAt = new Date(endedAt.getTime() - durationSec * 1000);

    saving.value = true;
    lastError.value = '';
    try {
      const data = await sessionApi.create({
        scene: sceneStore.current,
        mode: mode.value,
        startedAt: toLocalIso(beginAt),
        endedAt: toLocalIso(endedAt),
        durationSec,
        tasks: tasks.value.map(({ title, done }) => ({ title, done })),
      });
      lastSaved.value = data.record;
      if (!silent) emit('saved', { record: data.record });
      return { ok: true, record: data.record };
    } catch (err) {
      lastError.value = err.message;
      emit('saveFailed', { message: err.message });
      return { ok: false, error: err.message };
    } finally {
      saving.value = false;
    }
  }

  /** 番茄钟一轮走完：先入库，再进入休息 */
  async function completeRound({ breakMinutes = 5 } = {}) {
    if (status.value !== 'focus') return;
    // 先同步切状态，避免 250ms 轮询重复触发
    accumulatedMs.value = planSec.value * 1000;
    runningSince.value = null;
    status.value = 'break';
    stopTick();
    emit('roundDone');

    await saveRecord();

    planSec.value = Math.max(60, Math.round(breakMinutes * 60));
    accumulatedMs.value = 0;
    runningSince.value = Date.now();
    startTick();

    return lastSaved.value;
  }

  /** 确认休息结束后回到待机 */
  function skipBreak() {
    if (status.value !== 'break') return;
    reset();
    emit('breakDone');
  }

  /** 手动结束整场自习（focus / paused / break 均可） */
  async function endSession() {
    if (status.value === 'idle') return null;
    stopTick();
    const wasFocusLike = status.value === 'focus' || status.value === 'paused';
    // 冻结读数
    if (status.value === 'focus') {
      accumulatedMs.value = computeElapsedMs({
        accumulatedMs: accumulatedMs.value,
        runningSince: runningSince.value,
        now: Date.now(),
      });
      runningSince.value = null;
    }
    const result = wasFocusLike ? await saveRecord() : null;
    reset();
    emit('end', { saved: Boolean(result?.ok) });
    return result;
  }

  function reset() {
    stopTick();
    status.value = 'idle';
    accumulatedMs.value = 0;
    runningSince.value = null;
    startedAt.value = null;
    tick.value = Date.now();
    idleAlerts = 0;
  }

  /* ------------------------------ 任务清单 ------------------------------ */

  /** 每次变更：刷新日期与更新时间戳（「今日」语义 + 跨设备同步依据） */
  function touchTasks() {
    tasksDate.value = todayKey();
    tasksUpdatedAt.value = Date.now();
    scheduleTasksSync();
  }

  function addTask(title) {
    const text = String(title || '').trim();
    if (!text || tasks.value.length >= TASKS_LIMIT) return false;
    tasks.value.push({ id: `t${Date.now()}${Math.random().toString(16).slice(2, 6)}`, title: text.slice(0, TITLE_LIMIT), done: false });
    touchTasks();
    return true;
  }

  function toggleTask(id) {
    const hit = tasks.value.find((t) => t.id === id);
    if (!hit) return;
    hit.done = !hit.done;
    touchTasks();
    if (allTasksDone.value) emit('allTasks');
  }

  function removeTask(id) {
    tasks.value = tasks.value.filter((t) => t.id !== id);
    touchTasks();
  }

  function renameTask(id, title) {
    const text = String(title || '').trim();
    const hit = tasks.value.find((t) => t.id === id);
    if (!hit || !text) return false;
    hit.title = text.slice(0, TITLE_LIMIT);
    touchTasks();
    return true;
  }

  function clearDone() {
    tasks.value = tasks.value.filter((t) => !t.done);
    touchTasks();
  }

  /* --------------------------- 清单跨设备同步 --------------------------- */

  let syncTimer = null;

  /** 变更后防抖推送，避免频繁打接口 */
  function scheduleTasksSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncTasksToServer(), 1200);
  }

  async function syncTasksToServer() {
    const userStore = useUserStore();
    if (!userStore.loggedIn) return;
    try {
      // dao 层对 prefs 做浅合并，只传 tasks 不会影响其他偏好
      await userStore.updateProfile({
        prefs: {
          tasks: {
            date: tasksDate.value,
            updatedAt: tasksUpdatedAt.value,
            items: tasks.value.map(({ title, done }) => ({ title, done })),
          },
        },
      });
    } catch {
      /* 同步失败静默，下次变更再试；本地始终可用 */
    }
  }

  /**
   * 登录后初始化：本地与服务器按 updatedAt 取较新的一方。
   * 服务器更新 → 采用服务器数据（并做跨天翻篇）；本地更新或服务器没有 → 推送本地。
   */
  function initTasks(remote) {
    const data = sanitizeTasksPayload(remote);
    if (!data || data.items.length === 0) {
      if (tasks.value.length > 0) syncTasksToServer();
      return;
    }
    if (data.updatedAt > tasksUpdatedAt.value) {
      const today = todayKey();
      tasks.value = rolloverItems(data.items, data.date, today);
      tasksDate.value = today;
      tasksUpdatedAt.value = data.updatedAt;
    } else {
      syncTasksToServer();
    }
  }

  watch(
    [tasks, tasksDate, tasksUpdatedAt],
    () => {
      try {
        localStorage.setItem(
          TASKS_KEY,
          JSON.stringify({ version: 1, date: tasksDate.value, updatedAt: tasksUpdatedAt.value, items: tasks.value }),
        );
      } catch {
        /* 忽略存储失败 */
      }
    },
    { deep: true },
  );

  // 卸载/离开时释放定时器
  function dispose() {
    stopTick();
    if (syncTimer) clearTimeout(syncTimer);
  }

  return {
    status,
    mode,
    planSec,
    tasks,
    saving,
    lastError,
    lastSaved,
    lastEvent,
    elapsedSec,
    remaining,
    progress,
    running,
    isActive,
    tasksTotal,
    tasksDone,
    allTasksDone,
    start,
    pause,
    resume,
    completeRound,
    skipBreak,
    endSession,
    saveRecord,
    reset,
    addTask,
    toggleTask,
    removeTask,
    renameTask,
    clearDone,
    initTasks,
    dispose,
  };
});
