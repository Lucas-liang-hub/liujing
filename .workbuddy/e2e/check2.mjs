import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SHOTS = 'D:\\流境\\.workbuddy\\shots';
const BASE = 'http://localhost:5173';
fs.mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-proxy-server', '--no-sandbox', '--disable-gpu', '--force-device-scale-factor=1'],
  defaultViewport: { width: 1440, height: 900 },
});

const page = await browser.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

async function shot(name) {
  await page.screenshot({ path: `${SHOTS}\\${name}.png` });
  console.log('shot:', name);
}

try {
  await page.goto(`${BASE}/register`, { waitUntil: 'networkidle2' });
  await sleep(700);
  await shot('01-register');

  const user = `e2e${Date.now().toString().slice(-7)}`;
  const inputs = await page.$$('.form .input');
  await inputs[0].type(user);
  await inputs[1].type('勇康');
  await inputs[2].type('123456');
  await inputs[3].type('123456');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => null),
    page.click('button[type=submit]'),
  ]);
  await sleep(2400);
  console.log('after register url:', page.url());
  await shot('02-room');

  // 造一周历史数据（走真实 API）
  const made = await page.evaluate(async () => {
    const token = localStorage.getItem('liujing_token');
    const pad = (n) => String(n).padStart(2, '0');
    const local = (d) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const post = (body) =>
      fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      }).then((r) => r.status);
    const scenes = ['sakura', 'star', 'deepsea', 'autumn', 'firefly', 'frost'];
    const results = [];
    for (let d = 6; d >= 0; d -= 1) {
      const slots = d === 0 ? [9, 14] : [9 + d, 15];
      for (let k = 0; k < slots.length; k += 1) {
        const start = new Date();
        start.setDate(start.getDate() - d);
        start.setHours(slots[k] % 24, 10, 0, 0);
        const end = new Date(start.getTime() + (30 + ((d + k) % 3) * 25) * 60000);
        results.push(
          await post({
            scene: scenes[(d + k) % 6],
            mode: 'pomodoro',
            startedAt: local(start),
            endedAt: local(end),
            tasks: [
              { title: '背单词 60 个', done: true },
              { title: '整理错题本', done: (d + k) % 2 === 0 },
            ],
          }),
        );
      }
    }
    return results;
  });
  console.log('seed status:', made.join(','));

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await sleep(2400);
  await shot('03-room-seeded');

  // 切换到星夜
  const scenes2 = await page.$$('.switcher .scene');
  if (scenes2[1]) {
    await scenes2[1].click();
    await sleep(1800);
    await shot('04-star');
  }

  // 沉浸模式
  const immersive = await page.$('.immersive');
  if (immersive) {
    await immersive.click();
    await sleep(1600);
    await shot('05-immersive');
    await page.keyboard.press('Escape');
    await sleep(800);
  }

  // 统计页（有数据）
  await page.goto(`${BASE}/stats`, { waitUntil: 'networkidle2' });
  await sleep(2400);
  await shot('06-stats');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.45));
  await sleep(500);
  await shot('07-stats-mid');

  // 移动端
  await page.setViewport({ width: 420, height: 880 });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await sleep(2400);
  console.log('mobile url:', page.url());
  await shot('08-mobile');
} catch (err) {
  console.error('E2E FAILED:', err.message);
} finally {
  console.log('--- console errors ---');
  console.log(errors.length ? errors.join('\n') : '(none)');
  await browser.close();
}
