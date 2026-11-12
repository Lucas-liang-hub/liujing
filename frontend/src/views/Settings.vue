<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from '../components/AppHeader.vue';
import { useUserStore } from '../stores/user.js';
import { useSceneStore } from '../stores/scene.js';
import { useYuejianStore } from '../stores/yuejian.js';
import { SCENE_META } from '../scenes/index.js';
import { aiApi } from '../api/index.js';

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

/* ── 月见 · 大模型运行时配置 ─────────────────── */
const llmStatus = ref(null); // { configured, source, baseUrl, model, keyMasked }
const llmForm = reactive({ apiKey: '', baseUrl: '', model: '' });
const llmSaving = ref(false);
const llmMsg = ref('');

async function loadLlm() {
  try {
    llmStatus.value = await aiApi.getLlm();
    if (llmStatus.value.source === 'env') {
      llmForm.baseUrl = llmStatus.value.baseUrl || '';
      llmForm.model = llmStatus.value.model || '';
    } else {
      llmForm.baseUrl = llmStatus.value.baseUrl || '';
      llmForm.model = llmStatus.value.model || '';
    }
  } catch {
    llmStatus.value = null;
  }
}

async function saveLlm() {
  if (!llmForm.apiKey.trim()) {
    llmMsg.value = '请填写 API Key';
    return;
  }
  llmSaving.value = true;
  llmMsg.value = '';
  try {
    llmStatus.value = await aiApi.setLlm({
      apiKey: llmForm.apiKey.trim(),
      baseUrl: llmForm.baseUrl.trim(),
      model: llmForm.model.trim(),
    });
    llmForm.apiKey = '';
    await yuejian.init();
    llmMsg.value = '已生效，月见现在用这个模型说话了';
  } catch (err) {
    llmMsg.value = err.message;
  } finally {
    llmSaving.value = false;
  }
}

async function resetLlm() {
  llmSaving.value = true;
  llmMsg.value = '';
  try {
    llmStatus.value = await aiApi.clearLlm();
    await yuejian.init();
    llmMsg.value = llmStatus.value.configured ? '已恢复为 .env 配置' : '已清除，月见回到规则语库陪伴';
  } catch (err) {
    llmMsg.value = err.message;
  } finally {
    llmSaving.value = false;
  }
}

async function testLlm() {
  llmSaving.value = true;
  llmMsg.value = '';
  try {
    const res = await aiApi.testLlm();
    llmMsg.value = res.ok ? `连接正常，模型回复：${res.reply}` : `连接失败：${res.error}`;
  } catch (err) {
    llmMsg.value = err.message;
  } finally {
    llmSaving.value = false;
  }
}

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
    // 只在真的修改了默认场景时才应用，避免「没动下拉框直接保存」把自习室手动选的场景冲掉
    const sceneChanged = form.scene !== user.prefs.scene;
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
    if (sceneChanged) scene.setScene(form.scene);
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
  await loadLlm();
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
          <span class="panel-title">月见 · 大模型</span>
          <span class="chip">{{ yuejian.llmEnabled ? '增强对话' : '规则陪伴' }}</span>
        </header>

        <div class="llm-status" v-if="llmStatus">
          <span class="st-dot" :class="{ on: llmStatus.configured }"></span>
          <span class="st-text">
            {{ llmStatus.configured ? `已连接 · ${llmStatus.model}` : '未配置 · 走规则语库保底' }}
          </span>
          <span class="st-tag" v-if="llmStatus.configured">
            {{ llmStatus.source === 'runtime' ? '页面配置' : '.env 默认' }}
          </span>
          <code class="st-key" v-if="llmStatus.keyMasked">{{ llmStatus.keyMasked }}</code>
        </div>

        <div class="llm-grid">
          <label class="field">
            <span class="field-label">API Key</span>
            <input v-model="llmForm.apiKey" class="input" type="password" autocomplete="off" placeholder="sk-..." />
          </label>
          <label class="field">
            <span class="field-label">接口地址（OpenAI 兼容）</span>
            <input v-model="llmForm.baseUrl" class="input" list="llm-presets" placeholder="https://api.deepseek.com/v1" />
            <datalist id="llm-presets">
              <option value="https://api.deepseek.com/v1">DeepSeek</option>
              <option value="https://dashscope.aliyuncs.com/compatible-mode/v1">阿里百炼</option>
            </datalist>
          </label>
          <label class="field">
            <span class="field-label">模型</span>
            <input v-model="llmForm.model" class="input" placeholder="deepseek-chat" />
          </label>
        </div>

        <div class="llm-actions">
          <button class="btn btn-primary" :disabled="llmSaving" @click="saveLlm">
            {{ llmSaving ? '处理中' : '保存并启用' }}
          </button>
          <button class="btn btn-ghost" :disabled="llmSaving" @click="testLlm">测试连接</button>
          <button class="btn btn-ghost" :disabled="llmSaving" @click="resetLlm">恢复 .env 默认</button>
          <span v-if="llmMsg" class="hint">{{ llmMsg }}</span>
        </div>

        <p class="hint">Key 只保存在后端，页面与网络传输中仅显示打码值；切换立即生效，无需重启。</p>
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

/* 月见 · 大模型配置 */
.llm-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.st-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
  background: var(--text-faint);
}

.st-dot.on {
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

.st-text {
  font-size: 12.5px;
  color: var(--text-dim);
}

.st-tag {
  font-size: 10.5px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--line);
  color: var(--text-faint);
}

.st-key {
  margin-left: auto;
  font-size: 11px;
}

.llm-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

@media (min-width: 640px) {
  .llm-grid {
    grid-template-columns: 2fr 2fr 1fr;
  }
}

.llm-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
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
