// @vitest-environment node
// Requirement — local test pass before opening access (SKD-70): a tab title is
// «<page name> | SkillKlan Job», once. The root layout adds the suffix
// (title.template), so a page gives only its name; and every dashboard page
// gives one — a student with three tabs open sees which is which.
import fs from "fs";
import path from "path";
import ukJobs from "@/i18n/messages/uk/jobs.json";
import enJobs from "@/i18n/messages/en/jobs.json";
import ukInterviews from "@/i18n/messages/uk/interviews.json";
import enInterviews from "@/i18n/messages/en/interviews.json";
import ukNav from "@/i18n/messages/uk/nav.json";
import enNav from "@/i18n/messages/en/nav.json";
import ukAccount from "@/i18n/messages/uk/account.json";
import enAccount from "@/i18n/messages/en/account.json";

describe("the suffix is added once", () => {
  it.each([
    ["uk jobs", ukJobs.page.title],
    ["en jobs", enJobs.page.title],
    ["uk interviews", ukInterviews.page.title],
    ["en interviews", enInterviews.page.title],
  ])("%s gives the name only", (_label, title) => {
    expect(title).toBeTruthy();
    expect(title).not.toContain("SkillKlan Job");
  });

  it("the developer page does too, and the root layout is where the suffix comes from", () => {
    const root = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
    expect(root("src/app/dashboard/developer/page.tsx")).not.toMatch(/title:\s*"[^"]*SkillKlan Job/);
    expect(root("src/app/layout.tsx")).toContain('template: "%s | SkillKlan Job"');
  });
});

describe("every dashboard page names itself", () => {
  const PAGES = ["", "myjobs", "interviews", "plan", "profile", "settings", "stats", "catalog", "student-plans", "developer"];

  it.each(PAGES)("/dashboard/%s", (page) => {
    const file = path.join(process.cwd(), "src/app/dashboard", page, "page.tsx");
    const code = fs.readFileSync(file, "utf8");
    expect(code).toMatch(/export (async function generateMetadata|const metadata)/);
  });

  it("the names come from translations that exist in both languages", () => {
    for (const key of ["plan", "profile", "stats", "catalog", "studentPlans"] as const) {
      expect(ukNav[key]).toBeTruthy();
      expect(enNav[key]).toBeTruthy();
    }
    expect(ukAccount.settings).toBeTruthy();
    expect(enAccount.settings).toBeTruthy();
  });
});
