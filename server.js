const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const host = '127.0.0.1';
const port = Number(process.env.PORT) || 3000;
const rootDir = __dirname;
const dataDir = path.join(rootDir, 'data');
const dataFile = path.join(dataDir, 'poems.json');

const defaultPoems = [
  {
    id: 'default-modern-1',
    type: 'modern',
    title: '夜难寐',
    date: '2024-11-03',
    content: '岁末辛劳晚，寒衾入睡迟。\n凄风冰雨夜，冻雪冷霜时。\n亘古须臾客，言愁未免痴。\n明朝应好日，切莫再凝眉。'
  },
  {
    id: 'default-modern-2',
    type: 'modern',
    title: '冰花',
    date: '2025-01-28',
    content: '寒夜霜风乱，清晨冻雪临。\n冰花凭自起，连理满窗林。'
  },
  {
    id: 'default-modern-3',
    type: 'modern',
    title: '金鱼',
    date: '2025-07-11',
    content: '水声终不绝，家有一池鱼。\n似玉两睛闪，如纱双尾虚。\n金鳞翻浪跃，丹觜傍沙嘘。\n食饵争浮上，厌厌鼓腹初。'
  },
  {
    id: 'default-classic-1',
    type: 'classic',
    title: '春日偶成',
    date: '2023-03-15',
    content: '（在此处填写您的古典诗词内容）'
  },
  {
    id: 'default-classic-2',
    type: 'classic',
    title: '中秋望月',
    date: '2022-09-10',
    content: '（在此处填写您的古典诗词内容）'
  },
  {
    id: 'default-classic-3',
    type: 'classic',
    title: '客行',
    date: '2023-01-28',
    content: '（在此处填写您的古典诗词内容）'
  },
  {
    id: 'default-couplet-1',
    type: 'couplet',
    title: '书房联',
    date: '2023-02-05',
    content: '（上联内容）\n（下联内容）'
  },
  {
    id: 'default-couplet-2',
    type: 'couplet',
    title: '新春联',
    date: '2023-01-10',
    content: '（上联内容）\n（下联内容）'
  },
  {
    id: 'default-couplet-3',
    type: 'couplet',
    title: '山水联',
    date: '2022-10-03',
    content: '（上联内容）\n（下联内容）'
  }
];

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

let writeQueue = Promise.resolve();

function applyCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(defaultPoems, null, 2), 'utf8');
  }
}

function normalizeDateValue(value) {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const match = String(value).match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (!match) {
    return new Date().toISOString().slice(0, 10);
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function normalizePoem(input, existingId) {
  const type = ['modern', 'classic', 'couplet'].includes(input.type) ? input.type : 'modern';
  const title = String(input.title || '').trim();
  const content = String(input.content || '').replace(/\r\n/g, '\n').trim();

  if (!title || !content) {
    const error = new Error('标题和内容不能为空。');
    error.statusCode = 400;
    throw error;
  }

  return {
    id: existingId || String(input.id || randomUUID()),
    type,
    title,
    date: normalizeDateValue(input.date),
    content
  };
}

async function readPoems() {
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function writePoems(poems) {
  writeQueue = writeQueue.then(() => fs.writeFile(dataFile, JSON.stringify(poems, null, 2), 'utf8'));
  return writeQueue;
}

function sendJson(response, statusCode, payload) {
  applyCorsHeaders(response);
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, message) {
  applyCorsHeaders(response);
  response.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(message);
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('请求体不是有效的 JSON。');
    error.statusCode = 400;
    throw error;
  }
}

async function handleApi(request, response, pathname) {
  if (request.method === 'OPTIONS') {
    applyCorsHeaders(response);
    response.writeHead(204);
    response.end();
    return;
  }

  if (pathname === '/api/poems' && request.method === 'GET') {
    const poems = await readPoems();
    sendJson(response, 200, poems);
    return;
  }

  if (pathname === '/api/poems' && request.method === 'POST') {
    const body = await readRequestBody(request);
    const poem = normalizePoem(body);
    const poems = await readPoems();
    poems.push(poem);
    await writePoems(poems);
    sendJson(response, 201, poem);
    return;
  }

  const poemIdMatch = pathname.match(/^\/api\/poems\/([^/]+)$/);
  if (!poemIdMatch) {
    sendJson(response, 404, { message: '接口不存在。' });
    return;
  }

  const poemId = decodeURIComponent(poemIdMatch[1]);
  const poems = await readPoems();
  const index = poems.findIndex((item) => item.id === poemId);

  if (index === -1) {
    sendJson(response, 404, { message: '作品不存在。' });
    return;
  }

  if (request.method === 'PUT') {
    const body = await readRequestBody(request);
    const poem = normalizePoem(body, poemId);
    poems[index] = poem;
    await writePoems(poems);
    sendJson(response, 200, poem);
    return;
  }

  if (request.method === 'DELETE') {
    poems.splice(index, 1);
    applyCorsHeaders(response);
    await writePoems(poems);
    response.writeHead(204);
    response.end();
    return;
  }

  sendJson(response, 405, { message: '不支持的请求方法。' });
}

async function serveStaticFile(response, pathname) {
  const safePath = pathname === '/' ? '/poetry-gallery.html' : pathname;
  const filePath = path.normalize(path.join(rootDir, safePath));

  if (!filePath.startsWith(rootDir)) {
    sendText(response, 403, 'Forbidden');
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    const targetFile = stat.isDirectory() ? path.join(filePath, 'index.html') : filePath;
    const ext = path.extname(targetFile).toLowerCase();
    const content = await fs.readFile(targetFile);
    response.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    response.end(content);
  } catch {
    sendText(response, 404, 'Not Found');
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);

  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(request, response, url.pathname);
      return;
    }

    await serveStaticFile(response, decodeURIComponent(url.pathname));
  } catch (error) {
    console.error(error);
    sendJson(response, error.statusCode || 500, { message: error.message || '服务器内部错误。' });
  }
});

ensureDataFile()
  .then(() => {
    server.listen(port, host, () => {
      console.log(`Poetry gallery server running at http://${host}:${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exitCode = 1;
  });