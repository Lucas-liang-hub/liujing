-- 「流境」MySQL 8 表结构（3 张核心表：users / study_records / achievements 视图不入库）
-- 与技术方案 4.2 一致：任务明细并入 study_records 的 JSON 字段

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username      VARCHAR(32)  NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  nickname      VARCHAR(32)  NOT NULL,
  prefs         JSON         NULL COMMENT '默认场景/音效/时长等偏好',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_username (username)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '用户表';

CREATE TABLE IF NOT EXISTS study_records (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED    NOT NULL,
  scene        VARCHAR(20)     NOT NULL COMMENT '场景 id: sakura/star/frost/firefly/deepsea/autumn',
  mode         VARCHAR(16)     NOT NULL DEFAULT 'pomodoro' COMMENT 'pomodoro/custom',
  started_at   DATETIME        NOT NULL,
  ended_at     DATETIME        NOT NULL,
  duration_sec INT             NOT NULL COMMENT '后端按起止时间戳回算校验',
  tasks_total  INT             NOT NULL DEFAULT 0,
  tasks_done   INT             NOT NULL DEFAULT 0,
  tasks        JSON            NULL COMMENT '任务清单快照 [{title,done}]',
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_records_user_started (user_id, started_at),
  CONSTRAINT fk_records_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '自习记录表';

CREATE TABLE IF NOT EXISTS app_configs (
  config_key   VARCHAR(64)  NOT NULL COMMENT '配置键，如 llm_runtime',
  config_value TEXT         NULL COMMENT '配置值（JSON 或文本）',
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (config_key)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '应用级运行时配置';
