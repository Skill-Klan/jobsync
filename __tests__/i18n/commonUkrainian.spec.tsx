// Requirement — D29/D30: the shared building blocks every screen uses speak
// Ukrainian — confirmations, pickers, dates, the contact and stage dialogs,
// "not found", support — stored stages/statuses/outcomes follow the glossary,
// and a picker finds an item by the Ukrainian word a person sees.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { DeleteAlertDialog } from "@/components/DeleteAlertDialog";
import { Combobox } from "@/components/ComboBox";
import { FormDialogFooter } from "@/components/FormDialogFooter";
import { SupportDialog } from "@/components/SupportDialog";
import { SlowResponseWarning } from "@/components/common/SlowResponseWarning";
import NotFound from "@/app/dashboard/not-found";
import { AddStageDialog } from "@/components/AddStageDialog";
import AddContact from "@/components/AddContact";
import { DatePicker } from "@/components/DatePicker";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { setTestLocale } from "../helpers/i18n";

vi.mock("@/actions/jobStage.actions", () => ({ addJobStage: vi.fn(), updateJobStage: vi.fn() }));
vi.mock("@/actions/contact.actions", () => ({ createContact: vi.fn(), updateContact: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toastActionResult: vi.fn(), toastSuccess: vi.fn(), toastError: vi.fn() }));
Element.prototype.scrollIntoView = vi.fn();

beforeEach(() => setTestLocale("uk"));

function ComboHarness({ creatable = false }: { creatable?: boolean }) {
  const form = useForm<{ v: string }>({ defaultValues: { v: "" } });
  const options = [
    { id: "1", label: "Співбесіда", value: "interview" },
    { id: "2", label: "Офер", value: "offer" },
  ];
  return (
    <Form {...form}>
      <Combobox options={options} field={{ ...form.register("v"), value: form.watch("v"), onChange: (v: string) => form.setValue("v", v) } as never} label="stage" creatable={creatable} />
    </Form>
  );
}

function DateHarness() {
  const form = useForm<{ d?: Date }>({ defaultValues: { d: new Date(2026, 9, 14) } });
  return (
    <Form {...form}>
      <DatePicker field={{ value: form.watch("d"), onChange: (d: Date) => form.setValue("d", d) } as never} presets isEnabled />
    </Form>
  );
}

describe("shared components in Ukrainian", () => {
  it("delete confirmation: the item the caller names, Ukrainian buttons", () => {
    render(<DeleteAlertDialog open onOpenChange={vi.fn()} onDelete={vi.fn()} pageTitle="цю вакансію" />);
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Справді видалити цю вакансію?")).toBeInTheDocument();
    expect(within(dialog).getByText(/Цю дію не можна скасувати/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Видалити" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Скасувати" })).toBeInTheDocument();
  });

  it("picker: Ukrainian prompts, and it finds an item by the Ukrainian word", async () => {
    render(<ComboHarness />);
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("Оберіть зі списку");
    await userEvent.click(trigger);
    const input = screen.getByPlaceholderText("Пошук…");
    await userEvent.type(input, "офер");
    expect(screen.getByRole("option", { name: /Офер/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Співбесіда/ })).toBeNull();
  });

  it("creatable picker: Ukrainian search and create", async () => {
    render(<ComboHarness creatable />);
    await userEvent.click(screen.getByRole("combobox"));
    const input = screen.getByPlaceholderText("Пошук або нове значення…");
    await userEvent.type(input, "Тестове завдання");
    expect(screen.getByText("Створити:")).toBeInTheDocument();
  });

  it("date picker: the date and presets in Ukrainian", async () => {
    render(<DateHarness />);
    const trigger = screen.getByRole("button", { name: /14 жовт\. 2026/ });
    await userEvent.click(trigger);
    expect(screen.getByText("Швидкий вибір")).toBeInTheDocument();
    // the calendar itself: Ukrainian month name
    expect(screen.getAllByText(/жовтень 2026/i).length).toBeGreaterThan(0);
  });

  it("form footer, dialog close", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>x</DialogTitle>
          <FormDialogFooter onCancel={vi.fn()} isPending={false} saveDisabled={false} />
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole("button", { name: "Скасувати" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Зберегти" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Закрити" })).toBeInTheDocument();
  });

  it("support and the slow-model warning", () => {
    render(<SupportDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByText("Підтримка")).toBeInTheDocument();
    expect(screen.getByText(/трекер пошуку роботи для студентів і випускників SkillKlan/)).toBeInTheDocument();
    expect(screen.getByText("Версія")).toBeInTheDocument();
    render(<SlowResponseWarning />);
    expect(screen.getByText(/Модель відповідає довше, ніж зазвичай/)).toHaveTextContent(/у розділі Налаштування\.$/);
  });

  it("not found", () => {
    render(<NotFound />);
    expect(screen.getByText("Не знайдено")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "На головну" })).toBeInTheDocument();
  });

  it("stage dialog: Ukrainian fields, glossary stage names, outcome names", async () => {
    const stageTypes = [
      { id: "t-int", label: "Final / Onsite Interview", value: "final / onsite interview", statusId: "s", sortOrder: 6, Status: { id: "s", label: "Interview", value: "interview" } },
    ] as any;
    render(
      <AddStageDialog open jobId="j1" jobLabel="QA · Acme" stage={null} stageTypes={stageTypes}
        jobStatuses={[{ id: "s", label: "Interview", value: "interview" }] as any} onOpenChange={vi.fn()} onSaved={vi.fn()} />,
    );
    expect(screen.getByText("Додати етап", { selector: "h2" })).toBeInTheDocument();
    // (the outcome field appears only when editing an existing stage)
    for (const l of ["ЕТАП", "ДАТА", "ЧАС"]) expect(screen.getByText(l)).toBeInTheDocument();
    await userEvent.click(within(screen.getByTestId("stage-type-select")).getByRole("combobox"));
    expect(screen.getByRole("option", { name: /Фінальна співбесіда/ })).toBeInTheDocument();
  });

  it("contact dialog: Ukrainian title, sections and fields", () => {
    render(
      <AddContact hideTrigger dialogOpen setDialogOpen={vi.fn()} companies={[]} locations={[]} roles={[]}
        reloadContacts={vi.fn()} resetEditContact={vi.fn()} />,
    );
    expect(screen.getByText("Додати контакт", { selector: "h2" })).toBeInTheDocument();
    for (const l of ["Імʼя", "Посада", "Ел. пошта", "Телефон", "Де працює", "Компанія", "Роль", "Нотатки"]) {
      expect(screen.getByText(l)).toBeInTheDocument();
    }
  });
});
