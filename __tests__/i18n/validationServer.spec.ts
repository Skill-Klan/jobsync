// @vitest-environment node
// Requirement: on the server (no page) a value that fails a schema without a
// message of ours keeps zod's own technical English — it names the expected
// and the received type, which is what logs, the backup import error and the
// AI tools need. The plain "Fill in this field" is for people filling a form.
import { z } from "zod";
import "@/i18n/validation";
import { AddTaskFormSchema } from "@/models/addTaskForm.schema";

describe("validation on the server", () => {
  it("keeps zod's own wording for its defaults", () => {
    expect(z.string().min(1).safeParse("").error?.issues[0].message).toBe(
      "Too small: expected string to have >=1 characters",
    );
    expect(z.string().safeParse(undefined).error?.issues[0].message).toBe(
      "Invalid input: expected string, received undefined",
    );
  });

  it("keeps our own messages in English", () => {
    const issues = AddTaskFormSchema.safeParse({ title: "a" }).error?.issues ?? [];
    expect(issues.map((i) => i.message)).toContain("Title must be at least 2 characters.");
  });
});
