/**
 * 阿里 DashScope 原生协议客户端。
 *
 * 与 OpenAI 风格的差异：
 * - 路径都在 /api/v1/services/... 下
 * - 请求体为 { model, input, parameters? }，不是 messages
 * - 错误信息以 { code, message } 包裹在响应顶层，HTTP 200 时仍可能携带业务错误
 *
 * 后续如果接入 Wanx 视频 / ASR 等异步任务类模型，可以在本模块里扩展
 * submitTask / pollTask 工具（需要 X-DashScope-Async: enable 头 + 轮询
 * /api/v1/tasks/{task_id}），现在 TTS 是同步的，暂时只放同步入口。
 */

import { parseHttpError, retryOperation } from '../ai/apiCore';

export interface DashScopeRequestOptions {
  /** API 基础 URL —— 既可以是直连域名，也可以是 /api/inference-proxy/<base64> 代理路径 */
  baseUrl: string;
  /** 服务路径，例如 /api/v1/services/aigc/multimodal-generation/generation */
  endpoint: string;
  apiKey: string;
  /** 请求体，DashScope 形如 { model, input, parameters? } */
  body: Record<string, any>;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** 额外请求头（如 X-DashScope-Async） */
  extraHeaders?: Record<string, string>;
}

export interface DashScopeEnvelope<TOutput = any> {
  request_id?: string;
  output?: TOutput;
  usage?: Record<string, any>;
  /** 业务错误码，存在即视为失败 */
  code?: string;
  message?: string;
}

const DEFAULT_TIMEOUT_MS = 180000;

/**
 * 同步调用 DashScope 原生 API。
 *
 * 适用于 qwen3-tts、qwen 文本生成（非 OpenAI 兼容路径）等无需任务轮询的接口。
 * 会抛出 HTTP 层错误（非 2xx）以及业务错误（响应体含 code 字段）。
 */
export const callDashScopeSync = async <TOutput = any>(
  options: DashScopeRequestOptions
): Promise<DashScopeEnvelope<TOutput>> => {
  const {
    baseUrl,
    endpoint,
    apiKey,
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
    extraHeaders,
  } = options;

  const controller = new AbortController();
  const handleExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', handleExternalAbort);
  }
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await retryOperation(async () => {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...(extraHeaders || {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw await parseHttpError(res);
      }
      return res;
    });

    const payload = (await response.json()) as DashScopeEnvelope<TOutput>;
    if (payload?.code) {
      const err: any = new Error(
        `DashScope 业务错误 [${payload.code}]: ${payload.message || '未知错误'}`
      );
      err.code = payload.code;
      err.requestId = payload.request_id;
      throw err;
    }
    return payload;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      if (signal?.aborted) {
        throw new Error('Request cancelled');
      }
      throw new Error(`DashScope 请求超时 (${Math.floor(timeoutMs / 1000)} 秒)`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', handleExternalAbort);
  }
};
