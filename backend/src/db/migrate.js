import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config } from '../config/index.js';
import { getDb } from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 读取并执行建表脚本（幂等：全部 CREATE TABLE IF NOT EXISTS） */
export async function runMigrations() {
  const db = await getDb();
  const file = db.driver === 'mysql' ? 'schema.mysql.sql' : 'schema.sqlite.sql';
  const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
  await db.exec(sql);
  return db.driver;
}

// CLI: npm run migrate
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  runMigrations()
    .then((driver) => {
      const target = driver === 'mysql' ? `${config.db.host}:${config.db.port}/${config.db.database}` : config.db.file;
      console.log(`[migrate] 完成，驱动=${driver}，目标=${target}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[migrate] 失败:', err.message);
      process.exit(1);
    });
}
