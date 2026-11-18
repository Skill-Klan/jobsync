import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { StepResume } from "@/components/automations/automation-wizard/StepResume";
import type { WizardResume } from "@/components/automations/automation-wizard/wizardConfig";

function Harness({ resumes }: { resumes: WizardResume[] }) {
  const form = useForm<any>({ defaultValues: { resumeId: "" } });
  return (
    <Form {...form}>
      <StepResume form={form} resumes={resumes} />
    </Form>
  );
}

describe("StepResume", () => {
  it("says no resumes exist when the list is empty", () => {
    render(<Harness resumes={[]} />);

    expect(screen.getByText(/No resumes found/)).toBeInTheDocument();
  });

  // Requirement — the owner, 2026-11: a resume is no longer refused for having
  // few sections; the AI is optional, so the person is told what a thin resume
  // cannot do instead of being stopped.
  it("keeps an incomplete resume selectable and says jobs will not be scored for it", async () => {
    // jsdom has no pointer capture or scrolling, which Radix Select calls
    window.HTMLElement.prototype.hasPointerCapture = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    const user = userEvent.setup({ skipHover: true });
    render(
      <Harness resumes={[{ id: "r1", title: "Draft", sectionCount: 0 }]} />,
    );

    expect(screen.queryByText(/No resumes found/)).not.toBeInTheDocument();
    expect(screen.getByText(/too few sections/)).toBeInTheDocument();
    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByRole("option", { name: /Draft/ })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("shows no warning when every resume is complete", () => {
    render(<Harness resumes={[{ id: "r1", title: "CV", sectionCount: 3 }]} />);

    expect(screen.queryByText(/too few sections/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No resumes found/)).not.toBeInTheDocument();
  });
});
