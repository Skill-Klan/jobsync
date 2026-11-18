import { render, screen } from "@testing-library/react";
import { IncompleteResumeHint } from "@/components/IncompleteResumeHint";
const HINT =
  "Fewer than 2 sections: the AI features (job match, review, cover letter) are not available for this resume. You can still use the resume without them. An attached file does not count.";

describe("IncompleteResumeHint", () => {
  it("exposes the hint as the accessible name of the icon", () => {
    render(<IncompleteResumeHint />);

    const icon = screen.getByRole("img", { name: HINT });
    expect(icon.parentElement).toHaveAttribute("data-incomplete-hint");
  });

  it("opts back into pointer events so it works inside a disabled item", () => {
    render(<IncompleteResumeHint />);

    const icon = screen.getByRole("img", { name: HINT });
    expect(icon.parentElement).toHaveClass("pointer-events-auto");
  });
});
