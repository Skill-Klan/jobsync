// Requirement — the owner, 2026-11-19 (SKD-55): "close AI with a switch" for
// the first release; the paid path (J4) is not ready. With `ai` off in
// Settings → «Функції»:
//   · no AI chat button, no match button or tab, no review button on a resume,
//     no cover-letter generation, no "fill with AI" offer, no hint about AI
//     functions, and no AI / usage / API-key sections in Settings;
//   · the server refuses to call a model: 403 from the helper the routes use
//     (a route answers 401 to nobody-signed-in first), the on-demand job match
//     refuses, and a cover letter already written is still shown;
//   · it is its own key: another switch being off does not hide anything here.
// Every "off" has an "on" pair, so "gone" is not just "never there".
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeaturesProvider } from "@/context/FeaturesContext";
import { ALL_FEATURES_ON, type FeatureFlags } from "@/skillklan/features";

const flags = vi.hoisted(() => ({ value: {} as Record<string, boolean> }));

vi.mock("server-only", () => ({}));
vi.mock("@/skillklan/featureFlags", () => ({
  getFeatureFlags: vi.fn(async () => flags.value),
  isFeatureOff: vi.fn(async (key: string) => !flags.value[key]),
}));
vi.mock("@/components/agent/AgentChatProvider", () => ({
  useAgentChat: () => ({ isOpen: false, open: vi.fn(), close: vi.fn(), approvalPending: false, busy: false }),
}));
vi.mock("@/actions/userSettings.actions", () => ({ getUserSettings: vi.fn().mockResolvedValue({ success: false }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));

import { AgentChatTrigger } from "@/components/AgentChatTrigger";
import { MatchJobButton } from "@/components/myjobs/MatchJobButton";
import { IncompleteResumeHint } from "@/components/IncompleteResumeHint";
import { CoverLetterTab } from "@/components/myjobs/job-details/CoverLetterTab";
import { ResumeHeader } from "@/components/profile/resume-container/ResumeHeader";
import SettingsSidebar from "@/components/settings/SettingsSidebar";
import CreateResume from "@/components/profile/CreateResume";
import { refuseWhenAiOff } from "@/skillklan/aiSwitch";

// Only the AI switch moves; the others stay on (or, in the "others off" case, off).
const set = (ai: boolean, others = true): FeatureFlags => {
  flags.value = { ...ALL_FEATURES_ON, automations: others, activities: others, library: others, tasks: others, questions: others, ai };
  return flags.value as FeatureFlags;
};
const withAi = (ai: boolean, ui: React.ReactNode, others = true) =>
  render(<FeaturesProvider value={set(ai, others)}>{ui}</FeaturesProvider>);

describe.each([
  [false, 0],
  [true, 1],
])("AI switch = %s", (ai, shown) => {
  it(`the chat button: ${shown} shown`, () => {
    withAi(ai, <AgentChatTrigger />);
    expect(screen.queryAllByRole("button", { name: /open|chat/i })).toHaveLength(shown);
  });

  it(`the match button on the jobs list: ${shown} shown`, () => {
    withAi(ai, <MatchJobButton jobId="j-1" />);
    expect(screen.queryAllByRole("link", { name: "Match" })).toHaveLength(shown);
  });

  it(`the hint about AI functions: ${shown} shown`, () => {
    withAi(ai, <IncompleteResumeHint />);
    expect(screen.queryAllByRole("img")).toHaveLength(shown);
  });

  it(`the resume review button: ${shown} shown`, () => {
    withAi(
      ai,
      <ResumeHeader
        resume={{ id: "r-1", title: "CV" } as never}
        title="CV"
        isDefault={false}
        resumeSectionRef={{ current: null }}
        onBack={vi.fn()}
        onReview={vi.fn()}
        onExport={vi.fn()}
        onSetDefault={vi.fn()}
      />,
    );
    expect(screen.queryAllByRole("button", { name: /review/i })).toHaveLength(shown);
    expect(screen.getByRole("button", { name: /back|назад/i })).toBeInTheDocument();
  });

  it(`Settings: the AI, usage and API-key sections: ${shown ? 3 : 0} shown, the rest stay`, () => {
    withAi(ai, <SettingsSidebar activeSection="appearance" onSectionChange={vi.fn()} showAi={ai} />);
    const names = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(names.filter((n) => /AI|API/i.test(n ?? ""))).toHaveLength(shown ? 3 : 0);
    expect(names.some((n) => /appearance/i.test(n ?? ""))).toBe(true);
  });

  it(`a cover letter: «Generate» ${shown ? "is" : "is not"} offered, and a letter written already is still shown`, () => {
    const { rerender } = withAi(ai, <CoverLetterTab onGenerate={vi.fn()} />);
    expect(screen.queryAllByRole("button", { name: /generate/i })).toHaveLength(shown);
    rerender(
      <FeaturesProvider value={set(ai)}>
        <CoverLetterTab letter={{ id: "l-1", title: "Letter for Acme", content: "<p>Hi</p>" } as never} onGenerate={vi.fn()} />
      </FeaturesProvider>,
    );
    expect(screen.getByText(/Letter for Acme/)).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /regenerate/i })).toHaveLength(shown);
  });

  it(`creating a resume with a file: the "fill with AI" switch: ${shown} shown`, async () => {
    withAi(
      ai,
      <CreateResume resumeDialogOpen setResumeDialogOpen={vi.fn()} reloadResumes={vi.fn()} setNewResumeId={vi.fn()} />,
    );
    const file = new File(["%PDF-1.4"], "cv.pdf", { type: "application/pdf" });
    await userEvent.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file);
    expect(await screen.findByDisplayValue("cv")).toBeInTheDocument();
    expect(screen.queryAllByRole("switch")).toHaveLength(shown);
  });
});

describe("it is its own key", () => {
  it("every other switch off, AI on → the chat button and the match button are there", () => {
    withAi(true, (
      <>
        <AgentChatTrigger />
        <MatchJobButton jobId="j-1" />
      </>
    ), false);
    expect(screen.getAllByRole("button", { name: /open|chat/i })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Match" })).toBeInTheDocument();
  });
});

describe("the server", () => {
  it("off → 403 with the message; on → nothing to refuse (the pair)", async () => {
    set(false);
    const off = await refuseWhenAiOff();
    expect(off?.status).toBe(403);
    await expect(off?.json()).resolves.toEqual({
      error: "AI is switched off by the administrator.",
      message: "AI is switched off by the administrator.",
    });
    set(true);
    await expect(refuseWhenAiOff()).resolves.toBeNull();
  });

  it("it reads only the `ai` key: AI on with everything else off → no refusal", async () => {
    set(true, false);
    await expect(refuseWhenAiOff()).resolves.toBeNull();
  });
});
