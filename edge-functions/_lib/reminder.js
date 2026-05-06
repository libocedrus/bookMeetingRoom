const SHANGHAI_TIME_ZONE = "Asia/Shanghai";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function formatShanghaiDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00+08:00`);
  return formatShanghaiDate(new Date(date.getTime() + days * MS_PER_DAY));
}

export function weekdayMondayZero(dateStr) {
  const day = new Date(`${dateStr}T00:00:00+08:00`).getDay();
  return day === 0 ? 6 : day - 1;
}

export function getYear(dateStr) {
  return Number(dateStr.slice(0, 4));
}

export function normalizeJiejiariWorkdays(payload) {
  return new Set(Object.keys(payload ?? {}));
}

export function calculateReminder(dateStr, workdaySet) {
  const todayIsWorkday = workdaySet.has(dateStr);

  if (!todayIsWorkday) {
    return {
      success: true,
      date: dateStr,
      todayIsWorkday: false,
      targetDate: null,
      targetIsWorkday: null,
      targetWeekday: null,
      shouldRemind: false,
      isFallback: false,
      userNotice: null,
      message: "今天不是工作日，无需提醒"
    };
  }

  let cursor = dateStr;
  let workdayCount = 0;
  let targetDate = null;

  while (workdayCount < 3) {
    cursor = addDays(cursor, 1);

    if (workdaySet.has(cursor)) {
      workdayCount += 1;
      targetDate = cursor;
    }
  }

  const targetWeekday = weekdayMondayZero(targetDate);
  const targetIsWorkday = workdaySet.has(targetDate);
  const shouldRemind = targetIsWorkday && targetWeekday === 3;

  return {
    success: true,
    date: dateStr,
    todayIsWorkday: true,
    targetDate,
    targetIsWorkday,
    targetWeekday,
    shouldRemind,
    isFallback: false,
    userNotice: null,
    message: shouldRemind
      ? "预约3个工作日后的会议室"
      : "3个工作日后不是周四，无需提醒"
  };
}

export function buildFallbackResult(dateStr, shouldRemind, error) {
  return {
    success: false,
    date: dateStr,
    todayIsWorkday: null,
    targetDate: null,
    targetIsWorkday: null,
    targetWeekday: null,
    shouldRemind,
    isFallback: true,
    userNotice: shouldRemind
      ? "会议室提醒判断失败，已默认打开闹钟"
      : "会议室提醒判断失败，已默认关闭闹钟",
    message: shouldRemind
      ? "工作日判断失败，已按不漏提醒策略打开闹钟"
      : "工作日判断失败，已按不打扰策略关闭闹钟",
    error: error?.message ?? String(error ?? "Unknown error")
  };
}
