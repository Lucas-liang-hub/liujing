import { getDb } from '../db/index.js';
import { toLocalDateTime } from '../utils/time.js';

/** JSON 列在 mysql/sqlite 下可能返回 string 或已解析对象，统一处理 */
function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

const num = (v) => Number(v || 0);

export const DEFAULT_PREFS = Object.freeze({
  scene: 'sakura',
  sound: 'rain',
  soundOn: false,
  focusMinutes: 25,
  breakMinutes: 5,
  dailyGoalMinutes: 120,
});

function mapUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    username: row.username,
    nickname: row.nickname,
    createdAt: row.created_at,
    prefs: { ...DEFAULT_PREFS, ...parseJson(row.prefs, {}) },
  };
}

/* ------------------------------- 用户 ------------------------------- */

export const userDao = {
  async create({ username, passwordHash, nickname }) {
    const db = await getDb();
    const now = toLocalDateTime();
    const { insertId } = await db.run(
      'INSERT INTO users (username, password_hash, nickname, prefs, created_at) VALUES (?, ?, ?, ?, ?)',
      [username, passwordHash, nickname, JSON.stringify(DEFAULT_PREFS), now],
    );
    return userDao.findById(insertId);
  },

  async findByUsername(username) {
    const db = await getDb();
    const row = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    return row ? { ...mapUser(row), passwordHash: row.password_hash } : null;
  },

  async findById(id) {
    const db = await getDb();
    const row = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    return mapUser(row);
  },

  async updateProfile(id, { nickname, prefs }) {
    const db = await getDb();
    const current = await userDao.findById(id);
    if (!current) return null;
    const nextNickname = nickname ?? current.nickname;
    const nextPrefs = { ...current.prefs, ...(prefs || {}) };
    await db.run('UPDATE users SET nickname = ?, prefs = ? WHERE id = ?', [
      nextNickname,
      JSON.stringify(nextPrefs),
      id,
    ]);
    return userDao.findById(id);
  },
};

/* ----------------------------- 自习记录 ----------------------------- */

function mapRecord(row) {
  return {
    id: Number(row.id),
    scene: row.scene,
    mode: row.mode,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSec: num(row.duration_sec),
    tasksTotal: num(row.tasks_total),
    tasksDone: num(row.tasks_done),
    tasks: parseJson(row.tasks, []),
    createdAt: row.created_at,
  };
}

export const recordDao = {
  async insert({ userId, scene, mode, startedAt, endedAt, durationSec, tasksTotal, tasksDone, tasks }) {
    const db = await getDb();
    const { insertId } = await db.run(
      `INSERT INTO study_records
         (user_id, scene, mode, started_at, ended_at, duration_sec, tasks_total, tasks_done, tasks, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        scene,
        mode || 'pomodoro',
        startedAt,
        endedAt,
        durationSec,
        tasksTotal,
        tasksDone,
        JSON.stringify(tasks || []),
        toLocalDateTime(),
      ],
    );
    const row = await db.get('SELECT * FROM study_records WHERE id = ?', [insertId]);
    return mapRecord(row);
  },

  async listByUser(userId, { limit = 20, offset = 0 } = {}) {
    const db = await getDb();
    const rows = await db.query(
      'SELECT * FROM study_records WHERE user_id = ? ORDER BY started_at DESC, id DESC LIMIT ? OFFSET ?',
      [userId, limit, offset],
    );
    return rows.map(mapRecord);
  },

  async countByUser(userId) {
    const db = await getDb();
    const row = await db.get('SELECT COUNT(*) AS c FROM study_records WHERE user_id = ?', [userId]);
    return num(row?.c);
  },

  /** 已打卡日期（升序），用于连续打卡计算 */
  async listDateKeys(userId, limit = 400) {
    const db = await getDb();
    const rows = await db.query(
      `SELECT DISTINCT SUBSTR(started_at, 1, 10) AS d
         FROM study_records WHERE user_id = ?
        ORDER BY d DESC LIMIT ?`,
      [userId, limit],
    );
    return rows.map((r) => r.d);
  },
};

/* ------------------------------- 统计 ------------------------------- */

const weekdayExpr = (col, driver) =>
  driver === 'mysql' ? `(DAYOFWEEK(${col}) + 5) % 7` : `((CAST(strftime('%w', ${col}) AS INTEGER)) + 6) % 7`;

const hourExpr = (col, driver) =>
  driver === 'mysql' ? `HOUR(${col})` : `CAST(strftime('%H', ${col}) AS INTEGER)`;

export const statsDao = {
  /** 时间区间内总时长/次数 */
  async totals(userId, from, to) {
    const db = await getDb();
    const row = await db.get(
      `SELECT COALESCE(SUM(duration_sec), 0) AS sec, COUNT(*) AS sessions
         FROM study_records
        WHERE user_id = ? AND started_at >= ? AND started_at < ?`,
      [userId, from, to],
    );
    return { sec: num(row?.sec), sessions: num(row?.sessions) };
  },

  /** 按天聚合（时间区间内） */
  async dailyTotals(userId, from, to) {
    const db = await getDb();
    const rows = await db.query(
      `SELECT SUBSTR(started_at, 1, 10) AS d,
              COALESCE(SUM(duration_sec), 0) AS sec,
              COUNT(*) AS sessions,
              COALESCE(SUM(tasks_done), 0) AS done,
              COALESCE(SUM(tasks_total), 0) AS total
         FROM study_records
        WHERE user_id = ? AND started_at >= ? AND started_at < ?
        GROUP BY d ORDER BY d ASC`,
      [userId, from, to],
    );
    return rows.map((r) => ({
      date: r.d,
      sec: num(r.sec),
      sessions: num(r.sessions),
      tasksDone: num(r.done),
      tasksTotal: num(r.total),
    }));
  },

  /** 场景分布 */
  async sceneTotals(userId, from) {
    const db = await getDb();
    const rows = await db.query(
      `SELECT scene, COALESCE(SUM(duration_sec), 0) AS sec, COUNT(*) AS sessions
         FROM study_records
        WHERE user_id = ? AND started_at >= ?
        GROUP BY scene ORDER BY sec DESC`,
      [userId, from],
    );
    return rows.map((r) => ({ scene: r.scene, sec: num(r.sec), sessions: num(r.sessions) }));
  },

  /** 专注时段热力图：周一=0 … 周日=6，按开始时间归属 */
  async heatmap(userId, from) {
    const db = await getDb();
    const rows = await db.query(
      `SELECT ${weekdayExpr('started_at', db.driver)} AS wd,
              ${hourExpr('started_at', db.driver)} AS hr,
              COALESCE(SUM(duration_sec), 0) AS sec
         FROM study_records
        WHERE user_id = ? AND started_at >= ?
        GROUP BY wd, hr`,
      [userId, from],
    );
    return rows.map((r) => ({ weekday: num(r.wd), hour: num(r.hr), sec: num(r.sec) }));
  },
};

/* ------------------------------ 应用配置 ------------------------------ */

export const configDao = {
  async get(key) {
    const db = await getDb();
    const row = await db.get('SELECT config_value FROM app_configs WHERE config_key = ?', [key]);
    return row ? row.config_value : null;
  },

  /** 双驱动的 upsert 语法不同，各自实现 */
  async set(key, value) {
    const db = await getDb();
    if (db.driver === 'mysql') {
      await db.run(
        `INSERT INTO app_configs (config_key, config_value, updated_at)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
        [key, value, toLocalDateTime()],
      );
    } else {
      await db.run(
        `INSERT INTO app_configs (config_key, config_value, updated_at)
         VALUES (?, ?, datetime('now', 'localtime'))
         ON CONFLICT(config_key) DO UPDATE SET config_value = excluded.config_value`,
        [key, value],
      );
    }
  },

  async del(key) {
    const db = await getDb();
    await db.run('DELETE FROM app_configs WHERE config_key = ?', [key]);
  },
};
