<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from './stores/user.js';
import { useSceneStore } from './stores/scene.js';
import { useYuejianStore } from './stores/yuejian.js';

const router = useRouter();
const user = useUserStore();
const scene = useSceneStore();
const yuejian = useYuejianStore();

function hexToRgba(hex, alpha) {
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 场景主色注入全局 CSS 变量，全站配色跟随当前场景
const themeStyle = computed(() => ({
  '--accent': scene.meta.accent,
  '--accent-soft': hexToRgba(scene.meta.accent, 0.16),
  '--glow': scene.meta.glow,
}));

function handleUnauthorized() {
  user.logout();
  yuejian.reset();
  if (router.currentRoute.value.meta?.auth) router.push({ name: 'login' });
}

onMounted(() => window.addEventListener('liujing:unauthorized', handleUnauthorized));
onBeforeUnmount(() => window.removeEventListener('liujing:unauthorized', handleUnauthorized));
</script>

<template>
  <div class="app-shell" :style="themeStyle">
    <router-view v-slot="{ Component }">
      <transition name="route" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<style>
.app-shell {
  height: 100%;
  position: relative;
  isolation: isolate;
}

.route-enter-active,
.route-leave-active {
  transition: opacity 280ms ease, transform 280ms cubic-bezier(0.22, 0.61, 0.36, 1);
}

.route-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.route-leave-to {
  opacity: 0;
}
</style>
