import { readFileSync } from "node:fs";
import http from "node:http";
import { extname, join, normalize } from "node:path";

const PORT = Number(process.env.PORT ?? 8787);
const PUBLIC_DIR = "github-pages/public";

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const server = http.createServer((req, res) => {
  if (req.method !== "GET") {
    res.writeHead(405, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ success: false, message: "Method not allowed" }));
    return;
  }

  const url = new URL(`http://localhost:${PORT}${req.url}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const normalized = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(PUBLIC_DIR, normalized);

  try {
    const body = readFileSync(filePath);
    const type = CONTENT_TYPES[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ success: false, message: "Not found" }));
  }
});

server.listen(PORT, () => {
  console.log(`static server listening on http://localhost:${PORT}`);
});
