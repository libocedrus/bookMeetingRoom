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
