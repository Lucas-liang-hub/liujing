import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SHOT = 'D:/流境/.workbuddy/shots';
fs.mkdirSync(SHOT, { recursive: true });

const API = 'http://localhost:3000/api';
const user = `snd${Date.now().toString().slice(-6)}`;

const reg = await fetch(`${API}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: user, password: '123456', nickname: '音效测试' }),
}).then((r) => r.json());
console.log('register:', reg.user ? 'ok' : JSON.stringify(reg));

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--window-size=1440,900'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
await page.evaluate((t) => localStorage.setItem('liujing_token', t), reg.token);
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1200));

// 打开顶部音效面板
await page.click('.sound-wrap .icon-btn');
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: `${SHOT}/12-sound-popover.png` });
const menuVisible = await page.$eval('.sound-popcon, .sound-pop', (el) => !!el).catch(() => false);
console.log('popover visible:', menuVisible);

// 选海浪
const chips = await page.$$('.sound-pop .chip');
console.log('chips:', chips.length);
if (chips[2]) await chips[2].click();
await new Promise((r) => setTimeout(r, 700));
await page.screenshot({ path: `${SHOT}/13-sound-waves.png` });
const nowName = await page.$eval('.sound-pop .name', (el) => el.textContent.trim()).catch(() => '?');
console.log('playing label:', nowName);

// 拖音量到 30
await page.$eval('.sound-pop input[type=range]', (el) => {
  el.value = 30;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
});
await new Promise((r) => setTimeout(r, 300));
const vol = await page.$eval('.sound-pop .num', (el) => el.textContent.trim()).catch(() => '?');
console.log('volume label:', vol);

// 点空白关闭
await page.mouse.click(700, 600);
await new Promise((r) => setTimeout(r, 350));
const closed = await page.$('.sound-pop');
console.log('closed after outside click:', !closed);

// 设置页
await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: `${SHOT}/14-settings-sound.png` });
const settingsChips = await page.$$('.card .sound-menu .chip');
console.log('settings chips:', settingsChips.length);

console.log('console errors:', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
