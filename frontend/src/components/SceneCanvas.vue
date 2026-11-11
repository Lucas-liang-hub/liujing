<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createSceneEngine } from '../scenes/engine.js';
import { useSceneStore } from '../stores/scene.js';

const scene = useSceneStore();
const canvasRef = ref(null);
const ready = ref(false);

// 引擎实例刻意不放进 ref：内部持有粒子数组，绝不能进入响应式系统
let engine = null;
let observer = null;

function onVisibility() {
  if (!engine) return;
  if (document.hidden) engine.stop();
  else engine.start();
}

onMounted(async () => {
  engine = createSceneEngine(canvasRef.value);
  engine.resize();
  await engine.load(scene.current);
  engine.start();
  ready.value = true;

  observer = new ResizeObserver(() => engine?.resize());
  observer.observe(canvasRef.value);
  document.addEventListener('visibilitychange', onVisibility);
});

watch(
  () => scene.current,
  async (id) => {
    if (!engine) return;
    await engine.load(id);
  },
);

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility);
  observer?.disconnect();
  engine?.destroy();
  engine = null;
});
</script>

<template>
  <div class="scene-canvas" :class="{ ready }">
    <canvas ref="canvasRef"></canvas>
    <div class="scene-vignette"></div>
  </div>
</template>

<style scoped>
.scene-canvas {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--bg);
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 900ms ease;
}

.ready canvas {
  opacity: 1;
}

/* 四周压暗，让中间内容浮起来 */
.scene-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(120% 90% at 50% 45%, rgba(0, 0, 0, 0) 35%, rgba(0, 0, 0, 0.55) 100%),
    linear-gradient(180deg, rgba(4, 6, 10, 0.55) 0%, rgba(4, 6, 10, 0) 22%, rgba(4, 6, 10, 0) 72%, rgba(4, 6, 10, 0.6) 100%);
}
</style>
