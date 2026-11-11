import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { authApi } from '../api/index.js';
import { clearToken, getToken, setToken } from '../api/client.js';

export const DEFAULT_PREFS = Object.freeze({
  scene: 'sakura',
  sound: 'rain',
  soundOn: false,
  focusMinutes: 25,
  breakMinutes: 5,
  dailyGoalMinutes: 120,
});

export const useUserStore = defineStore('user', () => {
  const user = ref(null);
  const token = ref(getToken());
  const loading = ref(false);
  const error = ref('');

  const loggedIn = computed(() => Boolean(token.value));
  const nickname = computed(() => user.value?.nickname || user.value?.username || '');
  const prefs = computed(() => ({ ...DEFAULT_PREFS, ...(user.value?.prefs || {}) }));

  function applyAuth(data) {
    setToken(data.token);
    token.value = data.token;
    user.value = data.user;
  }

  async function login(payload) {
    loading.value = true;
    error.value = '';
    try {
      applyAuth(await authApi.login(payload));
      return true;
    } catch (err) {
      error.value = err.message;
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function register(payload) {
    loading.value = true;
    error.value = '';
    try {
      applyAuth(await authApi.register(payload));
      return true;
    } catch (err) {
      error.value = err.message;
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function fetchProfile() {
    if (!token.value) return null;
    try {
      const data = await authApi.profile();
      user.value = data.user;
      return data.user;
    } catch {
      logout();
      return null;
    }
  }

  async function updateProfile(payload) {
    const data = await authApi.updateProfile(payload);
    user.value = data.user;
    return data.user;
  }

  /** 本地乐观更新偏好（设置页即时反馈），失败再回滚由调用方处理 */
  function patchLocalPrefs(patch) {
    if (!user.value) return;
    user.value = { ...user.value, prefs: { ...prefs.value, ...patch } };
  }

  function logout() {
    clearToken();
    token.value = '';
    user.value = null;
  }

  return {
    user,
    token,
    loading,
    error,
    loggedIn,
    nickname,
    prefs,
    login,
    register,
    fetchProfile,
    updateProfile,
    patchLocalPrefs,
    logout,
  };
});
