import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, '.demo-build', 'out');
const args = process.argv.slice(2);
let basePath = '/studioshelf-demo';
let port = 4173;
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--base-path') basePath = args[++index];
  else if (args[index] === '--port') port = Number(args[++index]);
  else throw new Error(`Unknown argument: ${args[index]}`);
}
if (
  !/^\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(basePath) ||
  !Number.isInteger(port) ||
  port < 0 ||
  port > 65535
) {
  throw new Error('Use --base-path /repository-name and a valid --port.');
}
const resolvedOutput = await realpath(output);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};
const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405).end();
    return;
  }
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/' || pathname === basePath) {
      response.writeHead(302, { Location: `${basePath}/${url.search}` }).end();
      return;
    }
    if (!pathname.startsWith(`${basePath}/`)) {
      response.writeHead(404).end('Not found');
      return;
    }
    const target = resolve(output, `.${pathname.slice(basePath.length)}`);
    const part = relative(output, target);
    if (isAbsolute(part) || part.startsWith(`..${sep}`) || part === '..' || part.startsWith(sep))
      throw new Error('Invalid path.');
    let file = target;
    let code = 200;
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      await stat(file);
    } catch {
      file = join(output, '404.html');
      code = 404;
    }
    const realFile = await realpath(file);
    const realPart = relative(resolvedOutput, realFile);
    if (
      isAbsolute(realPart) ||
      realPart.startsWith(`..${sep}`) ||
      realPart === '..' ||
      realPart.startsWith(sep)
    )
      throw new Error('Invalid path.');
    const data = await readFile(realFile);
    response.writeHead(code, {
      'Content-Type': mime[extname(file)] || 'application/octet-stream',
      'Content-Length': data.length,
    });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch {
    response.writeHead(400).end('Bad request');
  }
});
server.listen(port, '127.0.0.1', () =>
  console.log(`StudioShelf static demo: http://127.0.0.1:${server.address().port}${basePath}/`),
);
