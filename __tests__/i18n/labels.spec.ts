// @vitest-environment node
// Requirement — D29/D30: statuses, stages, outcomes, contact roles and job
// sources are stored in English (seeded); they are shown in the user's
// language by their value. What the person renamed or created is theirs and
// is shown as stored; brand sources are not translated.
import { createTranslator } from "use-intl/core";
import { MESSAGES } from "@/i18n/messages";
import { DEFAULT_LABELS, labelFor, type LabelKind } from "@/i18n/labels";

const t = (locale: "uk" | "en") =>
  createTranslator({ locale, messages: MESSAGES[locale], namespace: "labels" }) as never;

describe("labelFor", () => {
  it("a seeded status in Ukrainian, by the glossary", () => {
    expect(labelFor(t("uk"), "jobStatus", { value: "applied", label: "Applied" })).toBe("Відгук надіслано");
    expect(labelFor(t("uk"), "jobStatus", { value: "offer-accepted", label: "Offer Accepted" })).toBe("Офер прийнято");
    expect(labelFor(t("uk"), "jobStage", { value: "final / onsite interview", label: "Final / Onsite Interview" })).toBe("Фінальна співбесіда");
    expect(labelFor(t("uk"), "stageOutcome", { value: "no-show", label: "No-show" })).toBe("Неявка");
    expect(labelFor(t("uk"), "contactRole", { value: "hiring manager", label: "Hiring Manager" })).toBe("Наймаючий менеджер");
    expect(labelFor(t("uk"), "jobSource", { value: "careerpage", label: "Company Career page" })).toBe("Сайт компанії");
  });

  it("in English — the stored English default", () => {
    expect(labelFor(t("en"), "jobStatus", { value: "applied", label: "Applied" })).toBe("Applied");
  });

  it("renamed by the person — shown as stored, in any language", () => {
    expect(labelFor(t("uk"), "jobStage", { value: "applied", label: "Відгук через рекрутера" })).toBe("Відгук через рекрутера");
    expect(labelFor(t("uk"), "contactRole", { value: "recruiter", label: "HR Ольга" })).toBe("HR Ольга");
  });

  it("created by the person (unknown value) — shown as stored", () => {
    expect(labelFor(t("uk"), "jobStage", { value: "test task", label: "Test task" })).toBe("Test task");
  });

  it("brand sources are not translated", () => {
    expect(labelFor(t("uk"), "jobSource", { value: "linkedin", label: "Linkedin" })).toBe("Linkedin");
    expect(labelFor(t("uk"), "jobSource", { value: "indeed", label: "Indeed" })).toBe("Indeed");
    expect(labelFor(t("uk"), "jobSource", { value: "dou", label: "DOU" })).toBe("DOU");
    expect(labelFor(t("uk"), "jobSource", { value: "djinni", label: "Djinni" })).toBe("Djinni");
  });

  it("an item without a stored label (constant lists) is translated by value", () => {
    expect(labelFor(t("uk"), "discoveryStatus", { value: "dismissed" })).toBe("Відхилена");
  });
});

describe("the labels dictionaries", () => {
  it("English reproduces every seeded English label exactly", () => {
    const en = MESSAGES.en.labels as unknown as Record<LabelKind, Record<string, string>>;
    for (const [kind, defaults] of Object.entries(DEFAULT_LABELS) as [LabelKind, Map<string, string>][]) {
      for (const [value, label] of defaults) {
        if (en[kind]?.[value] !== undefined) expect([kind, value, en[kind][value]]).toEqual([kind, value, label]);
      }
    }
  });

  it("every seeded default except brand sources has a translation", () => {
    const uk = MESSAGES.uk.labels as unknown as Record<LabelKind, Record<string, string>>;
    const brands = new Set(["indeed", "linkedin", "dou", "djinni", "monster", "glassdoor", "google", "ziprecruiter", "jobstreet"]);
    const missing: string[] = [];
    for (const [kind, defaults] of Object.entries(DEFAULT_LABELS) as [LabelKind, Map<string, string>][]) {
      for (const value of defaults.keys()) {
        if (kind === "jobSource" && brands.has(value)) continue;
        if (uk[kind]?.[value] === undefined) missing.push(`${kind}.${value}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
