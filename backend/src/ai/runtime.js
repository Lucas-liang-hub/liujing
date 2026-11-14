import { config } from '../config/index.js';
import { llmKeyDao } from '../dao/index.js';

/**
 * 月见 LLM 按用户配置（多用户隔离）：
 * - Key 只属于配置它的账号，存 user_llm_keys 表（历史记录制，最新一条生效）
 * - 项目本身不内置任何 Key：新注册用户默认走规则语库，自己配置 Key 后才启用大模型
 * - 明文 Key 只在后端请求大模型时使用，任何接口返回前必须打码
 */

/** 某用户当前生效的 LLM 配置；该用户从未配置过则返回 null */
export async function getUserLlmConfig(userId) {
  const row = await llmKeyDao.latestByUser(userId);
  if (!row) return null;
  return { id: row.id, apiKey: row.apiKey, baseUrl: row.baseUrl, model: row.model, createdAt: row.createdAt };
}

/** 保存配置时的默认值：接口地址/模型可由 .env 预设推荐，Key 永远只来自用户自己 */
export function llmDefaults() {
  return { baseUrl: config.llm.baseUrl, model: config.llm.model };
}
