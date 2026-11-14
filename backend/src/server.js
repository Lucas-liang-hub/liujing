import { createApp } from './app.js';
import { config } from './config/index.js';
import { runMigrations } from './db/migrate.js';

const app = createApp();

async function bootstrap() {
  const driver = await runMigrations();
  app.listen(config.port, () => {
    console.log('────────────────────────────────────────────');
    console.log('  流境 · 后端已启动');
    console.log(`  地址     http://localhost:${config.port}/api/health`);
    console.log(`  数据库   ${driver}${driver === 'sqlite' ? ` (${config.db.file})` : ` ${config.db.database}`}`);
    console.log('  月见模式 大模型增强按用户各自的 Key 启用，未配置的账号走规则语库保底');
    console.log('────────────────────────────────────────────');
  });
}

bootstrap().catch((err) => {
  console.error('[启动失败]', err);
  process.exit(1);
});
