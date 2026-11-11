<script setup>
import { computed } from 'vue';
import { SOUND_OPTIONS, getAmbient } from '../utils/ambient.js';
import { useSceneStore } from '../stores/scene.js';

const scene = useSceneStore();
const ambient = getAmbient();

const sounds = SOUND_OPTIONS.filter((s) => s.id !== 'none');

const activeName = computed(
  () => SOUND_OPTIONS.find((s) => s.id === scene.soundType)?.name || '雨声',
);

function toggle() {
  const on = scene.toggleSound();
  if (on) ambient.play(scene.soundType === 'none' ? 'rain' : scene.soundType);
  else ambient.stop();
}

function choose(id) {
  scene.setSoundType(id);
  scene.toggleSound(true);
  ambient.play(id);
}

function onVolume(e) {
  const v = scene.setVolume(Number(e.target.value) / 100);
  ambient.setVolume(v);
}

function previewVolume() {
  if (!scene.soundOn) toggle();
  ambient.setVolume(scene.volume);
}
</script>

<template>
  <div class="sound-menu">
    <div class="row">
      <div class="now">
        <span class="pulse" :class="{ on: scene.soundOn }"></span>
        <span class="name">{{ scene.soundOn ? activeName : '已静音' }}</span>
      </div>
      <button
        class="switch"
        :class="{ on: scene.soundOn }"
        role="switch"
        :aria-checked="scene.soundOn"
        :title="scene.soundOn ? '关闭环境音' : '开启环境音'"
        @click="toggle"
      >
        <span class="knob"></span>
      </button>
    </div>

    <div class="chips">
      <button
        v-for="s in sounds"
        :key="s.id"
        class="chip"
        :class="{ on: scene.soundOn && scene.soundType === s.id }"
        @click="choose(s.id)"
      >
        {{ s.name }}
      </button>
    </div>

    <label class="vol">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
        <path d="M4 9v6h3.2L12 18.5v-13L7.2 9H4z" />
        <path d="M15.5 9.5a3.5 3.5 0 010 5" />
      </svg>
      <input
        type="range"
        min="0"
        max="100"
        :value="Math.round(scene.volume * 100)"
        :style="{ '--v': Math.round(scene.volume * 100) }"
        aria-label="环境音音量"
        @input="onVolume"
        @change="previewVolume"
      />
      <span class="num">{{ Math.round(scene.volume * 100) }}</span>
    </label>

    <p class="credit">自然录音来自开源项目 Blanket</p>
  </div>
</template>

<style scoped>
.sound-menu {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 224px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.now {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-faint);
  transition: all var(--transition);
}

.pulse.on {
  background: var(--accent);
  box-shadow: 0 0 10px var(--accent);
  animation: breath 2.6s ease-in-out infinite;
}

.name {
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--text-dim);
  white-space: nowrap;
}

/* 开关 */
.switch {
  position: relative;
  width: 34px;
  height: 18px;
  flex: 0 0 34px;
  border-radius: 999px;
  border: 1px solid var(--line-strong);
  background: rgba(255, 255, 255, 0.05);
  transition: all var(--transition);
}

.switch .knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--text-faint);
  transition: all var(--transition);
}

.switch.on {
  border-color: var(--accent-soft);
  background: var(--accent-soft);
}

.switch.on .knob {
  left: 18px;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

/* 音效九宫格 */
.chips {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
}

.chip {
  padding: 6px 0;
  border-radius: 8px;
  border: 1px solid var(--line);
  font-size: 11.5px;
  letter-spacing: 0.06em;
  color: var(--text-faint);
  transition: all var(--transition);
}

.chip:hover {
  color: var(--text-dim);
  border-color: var(--line-strong);
  background: rgba(255, 255, 255, 0.04);
}

.chip.on {
  color: var(--text);
  border-color: var(--accent-soft);
  background: var(--accent-soft);
}

/* 音量 */
.vol {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-faint);
}

.vol input[type='range'] {
  flex: 1;
  height: 3px;
  -webkit-appearance: none;
  appearance: none;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    var(--accent) 0,
    var(--accent) calc(var(--v, 50) * 1%),
    rgba(255, 255, 255, 0.1) calc(var(--v, 50) * 1%),
    rgba(255, 255, 255, 0.1) 100%
  );
  outline: none;
}

.vol input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text);
  box-shadow: 0 0 6px var(--glow);
  cursor: pointer;
}

.num {
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  color: var(--text-faint);
  width: 22px;
  text-align: right;
}

.credit {
  font-size: 10px;
  color: var(--text-faint);
  opacity: 0.7;
  letter-spacing: 0.04em;
}

@keyframes breath {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}
</style>
