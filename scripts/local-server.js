import { readFileSync } from "node:fs";
import http from "node:http";
import { extname, join, normalize } from "node:path";
import worker from "../src/worker.js";

const PORT = Number(process.env.PORT ?? 8787);
const PUBLIC_DIR = "public";

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function loadEnv() {
  try {
    const text = readFileSync(".env", "utf8");

    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const index = trimmed.indexOf("=");

      if (index === -1) {
        continue;
      }

      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();

      if (key && process.env[key] === undefined) {
        process.env[key] = value.replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // .env is optional for local development.
  }
}

loadEnv();

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && !req.url.startsWith("/api/meeting-room/should-remind")) {
    const url = new URL(`http://localhost:${PORT}${req.url}`);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const normalized = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
    const filePath = join(PUBLIC_DIR, normalized);

    try {
      const body = readFileSync(filePath);
      const type = CONTENT_TYPES[extname(filePath)] || "application/octet-stream";
      res.writeHead(200, { "content-type": type });
      res.end(body);
      return;
    } catch {
      res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ success: false, message: "Not found" }));
      return;
    }
  }

  if (req.method !== "GET") {
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ success: false, message: "Not found" }));
    return;
  }

  try {
    const response = await worker.fetch(
      new Request(`http://localhost:${PORT}${req.url}`),
      process.env
    );
    const body = await response.text();

    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    res.end(body);
  } catch (error) {
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
});

server.listen(PORT, () => {
  console.log(`local server listening on http://localhost:${PORT}`);
});
