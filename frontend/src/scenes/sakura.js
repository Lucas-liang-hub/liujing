import { density, makeBackdrop, radialGlow, rand } from './engine.js';

const BG = ['#120b11', '#25131d', '#3a1c28'];
const HUES = ['#f7c3cf', '#f2a3b4', '#fbd9e1', '#e58fa2'];

/** 樱花：花瓣旋转飘落，风摆为两条不同频率正弦叠加 */
export function createScene() {
  let ctx;
  let w = 0;
  let h = 0;
  let bg = null;
  let petals = [];
  let time = 0;
  let wind = 0;

  function seed() {
    const count = density(w, h, 46, 150, 9000);
    petals = Array.from({ length: count }, () => ({
      x: rand(-60, w + 60),
      y: rand(-h, h),
      size: rand(3.5, 10),
      vy: rand(12, 34),
      vx: rand(-8, 10),
      rot: rand(0, Math.PI * 2),
      vr: rand(-1.1, 1.1),
      sway: rand(0.5, 1.6),
      phase: rand(0, Math.PI * 2),
      alpha: rand(0.22, 0.72),
      color: HUES[(Math.random() * HUES.length) | 0],
    }));
  }

  function step(p, dt) {
    p.y += p.vy * dt;
    p.x += (p.vx + Math.sin(time * p.sway + p.phase) * 14 + wind * 12) * dt;
    p.rot += p.vr * dt;

    if (p.y > h + 24) {
      p.y = -24;
      p.x = rand(-60, w + 40);
    }
    if (p.x > w + 70) p.x = -50;
    if (p.x < -70) p.x = w + 50;
  }

  function draw(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size, p.size * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
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

      radialGlow(ctx, w * 0.76, h * 0.16, Math.min(w, h) * 0.8, 'rgba(255,188,205,0.10)');
      radialGlow(ctx, w * 0.14, h * 0.82, Math.min(w, h) * 0.55, 'rgba(255,150,175,0.07)');

      wind = 0.7 + Math.sin(time * 0.16) * 0.5;

      for (let i = 0; i < petals.length; i += 1) {
        const p = petals[i];
        step(p, dt);
        draw(p);
      }
      ctx.globalAlpha = 1;
    },
    destroy() {
      petals = [];
    },
  };
}
