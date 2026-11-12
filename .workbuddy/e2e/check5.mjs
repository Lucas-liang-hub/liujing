import puppeteer from 'puppeteer-core';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SHOT = 'D:/流境/.workbuddy/shots';
const API = 'http://localhost:3000/api';
const user = `taskui${Date.now().toString().slice(-6)}`;

const reg = await fetch(`${API}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: user, password: '123456', nickname: '清单测试' }),
}).then((r) => r.json());
console.log('register:', reg.user ? 'ok' : JSON.stringify(reg));

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--window-size=1440,900'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto('http://localhost:5173/study', { waitUntil: 'networkidle2' });
await page.evaluate((t) => localStorage.setItem('liujing_token', t), reg.token);
await page.goto('http://localhost:5173/study', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1500));

// 添加两个任务
const taskInput = await page.$('.tasks .add input');
if (!taskInput) throw new Error('task input not found');
await taskInput.type('写实验报告');
await page.keyboard.press('Enter');
await new Promise((r) => setTimeout(r, 400));
await taskInput.type('背 50 个单词');
await page.keyboard.press('Enter');
await new Promise((r) => setTimeout(r, 600));

// 双击第一个任务改名（无头模式下手势双击不稳定，直接派发 dblclick 事件）
await page.evaluate(() => {
  document.querySelector('.tasks .item .title').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
});
await new Promise((r) => setTimeout(r, 800));
const editBox = await page.$('.tasks .edit-input');
console.log('edit box appeared:', Boolean(editBox));
await editBox.click({ clickCount: 3 }); // 全选原文
await editBox.type('写数据库实验报告');
await page.keyboard.press('Enter');
await new Promise((r) => setTimeout(r, 500));

const text = await page.evaluate(() => document.querySelector('.tasks .list')?.innerText || '');
console.log('list now:', text.replace(/\n/g, ' | '));

// localStorage 新结构
const stored = await page.evaluate(() => localStorage.getItem('liujing_tasks'));
console.log('storage:', stored);

// 等防抖同步推送服务器后，从服务器回读核对
await new Promise((r) => setTimeout(r, 2200));
const prof = await fetch(`${API}/auth/profile`, { headers: { Authorization: `Bearer ${reg.token}` } }).then((r) => r.json());
console.log('server tasks:', JSON.stringify(prof.user?.prefs?.tasks));

await page.screenshot({ path: `${SHOT}/16-tasklist-edit.png` });
await browser.close();
console.log('pageerrors:', errors.length ? errors : 'none');
