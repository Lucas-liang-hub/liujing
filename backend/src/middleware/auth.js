import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { unauthorized } from './error.js';

/** 签发 7 天有效期的 token */
export function signToken(user) {
  return jwt.sign({ sub: String(user.id), username: user.username }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

/** 从 Authorization: Bearer <token> 解析用户 */
export function authGuard(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(unauthorized('缺少访问令牌'));

  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = { id: Number(payload.sub), username: payload.username };
    return next();
  } catch {
    return next(unauthorized('登录已过期，请重新登录'));
  }
}
