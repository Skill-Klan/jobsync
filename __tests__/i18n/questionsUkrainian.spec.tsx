// Requirement — D29 (Ukrainian by default) and D30 (the owner's glossary):
// the Questions screen, the question dialog and the messages the question
// actions return speak Ukrainian. Questions → «Питання», Tag → «тег»;
// counts agree with the number (1 етапу, 3 етапів).
import { render, screen, within } from "@testing-library/react";
import QuestionsContainer from "@/components/questions/QuestionsContainer";
import QuestionsSidebar from "@/components/questions/QuestionsSidebar";
import { QuestionForm } from "@/components/questions/QuestionForm";
import { getQuestionsList } from "@/actions/question.actions";
import { getCurrentUser } from "@/utils/user.utils";
import { PrismaClient } from "@prisma/client";
import { setTestLocale } from "../helpers/i18n";

vi.mock("@/actions/question.actions", () => ({
  getQuestionsList: vi.fn(),
  getQuestionById: vi.fn(),
  getPrepStageLabel: vi.fn(),
  deleteQuestion: vi.fn(),
  createQuestion: vi.fn(),
  updateQuestion: vi.fn(),
}));
vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@prisma/client", () => {
  const client = {
    question: { delete: vi.fn() },
    jobStagePrepQuestion: { count: vi.fn() },
  };
  return { PrismaClient: vi.fn(function () { return client; }) };
});
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

const prisma = new PrismaClient() as any;

const question = (over: Record<string, unknown> = {}) => ({
  id: "q-1",
  question: "Що таке регресійне тестування?",
  answer: "<p>Перевірка, що старе не зламалось.</p>",
  createdBy: "user-id",
  tags: [{ id: "tag-1", label: "QA", value: "qa" }],
  createdVia: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const ENGLISH = /\b(Questions|New Question|Edit question|Delete question|Load More|No questions found|via|Show more|Show less|Skill Tags|All|Cancel|Save|Answer|Question)\b/;

describe("Questions in Ukrainian", () => {
  it("the list: heading, toolbar, cards and loading more", async () => {
    setTestLocale("uk");
    (getQuestionsList as any).mockResolvedValue({
      success: true,
      data: [question(), question({ id: "q-2", question: "Що таке смоук?", createdVia: "mcp" })],
      total: 30,
    });
    const { container } = render(<QuestionsContainer availableTags={[]} />);

    expect(await screen.findByText("Що таке регресійне тестування?")).toBeInTheDocument();
    expect(screen.getByText("Питання")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Нове питання/ })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Пошук питань…")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Редагувати питання" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Видалити питання" })).toHaveLength(2);
    expect(screen.getByText("через mcp")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Завантажити ще" })).toBeInTheDocument();
    const cards = screen.getAllByTestId("question-card").map((c) => c.textContent).join(" ");
    expect(cards).not.toMatch(ENGLISH);
    expect(container.textContent).not.toMatch(/\b(New Question|Load More)\b/);
  });

  it("an empty list says so in Ukrainian", async () => {
    setTestLocale("uk");
    (getQuestionsList as any).mockResolvedValue({ success: true, data: [], total: 0 });
    render(<QuestionsContainer availableTags={[]} />);

    expect(
      await screen.findByText("Питань не знайдено. Створіть перше питання, щоб почати."),
    ).toBeInTheDocument();
  });

  it("the sidebar of skill tags", () => {
    setTestLocale("uk");
    const { container } = render(
      <QuestionsSidebar
        tags={[{ id: "tag-1", label: "QA", value: "qa", questionCount: 3 }]}
        totalQuestions={5}
        onFilterChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Навички")).toBeInTheDocument();
    expect(screen.getByText("5 усього")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Згорнути панель" })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(ENGLISH);
  });

  it("the dialog: adding a question", () => {
    setTestLocale("uk");
    render(
      <QuestionForm
        availableTags={[]}
        resetEditQuestion={vi.fn()}
        onQuestionSaved={vi.fn()}
        dialogOpen
        setDialogOpen={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Додати питання" })).toBeInTheDocument();
    expect(within(dialog).getByText("Додайте питання до своєї бази питань.")).toBeInTheDocument();
    expect(within(dialog).getByText("Питання *")).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText("Введіть питання зі співбесіди")).toBeInTheDocument();
    expect(within(dialog).getByText("Відповідь *")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Скасувати" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Зберегти" })).toBeInTheDocument();
  });
});

describe("Question actions answer in Ukrainian", () => {
  beforeEach(() => {
    (getCurrentUser as any).mockResolvedValue({ id: "user-id" });
  });

  it.each([
    [1, "Питання не можна видалити: воно є у списку для підготовки до 1 етапу співбесіди. Спершу приберіть його звідти."],
    [3, "Питання не можна видалити: воно є у списку для підготовки до 3 етапів співбесід. Спершу приберіть його звідти."],
  ])("a question on %i prep lists cannot be deleted", async (count, message) => {
    setTestLocale("uk");
    const { deleteQuestion } = await vi.importActual<typeof import("@/actions/question.actions")>(
      "@/actions/question.actions",
    );
    prisma.jobStagePrepQuestion.count.mockResolvedValue(count);
    expect(await deleteQuestion("q-1")).toEqual({ success: false, message });
  });
});
