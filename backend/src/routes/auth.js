import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { userDao } from '../dao/index.js';
import { signToken, authGuard } from '../middleware/auth.js';
import { asyncHandler, badRequest, conflict, unauthorized } from '../middleware/error.js';
import { requireFields, validateNickname, validatePassword, validateUsername, validateScene } from '../middleware/validate.js';

const router = Router();
const BCRYPT_ROUNDS = 10;

/** 偏好白名单校验，避免写入任意字段 */
function sanitizePrefs(input) {
  if (input === undefined) return undefined;
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('prefs 必须为对象');

  const prefs = {};
  if (input.scene !== undefined) prefs.scene = validateScene(input.scene);

  if (input.soundOn !== undefined) {
    if (typeof input.soundOn !== 'boolean') throw badRequest('soundOn 必须为布尔值');
    prefs.soundOn = input.soundOn;
  }
  if (input.sound !== undefined) {
    const allowed = ['rain', 'stream', 'wind', 'night', 'none'];
    if (!allowed.includes(input.sound)) throw badRequest(`音效不合法，可选值: ${allowed.join('/')}`);
    prefs.sound = input.sound;
  }

  const rangeCheck = (key, min, max, label) => {
    if (input[key] === undefined) return;
    const n = Number(input[key]);
    if (!Number.isFinite(n) || n < min || n > max) throw badRequest(`${label}需在 ${min}-${max} 之间`);
    prefs[key] = Math.round(n);
  };
  rangeCheck('focusMinutes', 5, 180, '专注时长');
  rangeCheck('breakMinutes', 1, 60, '休息时长');
  rangeCheck('dailyGoalMinutes', 30, 720, '每日目标');

  return prefs;
}

// POST /api/auth/register
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['username', 'password']);
    const username = validateUsername(req.body.username);
    const password = validatePassword(req.body.password);
    const nickname = validateNickname(req.body.nickname, username);

    const existed = await userDao.findByUsername(username);
    if (existed) throw conflict('该用户名已被注册');

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await userDao.create({ username, passwordHash, nickname });
    res.status(201).json({ token: signToken(user), user });
  }),
);

// POST /api/auth/login
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['username', 'password']);
    const username = String(req.body.username).trim();
    const password = String(req.body.password);

    const found = await userDao.findByUsername(username);
    // 统一提示，避免暴露用户名是否存在
    if (!found) throw unauthorized('用户名或密码不正确');

    const ok = await bcrypt.compare(password, found.passwordHash);
    if (!ok) throw unauthorized('用户名或密码不正确');

    const { passwordHash, ...user } = found;
    res.json({ token: signToken(user), user });
  }),
);

// GET /api/auth/profile
router.get(
  '/profile',
  authGuard,
  asyncHandler(async (req, res) => {
    const user = await userDao.findById(req.user.id);
    if (!user) throw unauthorized('用户不存在');
    res.json({ user });
  }),
);

// PUT /api/auth/profile
router.put(
  '/profile',
  authGuard,
  asyncHandler(async (req, res) => {
    const nickname = req.body?.nickname === undefined ? undefined : validateNickname(req.body.nickname, '');
    const prefs = sanitizePrefs(req.body?.prefs);
    if (nickname === undefined && prefs === undefined) throw badRequest('没有可更新的字段');

    const user = await userDao.updateProfile(req.user.id, { nickname, prefs });
    if (!user) throw unauthorized('用户不存在');
    res.json({ user });
  }),
);

export default router;
