import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { authGuard } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import sessionRoutes from './routes/sessions.js';
import statsRoutes from './routes/stats.js';
import aiRoutes from './routes/ai.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '256kb' }));

  // llmEnabled 按登录用户各自的 Key 判定，见 GET /api/ai/config；health 是匿名接口，不再返回全局值
  app.get('/api/health', (req, res) => {
    res.json({ ok: true, driver: config.db.driver, time: new Date().toISOString() });
  });

  // /api/auth 内部自行控制闸门（注册/登录免鉴权，profile 需鉴权）
  app.use('/api/auth', authRoutes);

  // 其余业务路由统一经 JWT 闸（技术方案 4.1）
  app.use('/api/sessions', authGuard, sessionRoutes);
  app.use('/api/stats', authGuard, statsRoutes);
  app.use('/api/ai', authGuard, aiRoutes);

  app.use(notFoundHandler);
  app.use((err, req, res, next) => {
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: '请求体不是合法的 JSON' } });
    }
    return errorHandler(err, req, res, next);
  });

  return app;
}
