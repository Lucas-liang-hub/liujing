<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from '../components/AppHeader.vue';
import { useUserStore } from '../stores/user.js';
import { useSceneStore } from '../stores/scene.js';
import { useYuejianStore } from '../stores/yuejian.js';
import { SCENE_META } from '../scenes/index.js';

const router = useRouter();
const user = useUserStore();
const scene = useSceneStore();
const yuejian = useYuejianStore();

const form = reactive({
  nickname: '',
  scene: 'sakura',
  focusMinutes: 25,
  breakMinutes: 5,
  dailyGoalMinutes: 120,
});

const saving = ref(false);
const savedAt = ref('');
const error = ref('');

const llmText = computed(() =>
  yuejian.llmEnabled ? '已启用大模型增强对话' : '当前为规则语库保底（未配置 LLM_API_KEY）',
);

function fill() {
  const p = user.prefs;
  form.nickname = user.nickname || '';
  form.scene = p.scene;
  form.focusMinutes = p.focusMinutes;
  form.breakMinutes = p.breakMinutes;
  form.dailyGoalMinutes = p.dailyGoalMinutes;
}

async function save() {
  saving.value = true;
  error.value = '';
  try {
    await user.updateProfile({
      nickname: form.nickname.trim() || undefined,
      prefs: {
        scene: form.scene,
        sound: scene.soundType,
        soundOn: scene.soundOn,
        volume: scene.volume,
        focusMinutes: Number(form.focusMinutes),
        breakMinutes: Number(form.breakMinutes),
        dailyGoalMinutes: Number(form.dailyGoalMinutes),
      },
    });
    scene.setScene(form.scene);
    savedAt.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } catch (err) {
    error.value = err.message;
  } finally {
    saving.value = false;
  }
}

function logout() {
  user.logout();
  yuejian.reset();
  router.push({ name: 'login' });
}

onMounted(async () => {
  await user.fetchProfile().catch(() => null);
  await yuejian.init();
  fill();
});

defineExpose({ fill });
</script>

<template>
  <div class="settings-page">
    <AppHeader @logout="logout" />

    <main class="wrap">
      <header class="page-head">
        <h1>设置</h1>
        <p class="sub">这里的东西只影响你自己的自习室</p>
      </header>

      <section class="card glass">
        <header class="card-head"><span class="panel-title">个人</span></header>
        <div class="row">
          <label class="field grow">
            <span class="field-label">昵称</span>
            <input v-model="form.nickname" class="input" maxlength="20" placeholder="月见会这样称呼你" />
          </label>
          <div class="field">
            <span class="field-label">用户名</span>
            <p class="readonly">{{ user.user?.username }}</p>
          </div>
        </div>
      </section>

      <section class="card glass">
        <header class="card-head">
          <span class="panel-title">默认场景</span>
          <span class="hint">每次进入自习室时的氛围</span>
        </header>
        <div class="scenes">
          <button
            v-for="s in SCENE_META"
            :key="s.id"
            class="scene"
            :class="{ on: form.scene === s.id }"
            :style="{ '--dot': s.accent }"
            @click="form.scene = s.id"
          >
            <span class="dot"></span>
            {{ s.name }}
          </button>
        </div>
      </section>

      <section class="card glass">
        <header class="card-head">
          <span class="panel-title">节奏</span>
          <span class="hint">也可在自习室临时调整</span>
        </header>
        <div class="row">
          <label class="field">
            <span class="field-label">专注时长（分钟）</span>
            <input v-model.number="form.focusMinutes" class="input" type="number" min="5" max="180" />
          </label>
          <label class="field">
            <span class="field-label">休息时长（分钟）</span>
            <input v-model.number="form.breakMinutes" class="input" type="number" min="1" max="60" />
          </label>
          <label class="field">
            <span class="field-label">每日目标（分钟）</span>
            <input v-model.number="form.dailyGoalMinutes" class="input" type="number" min="30" max="720" />
          </label>
        </div>
        <p class="hint">目标会显示在计时器下方，作为当天进度的参照。</p>
      </section>

      <section class="card glass">
        <header class="card-head">
          <span class="panel-title">月见</span>
          <span class="chip">{{ yuejian.llmEnabled ? '增强对话' : '规则陪伴' }}</span>
        </header>
        <p class="hint">{{ llmText }}</p>
        <p class="hint">
          想让她更懂你，可以在后端 <code>.env</code> 里填入 <code>LLM_API_KEY</code>（DeepSeek 或阿里百炼），保存后重启服务即可自动启用，无需改代码。
        </p>
      </section>

      <div class="actions">
        <button class="btn btn-primary" :disabled="saving" @click="save">
          <span v-if="saving" class="spinner"></span>
          {{ saving ? '保存中' : '保存设置' }}
        </button>
        <span v-if="savedAt" class="hint">已于 {{ savedAt }} 保存</span>
        <button class="btn btn-ghost danger" @click="logout">退出登录</button>
      </div>

      <p v-if="error" class="error-text">{{ error }}</p>
    </main>
  </div>
</template>

<style scoped>
.settings-page {
  height: 100%;
  overflow-y: auto;
  background:
    radial-gradient(80% 50% at 80% 0%, var(--accent-soft), transparent 60%),
    var(--bg);
}

.wrap {
  max-width: 760px;
  margin: 0 auto;
  padding: 10px 28px 72px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-head h1 {
  font-size: 26px;
  letter-spacing: 0.2em;
}

.sub {
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--text-faint);
}

.card {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.row {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

.grow {
  flex: 1;
  min-width: 200px;
}

.readonly {
  padding: 12px 0;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-dim);
}

.scenes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 8px;
}

.scene {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.02);
  font-size: 12.5px;
  color: var(--text-dim);
  transition: all var(--transition);
}

.scene:hover {
  border-color: var(--line-strong);
}

.scene.on {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--text);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dot);
  box-shadow: 0 0 10px var(--dot);
}

.sounds {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

code {
  font-family: var(--font-mono);
  font-size: 11.5px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.07);
  color: var(--text-dim);
}

.actions {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-top: 6px;
}

.danger {
  margin-left: auto;
  color: #ff9b9b;
}

.danger:hover {
  background: rgba(255, 120, 120, 0.1);
}
</style>
