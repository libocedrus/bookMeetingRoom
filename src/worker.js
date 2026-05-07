import {
  buildFallbackResult,
  calculateReminder,
  formatShanghaiDate,
  getYear,
  normalizeJiejiariWorkdays
} from "./reminder.js";

const API_BASE_URL = "https://api.jiejiariapi.com/v1/workdays";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    }
  });
}

async function fetchWorkdays(year, env) {
  const url = new URL(`${API_BASE_URL}/${year}`);
  const apiKey = env?.JIEJIARI_API_KEY;

  if (apiKey) {
    url.searchParams.set("key", apiKey);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`jiejiariapi request failed: ${response.status}`);
  }

  return normalizeJiejiariWorkdays(await response.json());
}

async function loadWorkdaySet(dateStr, env) {
  const year = getYear(dateStr);
  const workdaySet = await fetchWorkdays(year, env);

  if (dateStr.slice(5) > "12-20") {
    const nextYearWorkdays = await fetchWorkdays(year + 1, env);

    for (const date of nextYearWorkdays) {
      workdaySet.add(date);
    }
  }

  return workdaySet;
}

async function handleShouldRemind(request, env) {
  const url = new URL(request.url);
  const dateStr = url.searchParams.get("date") || formatShanghaiDate();
  const fallbackShouldRemind = env?.FALLBACK_SHOULD_REMIND !== "false";

  try {
    const workdaySet = await loadWorkdaySet(dateStr, env);
    return json(calculateReminder(dateStr, workdaySet));
  } catch (error) {
    return json(buildFallbackResult(dateStr, fallbackShouldRemind, error));
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/meeting-room/should-remind") {
      return handleShouldRemind(request, env);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-allow-headers": "content-type"
        }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
