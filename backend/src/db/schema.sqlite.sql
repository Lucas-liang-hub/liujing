-- 「流境」SQLite 本地开发表结构（与 schema.mysql.sql 字段/索引一一对应）
-- 仅用于本地零依赖运行与自动化测试；生产/答辩环境请用 DB_DRIVER=mysql

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nickname      TEXT NOT NULL,
  prefs         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS study_records (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  scene        TEXT NOT NULL,
  mode         TEXT NOT NULL DEFAULT 'pomodoro',
  started_at   TEXT NOT NULL,
  ended_at     TEXT NOT NULL,
  duration_sec INTEGER NOT NULL,
  tasks_total  INTEGER NOT NULL DEFAULT 0,
  tasks_done   INTEGER NOT NULL DEFAULT 0,
  tasks        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_records_user_started ON study_records (user_id, started_at);

CREATE TABLE IF NOT EXISTS app_configs (
  config_key   TEXT PRIMARY KEY,
  config_value TEXT,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 每用户独立的月见大模型 Key（历史记录制：最新一条为生效配置，可按条删除）
CREATE TABLE IF NOT EXISTS user_llm_keys (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  api_key    TEXT NOT NULL,
  base_url   TEXT NOT NULL,
  model      TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_llm_keys_user ON user_llm_keys (user_id, id);
