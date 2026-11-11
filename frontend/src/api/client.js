const TOKEN_KEY = 'liujing_token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* 隐私模式下 localStorage 不可用时静默忽略 */
  }
}

export function clearToken() {
  setToken('');
}

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function notifyUnauthorized() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('liujing:unauthorized'));
  }
}

/**
 * 统一 fetch 封装：自动携带 JWT，401 时清理令牌并广播事件。
 */
export async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
      notifyUnauthorized();
    }
    throw new ApiError(res.status, data?.error?.code || 'HTTP_ERROR', data?.error?.message || `请求失败（${res.status}）`);
  }
  return data;
}

/**
 * SSE 流式请求：逐事件回调 onEvent({delta} | {done} | {error})
 * 使用 fetch + ReadableStream 而非 EventSource，因为需要携带 Authorization 头。
 */
export async function streamRequest(path, body, onEvent, { signal } = {}) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    let message = `请求失败（${res.status}）`;
    try {
      message = JSON.parse(text)?.error?.message || message;
    } catch {
      /* 忽略非 JSON 错误体 */
    }
    if (res.status === 401) {
      clearToken();
      notifyUnauthorized();
    }
    throw new ApiError(res.status, 'STREAM_ERROR', message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() || '';

    for (const chunk of chunks) {
      const line = chunk.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        onEvent(JSON.parse(payload));
      } catch {
        /* 跳过无法解析的帧 */
      }
    }
  }
}
