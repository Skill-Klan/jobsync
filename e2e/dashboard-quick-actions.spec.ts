// Requirement: every quick action on the dashboard shows its whole label — no
// ellipsis, no text over the button's padding or border, buttons in one row
// equally tall — in Ukrainian (the default, with
// longer words) and in English, from a phone to a wide screen. Only a real
// browser lays text out, so this is an e2e check, not a unit test.
import { test, expect } from "./fixtures";

// 1250: the narrowest card that still has two columns — the tightest fit.
const WIDTHS = [360, 390, 768, 1024, 1250, 1280, 1366, 1440, 1536, 1920];

const LABELS = {
  uk: ["Додати вакансію", "Додати автопошук", "Додати завдання", "Додати питання", "Додати активність", "Додати контакт"],
  en: ["Add Job", "Add Automation", "Add Task", "Add Question", "Add Activity", "Add Contact"],
} as const;

for (const locale of ["uk", "en"] as const) {
  test(`dashboard quick actions show whole labels (${locale})`, async ({ page, baseURL }) => {
    await page.context().addCookies([{ name: "sk_locale", value: locale, url: baseURL! }]);
    const problems: string[] = [];
    for (const width of WIDTHS) {
      // Narrow screens collapse the sidebar and the app remembers it in a
      // cookie; reset it to the default (expanded) — the narrowest card.
      await page.context().addCookies([{ name: "sidebar-expanded", value: "true", url: baseURL! }]);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/dashboard");
      await page.evaluate(() => document.fonts.ready);
      for (const label of LABELS[locale]) {
        const button = page.getByRole("button", { name: label, exact: true });
        await expect(button, `${label} at ${width}px`).toBeVisible();
        const fit = await button.evaluate((b) => {
          const text = b.querySelector("span");
          if (!text) return "no label element";
          // The button's inner box: its edge minus border and padding.
          const r = b.getBoundingClientRect();
          const cs = getComputedStyle(b);
          const px = (v: string) => parseFloat(v) || 0;
          const box = {
            left: r.left + px(cs.borderLeftWidth) + px(cs.paddingLeft),
            right: r.right - px(cs.borderRightWidth) - px(cs.paddingRight),
            top: r.top + px(cs.borderTopWidth) + px(cs.paddingTop),
            bottom: r.bottom - px(cs.borderBottomWidth) - px(cs.paddingBottom),
          };
          const inner = text.getBoundingClientRect();
          if (text.scrollWidth > text.clientWidth) return "cut off";
          if (inner.left < box.left - 0.5 || inner.right > box.right + 0.5) return "over the side padding";
          if (inner.top < box.top - 0.5 || inner.bottom > box.bottom + 0.5) return "over the top or bottom padding";
          return "ok";
        });
        if (fit !== "ok") problems.push(`${width}px «${label}»: ${fit}`);
      }
      // A one-line button beside a two-line one must not be shorter.
      const boxes = await Promise.all(
        LABELS[locale].map((label) => page.getByRole("button", { name: label, exact: true }).boundingBox()),
      );
      const rows = new Map<number, number[]>();
      for (const box of boxes) {
        if (!box) continue;
        // Grouped by the vertical centre: a centred shorter button has a
        // different top but shares the row's centre.
        const centre = Math.round(box.y + box.height / 2);
        rows.set(centre, [...(rows.get(centre) ?? []), Math.round(box.height)]);
      }
      for (const heights of rows.values()) {
        if (new Set(heights).size > 1) problems.push(`${width}px: buttons in one row differ in height (${heights.join(", ")})`);
      }
    }
    expect(problems).toEqual([]);
  });
}
