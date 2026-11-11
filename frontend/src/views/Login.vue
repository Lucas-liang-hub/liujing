<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AuthLayout from '../components/AuthLayout.vue';
import { useUserStore } from '../stores/user.js';

const router = useRouter();
const route = useRoute();
const user = useUserStore();

const form = ref({ username: '', password: '' });

async function submit() {
  const ok = await user.login({ username: form.value.username.trim(), password: form.value.password });
  if (ok) {
    await user.fetchProfile();
    router.push(typeof route.query.redirect === 'string' ? route.query.redirect : '/');
  }
}
</script>

<template>
  <AuthLayout title="回到你的安静里" subtitle="继续上次没走完的那段路">
    <form class="form" @submit.prevent="submit">
      <label class="field">
        <span class="field-label">用户名</span>
        <input v-model="form.username" class="input" autocomplete="username" placeholder="输入用户名" required />
      </label>

      <label class="field">
        <span class="field-label">密码</span>
        <input
          v-model="form.password"
          class="input"
          type="password"
          autocomplete="current-password"
          placeholder="输入密码"
          required
        />
      </label>

      <p v-if="user.error" class="error-text">{{ user.error }}</p>

      <button class="btn btn-primary submit" type="submit" :disabled="user.loading">
        <span v-if="user.loading" class="spinner"></span>
        <span>{{ user.loading ? '正在进入' : '进入自习室' }}</span>
      </button>

      <p class="alt">
        还没有座位？
        <router-link to="/register" class="link">创建一个</router-link>
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
