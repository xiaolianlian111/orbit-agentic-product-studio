import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, normalize, resolve, sep } from 'node:path';

const ROOT = resolve(process.cwd());
const PORT = Number(process.env.PORT || 10000);
const MAX_BODY_BYTES = 12_000;
const PUBLIC_FILES = new Set(['index.html', 'app.js', 'styles.css']);

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const SYSTEM_PROMPT = `You are Orbit's product team. Turn the user's product idea into a compact JSON specification for a working single-page web app. Return JSON only, with this exact shape:
{
  "name": "short product name",
  "tagline": "short value proposition",
  "type": "tasks|finance|habits|crm|inventory|events|generic",
  "theme": {"accent":"#hex", "surface":"warm|cool|dark"},
  "features": ["3-5 concise features"],
  "entities": [{"name":"entity name","fields":["field","field"]}],
  "sampleItems": [{"title":"item","meta":"detail","value":12}],
  "plan": {"problem":"one sentence","user":"target user","success":"success metric"}
}
Never include markdown. Keep all string values in the user's language.`;

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function extractText(data) {
  if (typeof data.output_text === 'string') return data.output_text;
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) return content.text;
    }
  }
  return '';
}

async function readJsonBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('Request body is too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function generate(request, response) {
  try {
    const body = await readJsonBody(request);
    const prompt = String(body.prompt || '').trim().slice(0, 3000);
    if (!prompt) return sendJson(response, 400, { error: 'Prompt is required' });
    if (!process.env.OPENAI_API_KEY) {
      return sendJson(response, 200, { provider: 'local-fallback' });
    }

    const providerResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        instructions: SYSTEM_PROMPT,
        input: prompt,
        max_output_tokens: 900,
        text: { format: { type: 'json_object' } },
      }),
    });

    if (!providerResponse.ok) {
      const detail = await providerResponse.text();
      throw new Error(`Provider returned ${providerResponse.status}: ${detail.slice(0, 180)}`);
    }
    const generated = JSON.parse(extractText(await providerResponse.json()));
    return sendJson(response, 200, generated);
  } catch (error) {
    return sendJson(response, 500, { error: error.message || 'Generation failed' });
  }
}

async function serveFile(request, response) {
  const requestPath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^[/\\]+/, '');
  if (!PUBLIC_FILES.has(relativePath)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }
  const absolutePath = resolve(ROOT, normalize(relativePath));
  if (absolutePath !== ROOT && !absolutePath.startsWith(`${ROOT}${sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const file = await readFile(absolutePath);
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[extname(absolutePath)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
    response.end(request.method === 'HEAD' ? undefined : file);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}

const server = createServer(async (request, response) => {
  if (request.url?.startsWith('/api/generate')) {
    if (request.method !== 'POST') return sendJson(response, 405, { error: 'Method not allowed' });
    return generate(request, response);
  }
  if (!['GET', 'HEAD'].includes(request.method || '')) {
    response.writeHead(405, { Allow: 'GET, HEAD, POST' }).end('Method not allowed');
    return;
  }
  return serveFile(request, response);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Orbit is listening on port ${PORT}`);
});

export default server;
