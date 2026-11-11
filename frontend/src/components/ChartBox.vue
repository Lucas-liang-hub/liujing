<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import echarts from '../utils/echarts.js';

const props = defineProps({
  option: { type: Object, required: true },
  height: { type: String, default: '240px' },
});

const el = ref(null);
let chart = null;
let observer = null;

function render() {
  if (!chart) return;
  chart.setOption(props.option, true);
}

onMounted(async () => {
  await nextTick();
  if (!el.value) return;
  chart = echarts.init(el.value, null, { renderer: 'canvas' });
  render();
  observer = new ResizeObserver(() => chart?.resize());
  observer.observe(el.value);
});

watch(() => props.option, render, { deep: true });

onBeforeUnmount(() => {
  observer?.disconnect();
  chart?.dispose();
  chart = null;
});
</script>

<template>
  <div ref="el" class="chart" :style="{ height }"></div>
</template>

<style scoped>
.chart {
  width: 100%;
}
</style>
