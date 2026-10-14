import { createJobFromNames } from "@/lib/jobs/createJobFromNames";
import { createJobRecord } from "@/lib/jobs/createJobRecord";
import {
  resolveCompany,
  resolveJobTitle,
  resolveLocation,
  resolveJobSource,
  resolveJobType,
  resolveWorkplaceType,
  resolveJobStatus,
  resolveTags,
} from "@/lib/jobs/resolve";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

vi.mock("@prisma/client", () => {
  const mPrismaClient = {
    job: { findFirst: vi.fn(), findMany: vi.fn() },
  };
  return { PrismaClient: vi.fn(function () { return mPrismaClient; }) };
});

vi.mock("@/lib/jobs/createJobRecord", () => ({
  createJobRecord: vi.fn(),
}));

vi.mock("@/lib/jobs/resolve", () => ({
  resolveCompany: vi.fn(),
  resolveJobTitle: vi.fn(),
  resolveLocation: vi.fn(),
  resolveJobSource: vi.fn(),
  resolveJobType: vi.fn(),
  resolveWorkplaceType: vi.fn(),
  resolveJobStatus: vi.fn(),
  resolveTags: vi.fn(),
}));

const baseInput = {
  company: "Acme",
  jobTitle: "Engineer",
  jobDescription: "Build things",
};

describe("createJobFromNames", () => {
  const userId = "user-1";

  beforeEach(() => {
    vi.clearAllMocks();
    (resolveCompany as any).mockResolvedValue({ id: "company-1", label: "Acme", created: true });
    (resolveJobTitle as any).mockResolvedValue({ id: "title-1", label: "Engineer", created: true });
    (resolveLocation as any).mockResolvedValue(null);
    (resolveJobSource as any).mockResolvedValue(null);
    (resolveJobType as any).mockReturnValue("Full-time");
    (resolveWorkplaceType as any).mockReturnValue(null);
    (resolveJobStatus as any).mockResolvedValue("status-1");
    (resolveTags as any).mockResolvedValue({ resolved: [], dropped: [] });
    (prisma.job.findFirst as any).mockResolvedValue(null);
    (prisma.job.findMany as any).mockResolvedValue([]);
    (createJobRecord as any).mockResolvedValue({ id: "job-1" });
  });

  it("defaults dueDate to 3 days from now when omitted", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-10T12:00:00Z"));
    try {
      await createJobFromNames(baseInput, userId);
    } finally {
      vi.useRealTimers();
    }

    expect(createJobRecord).toHaveBeenCalledWith(
      expect.objectContaining({ dueDate: new Date("2030-01-13T12:00:00Z") }),
    );
  });

  it("keeps a supplied dueDate", async () => {
    const dueDate = new Date("2030-02-01T00:00:00Z");
    await createJobFromNames({ ...baseInput, dueDate }, userId);

    expect(createJobRecord).toHaveBeenCalledWith(
      expect.objectContaining({ dueDate }),
    );
  });

  it("creates a job and reports matched/created resolutions", async () => {
    const result = await createJobFromNames(baseInput, userId);

    expect(result.created).toBe(true);
    expect(result.jobId).toBe("job-1");
    expect(result.resolutions.map((r) => [r.label, r.created])).toEqual([
      ["Acme", true],
      ["Engineer", true],
    ]);
    expect(createJobRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        jobTitleId: "title-1",
        statusId: "status-1",
        jobType: "Full-time",
        userId,
        applied: false,
        appliedDate: null,
      }),
    );
  });

  it("defaults appliedDate to now when applied is true and no date given", async () => {
    const before = Date.now();
    await createJobFromNames({ ...baseInput, applied: true }, userId);
    const after = Date.now();

    const call = (createJobRecord as any).mock.calls[0][0];
    expect(call.applied).toBe(true);
    expect(call.appliedDate.getTime()).toBeGreaterThanOrEqual(before);
    expect(call.appliedDate.getTime()).toBeLessThanOrEqual(after);
  });

  it("uses the given appliedDate when provided", async () => {
    const appliedDate = new Date("2026-01-01T00:00:00Z");
    await createJobFromNames({ ...baseInput, applied: true, appliedDate }, userId);

    const call = (createJobRecord as any).mock.calls[0][0];
    expect(call.appliedDate).toBe(appliedDate);
  });

  it("attaches only the tags within the limit, not the dropped ones", async () => {
    (resolveTags as any).mockResolvedValue({
      resolved: [{ id: "tag-1", label: "React", created: false }],
      dropped: ["Extra1", "Extra2"],
    });

    await createJobFromNames(baseInput, userId);

    expect(createJobRecord).toHaveBeenCalledWith(
      expect.objectContaining({ tagIds: ["tag-1"] }),
    );
  });

  // The same company + title saved within the last 30 days is a duplicate;
  // an older one is a new application round, not a duplicate.
  it("looks for a company+title duplicate only among the last 30 days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-31T12:00:00Z"));
    try {
      await createJobFromNames(baseInput, userId);
    } finally {
      vi.useRealTimers();
    }

    expect(prisma.job.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: new Date("2030-01-01T12:00:00Z") },
        }),
      }),
    );
  });

  it("detects a duplicate by jobUrl (aggressive key catches www/case/tracking variants)", async () => {
    (prisma.job.findMany as any).mockResolvedValueOnce([
      {
        id: "existing-job",
        jobUrl: "https://www.Example.com/job/1?utm_source=x",
        JobTitle: { label: "Engineer" },
        Company: { label: "Acme" },
      },
    ]);

    const result = await createJobFromNames(
      { ...baseInput, jobUrl: "https://example.com/job/1" },
      userId,
    );

    expect(result.created).toBe(false);
    expect(result.duplicateOf).toEqual({
      id: "existing-job",
      title: "Engineer",
      company: "Acme",
    });
    expect(createJobRecord).not.toHaveBeenCalled();
  });

  it("detects a duplicate by company+title within the window when no URL is given", async () => {
    (prisma.job.findFirst as any).mockResolvedValueOnce({
      id: "existing-job-2",
      JobTitle: { label: "Engineer" },
      Company: { label: "Acme" },
    });

    const result = await createJobFromNames(baseInput, userId);

    expect(result.created).toBe(false);
    expect(result.duplicateOf?.id).toBe("existing-job-2");
    expect(createJobRecord).not.toHaveBeenCalled();
  });

  it("creates the job when no duplicate is found", async () => {
    const result = await createJobFromNames(baseInput, userId);

    expect(result.created).toBe(true);
    expect(result.duplicateOf).toBeUndefined();
  });

  it("classifies and persists descriptionCompleteness from the raw description", async () => {
    const full = Array.from({ length: 200 }, () => "word").join(" ");
    const result = await createJobFromNames(
      { ...baseInput, jobDescription: full },
      userId,
    );

    expect(result.descriptionCompleteness).toBe("full");
    expect(createJobRecord).toHaveBeenCalledWith(
      expect.objectContaining({ descriptionCompleteness: "full" }),
    );
  });

  it("marks a stub description as title-only", async () => {
    const result = await createJobFromNames(
      { ...baseInput, jobDescription: "Frontend Developer, $120k, Remote." },
      userId,
    );

    expect(result.descriptionCompleteness).toBe("title-only");
    expect(createJobRecord).toHaveBeenCalledWith(
      expect.objectContaining({ descriptionCompleteness: "title-only" }),
    );
  });
});
