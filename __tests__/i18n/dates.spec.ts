// @vitest-environment node
// Requirement — glossary (D30): Ukrainian dates put the day first, use Ukrainian
// month names and 24-hour time; English keeps the patterns the screens used
// before translation.
import { DATE_PATTERNS, formatDate } from "@/i18n/dates";

const d = new Date(2026, 9, 14, 15, 5); // 14 Oct 2026, 15:05 local

describe("formatDate", () => {
  it.each([
    ["date", "14 жовт. 2026", "Oct 14, 2026"],
    ["dateLong", "14 жовтня 2026", "October 14, 2026"],
    ["dateNumeric", "14.10.2026", "10/14/2026"],
    ["dayMonth", "14 жовт.", "Oct 14"],
    ["dateTime", "14 жовт. 2026, 15:05", "Oct 14, 2026 3:05 PM"],
    ["time", "15:05", "3:05 PM"],
    ["monthYear", "жовтень 2026", "October 2026"],
  ] as const)("%s — uk %j, en %j", (name, uk, en) => {
    expect(formatDate(d, DATE_PATTERNS[name], "uk")).toBe(uk);
    expect(formatDate(d, DATE_PATTERNS[name], "en")).toBe(en);
  });
});
