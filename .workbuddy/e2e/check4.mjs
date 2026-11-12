import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SHOT = 'D:/流境/.workbuddy/shots';
const API = 'http://localhost:3000/api';
const user = `llm${Date.now().toString().slice(-6)}`;

const reg = await fetch(`${API}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: user, password: '123456', nickname: '切换测试' }),
}).then((r) => r.json());
console.log('register:', reg.user ? 'ok' : JSON.stringify(reg));

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--window-size=1440,900'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle2' });
await page.evaluate((t) => localStorage.setItem('liujing_token', t), reg.token);
await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1200));

// 初始状态
let status = await page.$eval('.llm-status .st-text', (el) => el.textContent.trim()).catch(() => 'N/A');
console.log('初始状态:', status);

// 填入 Key（DeepSeek）并保存 —— 先清空预填值
await page.type('.llm-grid input[type=password]', 'SK-REDACTED');
const inputs = await page.$$('.llm-grid input.input');
for (const el of [inputs[1], inputs[2]]) {
  await page.evaluate((node) => {
    node.value = '';
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }, el);
}
await inputs[1].type('https://api.deepseek.com/v1');
await inputs[2].type('deepseek-chat');
await page.click('.llm-actions .btn-primary');
await new Promise((r) => setTimeout(r, 1500));
status = await page.$eval('.llm-status .st-text', (el) => el.textContent.trim()).catch(() => 'N/A');
const tag = await page.$eval('.llm-status .st-tag', (el) => el.textContent.trim()).catch(() => 'N/A');
const mask = await page.$eval('.llm-status .st-key', (el) => el.textContent.trim()).catch(() => 'N/A');
const chip = await page.$eval('.card-head .chip', (el) => el.textContent.trim()).catch(() => 'N/A');
console.log('保存后:', status, '| 来源:', tag, '| Key:', mask, '| 模式:', chip);
await page.screenshot({ path: `${SHOT}/15-settings-llm.png` });

// 测试连接
const btns = await page.$$('.llm-actions .btn-ghost');
await btns[0].click();
await new Promise((r) => setTimeout(r, 6000));
const testMsg = await page.$eval('.llm-actions .hint', (el) => el.textContent.trim()).catch(() => 'N/A');
console.log('测试连接:', testMsg);

// 直接调 API 验证月见真的走 LLM
const chat = await fetch(`${API}/ai/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${reg.token}` },
  body: JSON.stringify({ message: '用一句话打个招呼' }),
}).then((r) => r.json());
console.log('月见回复 source:', chat.source, '| 内容:', (chat.reply || '').slice(0, 40));

// 恢复 .env 默认（当前 .env 也有 Key，应显示 .env 来源）
await page.click('.llm-actions .btn-ghost');
await new Promise((r) => setTimeout(r, 1200));
const tag2 = await page.$eval('.llm-status .st-tag', (el) => el.textContent.trim()).catch(() => '无');
const chip2 = await page.$eval('.card-head .chip', (el) => el.textContent.trim()).catch(() => 'N/A');
console.log('恢复后来源:', tag2, '| 模式:', chip2);

console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
