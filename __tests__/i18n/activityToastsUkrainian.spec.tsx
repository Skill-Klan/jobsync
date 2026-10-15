// Requirement — D29: starting and stopping an activity is reported in
// Ukrainian, including the two rules the student meets: an activity shorter
// than 2 minutes is not saved, and one that runs 8 hours stops by itself.
// The numbers are written out here, not read from the constants they check.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityProvider, useActivity } from "@/context/ActivityContext";
import {
  getCurrentActivity,
  startActivityById,
  stopActivityById,
} from "@/actions/activity.actions";
import { toastSuccess, toastError } from "@/lib/toast";
import { setTestLocale } from "../helpers/i18n";

vi.mock("@/actions/activity.actions", () => ({
  getCurrentActivity: vi.fn(),
  startActivityById: vi.fn(),
  stopActivityById: vi.fn(),
  startBreak: vi.fn(),
  endBreak: vi.fn(),
  updateBreakLength: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({ toastSuccess: vi.fn(), toastError: vi.fn() }));

function Harness() {
  const { currentActivity, startActivity, stopActivity } = useActivity();
  return (
    <div>
      <div data-testid="current">{currentActivity ? currentActivity.id : "none"}</div>
      <button onClick={() => startActivity("type-1")}>Start</button>
      <button onClick={() => stopActivity()}>Stop</button>
      <button onClick={() => stopActivity(true)}>AutoStop</button>
    </div>
  );
}

const activity = { id: "act-1", activityName: "Резюме", startTime: new Date(), breakMinutes: 0 };

describe("activity toasts in Ukrainian", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    setTestLocale("uk");
    (getCurrentActivity as any).mockResolvedValue({ success: false });
    (startActivityById as any).mockResolvedValue({ success: true, newActivity: activity });
  });

  async function started() {
    render(
      <ActivityProvider>
        <Harness />
      </ActivityProvider>,
    );
    await user.click(screen.getByText("Start"));
    await waitFor(() => expect(screen.getByTestId("current")).toHaveTextContent("act-1"));
  }

  it("start and stop", async () => {
    (stopActivityById as any).mockResolvedValue({ success: true, discarded: false });
    await started();
    expect(toastSuccess).toHaveBeenCalledWith("Активність розпочато");
    await user.click(screen.getByText("Stop"));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Активність зупинено"));
  });

  it("too short to be saved", async () => {
    (stopActivityById as any).mockResolvedValue({ success: true, discarded: true });
    await started();
    await user.click(screen.getByText("Stop"));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Активність не збережено: вона тривала менше ніж 2 хв"),
    );
  });

  it("stopped at the 8-hour cap", async () => {
    (stopActivityById as any).mockResolvedValue({ success: true, discarded: false });
    await started();
    await user.click(screen.getByText("AutoStop"));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        "Активність зупинено автоматично: досягнуто максимуму в 8 год",
      ),
    );
  });
});
