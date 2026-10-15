// Requirement — D36 (owner, 2026-10-15): in Ukrainian the time picker shows
// the 24-hour clock — 14:30, hours 00–23, no AM/PM. English stays 02:30 PM.
// What the form holds does not change ("02:30 PM"), so saved data, schemas
// and the code that stores the time are untouched.
import { TimePicker } from "@/components/TimePicker";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem } from "@/components/ui/form";
import { setTestLocale } from "../helpers/i18n";

Element.prototype.scrollIntoView = vi.fn();
const user = userEvent.setup({ skipHover: true });

function Harness({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const form = useForm({ defaultValues: { startTime: value } });
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="startTime"
        render={({ field }) => (
          <FormItem>
            <TimePicker
              field={{
                ...field,
                onChange: (v: string) => {
                  field.onChange(v);
                  onChange(v);
                },
              }}
            />
          </FormItem>
        )}
      />
    </Form>
  );
}

const hours = () => within(screen.getByRole("group", { name: "Година" }));

async function open(value: string, trigger: string) {
  const onChange = vi.fn();
  render(<Harness value={value} onChange={onChange} />);
  await user.click(screen.getByRole("button", { name: trigger }));
  return onChange;
}

beforeEach(() => setTestLocale("uk"));

describe("time picker in Ukrainian", () => {
  it.each([
    ["02:30 PM", "14:30"],
    ["12:15 AM", "00:15"],
    ["12:00 PM", "12:00"],
    ["09:05 AM", "09:05"],
  ])("shows %s as %s", (value, shown) => {
    render(<Harness value={value} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: shown })).toBeInTheDocument();
  });

  it("offers hours 00–23 and no AM/PM", async () => {
    await open("02:30 PM", "14:30");
    const options = hours().getAllByRole("button").map((b) => b.textContent);
    expect(options).toEqual(Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")));
    expect(hours().getByRole("button", { name: "14" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("group", { name: "AM/PM" })).not.toBeInTheDocument();
  });

  it.each([
    ["09", "09:30 AM"],
    ["00", "12:30 AM"],
    ["12", "12:30 PM"],
    ["23", "11:30 PM"],
  ])("picking %s stores %s", async (hour, stored) => {
    const onChange = await open("02:30 PM", "14:30");
    await user.click(hours().getByRole("button", { name: hour }));
    expect(onChange).toHaveBeenLastCalledWith(stored);
  });

  it("an empty value takes the picked hour with :00", async () => {
    const onChange = await open("", "Оберіть час");
    await user.click(hours().getByRole("button", { name: "13" }));
    expect(onChange).toHaveBeenLastCalledWith("01:00 PM");
  });

  it("stepping past midnight still shows the 24-hour time", async () => {
    const onChange = vi.fn();
    render(<Harness value="11:58 PM" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "На 5 хв пізніше" }));
    expect(onChange).toHaveBeenLastCalledWith("12:03 AM");
    expect(screen.getByRole("button", { name: "00:03" })).toBeInTheDocument();
  });
});
