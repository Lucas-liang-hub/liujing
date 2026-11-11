import { density, makeBackdrop, radialGlow, rand } from './engine.js';

const BG = ['#060915', '#0c1226', '#131b34'];

/** 星河：星点呼吸闪烁 + 预生成星座连线 + 偶发流星 */
export function createScene() {
  let ctx;
  let w = 0;
  let h = 0;
  let bg = null;
  let stars = [];
  let links = [];
  let meteors = [];
  let time = 0;
  let nextMeteor = 3;

  function seed() {
    const count = density(w, h, 90, 320, 4200);
    stars = Array.from({ length: count }, () => ({
      x: rand(0, w),
      y: rand(0, h),
      r: rand(0.4, 1.9),
      base: rand(0.18, 0.9),
      twinkle: rand(0.4, 2.2),
      phase: rand(0, Math.PI * 2),
      drift: rand(-1.5, 1.5),
    }));

    // 预生成星座连线（避免每帧 O(n²)）
    links = [];
    const bright = stars.slice(0, Math.min(46, stars.length));
    for (let i = 0; i < bright.length; i += 1) {
      for (let j = i + 1; j < bright.length; j += 1) {
        const dx = bright[i].x - bright[j].x;
        const dy = bright[i].y - bright[j].y;
        const d = Math.hypot(dx, dy);
        if (d < Math.min(w, h) * 0.11 && Math.random() < 0.5) {
          links.push({ a: bright[i], b: bright[j], alpha: rand(0.04, 0.12) });
          if (links.length > 90) break;
        }
      }
      if (links.length > 90) break;
    }
  }

  function spawnMeteor() {
    const fromLeft = Math.random() > 0.45;
    meteors.push({
      x: fromLeft ? rand(-40, w * 0.7) : w + 40,
      y: rand(-20, h * 0.55),
      vx: fromLeft ? rand(220, 380) : -rand(220, 380),
      vy: rand(120, 220),
      len: rand(70, 160),
      life: 1,
    });
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

      radialGlow(ctx, w * 0.2, h * 0.8, Math.min(w, h) * 0.9, 'rgba(90,110,220,0.10)');

      // 银河带
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = '#9fb0ff';
      ctx.beginPath();
      ctx.ellipse(w * 0.55, h * 0.42, w * 0.62, h * 0.14, -0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      for (let i = 0; i < links.length; i += 1) {
        const l = links[i];
        ctx.strokeStyle = `rgba(180,198,255,${l.alpha})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(l.a.x, l.a.y);
        ctx.lineTo(l.b.x, l.b.y);
        ctx.stroke();
      }

      for (let i = 0; i < stars.length; i += 1) {
        const s = stars[i];
        s.x += s.drift * dt;
        if (s.x < -4) s.x = w + 4;
        if (s.x > w + 4) s.x = -4;

        const alpha = s.base * (0.6 + 0.4 * Math.sin(time * s.twinkle + s.phase));
        ctx.globalAlpha = Math.max(0.05, alpha);
        ctx.fillStyle = '#dce4ff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 流星
      nextMeteor -= dt;
      if (nextMeteor <= 0) {
        spawnMeteor();
        nextMeteor = rand(5, 12);
      }
      for (let i = meteors.length - 1; i >= 0; i -= 1) {
        const m = meteors[i];
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.life -= dt * 0.55;

        const tailX = m.x - (m.vx / Math.hypot(m.vx, m.vy)) * m.len;
        const tailY = m.y - (m.vy / Math.hypot(m.vx, m.vy)) * m.len;
        const g = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
        g.addColorStop(0, `rgba(226,236,255,${Math.max(0, m.life) * 0.85})`);
        g.addColorStop(1, 'rgba(226,236,255,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        if (m.life <= 0 || m.x < -200 || m.x > w + 200 || m.y > h + 100) meteors.splice(i, 1);
      }
    },
    destroy() {
      stars = [];
      links = [];
      meteors = [];
    },
  };
}
