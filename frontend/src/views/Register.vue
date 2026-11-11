<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import AuthLayout from '../components/AuthLayout.vue';
import { useUserStore } from '../stores/user.js';

const router = useRouter();
const user = useUserStore();

const form = ref({ username: '', nickname: '', password: '', confirm: '' });
const localError = ref('');

async function submit() {
  localError.value = '';
  if (form.value.password !== form.value.confirm) {
    localError.value = '两次输入的密码不一致';
    return;
  }
  const ok = await user.register({
    username: form.value.username.trim(),
    nickname: form.value.nickname.trim() || undefined,
    password: form.value.password,
  });
  if (ok) router.push('/');
}
</script>

<template>
  <AuthLayout title="给自己留个位置" subtitle="从今天开始，把时间存进流境">
    <form class="form" @submit.prevent="submit">
      <label class="field">
        <span class="field-label">用户名</span>
        <input
          v-model="form.username"
          class="input"
          autocomplete="username"
          placeholder="3-20 位字母、数字或下划线"
          required
        />
      </label>

      <label class="field">
        <span class="field-label">昵称（可选）</span>
        <input v-model="form.nickname" class="input" maxlength="20" placeholder="月见会这样称呼你" />
      </label>

      <div class="row">
        <label class="field">
          <span class="field-label">密码</span>
          <input v-model="form.password" class="input" type="password" autocomplete="new-password" placeholder="至少 6 位" required />
        </label>
        <label class="field">
          <span class="field-label">确认密码</span>
          <input v-model="form.confirm" class="input" type="password" autocomplete="new-password" placeholder="再输一次" required />
        </label>
      </div>

      <p v-if="localError || user.error" class="error-text">{{ localError || user.error }}</p>

      <button class="btn btn-primary submit" type="submit" :disabled="user.loading">
        <span v-if="user.loading" class="spinner"></span>
        <span>{{ user.loading ? '正在创建' : '开始第一次自习' }}</span>
      </button>

      <p class="alt">
        已经有位置了？
        <router-link to="/login" class="link">直接进入</router-link>
      </p>
    </form>
  </AuthLayout>
</template>

<style scoped>
.form {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.submit {
  width: 100%;
  margin-top: 4px;
  padding: 12px;
}

.alt {
  text-align: center;
  font-size: 12px;
  color: var(--text-faint);
}

.link {
  color: var(--accent);
  border-bottom: 1px solid transparent;
  transition: border-color var(--transition);
}

.link:hover {
  border-color: var(--accent);
}
</style>
