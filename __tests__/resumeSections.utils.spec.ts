import { renderHook } from "@testing-library/react";
import { useWarnInsufficientResumeSections } from "@/utils/resumeSections.utils";

const mockToastError = vi.fn();
vi.mock("@/lib/toast", () => ({
  toastError: (...args: any[]) => mockToastError(...args),
}));

describe("useWarnInsufficientResumeSections", () => {
  it("shows a destructive toast naming the minimum and the action", () => {
    const { result } = renderHook(() => useWarnInsufficientResumeSections());

    result.current("setDefault");
    expect(mockToastError).toHaveBeenLastCalledWith(
      "Add at least 2 sections before setting this resume as default.",
      "Not enough content",
    );

    result.current("copy");
    expect(mockToastError).toHaveBeenLastCalledWith(
      "Add at least 2 sections before creating a copy.",
      "Not enough content",
    );
  });
});
