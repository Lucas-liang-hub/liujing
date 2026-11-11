import { badRequest } from './error.js';

/** 手写轻量校验工具，不引重型校验库（技术方案 4.1） */

export const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

export function requireFields(body, fields) {
  if (!body || typeof body !== 'object') throw badRequest('请求体必须为 JSON 对象');
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
  if (missing.length) throw badRequest(`缺少必填字段: ${missing.join(', ')}`);
}

/** 用户名：3-20 位字母/数字/下划线 */
export function validateUsername(username) {
  if (!isNonEmptyString(username)) throw badRequest('用户名不能为空');
  const value = username.trim();
  if (!/^[A-Za-z0-9_]{3,20}$/.test(value)) {
    throw badRequest('用户名需为 3-20 位字母、数字或下划线');
  }
  return value;
}

/** 密码：6-64 位，不允许纯空格 */
export function validatePassword(password) {
  if (typeof password !== 'string') throw badRequest('密码不能为空');
  if (password.length < 6 || password.length > 64) throw badRequest('密码长度需为 6-64 位');
  if (!password.trim()) throw badRequest('密码不能全为空格');
  return password;
}

export function validateNickname(nickname, fallback) {
  if (nickname === undefined || nickname === null || nickname === '') return fallback;
  if (typeof nickname !== 'string') throw badRequest('昵称格式不正确');
  const value = nickname.trim();
  if (value.length > 20) throw badRequest('昵称最多 20 个字符');
  return value || fallback;
}

/** 正整数/零 */
export function toCount(value, name) {
  if (value === undefined || value === null) return 0;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 1000) throw badRequest(`${name} 必须为 0-1000 的整数`);
  return n;
}

export function validateScene(scene) {
  const allowed = ['sakura', 'star', 'frost', 'firefly', 'deepsea', 'autumn'];
  if (!allowed.includes(scene)) throw badRequest(`场景不合法，可选值: ${allowed.join('/')}`);
  return scene;
}

export function validateMode(mode) {
  const allowed = ['pomodoro', 'custom'];
  if (mode === undefined || mode === null) return 'pomodoro';
  if (!allowed.includes(mode)) throw badRequest(`模式不合法，可选值: ${allowed.join('/')}`);
  return mode;
}
