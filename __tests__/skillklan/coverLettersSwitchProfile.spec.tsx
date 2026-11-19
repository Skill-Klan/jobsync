// Requirement — SKD-57 (the owner, 2026-11-19): with `coverLetters` off the
// profile lists resumes only: no letters in the list or the count, no «Add
// cover letter», and the letters are not even read. «Add resume» stays one
// click away. On (the pair), the letters and the two-item «New» menu are there.
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProfileContainer from "@/components/profile/ProfileContainer";
import { FeaturesProvider } from "@/context/FeaturesContext";
import { ALL_FEATURES_ON } from "@/skillklan/features";
import { getCoverLetterList } from "@/actions/coverLetter.actions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/" }));
vi.mock("@/actions/userSettings.actions", () => ({ getUserSettings: vi.fn().mockResolvedValue({ success: false }) }));
vi.mock("@/actions/profile.actions", () => ({
  getResumeList: vi.fn(async () => ({
    data: [{ id: "r-1", title: "My resume", createdAt: new Date(), updatedAt: new Date(), _count: { Job: 0, ResumeSections: 3 } }],
    total: 1,
    success: true,
    message: "",
  })),
  getDefaultResumeId: vi.fn(async () => null),
  getDefaultContactInfo: vi.fn(async () => null),
}));
vi.mock("@/actions/coverLetter.actions", () => ({
  getCoverLetterList: vi.fn(async () => ({
    data: [{ id: "l-1", title: "Letter for Acme", content: "<p>Hi</p>", createdAt: new Date(), updatedAt: new Date(), _count: { Job: 0 } }],
    total: 1,
    success: true,
    message: "",
  })),
  deleteCoverLetterById: vi.fn(),
}));

const renderProfile = async (coverLetters: boolean) => {
  await act(async () => {
    render(
      <FeaturesProvider value={{ ...ALL_FEATURES_ON, coverLetters }}>
        <ProfileContainer />
      </FeaturesProvider>,
    );
  });
};

beforeEach(() => vi.clearAllMocks());

describe("the profile with cover letters off", () => {
  it("lists the resume only, never reads the letters, and offers «Add resume» directly", async () => {
    await renderProfile(false);
    expect(screen.getByText("My resume")).toBeInTheDocument();
    expect(screen.queryByText("Letter for Acme")).not.toBeInTheDocument();
    expect(getCoverLetterList).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /add new resume/i })).toBeInTheDocument();
    expect(screen.queryByText(/add new cover letter/i)).not.toBeInTheDocument();
  });

  it("pair: on → the letter is listed and read, the «New» menu has both items", async () => {
    await renderProfile(true);
    expect(screen.getByText("Letter for Acme")).toBeInTheDocument();
    expect(getCoverLetterList).toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole("button", { name: /new/i }));
    expect(await screen.findByText(/add new cover letter/i)).toBeInTheDocument();
    expect(screen.getByText(/add new resume/i)).toBeInTheDocument();
  });
});
