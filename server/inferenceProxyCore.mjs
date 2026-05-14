import { Readable } from 'node:stream';

/**
 * 通用 AI 推理反向代理
 *
 * 客户端请求格式：
 *   {METHOD} /api/inference-proxy/<base64url-of-target-baseUrl>/<rest-of-path>?query
 *
 * 例：base64url-of("https://dashscope.aliyuncs.com/compatible-mode/v1") = "aHR0..."
 *   POST /api/inference-proxy/aHR0.../chat/completions
 *   → 转发到 https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
 *
 * 用途：解决 DashScope / Volcengine 等不返回 CORS 头的厂商无法浏览器直连的问题。
 */

const PROXY_PREFIX = '/api/inference-proxy';

const decodeBase64Url = (encoded) => {
  let str = String(encoded || '').replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
};

const isPrivateHostname = (hostname) => {
  const lower = String(hostname || '').toLowerCase();
  if (!lower) return true;
  if (lower === 'localhost' || lower === '::1') return true;
  if (/^127\./.test(lower)) return true;
  if (/^10\./.test(lower)) return true;
  if (/^192\.168\./.test(lower)) return true;
  if (/^169\.254\./.test(lower)) return true; // link-local
  const match172 = lower.match(/^172\.(\d+)\./);
  if (match172) {
    const second = Number.parseInt(match172[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  // IPv6 unique local
  if (/^f[cd][0-9a-f]{2}:/i.test(lower)) return true;
  return false;
};

const replyJson = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(payload));
};

// 请求转发时丢弃这些头（要么是 hop-by-hop，要么会暴露真实来源/会话）
const REQUEST_DROP_HEADERS = new Set([
  'host',
  'origin',
  'referer',
  'cookie',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-length',
  'upgrade',
  'expect',
  'x-forwarded-for',
  'x-forwarded-proto',
  'x-forwarded-host',
  'x-real-ip',
  'sec-fetch-dest',
  'sec-fetch-mode',
  'sec-fetch-site',
  'sec-fetch-user',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform',
  'accept-encoding',
]);

// 响应回传时丢弃这些头
const RESPONSE_DROP_HEADERS = new Set([
  'set-cookie',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-encoding', // Node fetch 已自动解码，长度也变了
  'content-length',
]);

export const createInferenceProxyHandler = (options = {}) => {
  const allowPrivateHosts = options.allowPrivateHosts ??
    (String(process.env.INFERENCE_PROXY_ALLOW_PRIVATE_HOSTS || '').toLowerCase() === 'true');

  const rawAllowedHosts = options.allowedHostSuffixes ??
    process.env.INFERENCE_PROXY_ALLOWED_HOSTS ?? '';
  const allowedHostSuffixes = String(rawAllowedHosts)
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return async (req, res, next) => {
    const url = req.url || '/';

    if (url !== PROXY_PREFIX && !url.startsWith(`${PROXY_PREFIX}/`)) {
      if (typeof next === 'function') {
        next();
        return;
      }
      replyJson(res, 404, { error: 'Not Found' });
      return;
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return;
    }

    const afterPrefix = url.slice(PROXY_PREFIX.length + 1); // 去掉 "/api/inference-proxy/"
    if (!afterPrefix) {
      replyJson(res, 400, { error: 'Missing encoded target segment.' });
      return;
    }

    // 把第一段切出来：直到下一个 "/" 或 "?"
    const slashIdx = afterPrefix.indexOf('/');
    const queryIdx = afterPrefix.indexOf('?');
    let segmentEnd;
    if (slashIdx === -1 && queryIdx === -1) {
      segmentEnd = afterPrefix.length;
    } else if (slashIdx === -1) {
      segmentEnd = queryIdx;
    } else if (queryIdx === -1) {
      segmentEnd = slashIdx;
    } else {
      segmentEnd = Math.min(slashIdx, queryIdx);
    }

    const encodedBase = afterPrefix.slice(0, segmentEnd);
    let rest = afterPrefix.slice(segmentEnd);
    if (!rest) rest = '';
    if (rest && !rest.startsWith('/') && !rest.startsWith('?')) {
      rest = `/${rest}`;
    }

    let targetBase;
    try {
      targetBase = decodeBase64Url(encodedBase);
    } catch {
      replyJson(res, 400, { error: 'Invalid encoded target.' });
      return;
    }

    let targetUrl;
    try {
      targetUrl = new URL(targetBase);
    } catch {
      replyJson(res, 400, { error: 'Decoded target URL is invalid.' });
      return;
    }

    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      replyJson(res, 400, { error: 'Only http/https targets are allowed.' });
      return;
    }

    if (!allowPrivateHosts && isPrivateHostname(targetUrl.hostname)) {
      replyJson(res, 403, { error: 'Private/local hosts are not allowed by this proxy.' });
      return;
    }

    if (allowedHostSuffixes.length > 0) {
      const hostname = targetUrl.hostname.toLowerCase();
      const allowed = allowedHostSuffixes.some(
        (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
      );
      if (!allowed) {
        replyJson(res, 403, { error: 'Target host is not in the allowlist.' });
        return;
      }
    }

    const sanitizedBase = targetBase.replace(/\/+$/, '');
    const upstreamUrl = `${sanitizedBase}${rest}`;

    // 转发请求头（过滤掉敏感/hop-by-hop 头）
    const forwardHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      const lower = key.toLowerCase();
      if (REQUEST_DROP_HEADERS.has(lower)) continue;
      // 多值头节点是数组形式，转字符串
      forwardHeaders[key] = Array.isArray(value) ? value.join(', ') : String(value);
    }

    const method = String(req.method || 'GET').toUpperCase();
    let body;
    if (!['GET', 'HEAD'].includes(method)) {
      try {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        body = chunks.length === 0 ? undefined : Buffer.concat(chunks);
      } catch (err) {
        replyJson(res, 400, {
          error: 'Failed to read request body.',
          detail: err?.message || String(err),
        });
        return;
      }
    }

    let upstream;
    try {
      upstream = await fetch(upstreamUrl, {
        method,
        headers: forwardHeaders,
        body,
        redirect: 'follow',
      });
    } catch (err) {
      replyJson(res, 502, {
        error: 'Upstream fetch failed.',
        detail: err?.message || String(err),
      });
      return;
    }

    const responseHeaders = {};
    upstream.headers.forEach((value, key) => {
      if (RESPONSE_DROP_HEADERS.has(key.toLowerCase())) return;
      responseHeaders[key] = value;
    });
    responseHeaders['Access-Control-Allow-Origin'] = '*';

    res.writeHead(upstream.status, responseHeaders);

    if (!upstream.body) {
      res.end();
      return;
    }

    try {
      const nodeStream = Readable.fromWeb(upstream.body);
      const cleanup = () => {
        try { nodeStream.destroy(); } catch {}
      };
      nodeStream.on('error', () => {
        try { res.end(); } catch {}
      });
      req.on('close', cleanup);
      res.on('close', cleanup);
      nodeStream.pipe(res);
    } catch {
      try { res.end(); } catch {}
    }
  };
};

export const INFERENCE_PROXY_PREFIX = PROXY_PREFIX;
