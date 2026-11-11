import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '../..');

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: num(process.env.PORT, 3000),
  corsOrigin: process.env.CORS_ORIGIN || true,
  jwt: {
    secret: process.env.JWT_SECRET || 'liujing-dev-secret-please-change',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  db: {
    // mysql | sqlite（sqlite 用于本地零依赖运行，表结构/索引与 MySQL 保持一致）
    driver: (process.env.DB_DRIVER || 'sqlite').toLowerCase(),
    file: process.env.DB_FILE || path.join(ROOT_DIR, 'data', 'liujing.db'),
    host: process.env.DB_HOST || '127.0.0.1',
    port: num(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'liujing',
    connectionLimit: num(process.env.DB_POOL, 10),
  },
  llm: {
    apiKey: process.env.LLM_API_KEY || '',
    baseUrl: (process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, ''),
    model: process.env.LLM_MODEL || 'deepseek-chat',
    timeoutMs: num(process.env.LLM_TIMEOUT_MS, 25000),
  },
  limits: {
    // 时长回算容忍区间（秒），见技术方案 4.2
    durationTolerance: num(process.env.DURATION_TOLERANCE, 60),
    maxHistoryRounds: 6,
  },
};

export const isSqlite = () => config.db.driver === 'sqlite';
