import { readFileSync } from "node:fs";
import http from "node:http";
import { onRequestGet } from "../functions/api/meeting-room/should-remind.js";

const PORT = Number(process.env.PORT ?? 8787);

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
  if (req.method !== "GET" || !req.url.startsWith("/api/meeting-room/should-remind")) {
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ success: false, message: "Not found" }));
    return;
  }

  try {
    const response = await onRequestGet({
      request: new Request(`http://localhost:${PORT}${req.url}`),
      env: process.env
    });
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
