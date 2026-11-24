// Requirement — the owner, 2026-11-24 (docs/decisions.md D118): «при першому вході людина обовʼязково має
// додивитись до кінця, а потім мати можливість закрити кнопкою „Все зрозуміло“, посередині екрану. На наступні входи
// вже показувати не треба» — a video for a student and one for a mentor:
//   · on the first sign-in the person's video opens by itself; until it ends there is no way to close it — no close
//     button, no Escape, no click outside — and no way to jump ahead;
//   · when it ends, «Все зрозуміло» in the middle of the video closes it and records it as watched;
//   · already watched (or the admin): nothing opens and nothing is asked;
//   · the backend away (which video is unknown): nothing opens;
//   · the profile menu replays it («Відео-огляд»): an ordinary window, closable any time, nothing recorded;
//   · the phone menu has the same «Відео-огляд».
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const actions = vi.hoisted(() => ({
  getOnboardingVideo: vi.fn(),
  finishOnboarding: vi.fn(),
}));
vi.mock("@/actions/onboarding.actions", () => actions);
const toast = vi.hoisted(() => ({ toastError: vi.fn(), toastSuccess: vi.fn(), toastInfo: vi.fn() }));
vi.mock("@/lib/toast", () => toast);

import { OnboardingProvider, useOnboarding } from "@/components/onboarding/OnboardingProvider";
import { setTestLocale } from "../helpers/i18n";

beforeAll(() => {
  // jsdom has no media playback.
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: vi.fn(() => Promise.resolve()) });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: vi.fn() });
});
beforeEach(() => {
  actions.getOnboardingVideo.mockResolvedValue({ success: true, data: { video: "student" } });
  actions.finishOnboarding.mockResolvedValue({ success: true });
});

function ReplayFromMenu() {
  const { openReplay } = useOnboarding();
  return (
    <button type="button" onClick={openReplay}>
      menu: video tour
    </button>
  );
}
const renderWith = (required: boolean) =>
  render(
    <OnboardingProvider required={required}>
      <ReplayFromMenu />
    </OnboardingProvider>,
  );
const video = () => screen.getByRole("dialog").querySelector("video")!;
// The video element's clock, which jsdom does not run.
function clockOf(el: HTMLVideoElement) {
  const state = { now: 0, seeking: false };
  Object.defineProperty(el, "currentTime", { configurable: true, get: () => state.now, set: (v: number) => (state.now = v) });
  Object.defineProperty(el, "duration", { configurable: true, get: () => 138 });
  Object.defineProperty(el, "seeking", { configurable: true, get: () => state.seeking });
  return state;
}

describe("the first sign-in: the person's video, watched to the end", () => {
  it("opens by itself with the student's video, and cannot be closed before it ends", async () => {
    renderWith(true);
    const dialog = await screen.findByRole("dialog");
    expect(actions.getOnboardingVideo).toHaveBeenCalledTimes(1);
    expect(video()).toHaveAttribute("src", "/onboarding/student.mp4");
    expect(video()).not.toHaveAttribute("controls"); // no native seek bar
    expect(within(dialog).queryByRole("button", { name: "Close" })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Got it" })).toBeNull();

    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.pointerDown(document.body);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("a mentor gets the mentor's video", async () => {
    actions.getOnboardingVideo.mockResolvedValue({ success: true, data: { video: "mentor" } });
    renderWith(true);
    await screen.findByRole("dialog");
    expect(video()).toHaveAttribute("src", "/onboarding/mentor.mp4");
  });

  it("jumping ahead is undone; going back is allowed", async () => {
    renderWith(true);
    await screen.findByRole("dialog");
    const el = video();
    const clock = clockOf(el);
    clock.now = 10;
    fireEvent.timeUpdate(el);

    clock.now = 120;
    clock.seeking = true;
    fireEvent.seeking(el);
    expect(clock.now).toBe(10);

    clock.now = 4;
    fireEvent.seeking(el);
    expect(clock.now).toBe(4);
  });

  it("when it ends, «Got it» in the middle closes it and records it as watched", async () => {
    const user = userEvent.setup();
    renderWith(true);
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Watch" }));
    fireEvent.ended(video());

    const done = screen.getByRole("button", { name: "Got it" });
    // In the middle: the overlay over the video centres it both ways.
    expect(done.parentElement).toHaveClass("absolute", "inset-0", "flex", "items-center", "justify-center");
    await user.click(done);

    expect(actions.finishOnboarding).toHaveBeenCalledWith("student");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("not saved (the server refused): the window still closes, the person is told", async () => {
    actions.finishOnboarding.mockResolvedValue({ success: false, message: "Not now" });
    const user = userEvent.setup();
    renderWith(true);
    await screen.findByRole("dialog");
    fireEvent.ended(video());
    await user.click(screen.getByRole("button", { name: "Got it" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toast.toastError).toHaveBeenCalledWith("Not now");
  });

  it("Ukrainian: «Дивитися», then «Все зрозуміло»", async () => {
    setTestLocale("uk");
    renderWith(true);
    await screen.findByRole("dialog");
    expect(screen.getByRole("button", { name: "Дивитися" })).toBeInTheDocument();
    fireEvent.ended(video());
    expect(screen.getByRole("button", { name: "Все зрозуміло" })).toBeInTheDocument();
  });
});

describe("nothing opens", () => {
  it("already watched (or the admin): nothing is asked and nothing opens", async () => {
    renderWith(false);
    await act(async () => {});
    expect(actions.getOnboardingVideo).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the backend away (which video is unknown): nothing opens", async () => {
    actions.getOnboardingVideo.mockResolvedValue({ success: false, message: "Unavailable" });
    renderWith(true);
    await act(async () => {});
    expect(actions.getOnboardingVideo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("the replay from the menu", () => {
  it("opens the person's video in an ordinary window: closable at any moment, nothing recorded", async () => {
    const user = userEvent.setup();
    renderWith(false);
    await user.click(screen.getByRole("button", { name: "menu: video tour" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeInTheDocument();

    fireEvent.ended(video());
    await user.click(screen.getByRole("button", { name: "Got it" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(actions.finishOnboarding).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "menu: video tour" }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("not available: the person is told, nothing opens", async () => {
    actions.getOnboardingVideo.mockResolvedValue({ success: false, message: "Unavailable" });
    const user = userEvent.setup();
    renderWith(false);
    await user.click(screen.getByRole("button", { name: "menu: video tour" }));
    await waitFor(() => expect(toast.toastError).toHaveBeenCalledWith("Unavailable"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
