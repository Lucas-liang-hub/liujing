import { density, makeBackdrop, radialGlow, rand } from './engine.js';

const BG = ['#120c07', '#221607', '#33200c'];
const COLORS = ['#f0b06a', '#e08b4a', '#d9a13f', '#c96f3a'];

/** 秋日：叶片旋转坠落 + 低角度暖光 + 地面落叶层 */
export function createScene() {
  let ctx;
  let w = 0;
  let h = 0;
  let bg = null;
  let leaves = [];
  let time = 0;
  let wind = 0;

  function seed() {
    const count = density(w, h, 26, 90, 14000);
    leaves = Array.from({ length: count }, () => ({
      x: rand(-40, w + 40),
      y: rand(-h, h),
      size: rand(5, 12),
      vy: rand(16, 40),
      vx: rand(-10, 14),
      rot: rand(0, Math.PI * 2),
      vr: rand(-1.6, 1.6),
      sway: rand(0.6, 1.8),
      phase: rand(0, Math.PI * 2),
      alpha: rand(0.3, 0.8),
      color: COLORS[(Math.random() * COLORS.length) | 0],
      // 叶片用两段弧模拟枫叶轮廓
      dent: rand(0.28, 0.45),
    }));
  }

  function drawLeaf(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(0, -p.size);
    ctx.quadraticCurveTo(p.size * 0.9, -p.size * p.dent, p.size * 0.75, p.size * 0.35);
    ctx.quadraticCurveTo(p.size * 0.2, p.size * 0.9, 0, p.size);
    ctx.quadraticCurveTo(-p.size * 0.2, p.size * 0.9, -p.size * 0.75, p.size * 0.35);
    ctx.quadraticCurveTo(-p.size * 0.9, -p.size * p.dent, 0, -p.size);
    ctx.fill();

    ctx.strokeStyle = 'rgba(90, 45, 20, 0.35)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, -p.size * 0.85);
    ctx.lineTo(0, p.size * 0.9);
    ctx.stroke();
    ctx.restore();
  }

  return {
    init(context, width, height) {
      ctx = context;
      w = width;
      h = height;
      bg = makeBackdrop(ctx, w, h, BG);
      seed();
    },
    resize(width, height) {
      w = width;
      h = height;
      bg = makeBackdrop(ctx, w, h, BG);
      seed();
    },
    update(dt) {
      time += dt;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // 低角度夕光
      radialGlow(ctx, w * 0.82, h * 0.88, Math.min(w, h) * 0.85, 'rgba(255, 176, 96, 0.16)');
      radialGlow(ctx, w * 0.1, h * 0.1, Math.min(w, h) * 0.5, 'rgba(255, 214, 150, 0.06)');

      wind = 0.8 + Math.sin(time * 0.22) * 0.6;

      for (let i = 0; i < leaves.length; i += 1) {
        const p = leaves[i];
        p.y += p.vy * dt;
        p.x += (p.vx + Math.sin(time * p.sway + p.phase) * 18 + wind * 14) * dt;
        p.rot += p.vr * dt;

        if (p.y > h + 26) {
          p.y = -26;
          p.x = rand(-40, w + 40);
        }
        if (p.x > w + 60) p.x = -40;
        if (p.x < -60) p.x = w + 40;

        drawLeaf(p);
      }
      ctx.globalAlpha = 1;

      // 地面落叶层
      ctx.fillStyle = 'rgba(28, 16, 6, 0.5)';
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 50) {
        ctx.lineTo(x, h - 12 - Math.sin(x * 0.02) * 6 - Math.cos(x * 0.05) * 4);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    },
    destroy() {
      leaves = [];
    },
  };
}
