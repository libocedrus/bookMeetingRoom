import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const OUTPUT_DIR = new URL("../public/data/", import.meta.url);
const TZ = "Asia/Shanghai";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const YEARS_AHEAD = 1;
const FALLBACK_SHOULD_REMIND = process.env.FALLBACK_SHOULD_REMIND !== "false";

function formatShanghaiDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function shanghaiIsoNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}:${value.second}+08:00`;
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00+08:00`);
  return formatShanghaiDate(new Date(date.getTime() + days * MS_PER_DAY));
}

function getYear(dateStr) {
  return Number(dateStr.slice(0, 4));
}

function weekdayName(dateStr) {
  const names = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return names[new Date(`${dateStr}T00:00:00+08:00`).getDay()];
}

function isOrdinaryWeekday(dateStr) {
  const day = new Date(`${dateStr}T00:00:00+08:00`).getDay();
  return day >= 1 && day <= 5;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        ...(options.headers ?? {})
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJiejiariapi(year) {
  const payload = await fetchJson(`https://api.jiejiariapi.com/v1/workdays/${year}`);
  const workdays = {};

  for (const [date, record] of Object.entries(payload ?? {})) {
    workdays[date] = {
      date,
      name: record.name || weekdayName(date),
      isWorkday: record.isOffDay === false,
      sourceMeta: record
    };
  }

  return {
    source: "jiejiariapi",
    year,
    workdays
  };
}

async function fetchTimor(year) {
  const payload = await fetchJson(`https://timor.tech/api/holiday/year/${year}`);
  const holidays = payload?.holiday;

  if (!holidays || typeof holidays !== "object") {
    throw new Error("timor.tech response missing holiday map");
  }

  const workdays = {};
  let cursor = `${year}-01-01`;
  const last = `${year}-12-31`;

  while (cursor <= last) {
    const key = cursor.slice(5);
    const record = holidays[key];
    const isHoliday = record?.holiday === true;
    const isWorkday = record?.holiday === false || (!isHoliday && isOrdinaryWeekday(cursor));

    if (isWorkday) {
      workdays[cursor] = {
        date: cursor,
        name: record?.name ? `${record.name},${weekdayName(cursor)}` : weekdayName(cursor),
        isWorkday: true,
        sourceMeta: record ?? null
      };
    }

    cursor = addDays(cursor, 1);
  }

  return {
    source: "timor.tech",
    year,
    workdays
  };
}

async function fetchNagerDate(year) {
  const holidays = await fetchJson(`https://date.nager.at/api/v3/PublicHolidays/${year}/CN`);
  const holidaySet = new Set((Array.isArray(holidays) ? holidays : []).map((item) => item.date));
  const workdays = {};
  let cursor = `${year}-01-01`;
  const last = `${year}-12-31`;

  while (cursor <= last) {
    if (isOrdinaryWeekday(cursor) && !holidaySet.has(cursor)) {
      workdays[cursor] = {
        date: cursor,
        name: weekdayName(cursor),
        isWorkday: true,
        sourceMeta: null
      };
    }

    cursor = addDays(cursor, 1);
  }

  return {
    source: "nager.date",
    year,
    workdays
  };
}

function validateYearData(data) {
  const dates = Object.keys(data.workdays ?? {});
  const count = dates.length;

  if (count < 230 || count > 270) {
    throw new Error(`workday count out of range: ${count}`);
  }

  for (const date of dates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`invalid date key: ${date}`);
    }
  }

  return true;
}

async function loadPreviousJson(fileName) {
  const path = join(OUTPUT_DIR.pathname, fileName);

  if (!existsSync(path)) {
    return null;
  }

  return JSON.parse(await readFile(path, "utf8"));
}

async function fetchYearWithFallback(year) {
  const sources = [
    ["jiejiariapi", fetchJiejiariapi],
    ["timor.tech", fetchTimor],
    ["nager.date", fetchNagerDate]
  ];
  const attempts = [];

  for (const [name, fetcher] of sources) {
    try {
      const data = await fetcher(year);
      validateYearData(data);
      attempts.push({ source: name, ok: true });

      return {
        ...data,
        attempts,
        status: attempts.length === 1 ? "ok" : "partial_source_fallback"
      };
    } catch (error) {
      attempts.push({ source: name, ok: false, error: error.message });
    }
  }

  const previous = await loadPreviousJson(`workdays-${year}.json`);

  if (previous?.workdays) {
    return {
      ...previous,
      attempts,
      status: "stale_data",
      staleReason: "all_sources_failed"
    };
  }

  throw new Error(`all sources failed for ${year}: ${attempts.map((item) => `${item.source}:${item.error}`).join("; ")}`);
}

function mergeWorkdayMaps(yearDataList) {
  const workdays = {};

  for (const yearData of yearDataList) {
    Object.assign(workdays, yearData.workdays);
  }

  return workdays;
}

function calculateReminder(dateStr, allWorkdays, status = "ok") {
  const todayRecord = allWorkdays[dateStr];

  if (!todayRecord) {
    return {
      date: dateStr,
      status,
      shouldRemind: false,
      actionPolicy: "close_alarm",
      todayIsWorkday: false,
      targetDate: null,
      targetIsWorkday: null,
      targetWeekdayName: null,
      message: "今天不是工作日，无需提醒"
    };
  }

  let cursor = dateStr;
  let count = 0;
  let targetRecord = null;

  while (count < 3) {
    cursor = addDays(cursor, 1);
    const record = allWorkdays[cursor];

    if (record) {
      count += 1;
      targetRecord = record;
    }

    if (cursor > addDays(dateStr, 45)) {
      return {
        date: dateStr,
        status: "validation_failed",
        shouldRemind: FALLBACK_SHOULD_REMIND,
        actionPolicy: FALLBACK_SHOULD_REMIND ? "open_alarm" : "close_alarm",
        todayIsWorkday: true,
        targetDate: null,
        targetIsWorkday: null,
        targetWeekdayName: null,
        message: "未能找到第3个工作日，请手动确认"
      };
    }
  }

  const targetWeekdayName = targetRecord.name || weekdayName(targetRecord.date);
  const shouldRemind = targetWeekdayName.includes("周四");

  return {
    date: dateStr,
    status,
    shouldRemind,
    actionPolicy: shouldRemind ? "open_alarm" : "close_alarm",
    todayIsWorkday: true,
    targetDate: targetRecord.date,
    targetIsWorkday: true,
    targetWeekdayName,
    message: shouldRemind ? "预约3个工作日后的会议室" : "今天无需提醒"
  };
}

async function writeJson(fileName, data) {
  await writeFile(join(OUTPUT_DIR.pathname, fileName), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const today = process.env.TODAY || formatShanghaiDate();
  const currentYear = getYear(today);
  const years = Array.from({ length: YEARS_AHEAD + 1 }, (_, index) => currentYear + index);
  const updatedAt = shanghaiIsoNow();
  const yearDataList = [];
  const sourceReports = [];

  for (const year of years) {
    const data = await fetchYearWithFallback(year);
    const output = {
      year,
      source: data.source,
      status: data.status,
      updatedAt,
      attempts: data.attempts,
      staleReason: data.staleReason ?? null,
      workdays: data.workdays
    };
    yearDataList.push(output);
    sourceReports.push({
      year,
      source: output.source,
      status: output.status,
      attempts: output.attempts,
      staleReason: output.staleReason
    });
    await writeJson(`workdays-${year}.json`, output);
  }

  const allWorkdays = mergeWorkdayMaps(yearDataList);
  const aggregateStatus = yearDataList.some((item) => item.status === "stale_data")
    ? "stale_data"
    : yearDataList.some((item) => item.status === "partial_source_fallback")
      ? "partial_source_fallback"
      : "ok";

  for (const year of years) {
    const reminders = {};
    let cursor = `${year}-01-01`;
    const last = `${year}-12-31`;

    while (cursor <= last) {
      reminders[cursor] = calculateReminder(cursor, allWorkdays, aggregateStatus);
      cursor = addDays(cursor, 1);
    }

    await writeJson(`reminders-${year}.json`, {
      year,
      status: aggregateStatus,
      updatedAt,
      reminders
    });
  }

  const todayResult = {
    ...calculateReminder(today, allWorkdays, aggregateStatus),
    updatedAt,
    sources: sourceReports
  };

  if (aggregateStatus === "partial_source_fallback") {
    todayResult.message = `${todayResult.message}；工作日数据使用备用来源更新`;
  }

  if (aggregateStatus === "stale_data") {
    todayResult.shouldRemind = FALLBACK_SHOULD_REMIND;
    todayResult.actionPolicy = FALLBACK_SHOULD_REMIND ? "open_alarm" : "close_alarm";
    todayResult.message = "工作日数据更新失败，已使用旧数据，请手动确认";
  }

  await writeJson("today.json", todayResult);
  await writeJson("status.json", {
    status: aggregateStatus,
    updatedAt,
    today,
    sources: sourceReports
  });
  await writeJson("sources.json", {
    updatedAt,
    sources: sourceReports
  });

  console.log(JSON.stringify(todayResult, null, 2));
}

main().catch(async (error) => {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const today = process.env.TODAY || formatShanghaiDate();
  const fallback = {
    date: today,
    status: "all_sources_failed",
    shouldRemind: FALLBACK_SHOULD_REMIND,
    actionPolicy: FALLBACK_SHOULD_REMIND ? "open_alarm" : "close_alarm",
    todayIsWorkday: null,
    targetDate: null,
    targetIsWorkday: null,
    targetWeekdayName: null,
    message: "工作日数据更新失败，请手动确认",
    updatedAt: shanghaiIsoNow(),
    error: error.message
  };
  await writeJson("today.json", fallback);
  await writeJson("status.json", fallback);
  console.error(error);
});
