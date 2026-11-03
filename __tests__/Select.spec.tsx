import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SelectFormCtrl from "@/components/Select";
import { Form } from "@/components/ui/form";
import { useForm } from "react-hook-form";

const options = [
  { id: "a", title: "Complete CV" },
  { id: "b", title: "Draft CV", disabled: true, suffix: <i>Incomplete</i> },
];

function Harness({ value }: { value?: string }) {
  const form = useForm({ defaultValues: { resume: value } });
  return (
    <Form {...form}>
      <SelectFormCtrl
        label="Resume"
        options={options}
        field={{ ...form.register("resume"), value } as any}
      />
    </Form>
  );
}

function Clearable({ value, onChange }: { value?: string; onChange: (v: unknown) => void }) {
  const form = useForm({ defaultValues: { resume: value } });
  return (
    <Form {...form}>
      <SelectFormCtrl
        label="Resume"
        options={options}
        clearable
        field={{ ...form.register("resume"), value, onChange } as any}
      />
    </Form>
  );
}

describe("SelectFormCtrl disabled options", () => {
  beforeAll(() => {
    window.HTMLElement.prototype.hasPointerCapture = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("shows a disabled option's title and suffix when it is the current value", () => {
    render(<Harness value="b" />);

    expect(screen.getByText("Draft CV")).toBeInTheDocument();
    expect(screen.getByText("Incomplete")).toBeInTheDocument();
  });

  it("marks a disabled option as disabled in the list", async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole("combobox"));

    expect(screen.getByRole("option", { name: /Draft CV/ })).toHaveAttribute(
      "data-disabled",
    );
    expect(
      screen.getByRole("option", { name: /Complete CV/ }),
    ).not.toHaveAttribute("data-disabled");
  });

  it("makes the hint a plain icon inside the closed trigger", () => {
    render(<Harness />);

    expect(screen.getByRole("combobox").className).toContain(
      "[&_[data-incomplete-hint]]:pointer-events-none",
    );
  });
});

// Requirement — product notes, 2026-11-03: a picker for something optional (a
// resume, a cover letter) must let the person go back to «nothing».
describe("SelectFormCtrl clearable", () => {
  beforeAll(() => {
    window.HTMLElement.prototype.hasPointerCapture = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("offers «Not selected» and reports an empty value when it is chosen", async () => {
    const onChange = vi.fn();
    render(<Clearable value="a" onChange={onChange} />);

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByRole("option", { name: "Not selected" }));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("shows «Not selected» when nothing is chosen", () => {
    render(<Clearable onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Not selected");
  });

  it("choosing a real option still reports its id", async () => {
    const onChange = vi.fn();
    render(<Clearable onChange={onChange} />);

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByRole("option", { name: "Complete CV" }));

    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("without the flag there is no such entry", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.queryByRole("option", { name: "Not selected" })).not.toBeInTheDocument();
  });
});
