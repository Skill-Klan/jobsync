// Requirement — the owner, 2026-11-19 (SKD-57): adding and using cover letters
// "closed with a switch" for the first release. With `coverLetters` off in
// Settings → «Функції»:
//   · the profile lists resumes only and offers «Add resume» alone (no «Add
//     cover letter»), and does not even read the letters;
//   · the job form has no «cover letter» choice; a job has no letter tab and no
//     «cover letter» button;
//   · the server refuses to create, edit, delete or generate a letter, and
//     writes nothing; reading is not part of the refusal;
//   · it is its own key: another switch being off does not hide the letters.
// Every "off" has an "on" pair, so "gone" is not just "never there".
import { render, screen } from "@testing-library/react";
import { FeaturesProvider } from "@/context/FeaturesContext";
import { ALL_FEATURES_ON, type FeatureFlags } from "@/skillklan/features";

const flags = vi.hoisted(() => ({ value: {} as Record<string, boolean> }));
const db = vi.hoisted(() => {
  const calls: string[] = [];
  const model = (name: string) =>
    new Proxy(
      {},
      {
        get: (_t, method) =>
          typeof method === "string" && method !== "then"
            ? async () => {
                calls.push(`${name}.${method}`);
                return method === "count" ? 0 : method === "findMany" ? [] : { id: "x", title: "Letter", Company: { label: "Acme" }, JobTitle: { label: "QA" } };
              }
            : undefined,
      },
    );
  const client = new Proxy({}, { get: (_t, name) => (typeof name === "string" && name !== "then" ? model(name) : undefined) });
  return { calls, client };
});

vi.mock("@/skillklan/featureFlags", () => ({
  isFeatureOff: vi.fn(async (key: string) => !flags.value[key]),
}));
vi.mock("@/lib/db", () => ({ default: db.client }));
vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn(async () => ({ id: "user-id" })) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/" }));
vi.mock("@/components/agent/AgentChatProvider", () => ({
  useAgentChat: () => ({ isOpen: false, open: vi.fn(), close: vi.fn(), approvalPending: false, busy: false }),
}));

import { JobDetailsHeader } from "@/components/myjobs/job-details/JobDetailsHeader";
import {
  createCoverLetter,
  deleteCoverLetterById,
  generateCoverLetterForJob,
  getCoverLetterList,
  updateCoverLetter,
} from "@/actions/coverLetter.actions";

const set = (coverLetters: boolean, others = true): FeatureFlags => {
  flags.value = { ...ALL_FEATURES_ON, automations: others, activities: others, library: others, tasks: others, questions: others, coverLetters };
  return flags.value as FeatureFlags;
};

beforeEach(() => {
  db.calls.length = 0;
  set(true);
});

describe.each([
  [false, 0],
  [true, 1],
])("coverLetters = %s", (on, shown) => {
  it(`the job's «cover letter» button: ${shown} shown`, () => {
    render(
      <FeaturesProvider value={set(on)}>
        <JobDetailsHeader
          job={{ id: "j-1", JobTitle: { label: "QA" }, Company: { label: "Acme" } } as never}
          coverLetterBlockedReason={undefined}
          chatBusy={false}
          onBack={vi.fn()}
          onMatch={vi.fn()}
          onCoverLetter={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onAddNote={vi.fn()}
          updateStatusMenu={null}
        />
      </FeaturesProvider>,
    );
    expect(screen.queryAllByTestId("generate-cover-letter-btn")).toHaveLength(shown);
  });
});

describe("it is its own key", () => {
  it("every other switch off, coverLetters on → the button is there (AI on)", () => {
    render(
      <FeaturesProvider value={set(true, false)}>
        <JobDetailsHeader
          job={{ id: "j-1", JobTitle: { label: "QA" }, Company: { label: "Acme" } } as never}
          chatBusy={false}
          onBack={vi.fn()}
          onMatch={vi.fn()}
          onCoverLetter={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onAddNote={vi.fn()}
          updateStatusMenu={null}
        />
      </FeaturesProvider>,
    );
    expect(screen.getByTestId("generate-cover-letter-btn")).toBeInTheDocument();
  });
});

describe("the actions", () => {
  const OFF = { success: false, message: "Cover letters have been switched off by the administrator." };
  const writes: [string, () => Promise<unknown>][] = [
    ["create", () => createCoverLetter("Letter", "<p>Hello there, a letter body</p>")],
    ["edit", () => updateCoverLetter("l-1", "Letter", "<p>Hello</p>")],
    ["delete", () => deleteCoverLetterById("l-1")],
    ["generate for a job", () => generateCoverLetterForJob("j-1", "x".repeat(400))],
  ];

  it.each(writes)("off → %s refuses and writes nothing", async (_label, call) => {
    set(false);
    await expect(call()).resolves.toEqual(OFF);
    expect(db.calls).toEqual([]);
  });

  it.each(writes)("on (the pair) → %s reaches the database", async (_label, call) => {
    await call();
    expect(db.calls.length).toBeGreaterThan(0);
  });

  it("off → reading the list is not part of the refusal", async () => {
    set(false);
    await expect(getCoverLetterList(1, 10)).resolves.toMatchObject({ success: true });
  });
});
