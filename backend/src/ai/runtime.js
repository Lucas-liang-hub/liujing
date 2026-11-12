import { config } from '../config/index.js';
import { configDao } from '../dao/index.js';

/**
 * 月见 LLM 运行时配置（设置页可随时切换，无需重启）。
 * 优先级：数据库运行时配置 > .env；Key 只存后端，接口返回一律打码。
 */

const KEY = 'llm_runtime';

let override = null; // { apiKey, baseUrl, model }
let loaded = false;

async function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await configDao.get(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.apiKey === 'string' && parsed.apiKey) override = parsed;
    }
  } catch (err) {
    console.warn('[llm] 读取运行时配置失败，回落 .env:', err.message);
  }
}

/** 当前生效的 LLM 配置（异步，路由内使用）。覆盖值与 .env 默认合并，保证字段完整 */
export async function currentLlmConfig() {
  await ensureLoaded();
  return override ? { ...config.llm, ...override } : config.llm;
}

/** 同步版本：启动时已 load 后使用（health 等高频处） */
export function currentLlmConfigSync() {
  return override ? { ...config.llm, ...override } : config.llm;
}

export async function setLlmOverride({ apiKey, baseUrl, model }) {
  await ensureLoaded();
  override = {
    apiKey,
    baseUrl: baseUrl || config.llm.baseUrl,
    model: model || config.llm.model,
  };
  await configDao.set(KEY, JSON.stringify(override));
  return override;
}

export async function clearLlmOverride() {
  override = null;
  await configDao.del(KEY);
}

export function llmSource() {
  return override ? 'runtime' : 'env';
}

/** 服务启动时预热一次，让 health 等同步读取拿到正确状态 */
export async function loadLlmOverride() {
  await ensureLoaded();
}
