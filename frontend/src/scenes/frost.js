import { density, makeBackdrop, rand } from './engine.js';

const BG = ['#06121a', '#0d1f28', '#133036'];

/**
 * 霜花：离屏画布预生成冰晶枝杈纹理（只生成一次），
 * 叠加缓慢下落的霜粒。避免每帧重复画分形导致掉帧。
 */
export function createScene() {
  let ctx;
  let w = 0;
  let h = 0;
  let bg = null;
  let frost = null;
  let grains = [];
  let time = 0;

  function branch(c, x, y, angle, length, depth) {
    if (depth <= 0 || length < 3) return;
    const nx = x + Math.cos(angle) * length;
    const ny = y + Math.sin(angle) * length;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(nx, ny);
    c.stroke();

    const spread = rand(0.35, 0.8);
    branch(c, nx, ny, angle - spread, length * rand(0.55, 0.78), depth - 1);
    branch(c, nx, ny, angle + spread, length * rand(0.55, 0.78), depth - 1);
    if (Math.random() < 0.35) branch(c, nx, ny, angle + rand(-0.15, 0.15), length * 0.7, depth - 1);
  }

  function buildFrostTexture() {
    const off = document.createElement('canvas');
    off.width = Math.max(1, Math.round(w));
    off.height = Math.max(1, Math.round(h));
    const c = off.getContext('2d');
    c.strokeStyle = 'rgba(180,232,244,0.14)';
    c.lineWidth = 0.9;
    c.lineCap = 'round';

    const clusters = 9;
    for (let i = 0; i < clusters; i += 1) {
      const edge = i % 4;
      let x;
      let y;
      let angle;
      if (edge === 0) {
        x = rand(0, w);
        y = 0;
        angle = Math.PI / 2;
      } else if (edge === 1) {
        x = w;
        y = rand(0, h);
        angle = Math.PI;
      } else if (edge === 2) {
        x = rand(0, w);
        y = h;
        angle = -Math.PI / 2;
      } else {
        x = 0;
        y = rand(0, h);
        angle = 0;
      }
      branch(c, x, y, angle + rand(-0.5, 0.5), rand(30, 70), 4);
    }

    // 角落的一层薄雾，让霜感更实
    const g = c.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.2, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(160,225,240,0)');
    g.addColorStop(1, 'rgba(160,225,240,0.07)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    return off;
  }

  function seed() {
    const count = density(w, h, 60, 190, 7000);
    grains = Array.from({ length: count }, () => ({
      x: rand(0, w),
      y: rand(0, h),
      r: rand(0.4, 1.8),
      vy: rand(4, 16),
      vx: rand(-4, 4),
      alpha: rand(0.15, 0.6),
      phase: rand(0, Math.PI * 2),
    }));
  }

  return {
    init(context, width, height) {
      ctx = context;
      w = width;
      h = height;
      bg = makeBackdrop(ctx, w, h, BG);
      frost = buildFrostTexture();
      seed();
    },
    resize(width, height) {
      w = width;
      h = height;
      bg = makeBackdrop(ctx, w, h, BG);
      frost = buildFrostTexture();
      seed();
    },
    update(dt) {
      time += dt;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      if (frost) ctx.drawImage(frost, 0, 0, w, h);

      for (let i = 0; i < grains.length; i += 1) {
        const p = grains[i];
        p.y += p.vy * dt;
        p.x += (p.vx + Math.sin(time * 0.6 + p.phase) * 5) * dt;
        if (p.y > h + 3) {
          p.y = -3;
          p.x = rand(0, w);
        }
        if (p.x < -3) p.x = w + 3;
        if (p.x > w + 3) p.x = -3;

        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = '#d8f4fb';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    destroy() {
      grains = [];
      frost = null;
    },
  };
}
