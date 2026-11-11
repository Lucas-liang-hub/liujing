<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from '../components/AppHeader.vue';
import ChartBox from '../components/ChartBox.vue';
import { sessionApi, statsApi } from '../api/index.js';
import { useUserStore } from '../stores/user.js';
import { useSceneStore } from '../stores/scene.js';
import { getSceneMeta, SCENE_META } from '../scenes/index.js';
import { formatDateCn, formatDuration, formatTime, formatDateShort, WEEKDAYS, toHours } from '../utils/format.js';
import { evaluateBadges, countUnlocked } from '../utils/badges.js';
import { CHART_LINE, CHART_TEXT, tooltipStyle } from '../utils/echarts.js';

const router = useRouter();
const user = useUserStore();
const scene = useSceneStore();

const summary = ref(null);
const heat = ref(null);
const records = ref([]);
const page = ref(1);
const pageSize = 8;
const hasMore = ref(false);
const loading = ref(true);
const loadingMore = ref(false);
const error = ref('');

const accent = computed(() => scene.meta.accent);

const overview = computed(() => {
  const s = summary.value || {};
  return [
    { label: '今日', value: formatDuration(s.todaySec || 0), sub: `${s.todaySessions || 0} 次坐下` },
    { label: '本周', value: formatDuration(s.weekSec || 0), sub: goalText(s.weekSec, (user.prefs.dailyGoalMinutes || 120) * 7 * 60) },
    { label: '累计', value: `${toHours(s.totalSec || 0)} 小时`, sub: `${s.totalSessions || 0} 次专注` },
    { label: '连续打卡', value: `${s.streak || 0} 天`, sub: `共 ${s.activeDays || 0} 天有记录` },
  ];
});

function goalText(current, goal) {
  if (!goal) return '—';
  const pct = Math.min(100, Math.round(((current || 0) / goal) * 100));
  return `目标 ${pct}%`;
}

const badges = computed(() => evaluateBadges(summary.value || {}, heat.value?.cells || []));
const unlockedCount = computed(() => countUnlocked(badges.value));

const barOption = computed(() => {
  const daily = summary.value?.daily || [];
  return {
    grid: { left: 44, right: 14, top: 20, bottom: 26 },
    tooltip: {
      trigger: 'axis',
      ...tooltipStyle,
      valueFormatter: (v) => formatDuration(Number(v) * 60),
    },
    xAxis: {
      type: 'category',
      data: daily.map((d) => formatDateShort(d.date)),
      axisLine: { lineStyle: { color: CHART_LINE } },
      axisTick: { show: false },
      axisLabel: { color: CHART_TEXT, fontSize: 10, interval: 1 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: CHART_LINE } },
      axisLabel: { color: CHART_TEXT, fontSize: 10, formatter: (v) => `${v}m` },
    },
    series: [
      {
        type: 'bar',
        data: daily.map((d) => Math.round((d.sec || 0) / 60)),
        barWidth: '46%',
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: accent.value },
              { offset: 1, color: 'rgba(255,255,255,0.06)' },
            ],
          },
        },
      },
    ],
  };
});

const pieOption = computed(() => {
  const scenes = summary.value?.scenes || [];
  const palette = SCENE_META.map((s) => s.accent);
  return {
    tooltip: { ...tooltipStyle, formatter: (p) => `${p.name} · ${formatDuration(p.value * 60)}` },
    series: [
      {
        type: 'pie',
        radius: ['50%', '72%'],
        center: ['50%', '52%'],
        avoidLabelOverlap: true,
        label: { show: false },
        itemStyle: { borderWidth: 0 },
        color: palette,
        data: scenes.map((s) => ({
          name: getSceneMeta(s.scene).name,
          value: Math.round((s.sec || 0) / 60),
        })),
      },
    ],
  };
});

const heatOption = computed(() => {
  const cells = heat.value?.cells || [];
  const data = cells.map((c) => [c.hour, c.weekday, Math.round((c.sec || 0) / 60)]);
  const max = Math.max(1, Math.round((heat.value?.maxSec || 0) / 60));
  return {
    grid: { left: 48, right: 16, top: 10, bottom: 24 },
    tooltip: {
      ...tooltipStyle,
      formatter: (p) => `${WEEKDAYS[p.value[1]]} ${p.value[0]}:00 · ${formatDuration((p.value[2] || 0) * 60)}`,
    },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, i) => String(i)),
      splitArea: { show: false },
      axisLine: { lineStyle: { color: CHART_LINE } },
      axisTick: { show: false },
      axisLabel: { color: CHART_TEXT, fontSize: 10, interval: 2 },
    },
    yAxis: {
      type: 'category',
      data: WEEKDAYS,
      splitArea: { show: false },
      axisLine: { lineStyle: { color: CHART_LINE } },
      axisTick: { show: false },
      axisLabel: { color: CHART_TEXT, fontSize: 10 },
    },
    visualMap: {
      min: 0,
      max,
      show: false,
      inRange: { color: ['rgba(255,255,255,0.05)', accent.value] },
    },
    series: [
      {
        type: 'heatmap',
        data,
        itemStyle: { borderColor: 'rgba(6,9,13,0.85)', borderWidth: 2, borderRadius: 3 },
        emphasis: { itemStyle: { borderColor: '#ffffff', borderWidth: 1 } },
      },
    ],
  };
});

const hasData = computed(() => (summary.value?.totalSessions || 0) > 0);
const hasSceneData = computed(() => (summary.value?.scenes || []).length > 0);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [s, h, list] = await Promise.all([
      statsApi.summary(),
      statsApi.heatmap(180),
      sessionApi.list({ page: 1, pageSize }),
    ]);
    summary.value = s;
    heat.value = h;
    records.value = list.items;
    hasMore.value = list.hasMore;
    page.value = 1;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value) return;
  loadingMore.value = true;
  try {
    const next = page.value + 1;
    const list = await sessionApi.list({ page: next, pageSize });
    records.value = records.value.concat(list.items);
    hasMore.value = list.hasMore;
    page.value = next;
  } catch (err) {
    error.value = err.message;
  } finally {
    loadingMore.value = false;
  }
}

function logout() {
  user.logout();
  router.push({ name: 'login' });
}

onMounted(async () => {
  await user.fetchProfile().catch(() => null);
  await load();
});
</script>

<template>
  <div class="stats-page">
    <AppHeader @logout="logout" />

    <main class="wrap">
      <header class="page-head">
        <h1>沉淀</h1>
        <p class="sub">你坐下来的每一次，都在这里留下痕迹</p>
      </header>

      <p v-if="error" class="error-text">{{ error }}</p>

      <section class="overview">
        <article v-for="item in overview" :key="item.label" class="stat glass">
          <span class="label">{{ item.label }}</span>
          <strong class="value">{{ item.value }}</strong>
          <span class="stat-sub">{{ item.sub }}</span>
        </article>
      </section>

      <div class="two">
        <section class="card glass">
          <header class="card-head">
            <span class="panel-title">近 14 天</span>
            <span class="hint">单位：分钟</span>
          </header>
          <ChartBox v-if="hasData" :option="barOption" height="230px" />
          <p v-else class="empty">还没有记录。去自习室坐一会儿吧。</p>
        </section>

        <section class="card glass">
          <header class="card-head">
            <span class="panel-title">场景偏好</span>
            <span class="hint">近 30 天</span>
          </header>
          <ChartBox v-if="hasSceneData" :option="pieOption" height="230px" />
          <p v-else class="empty">还没有场景数据。</p>
        </section>
      </div>

      <section class="card glass">
        <header class="card-head">
          <span class="panel-title">专注时段</span>
          <span class="hint">周 × 小时 · 近 180 天</span>
        </header>
        <ChartBox v-if="hasData" :option="heatOption" height="250px" />
        <p v-else class="empty">积累几天的记录后，这里会显现你最容易专注的时段。</p>
      </section>

      <section class="card glass">
        <header class="card-head">
          <span class="panel-title">徽章</span>
          <span class="hint">已获得 {{ unlockedCount }} / {{ badges.length }}</span>
        </header>
        <ul class="badges">
          <li v-for="b in badges" :key="b.id" class="badge" :class="{ on: b.unlocked }">
            <span class="glyph">{{ b.glyph }}</span>
            <span class="b-text">
              <strong>{{ b.name }}</strong>
              <em>{{ b.desc }}</em>
            </span>
            <span class="b-bar" v-if="!b.unlocked"><i :style="{ width: `${Math.round(b.progress * 100)}%` }"></i></span>
          </li>
        </ul>
      </section>

      <section class="card glass">
        <header class="card-head">
          <span class="panel-title">最近记录</span>
          <span class="hint">{{ summary?.totalSessions || 0 }} 次累计</span>
        </header>

        <ul class="records" v-if="records.length">
          <li v-for="r in records" :key="r.id" class="record">
            <span class="when">
              <strong>{{ formatDateCn(r.startedAt) }}</strong>
              <em>{{ formatTime(r.startedAt) }} - {{ formatTime(r.endedAt) }}</em>
            </span>
            <span class="scene-tag" :style="{ '--c': getSceneMeta(r.scene).accent }">
              {{ getSceneMeta(r.scene).name }}
            </span>
            <span class="dur">{{ formatDuration(r.durationSec) }}</span>
            <span class="tasks" v-if="r.tasksTotal">{{ r.tasksDone }}/{{ r.tasksTotal }} 任务</span>
          </li>
        </ul>
        <p v-else class="empty">还没有自习记录。</p>

        <div class="more" v-if="hasMore">
          <button class="btn btn-sm" :disabled="loadingMore" @click="loadMore">
            {{ loadingMore ? '加载中…' : '加载更多' }}
          </button>
        </div>
      </section>

      <p v-if="loading" class="loading"><span class="spinner"></span> 正在读取你的记录</p>
    </main>
  </div>
</template>

<style scoped>
.stats-page {
  height: 100%;
  overflow-y: auto;
  background:
    radial-gradient(90% 60% at 15% 0%, rgba(255, 255, 255, 0.05), transparent 60%),
    radial-gradient(70% 50% at 90% 10%, var(--accent-soft), transparent 65%),
    var(--bg);
}

.wrap {
  max-width: 1120px;
  margin: 0 auto;
  padding: 10px 28px 72px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.page-head {
  padding: 10px 2px 2px;
}

.page-head h1 {
  font-size: 26px;
  letter-spacing: 0.2em;
}

.sub {
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--text-faint);
  letter-spacing: 0.04em;
}

.overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.stat {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label {
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--text-faint);
}

.value {
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--text);
}

.stat-sub {
  font-size: 11.5px;
  color: var(--text-faint);
}

.two {
  display: grid;
  grid-template-columns: 1.55fr 1fr;
  gap: 16px;
}

.card {
  padding: 18px 18px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.empty {
  padding: 26px 4px;
  font-size: 12.5px;
  color: var(--text-faint);
  text-align: center;
}

.badges {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 10px;
}

.badge {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.02);
  opacity: 0.5;
  transition: all var(--transition);
  overflow: hidden;
}

.badge.on {
  opacity: 1;
  border-color: var(--accent-soft);
  background: linear-gradient(140deg, var(--accent-soft), rgba(255, 255, 255, 0.02));
}

.glyph {
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-family: var(--font-serif);
  font-size: 14px;
  border: 1px solid var(--line-strong);
  color: var(--text-dim);
}

.badge.on .glyph {
  color: var(--accent);
  border-color: var(--accent);
  box-shadow: 0 0 18px -6px var(--glow);
}

.b-text {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
  min-width: 0;
}

.b-text strong {
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: 0.06em;
}

.b-text em {
  font-style: normal;
  font-size: 10.5px;
  color: var(--text-faint);
}

.b-bar {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
}

.b-bar i {
  display: block;
  height: 100%;
  background: var(--accent);
  opacity: 0.6;
}

.records {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.record {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 12.5px;
}

.record:last-child {
  border-bottom: 0;
}

.when {
  display: flex;
  flex-direction: column;
  min-width: 108px;
  line-height: 1.4;
}

.when strong {
  font-weight: 500;
  color: var(--text-dim);
}

.when em {
  font-style: normal;
  font-size: 11px;
  color: var(--text-faint);
  font-family: var(--font-mono);
}

.scene-tag {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--c);
  border: 1px solid color-mix(in srgb, var(--c) 30%, transparent);
  padding: 1px 8px;
  border-radius: 999px;
}

.dur {
  flex: 1;
  font-family: var(--font-mono);
  color: var(--text);
}

.tasks {
  font-size: 11px;
  color: var(--text-faint);
}

.more {
  display: flex;
  justify-content: center;
  padding-top: 8px;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-faint);
  padding: 20px;
}

@media (max-width: 900px) {
  .overview {
    grid-template-columns: repeat(2, 1fr);
  }
  .two {
    grid-template-columns: 1fr;
  }
  .wrap {
    padding: 8px 16px 60px;
  }
}
</style>
