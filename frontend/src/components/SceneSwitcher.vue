<script setup>
import { onMounted, ref } from 'vue';
import { SCENE_META } from '../scenes/index.js';
import { useSceneStore } from '../stores/scene.js';

const scene = useSceneStore();
const expanded = ref(true);

const emit = defineEmits(['change']);

function choose(id) {
  scene.setScene(id);
  emit('change', id);
}

onMounted(() => {
  if (window.innerWidth < 900) expanded.value = false;
});
</script>

<template>
  <section class="switcher glass">
    <header class="head" @click="expanded = !expanded">
      <span class="panel-title">场景</span>
      <span class="toggle">{{ expanded ? '收起' : '展开' }}</span>
    </header>

    <div class="grid" v-show="expanded">
      <button
        v-for="s in SCENE_META"
        :key="s.id"
        class="scene"
        :class="{ on: scene.current === s.id }"
        :style="{ '--dot': s.accent }"
        @click="choose(s.id)"
      >
        <span class="dot"></span>
        <span class="names">
          <strong>{{ s.name }}</strong>
          <em>{{ s.mood }}</em>
        </span>
      </button>
    </div>

    <p class="desc" v-show="expanded">{{ scene.meta.desc }}</p>
  </section>
</template>

<style scoped>
.switcher {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.toggle {
  font-size: 11px;
  color: var(--text-faint);
}

.grid {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.scene {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 9px;
  border-radius: 10px;
  border: 1px solid transparent;
  text-align: left;
  transition: all var(--transition);
}

.scene:hover {
  background: rgba(255, 255, 255, 0.05);
}

.scene.on {
  background: rgba(255, 255, 255, 0.07);
  border-color: var(--line-strong);
}

.dot {
  width: 9px;
  height: 9px;
  flex: 0 0 9px;
  border-radius: 50%;
  background: var(--dot);
  box-shadow: 0 0 12px var(--dot);
  opacity: 0.55;
  transition: opacity var(--transition), transform var(--transition);
}

.scene.on .dot {
  opacity: 1;
  transform: scale(1.18);
}

.names {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
  min-width: 0;
}

.names strong {
  font-family: var(--font-serif);
  font-weight: 500;
  font-size: 13px;
  letter-spacing: 0.06em;
  color: var(--text-dim);
}

.scene.on .names strong {
  color: var(--text);
}

.names em {
  font-style: normal;
  font-size: 10.5px;
  color: var(--text-faint);
}

.desc {
  font-size: 11.5px;
  color: var(--text-faint);
  line-height: 1.6;
  border-top: 1px solid var(--line);
  padding-top: 10px;
}
</style>
