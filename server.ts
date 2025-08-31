//import { serveFile } from 'jsr:@std/http/file-server';
//return serveFile(req, 'index.html');
import { extname } from "jsr:@std/path/extname";
import { eTag, ifNoneMatch } from "jsr:@std/http/etag";
import createHeaders from './headers.ts';

const EXT_RAWS = new Set([
  ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif",
  ".ico", ".bmp"
]);
const EXT_FONTS = new Set([".ttf", ".woff2"]);

Deno.serve(async (req: Request) => {
  const { pathname } = new URL(req.url);
  const ifNone = req.headers.get('if-none-match');
  if (pathname === '/' && req.method === 'GET') {
    const file = await Deno.readFile('src/index.html');
    return new Response(file, createHeaders({ ext: 'html' }));
  };

  const patternStatic = new URLPattern({ pathname: "/static/**" });
  if (patternStatic.test(req.url) && req.method === 'GET') {
    const ext = extname(pathname);
    const baseDir = (EXT_FONTS.has(ext) || EXT_RAWS.has(ext)) ? 'src' : 'src/dist';
    const fsPath = pathname.replace('/static', baseDir);
    const file = await Deno.readFile(fsPath);
    const computedEtag = await eTag(file);
    if (!ifNoneMatch(ifNone, computedEtag)) {
      return new Response(null, createHeaders({
        status: 304,
        customHeaders: {
          'ETag': computedEtag,
          'Cache-Control': 'no-cache, must-revalidate'
        }
      }))
    }
    return new Response(file, createHeaders({
      ext,
      customHeaders: {
        'ETag': computedEtag,
        'Cache-Control': EXT_FONTS.has(ext) ? 'public, max-age=2592000, immutable' : 'no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff'
      }
    }));
  };

  const file = await Deno.readFile('src/404.html');
  return new Response(file, createHeaders({ ext: 'html', status: 404 }));
});
