import { density, makeBackdrop, rand } from './engine.js';

const BG = ['#030c13', '#07202c', '#0a2f3d'];

/** 深海：多层水波 + 上浮气泡 + 顶部斜射光柱 */
export function createScene() {
  let ctx;
  let w = 0;
  let h = 0;
  let bg = null;
  let bubbles = [];
  let time = 0;

  function seed() {
    const count = density(w, h, 28, 80, 20000);
    bubbles = Array.from({ length: count }, () => ({
      x: rand(0, w),
      y: rand(0, h),
      r: rand(1.2, 5.5),
      vy: rand(10, 34),
      sway: rand(0.4, 1.4),
      phase: rand(0, Math.PI * 2),
      alpha: rand(0.08, 0.32),
    }));
  }

  function drawWaves() {
    for (let layer = 0; layer < 4; layer += 1) {
      const yBase = h * (0.42 + layer * 0.13);
      const amp = 8 + layer * 5;
      const speed = 0.25 + layer * 0.12;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 12) {
        const y = yBase + Math.sin(x * 0.006 + time * speed + layer) * amp + Math.sin(x * 0.019 - time * speed * 0.7) * (amp * 0.4);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(150, 225, 240, ${0.05 + layer * 0.015})`;
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
  }

  function drawShafts() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i += 1) {
      const x = w * (0.2 + i * 0.28) + Math.sin(time * 0.2 + i) * 18;
      const topW = 30 + i * 12;
      const g = ctx.createLinearGradient(x, 0, x + 80, h);
      g.addColorStop(0, 'rgba(160, 235, 250, 0.10)');
      g.addColorStop(0.5, 'rgba(120, 210, 235, 0.04)');
      g.addColorStop(1, 'rgba(90, 180, 210, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + topW, 0);
      ctx.lineTo(x + topW + h * 0.35, h);
      ctx.lineTo(x + h * 0.2, h);
      ctx.closePath();
      ctx.fill();
    }
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

      drawShafts();
      drawWaves();

      for (let i = 0; i < bubbles.length; i += 1) {
        const b = bubbles[i];
        b.y -= b.vy * dt;
        b.x += Math.sin(time * b.sway + b.phase) * 7 * dt;
        if (b.y < -10) {
          b.y = h + rand(0, 60);
          b.x = rand(0, w);
        }

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(200, 245, 255, ${b.alpha})`;
        ctx.lineWidth = 0.9;
        ctx.stroke();

        if (b.r > 3) {
          ctx.beginPath();
          ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.22, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(235, 253, 255, ${b.alpha * 1.4})`;
          ctx.fill();
        }
      }
    },
    destroy() {
      bubbles = [];
    },
  };
}
