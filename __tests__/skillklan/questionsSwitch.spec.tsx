// Requirement — the owner, 2026-11-19 (SKD-51): the Questions section "closed
// with a switch" for the first release. With `questions` off in Settings →
// «Функції»:
//   · the menu has no «Питання»; the page answers 404 and reads nothing;
//   · the dashboard has no «Add question», and its sentence stops naming them;
//   · a page opened before the switch went off still has its buttons, so the
//     server refuses to change or delete a question — and writes nothing;
//   · a question typed into an interview's prep list stays possible (the same
//     "create on the fly" rule as the Library), and reading is not touched;
//   · it is its own key: another switch being off does not close the page.
// Every "off" has an "on" pair, so "gone" is not just "never there".
import { render, screen } from "@testing-library/react";
import { FeaturesProvider } from "@/context/FeaturesContext";
import JobsAppliedCard from "@/components/dashboard/JobsAppliedCard";
import { visibleSidebarLinks } from "@/lib/constants";
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
                return method === "count" ? 0 : method === "findMany" ? [] : { id: "q-1" };
              }
            : undefined,
      },
    );
  const client = new Proxy({}, { get: (_t, name) => (typeof name === "string" && name !== "then" ? model(name) : undefined) });
  return { calls, client };
});

vi.mock("@/skillklan/featureFlags", () => ({
  getFeatureFlags: vi.fn(async () => flags.value),
  isFeatureOff: vi.fn(async (key: string) => !flags.value[key]),
}));
vi.mock("@/lib/db", () => ({ default: db.client }));
vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn(async () => ({ id: "user-id" })) }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));
vi.mock("@/actions/tag.actions", () => ({ getAllTags: vi.fn(async () => []) }));
vi.mock("@/app/dashboard/questions/QuestionsPageClient", () => ({ default: () => <div data-testid="questions" /> }));

import Questions from "@/app/dashboard/questions/page";
import { createQuestion, deleteQuestion, getQuestionsList, updateQuestion } from "@/actions/question.actions";

const setFlags = (questions: boolean, others = true): FeatureFlags => {
  flags.value = { ...ALL_FEATURES_ON, automations: others, activities: others, library: others, tasks: others, questions };
  return flags.value as FeatureFlags;
};

beforeEach(() => {
  db.calls.length = 0;
  setFlags(true);
});

describe("the menu", () => {
  const routes = (f: FeatureFlags) => visibleSidebarLinks(f, "production").map((i) => i.route);
  it("off → no «Питання»; on → it is there (the pair)", () => {
    expect(routes(setFlags(false))).not.toContain("/dashboard/questions");
    expect(routes(setFlags(true))).toContain("/dashboard/questions");
  });
});

describe("the page", () => {
  it("off → 404 and nothing is read; on → the page, even with every other switch off", async () => {
    setFlags(false);
    await expect(Questions({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(db.calls).toEqual([]);

    setFlags(true, false);
    render(await Questions({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId("questions")).toBeInTheDocument();
  });
});

describe("the dashboard quick actions", () => {
  it.each([
    [false, 0],
    [true, 1],
  ])("questions=%s → «Add Question» buttons: %i, and the sentence follows", (on, count) => {
    const { container } = render(<FeaturesProvider value={setFlags(on)}>{<JobsAppliedCard />}</FeaturesProvider>);
    expect(screen.queryAllByRole("button", { name: "Add Question" })).toHaveLength(count);
    expect(screen.getByRole("button", { name: "Add Job" })).toBeInTheDocument();
    expect(/questions/i.test(container.textContent ?? "")).toBe(on);
  });
});

describe("the actions", () => {
  const SWITCHED_OFF = { success: false, message: "This action has been switched off by the administrator." };

  it("off → update and delete refuse and write nothing", async () => {
    setFlags(false);
    await expect(updateQuestion({ id: "q-1", question: "Що таке React?", answer: "TBD", tagIds: [] } as never)).resolves.toEqual(SWITCHED_OFF);
    await expect(deleteQuestion("q-1")).resolves.toEqual(SWITCHED_OFF);
    expect(db.calls).toEqual([]);
  });

  it("on (the pair) → the same calls reach the database", async () => {
    await expect(updateQuestion({ id: "q-1", question: "Що таке React?", answer: "TBD", tagIds: [] } as never)).resolves.toMatchObject({ success: true });
    await expect(deleteQuestion("q-1")).resolves.toEqual({ success: true });
    expect(db.calls).toEqual(expect.arrayContaining(["question.update", "question.delete"]));
  });

  it("off → reading and creating from an interview's prep list stay open", async () => {
    setFlags(false);
    await expect(getQuestionsList(1, 10)).resolves.toMatchObject({ success: true });
    await expect(createQuestion({ question: "Що таке React?", answer: "TBD", tagIds: [] } as never)).resolves.toMatchObject({ success: true });
    expect(db.calls).toEqual(expect.arrayContaining(["question.findMany", "question.create"]));
  });
});
