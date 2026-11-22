import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProfileContainer from "@/components/profile/ProfileContainer";
import { getResumeList } from "@/actions/profile.actions";
import React from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("@/actions/userSettings.actions", () => ({
  getUserSettings: vi.fn().mockResolvedValue({ success: false }),
}));

vi.mock("@/actions/profile.actions", () => ({
  getResumeList: vi.fn(() =>
    Promise.resolve({
      data: [],
      total: 0,
      success: true,
      message: "",
    }),
  ),
  getDefaultResumeId: vi.fn(() => Promise.resolve(null)),
  getDefaultContactInfo: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@/actions/coverLetter.actions", () => ({
  getCoverLetterList: vi.fn(() =>
    Promise.resolve({
      data: [],
      total: 0,
      success: true,
      message: "",
    }),
  ),
}));

describe("ProfileContainer Component", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await act(async () => {
      render(<ProfileContainer />);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
  it("should render the profile container component", () => {
    expect(screen.getByText(/profile/i)).toBeInTheDocument();
  });

  it("should open the create resume dialog upon clicking create resume button", async () => {
    const user = userEvent.setup();

    const newButton = screen.getByRole("button", {
      name: /new/i,
    });
    await user.click(newButton);

    const addResumeItem = await screen.findByText(/add new resume/i);
    await user.click(addResumeItem);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /create resume/i }),
    ).toBeInTheDocument();
  });
});

// Review of the local test pass (SKD-70): a student with no resume saw only the
// title and a button — no word on what to do. The hint shows once the first
// load has finished and nothing came back, never while it is still loading.
describe("ProfileContainer with nothing yet", () => {
  it("says so when the first load found no documents", async () => {
    await act(async () => {
      render(<ProfileContainer />);
    });
    expect(screen.getByText(/no documents yet/i)).toBeInTheDocument();
  });

  it("says nothing while the first load is still running", async () => {
    vi.mocked(getResumeList).mockReturnValueOnce(new Promise(() => {}) as never);
    await act(async () => {
      render(<ProfileContainer />);
    });
    expect(screen.queryByText(/no documents yet/i)).not.toBeInTheDocument();
  });
});
