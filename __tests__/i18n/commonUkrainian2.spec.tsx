// Requirement — D29/D30, second pass over the shared layer: the record counter
// on every list, the generic error toast, the activity start/stop toasts and
// the "switch activity" confirmation speak Ukrainian; the counter needs no
// noun (Ukrainian would have to agree it with any number); the job page tab
// is called «Етапи» everywhere that points to it.
import { render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { RecordsCount } from "@/components/RecordsCount";
import { toastError } from "@/lib/toast";
import { useActivitySwitchConfirm } from "@/hooks/useActivitySwitchConfirm";
import { useActivity } from "@/context/ActivityContext";
import { MESSAGES } from "@/i18n/messages";
import { setTestLocale } from "../helpers/i18n";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock("@/context/ActivityContext", () => ({ useActivity: vi.fn() }));

beforeEach(() => {
  setTestLocale("uk");
  document.documentElement.lang = "uk";
});
afterEach(() => {
  document.documentElement.lang = "";
});

describe("second pass, in Ukrainian", () => {
  it("record counter: no English, no noun to decline", () => {
    const { container, rerender } = render(<RecordsCount count={25} total={121} label="вакансій" />);
    expect(container).toHaveTextContent("Показано 1–25 з 121");
    expect(container.textContent).not.toMatch(/Showing|of|вакансій/);
    rerender(<RecordsCount count={3} />);
    expect(container).toHaveTextContent("Показано 1–3");
  });

  it("record counter in English: unchanged", () => {
    setTestLocale("en");
    const { container } = render(<RecordsCount count={25} total={121} label="jobs" />);
    expect(container).toHaveTextContent("Showing 1 to 25 of 121 jobs");
  });

  it("generic error toast follows the page language", () => {
    toastError();
    expect(toast.error).toHaveBeenCalledWith("Щось пішло не так. Спробуйте ще раз.");
  });

  it("switch-activity confirmation", () => {
    (useActivity as any).mockReturnValue({ currentActivity: { activityName: "Резюме" }, stopActivity: vi.fn() });
    function Harness() {
      const { requestStart, confirmDialog } = useActivitySwitchConfirm();
      return (
        <>
          <button onClick={() => requestStart(async () => true)}>go</button>
          {confirmDialog}
        </>
      );
    }
    render(<Harness />);
    screen.getByText("go").click();
    return screen.findByText("Зупинити поточну активність і почати нову?").then(() => {
      expect(screen.getByText("«Резюме» зараз триває. Зупинити її й почати нову активність?")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Зупинити й почати" })).toBeInTheDocument();
    });
  });

  it("interviews point to the job tab by its real name «Етапи»", () => {
    const tab = (MESSAGES.uk.jobs as any).details.tabs.timeline;
    expect(tab).toBe("Етапи");
    const interviews = JSON.stringify(MESSAGES.uk.interviews);
    expect(interviews).not.toMatch(/Хронологі/);
    expect(interviews).toMatch(/«Етапи»/);
  });
});
