import { z } from "zod";
import { vt } from "@/i18n/validation";
import { APP_CONSTANTS, JOB_STATUS_VALUES } from "@/lib/constants";
import { WORKPLACE_TYPES, matchEnumEntry } from "@/models/job.model";

export const AgentChatRequestSchema = z.object({
  // Validated by the SDK downstream, not here. The whole array is
  // client-supplied; nothing in it widens what the request can touch,
  // because userId always comes from the session.
  messages: z.array(z.any()),
  pageContext: z
    .object({
      route: z.string().optional(),
      jobId: z.string().optional(),
      resumeId: z.string().optional(),
    })
    .optional(),
});

export type AgentChatRequest = z.infer<typeof AgentChatRequestSchema>;

// An enum rather than a described string, for the same reason status is one:
// a small local model fills an enum-constrained slot and ignores prose hints.
// It sent "On-site" — the posting's own spelling — and when that was rejected
// it dropped the field entirely, losing a value the posting stated. The
// preprocess folds case and separators through matchEnumEntry, so "On-site",
// "on site" and "REMOTE" all still validate.
const workplaceTypeField = z
  .preprocess(
    (v) => (typeof v === "string" ? (matchEnumEntry(WORKPLACE_TYPES, v)?.[1] ?? v) : v),
    z.enum(WORKPLACE_TYPES),
  )
  .optional()
  .describe(`Work arrangement stated in the posting. One of: ${Object.values(WORKPLACE_TYPES).join(", ")}.`);

// No upsert or allowDuplicate: the model must not be able to force past
// duplicate detection. AI SDK's tool() uses one schema for both the JSON
// schema the model reads and the validation of what it returns, so the date
// transforms are deferred to AgentAddJobParseSchema. status keeps its
// z.preprocess — that is what keeps enum: [...] on the input side of the
// emitted JSON schema.
export const AgentAddJobSchema = z.object({
  company: z.string().min(1, { error: () => vt("agent.company.required") }),
  jobTitle: z.string().min(1, { error: () => vt("agent.jobTitle.required") }),
  jobDescription: z
    .string()
    .refine((val) => val === "N/A" || val.length >= 10, { error: () => vt("agent.jobDescription.min", { min: 10 }) })
    .optional()
    .describe("What the job involves, in the user's own words, copied verbatim and never summarised. Always include this field, even if their description is only one sentence and looks nothing like a full posting, and never condense it into tags instead. If you were shown only the opening portion of a pasted posting, copy the portion you were shown. Use 'N/A' only if the user explicitly declines to give any description after being asked once."),
  location: z.string().optional().describe("City, province/state, country, or 'Remote' — e.g. 'Calgary, AB'. Do not include a street address."),
  source: z.string().optional().describe("Job board or site the listing came from, e.g. 'LinkedIn', 'Indeed', 'company website'. If not stated explicitly, infer it from the job posting's URL/domain when possible instead of leaving it blank."),
  jobType: z.string().optional().describe("Employment type: 'Full-time', 'Part-time', or 'Contract'"),
  workplaceType: workplaceTypeField,
  // Lowercased before the enum check so "Applied"/"Draft" still validate.
  // zod v4's pipe-aware conversion keeps the target enum on the input side of
  // the JSON schema too — it is NOT just cosmetic.
  status: z
    .preprocess(
      (v) => (typeof v === "string" ? v.toLowerCase() : v),
      z.enum(JOB_STATUS_VALUES),
    )
    .optional()
    .describe(
      `Application status. One of: ${JOB_STATUS_VALUES.join(", ")}. Defaults to '${APP_CONSTANTS.JOB_DEFAULT_STATUS}'.`,
    ),
  dueDate: z.string().datetime({ offset: true }).optional().describe("Application deadline as an ISO-8601 datetime string. Defaults to 3 days from now if omitted."),
  applied: z.boolean().optional().describe("Set true if you have already submitted the application"),
  appliedDate: z.string().datetime({ offset: true }).optional().describe("Date the application was submitted as an ISO-8601 datetime string"),
  jobUrl: z.string().url().optional().describe("Direct URL to the job posting"),
  salaryRange: z.string().optional().describe("Salary range as a free-form string, e.g. '$120k–$150k' or '100,000 CAD'"),
  tags: z.array(z.string()).optional().describe("Skills required for the job (max 10 applied, extras are dropped). Tags are created if they don't exist. e.g. ['React', 'TypeScript', 'Node.js']"),
});

export const AgentAddJobInputShape = AgentAddJobSchema.shape;

// Parsed inside execute, after the model's input has been validated.
export const AgentAddJobParseSchema = AgentAddJobSchema.extend({
  dueDate: z.string().datetime({ offset: true }).optional().transform((v) => (v ? new Date(v) : undefined)),
  appliedDate: z.string().datetime({ offset: true }).optional().transform((v) => (v ? new Date(v) : undefined)),
});

export type AgentAddJobInput = z.infer<typeof AgentAddJobParseSchema>;

// One optional field, and never an id: the model names a resume the way the
// user did, and the server resolves it ownership-scoped. An id-shaped input
// would be an IDOR surface the model could be talked into filling.
export const AgentGetResumeSchema = z.object({
  resumeTitle: z.string().optional().describe("The title of the resume to read, as the user referred to it. Omit this entirely if the user did not name one — the app then uses the resume they are currently viewing, or their default resume."),
});

export type AgentGetResumeInput = z.infer<typeof AgentGetResumeSchema>;

// Same one-optional-field shape as AgentGetResumeSchema, and never an id: the
// model names a resume the way the user did, and the server resolves it
// ownership-scoped.
export const AgentReviewResumeSchema = z.object({
  resumeTitle: z.string().optional().describe("The title of the resume to review, as the user referred to it. Omit this entirely if the user did not name one — the app then uses the resume they are currently viewing, or their default resume."),
});

export type AgentReviewResumeInput = z.infer<typeof AgentReviewResumeSchema>;

// No job field of any kind: match_job scores the job the user is viewing, and
// the id comes from server-held page context. An id-shaped input would be an
// IDOR surface the model could be talked into filling.
export const AgentMatchJobSchema = z.object({
  resumeTitle: z.string().optional().describe("The title of the resume to match against, as the user referred to it. Omit this entirely if the user did not name one — the app then uses the resume linked to the job, or their default resume."),
});

export type AgentMatchJobInput = z.infer<typeof AgentMatchJobSchema>;

// No job field of any kind, for the same reason AgentMatchJobSchema has none:
// the letter is written for the job the user is viewing, and the id comes from
// server-held page context.
export const AgentCoverLetterSchema = z.object({
  resumeTitle: z.string().optional().describe("The title of the resume the letter should draw on, as the user referred to it. Omit this entirely if the user did not name one — the app then uses the resume linked to the job, or their default resume."),
});

export type AgentCoverLetterInput = z.infer<typeof AgentCoverLetterSchema>;
