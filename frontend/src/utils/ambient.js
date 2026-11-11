/**
 * 环境音效：用 Web Audio API 实时合成（决策见 PROJECT.md 决策记录）。
 * 不依赖任何音频素材文件，避免版权与外链风险，体积为零。
 */

function makeNoiseBuffer(ctx, seconds = 2) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    // 略作平滑的褐噪声，比纯白噪声更接近自然底噪
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

export function createAmbient() {
  let audio = null;
  let master = null;
  let sources = [];
  let timer = null;
  let currentType = 'none';

  function ensure() {
    if (!audio) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      audio = new Ctor();
      master = audio.createGain();
      master.gain.value = 0.5;
      master.connect(audio.destination);
    }
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    return audio;
  }

  function clearNodes() {
    sources.forEach((node) => {
      try {
        node.stop?.(0);
        node.disconnect?.();
      } catch {
        /* 已停止的节点忽略 */
      }
    });
    sources = [];
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function buildRain(ctx) {
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 3);
    noise.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1600;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 220;

    const g = ctx.createGain();
    g.gain.value = 0.34;

    noise.connect(hp).connect(lp).connect(g).connect(master);
    noise.start();
    sources.push(noise, hp, lp, g);
  }

  function buildStream(ctx) {
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 3);
    noise.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 720;
    bp.Q.value = 0.8;

    const g = ctx.createGain();
    g.gain.value = 0.3;

    noise.connect(bp).connect(g).connect(master);
    noise.start();
    sources.push(noise, bp, g);

    // 缓慢起伏，模拟水流强弱
    timer = setInterval(() => {
      const t = ctx.currentTime;
      bp.frequency.cancelScheduledValues(t);
      bp.frequency.linearRampToValueAtTime(620 + Math.random() * 260, t + 1.6);
    }, 1800);
  }

  function buildWind(ctx) {
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 4);
    noise.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;

    const g = ctx.createGain();
    g.gain.value = 0.28;

    noise.connect(lp).connect(g).connect(master);
    noise.start();
    sources.push(noise, lp, g);

    timer = setInterval(() => {
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.linearRampToValueAtTime(0.16 + Math.random() * 0.18, t + 2.4);
      lp.frequency.linearRampToValueAtTime(300 + Math.random() * 260, t + 2.4);
    }, 2600);
  }

  function buildNight(ctx) {
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 3);
    noise.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3800;
    bp.Q.value = 0.6;

    const g = ctx.createGain();
    g.gain.value = 0.08;

    noise.connect(bp).connect(g).connect(master);
    noise.start();
    sources.push(noise, bp, g);

    // 稀疏虫鸣
    timer = setInterval(() => {
      if (Math.random() > 0.55) return;
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 2400 + Math.random() * 900;
      og.gain.value = 0;
      osc.connect(og).connect(master);
      const t = ctx.currentTime;
      og.gain.linearRampToValueAtTime(0.05, t + 0.02);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.start(t);
      osc.stop(t + 0.24);
    }, 1400);
  }

  function play(type) {
    const ctx = ensure();
    if (!ctx) return false;
    clearNodes();
    currentType = type;
    if (type === 'rain') buildRain(ctx);
    else if (type === 'stream') buildStream(ctx);
    else if (type === 'wind') buildWind(ctx);
    else if (type === 'night') buildNight(ctx);
    else currentType = 'none';
    return currentType !== 'none';
  }

  function stop() {
    clearNodes();
    currentType = 'none';
  }

  function setVolume(value) {
    if (!master) return;
    master.gain.value = Math.min(1, Math.max(0, Number(value) || 0));
  }

  function destroy() {
    stop();
    if (audio) {
      audio.close().catch(() => {});
      audio = null;
      master = null;
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
  { id: 'rain', name: '细雨' },
  { id: 'stream', name: '溪流' },
  { id: 'wind', name: '晚风' },
  { id: 'night', name: '夜虫' },
  { id: 'none', name: '静音' },
];
