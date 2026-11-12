import { createApp } from './app.js';
import { config } from './config/index.js';
import { runMigrations } from './db/migrate.js';
import { isLlmEnabled } from './ai/llm.js';
import { loadLlmOverride, currentLlmConfigSync } from './ai/runtime.js';

const app = createApp();

async function bootstrap() {
  const driver = await runMigrations();
  await loadLlmOverride(); // 预热运行时 LLM 配置（设置页热切换的持久化值）
  app.listen(config.port, () => {
    console.log('────────────────────────────────────────────');
    console.log('  流境 · 后端已启动');
    console.log(`  地址     http://localhost:${config.port}/api/health`);
    console.log(`  数据库   ${driver}${driver === 'sqlite' ? ` (${config.db.file})` : ` ${config.db.database}`}`);
    console.log(`  月见模式 ${isLlmEnabled() ? `大模型增强 (${currentLlmConfigSync().model})` : '规则语库保底（未配置 LLM_API_KEY）'}`);
    console.log('────────────────────────────────────────────');
  });
}

bootstrap().catch((err) => {
  console.error('[启动失败]', err);
  process.exit(1);
});
