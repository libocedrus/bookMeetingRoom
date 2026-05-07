import assert from "node:assert/strict";
import test from "node:test";
import { calculateReminder, weekdayMondayZero } from "../src/reminder.js";

function workdays(dates) {
  return new Set(dates);
}

test("weekday uses Monday as 0 and Thursday as 3", () => {
  assert.equal(weekdayMondayZero("2026-05-11"), 0);
  assert.equal(weekdayMondayZero("2026-05-14"), 3);
  assert.equal(weekdayMondayZero("2026-05-17"), 6);
});

test("does not remind when today is not a workday", () => {
  const result = calculateReminder("2026-05-10", workdays([]));

  assert.equal(result.shouldRemind, false);
  assert.equal(result.todayIsWorkday, false);
});

test("reminds when the third following workday is Thursday", () => {
  const result = calculateReminder("2026-05-11", workdays([
    "2026-05-11",
    "2026-05-12",
    "2026-05-13",
    "2026-05-14"
  ]));

  assert.equal(result.shouldRemind, true);
  assert.equal(result.targetDate, "2026-05-14");
});

test("counts makeup workdays exactly as the API says", () => {
  const result = calculateReminder("2026-05-06", workdays([
    "2026-05-06",
    "2026-05-07",
    "2026-05-08",
    "2026-05-09"
  ]));

  assert.equal(result.shouldRemind, false);
  assert.equal(result.targetDate, "2026-05-09");
});

test("skips long holidays when counting future workdays", () => {
  const result = calculateReminder("2026-02-13", workdays([
    "2026-02-13",
    "2026-02-14",
    "2026-02-24",
    "2026-02-25"
  ]));

  assert.equal(result.shouldRemind, false);
  assert.equal(result.targetDate, "2026-02-25");
});
