/** 统一错误类型：带 HTTP 状态码与业务码 */
export class ApiError extends Error {
  constructor(status, message, code = 'BAD_REQUEST') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (msg) => new ApiError(400, msg, 'BAD_REQUEST');
export const unauthorized = (msg = '请先登录') => new ApiError(401, msg, 'UNAUTHORIZED');
export const conflict = (msg) => new ApiError(409, msg, 'CONFLICT');
export const notFoundError = (msg = '资源不存在') => new ApiError(404, msg, 'NOT_FOUND');

/** 包住 async 路由，异常统一交给错误中间件 */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** 404 */
export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `接口不存在: ${req.method} ${req.path}` } });
}

/** 统一错误响应结构 { error: { code, message } } */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: status >= 500 ? '服务器开小差了，请稍后再试' : err.message,
    },
  });
}
