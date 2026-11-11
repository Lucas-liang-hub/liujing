import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { getSceneMeta, SCENE_IDS } from '../scenes/index.js';

const SCENE_KEY = 'liujing_scene';
const SOUND_KEY = 'liujing_sound';

/** 按时段推荐场景（首次进入且用户没手动选过时使用） */
export function recommendedScene(hour = new Date().getHours()) {
  if (hour < 7) return 'deepsea';
  if (hour < 10) return 'frost';
  if (hour < 13) return 'sakura';
  if (hour < 17) return 'autumn';
  if (hour < 20) return 'firefly';
  return 'star';
}

function readLocal(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

export const useSceneStore = defineStore('scene', () => {
  const stored = readLocal(SCENE_KEY, '');
  const current = ref(SCENE_IDS.includes(stored) ? stored : recommendedScene());
  const manual = ref(Boolean(stored));
  const focusMode = ref(false); // 全屏专注模式（隐藏周边 UI）
  const soundOn = ref(false);
  const soundType = ref(readLocal(SOUND_KEY, 'rain'));
  const volume = ref(0.5);

  const meta = computed(() => getSceneMeta(current.value));

  function setScene(id, { byUser = true } = {}) {
    if (!SCENE_IDS.includes(id)) return;
    current.value = id;
    if (byUser) {
      manual.value = true;
      try {
        localStorage.setItem(SCENE_KEY, id);
      } catch {
        /* 忽略 */
      }
    }
  }

  function nextScene() {
    const idx = SCENE_IDS.indexOf(current.value);
    setScene(SCENE_IDS[(idx + 1) % SCENE_IDS.length]);
  }

  function setSoundType(id) {
    soundType.value = id;
    try {
      localStorage.setItem(SOUND_KEY, id);
    } catch {
      /* 忽略 */
    }
  }

  function toggleSound(force) {
    soundOn.value = typeof force === 'boolean' ? force : !soundOn.value;
    return soundOn.value;
  }

  function toggleFocusMode(force) {
    focusMode.value = typeof force === 'boolean' ? force : !focusMode.value;
    return focusMode.value;
  }

  return {
    current,
    manual,
    focusMode,
    soundOn,
    soundType,
    volume,
    meta,
    setScene,
    nextScene,
    setSoundType,
    toggleSound,
    toggleFocusMode,
  };
});
