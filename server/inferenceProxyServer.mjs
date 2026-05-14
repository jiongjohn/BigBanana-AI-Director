import http from 'node:http';
import { createInferenceProxyHandler } from './inferenceProxyCore.mjs';

const PORT = Number.parseInt(process.env.INFERENCE_PROXY_PORT || process.env.PORT || '8789', 10);
const HOST = process.env.INFERENCE_PROXY_HOST || '0.0.0.0';

const handler = createInferenceProxyHandler();

const server = http.createServer((req, res) => {
  handler(req, res).catch((err) => {
    console.error('[inference-proxy] handler error', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Internal proxy error.' }));
    } else {
      try { res.end(); } catch {}
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`inference proxy server listening on http://${HOST}:${PORT}`);
});
