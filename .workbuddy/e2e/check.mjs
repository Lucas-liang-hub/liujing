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
// 专注计时中整页导航会触发 StudyRoom 的 beforeunload 防误关确认框，
// 无头模式下必须自动接受，否则导航被挂起直到超时（产品行为本身是正确的）。
page.on('dialog', (d) => d.accept().catch(() => {}));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

async function shot(name) {
  await page.screenshot({ path: `${SHOTS}\\${name}.png` });
  console.log('shot:', name);
}

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await sleep(1600);
  await shot('01-login');

  await page.goto(`${BASE}/register`, { waitUntil: 'networkidle2' });
  await sleep(800);
  await shot('02-register');

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
  await sleep(2600);
  await shot('03-room');

  const title1 = await page.title();
  console.log('title(idle):', title1);

  // 开始专注
  const startBtn = await page.$('.actions .btn-primary');
  if (startBtn) {
    await startBtn.click();
    await sleep(2500);
    await shot('04-focus');
    console.log('title(focus):', await page.title());
  } else {
    console.log('!! 未找到开始按钮');
  }

  // 切换场景：星夜
  const scenes = await page.$$('.switcher .scene');
  if (scenes[1]) {
    await scenes[1].click();
    await sleep(1800);
    await shot('05-scene-star');
  }

  // 加任务
  const taskInput = await page.$('.tasks .input');
  if (taskInput) {
    await taskInput.type('看完《传播学教程》第三章');
    await page.click('.tasks .add button');
    await sleep(400);
    await taskInput.type('整理 10 道真题错题');
    await page.click('.tasks .add button');
    await sleep(500);
    await shot('06-tasks');
  }

  // 月见对话
  const chatInput = await page.$('.compose .input');
  if (chatInput) {
    await chatInput.type('我有点学不进去');
    await page.click('.compose .send');
    await sleep(2600);
    await shot('07-yuejian');
  }

  // 统计页
  await page.goto(`${BASE}/stats`, { waitUntil: 'networkidle2' });
  await sleep(2200);
  await shot('08-stats');

  // 设置页
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle2' });
  await sleep(1200);
  await shot('09-settings');

  // 沉浸模式
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await sleep(2000);
  const immersive = await page.$('.immersive');
  if (immersive) {
    await immersive.click();
    await sleep(1500);
    await shot('10-immersive');
  }

  // 窄屏
  await page.setViewport({ width: 420, height: 860, isMobile: true });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await sleep(2000);
  await shot('11-mobile');
} catch (err) {
  console.error('E2E FAILED:', err.message);
} finally {
  console.log('--- console errors ---');
  console.log(errors.length ? errors.join('\n') : '(none)');
  await browser.close();
}
