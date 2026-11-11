import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';

/**
 * 统一数据库访问层（无 ORM）。
 * - mysql   : mysql2 连接池（生产 / 答辩环境）
 * - sqlite  : Node 22 内置 node:sqlite（本地零依赖运行与测试，无需编译原生模块）
 * 两种驱动暴露完全相同的异步方法签名，SQL 由 dao 层手写。
 */

let adapter = null;
let initPromise = null;

/** SQLite 不接受 undefined，统一归一化为 null */
function normalizeParams(params = []) {
  return params.map((p) => (p === undefined ? null : p));
}

async function createMysqlAdapter() {
  const mysql = await import('mysql2/promise');
  const pool = mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    connectionLimit: config.db.connectionLimit,
    waitForConnections: true,
    charset: 'utf8mb4',
    dateStrings: true, // 统一返回 'YYYY-MM-DD HH:mm:ss' 字符串，避免时区/Date 对象歧义
    multipleStatements: true,
  });

  return {
    driver: 'mysql',
    async query(sql, params = []) {
      const [rows] = await pool.query(sql, params);
      return rows;
    },
    async get(sql, params = []) {
      const [rows] = await pool.query(sql, params);
      return rows?.[0] ?? null;
    },
    async run(sql, params = []) {
      const [res] = await pool.query(sql, params);
      return { insertId: Number(res.insertId || 0), changes: Number(res.affectedRows || 0) };
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async close() {
      await pool.end();
    },
  };
}

async function createSqliteAdapter() {
  // 用 createRequire 加载 node:sqlite：Vite/Vitest 的模块解析不认识这个新内置模块名，
  // 走 CommonJS require 可绕过打包器的静态分析（运行时由 Node 原生提供）。
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const { DatabaseSync } = require('node:sqlite');
  if (config.db.file !== ':memory:') {
    fs.mkdirSync(path.dirname(config.db.file), { recursive: true });
  }
  const handle = new DatabaseSync(config.db.file);
  handle.exec('PRAGMA journal_mode = WAL');
  handle.exec('PRAGMA foreign_keys = ON');

  return {
    driver: 'sqlite',
    async query(sql, params = []) {
      return handle.prepare(sql).all(...normalizeParams(params));
    },
    async get(sql, params = []) {
      return handle.prepare(sql).get(...normalizeParams(params)) ?? null;
    },
    async run(sql, params = []) {
      const res = handle.prepare(sql).run(...normalizeParams(params));
      return { insertId: Number(res.lastInsertRowid || 0), changes: Number(res.changes || 0) };
    },
    async exec(sql) {
      handle.exec(sql);
    },
    async close() {
      handle.close();
    },
  };
}

/** 获取（惰性初始化）数据库适配器 */
export async function getDb() {
  if (adapter) return adapter;
  if (!initPromise) {
    initPromise = (async () => {
      adapter = config.db.driver === 'mysql' ? await createMysqlAdapter() : await createSqliteAdapter();
      return adapter;
    })();
  }
  return initPromise;
}

/** 关闭连接（测试收尾、优雅退出） */
export async function closeDb() {
  if (adapter) {
    await adapter.close();
    adapter = null;
    initPromise = null;
  }
}

/** 重建连接（测试切换临时库时使用） */
export async function resetDbConnection() {
  await closeDb();
}
