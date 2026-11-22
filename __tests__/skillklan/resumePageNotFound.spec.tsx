// @vitest-environment node
// Requirement — local test pass before opening access (SKD-70): a resume page
// for an id that is not there (a deleted resume, an old link, someone else's
// id) is a 404, like a job page — not a crashed page with HTTP 500.
import React from "react";

const ctx = vi.hoisted(() => ({ resume: null as null | { id: string } }));

vi.mock("@/actions/profile.actions", () => ({
  getResumeById: vi.fn(async () => ({ data: ctx.resume })),
  getDefaultResumeId: vi.fn(async () => null),
}));
vi.mock("@/components/profile/ResumeContainer", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import ResumePage from "@/app/dashboard/profile/resume/[id]/page";

describe("the resume page", () => {
  it("an id with no resume behind it is a 404", async () => {
    ctx.resume = null;
    await expect(ResumePage({ params: Promise.resolve({ id: "nope" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("paired: a resume that is there is shown", async () => {
    ctx.resume = { id: "r1" };
    const page = await ResumePage({ params: Promise.resolve({ id: "r1" }) });
    expect(React.isValidElement(page)).toBe(true);
  });
});
