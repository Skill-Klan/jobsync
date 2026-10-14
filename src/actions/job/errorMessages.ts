// Not a "use server" module: a helper for the job, stage, note and cover
// letter actions, so it must not become a callable server-action endpoint.
import { getTranslations } from "@/i18n/server";
import type { Messages } from "@/i18n/messages";

// Messages with arguments are formatted at their call site with getTranslations.
type WithArguments =
  | "stageLinksInterviewers"
  | "stageLinksQuestions"
  | "stageLinksBoth"
  | "stageStillLinked"
  | "notInterviewStage"
  | "unknownOutcome";

type JobsErrorKey = Exclude<keyof Messages["jobs"]["errors"], WithArguments>;

/**
 * A failure message the person sees (handleError puts it in the toast), in
 * their language.
 */
export async function jobsError(key: JobsErrorKey): Promise<string> {
  const t = await getTranslations("jobs");
  return (t as unknown as (key: string) => string)(`errors.${key}`);
}
