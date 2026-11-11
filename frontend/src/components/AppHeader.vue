<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '../stores/user.js';
import { useSceneStore } from '../stores/scene.js';
import { getAmbient } from '../utils/ambient.js';
import SoundMenu from './SoundMenu.vue';

const emit = defineEmits(['logout']);

const route = useRoute();
const router = useRouter();
const user = useUserStore();
const scene = useSceneStore();

const navs = [
  { name: 'study', label: '自习室' },
  { name: 'stats', label: '沉淀' },
  { name: 'settings', label: '设置' },
];

const initial = computed(() => (user.nickname || '客').slice(0, 1));

const soundOpen = ref(false);
const soundWrap = ref(null);

function go(name) {
  if (route.name !== name) router.push({ name });
}

function onDocClick(e) {
  if (!soundOpen.value) return;
  if (soundWrap.value && !soundWrap.value.contains(e.target)) soundOpen.value = false;
}

function onEsc(e) {
  if (e.key === 'Escape') soundOpen.value = false;
}

function handleLogout() {
  soundOpen.value = false;
  getAmbient().stop();
  emit('logout');
}

onMounted(() => {
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onEsc);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick);
  document.removeEventListener('keydown', onEsc);
});
</script>

<template>
  <header class="app-header">
    <div class="brand" @click="go('study')">
      <span class="logo">流境</span>
      <span class="tagline">沉浸式自习室</span>
    </div>

    <nav class="nav">
      <button
        v-for="n in navs"
        :key="n.name"
        class="nav-item"
        :class="{ active: route.name === n.name }"
        @click="go(n.name)"
      >
        {{ n.label }}
      </button>
    </nav>

    <div class="tools">
      <div ref="soundWrap" class="sound-wrap">
        <button
          class="icon-btn"
          :class="{ on: scene.soundOn, open: soundOpen }"
          :title="'环境音' + (scene.soundOn ? '（播放中）' : '（已关闭）')"
          :aria-expanded="soundOpen"
          @click="soundOpen = !soundOpen"
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <path d="M4 9v6h3.5L13 19V5L7.5 9H4z" />
            <path v-if="scene.soundOn" d="M16.5 9.2a4 4 0 010 5.6M19 7a7.5 7.5 0 010 10" />
            <path v-else d="M17 10l4 4M21 10l-4 4" />
          </svg>
        </button>

        <transition name="pop">
          <div v-if="soundOpen" class="sound-pop glass">
            <SoundMenu />
          </div>
        </transition>
      </div>

      <div class="user">
        <span class="avatar">{{ initial }}</span>
        <span class="nick">{{ user.nickname }}</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 18px 28px 12px;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.logo {
  font-family: var(--font-serif);
  font-size: 19px;
  letter-spacing: 0.3em;
  color: var(--text);
  text-shadow: 0 0 24px var(--glow);
}

.tagline {
  font-size: 10.5px;
  letter-spacing: 0.22em;
  color: var(--text-faint);
}

.nav {
  display: flex;
  gap: 4px;
  margin-left: auto;
  margin-right: auto;
}

.nav-item {
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12.5px;
  letter-spacing: 0.12em;
  color: var(--text-faint);
  transition: all var(--transition);
}

.nav-item:hover {
  color: var(--text-dim);
  background: rgba(255, 255, 255, 0.04);
}

.nav-item.active {
  color: var(--text);
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid var(--line);
}

.tools {
  display: flex;
  align-items: center;
  gap: 14px;
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid var(--line);
  color: var(--text-dim);
  transition: all var(--transition);
}

.icon-btn:hover {
  color: var(--text);
  border-color: var(--line-strong);
}

.icon-btn.on {
  color: var(--accent);
  border-color: var(--accent-soft);
  background: var(--accent-soft);
}

.icon-btn.open {
  color: var(--text);
  border-color: var(--line-strong);
  background: rgba(255, 255, 255, 0.07);
}

.sound-wrap {
  position: relative;
}

.sound-pop {
  position: absolute;
  top: 40px;
  right: -10px;
  z-index: 40;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--line-strong);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
}

.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

.user {
  display: flex;
  align-items: center;
  gap: 8px;
}

.avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--accent-soft);
  border: 1px solid var(--line-strong);
  font-size: 11.5px;
  color: var(--text);
}

.nick {
  font-size: 12.5px;
  color: var(--text-dim);
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .app-header {
    padding: 14px 16px 8px;
    gap: 12px;
  }
  .tagline,
  .nick {
    display: none;
  }
  .nav {
    margin-right: 0;
  }
  .nav-item {
    padding: 6px 10px;
    letter-spacing: 0.06em;
  }
}
</style>
