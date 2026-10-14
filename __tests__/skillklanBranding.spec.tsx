// skillklan: вимоги до брендингу й відʼєднання від апстріму (рішення власника 2026-10-14).
//   B1  PDF резюме й супровідного листа мають Creator = "SkillKlan Job" (не jobsync.ca)
//   B2  вікно Support: "SkillKlan Job", атрибуція JobSync (MIT), жодних посилань на jobsync.ca чи GitHub апстріму
//   B3  меню профілю не веде на вікі апстріму
//   B4  код застосунку не звертається до репозиторію апстріму й не містить jobsync.ca
import fs from "node:fs";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SimpleResumeDocument } from "@/components/profile/resume-pdf/SimpleTemplate";
import { ProfessionalResumeDocument } from "@/components/profile/resume-pdf/ProfessionalTemplate";
import { CoverLetterDocument } from "@/components/profile/cover-letter-pdf/CoverLetterTemplate";
import { SupportDialog } from "@/components/SupportDialog";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useNotifications } from "@/context/NotificationContext";

vi.mock("@/context/NotificationContext", () => ({ useNotifications: vi.fn() }));

// Назви збираємо з частин, щоб цей файл не знаходив сам себе (і щоб скан у B4 не залежав від нього).
const UPSTREAM_SLUG = ["Gsync", "jobsync"].join("/");
const UPSTREAM_SITE = ["jobsync", "ca"].join(".");
const BRAND = "SkillKlan Job";

// Будь-яка властивість стилів чи вузлів повертає сам проксі: шаблону потрібен лише Document.
// Перетворення на рядок і ітерація — порожні, інакше шаблон падає з TypeError, а не на вимозі.
const anything: any = new Proxy(() => anything, {
  get: (_t, prop) => {
    if (prop === Symbol.toPrimitive || prop === "toString" || prop === "valueOf") return () => "";
    if (prop === Symbol.iterator) return function* () {};
    if (prop === "length") return 0;
    return anything;
  },
  apply: () => anything,
});

beforeEach(() => {
  (useNotifications as any).mockReturnValue({ summary: { unread: 0, unreadErrors: 0 }, refresh: vi.fn() });
  // Стара версія ходила по /api/version — без мережі вона мовчки «без оновлень».
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
});

describe("B1 PDF creator metadata", () => {
  const resume: any = { title: "CV", ContactInfo: null, ResumeSections: [] };

  it.each([
    ["simple resume", () => SimpleResumeDocument({ resume, htmlNodes: anything, styles: anything, showPageNumbers: false })],
    ["professional resume", () => ProfessionalResumeDocument({ resume, htmlNodes: anything, styles: anything, showPageNumbers: false })],
    ["cover letter", () => CoverLetterDocument({ title: "Letter", contactInfo: null, dateLabel: "", bodyNodes: [], styles: anything })],
  ])("%s has Creator = SkillKlan Job", (_name, build) => {
    const doc: any = build();
    expect(doc.props.creator).toBe(BRAND);
  });
});

describe("B2 Support dialog", () => {
  it("shows SkillKlan Job, keeps JobSync MIT attribution, links nowhere upstream", () => {
    render(<SupportDialog open onOpenChange={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByText(new RegExp(BRAND)).length).toBeGreaterThan(0);
    expect(dialog.textContent).toMatch(/JobSync/);
    expect(dialog.textContent).toMatch(/MIT/);
    const hrefs = within(dialog).queryAllByRole("link").map((a) => a.getAttribute("href") ?? "");
    for (const href of hrefs) {
      expect(href).not.toContain(UPSTREAM_SITE);
      expect(href).not.toContain(UPSTREAM_SLUG);
    }
    expect(dialog.textContent).not.toContain(UPSTREAM_SITE);
  });
});

describe("B3 profile menu", () => {
  it("has no link to the upstream wiki", async () => {
    render(
      <TooltipProvider>
        <ProfileDropdown user={{ email: "s@example.com" }} expanded signOutAction={() => {}} />
      </TooltipProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: /user menu/i }));
    await screen.findByRole("menuitem", { name: /support/i });
    const hrefs = screen.queryAllByRole("menuitem").map((el) => el.getAttribute("href") ?? "");
    expect(hrefs.some((h) => h.includes(UPSTREAM_SLUG))).toBe(false);
  });
});

describe("B4 source has no upstream ties", () => {
  it("no file under src/ references the upstream repo or jobsync.ca", () => {
    const root = path.resolve(__dirname, "../src");
    const offenders: string[] = [];
    const visited: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx|js|mjs|json)$/.test(entry.name)) {
          visited.push(path.relative(root, full));
          const text = fs.readFileSync(full, "utf8");
          if (text.includes(UPSTREAM_SLUG) || text.includes(UPSTREAM_SITE)) offenders.push(path.relative(root, full));
        }
      }
    };
    walk(root);
    // Якір: обхід справді дійшов до відомих файлів — інакше «нуль порушень» нічого не доводить.
    expect(visited).toContain(path.join("components", "SupportDialog.tsx"));
    expect(visited).toContain(path.join("lib", "constants.ts"));
    expect(offenders).toEqual([]);
  });
});
