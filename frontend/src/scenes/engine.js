/**
 * Canvas 粒子引擎（技术方案 3.2）
 * - 粒子数据全部存放在普通 JS 数组/对象中，绝不进入 Vue 响应式系统
 * - 统一调度 6 个场景：切场景 = destroy 旧 + init 新
 * - rAF 驱动，dt 以秒传入，逻辑与绘制放在场景内部，便于单测（dt 驱动可测）
 */

import { loadScene } from './index.js';

export const rand = (min, max) => min + Math.random() * (max - min);
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/** 垂直渐变背景（resize 时重建，避免每帧创建 Gradient） */
export function makeBackdrop(ctx, w, h, colors) {
  const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
  colors.forEach((color, i) => g.addColorStop(i / Math.max(1, colors.length - 1), color));
  return g;
}

/** 径向光晕 */
export function radialGlow(ctx, x, y, radius, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/** 依据画布面积决定粒子数量，兼顾低端机 */
export function density(w, h, min, max, divisor = 14000) {
  const count = Math.round((w * h) / divisor);
  return clamp(count, min, max);
}

export function createSceneEngine(canvas) {
  const ctx = canvas.getContext('2d');
  let scene = null;
  let raf = 0;
  let last = 0;
  let running = false;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let currentId = null;
  let frames = 0;
  let fpsMark = 0;
  let fps = 60;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const nextW = Math.max(1, Math.round(rect.width));
    const nextH = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = nextW;
    height = nextH;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scene?.resize?.(width, height);
  }

  function frame(ts) {
    if (!running) return;
    const dt = last ? Math.min(0.06, (ts - last) / 1000) : 0.016;
    last = ts;

    if (scene) scene.update(dt);

    frames += 1;
    if (ts - fpsMark >= 1000) {
      fps = Math.round((frames * 1000) / (ts - fpsMark));
      frames = 0;
      fpsMark = ts;
    }
    raf = requestAnimationFrame(frame);
  }

  async function load(id) {
    const factory = await loadScene(id);
    if (!width || !height) resize();
    const next = factory();
    next.init(ctx, width, height);
    if (scene) scene.destroy?.();
    scene = next;
    currentId = id;
    return currentId;
  }

  function start() {
    if (running) return;
    running = true;
    last = 0;
    fpsMark = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function destroy() {
    stop();
    scene?.destroy?.();
    scene = null;
    currentId = null;
  }

  return {
    resize,
    load,
    start,
    stop,
    destroy,
    get fps() {
      return fps;
    },
    get id() {
      return currentId;
    },
    get isRunning() {
      return running;
    },
  };
}
