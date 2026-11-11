/**
 * 环境音效：播放真实自然音频（OGG，位于 public/sounds/）。
 * 素材来自开源白噪音应用 Blanket（github.com/rafaelmardojai/blanket），
 * 许可：stream/wind CC0，summer-night/fireplace 公有领域，rain/waves CC BY（见 public/sounds/CREDITS.md）。
 * 旧版合成音已替换；接口与合成版一致（play/stop/setVolume/destroy）。
 */

const FILES = {
  rain: '/sounds/rain.ogg',
  stream: '/sounds/stream.ogg',
  wind: '/sounds/wind.ogg',
  'summer-night': '/sounds/summer-night.ogg',
  waves: '/sounds/waves.ogg',
  fireplace: '/sounds/fireplace.ogg',
};

// 旧版合成音 id 兼容映射
const LEGACY = { night: 'summer-night' };

function resolveSrc(type) {
  const id = LEGACY[type] || type;
  return FILES[id] ? { id, src: FILES[id] } : null;
}

export function createAmbient() {
  let audioEl = null;
  let currentType = 'none';
  let volume = 0.5;

  function ensureEl() {
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.loop = true;
      audioEl.preload = 'none';
      audioEl.volume = volume;
    }
    return audioEl;
  }

  function play(type) {
    const hit = resolveSrc(type);
    if (!hit) {
      stop();
      return false;
    }
    const el = ensureEl();
    const src = new URL(hit.src, window.location.origin).href;
    if (currentType === hit.id && el.src === src) {
      // 同一曲目：确保在播即可
      if (el.paused) el.play().catch(() => {});
      return true;
    }
    currentType = hit.id;
    el.pause();
    el.src = src;
    el.volume = volume;
    el.play().catch(() => {
      /* 自动播放被拦截时由用户手势再次触发 */
    });
    return true;
  }

  function stop() {
    if (audioEl) {
      audioEl.pause();
    }
    currentType = 'none';
  }

  function setVolume(value) {
    volume = Math.min(1, Math.max(0, Number(value) || 0));
    if (audioEl) audioEl.volume = volume;
  }

  function destroy() {
    stop();
    if (audioEl) {
      audioEl.src = '';
      audioEl = null;
    }
  }

  return {
    play,
    stop,
    setVolume,
    destroy,
    get type() {
      return currentType;
    },
  };
}

export const SOUND_OPTIONS = [
  { id: 'rain', name: '雨声' },
  { id: 'stream', name: '溪流' },
  { id: 'waves', name: '海浪' },
  { id: 'wind', name: '晚风' },
  { id: 'summer-night', name: '夏夜' },
  { id: 'fireplace', name: '篝火' },
  { id: 'none', name: '静音' },
];

/** 全站共享同一个音频实例：顶部面板 / 设置页 / 自习室操作的是同一路声音 */
let shared = null;
export function getAmbient() {
  if (!shared) shared = createAmbient();
  return shared;
}
