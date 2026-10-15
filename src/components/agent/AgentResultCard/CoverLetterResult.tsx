"use client";

import Link from "next/link";
import { AgentMarkdown } from "@/components/agent/AgentMarkdown";
import { NoResumesNotice } from "@/components/agent/AgentResultCard/NoResumesNotice";
import { ResumeSelectionPrompt } from "@/components/agent/AgentResultCard/ResumeSelectionPrompt";
import type { AgentCoverLetterResult } from "@/models/agent.model";
import { useTranslations } from "@/i18n/client";

const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;

// The letter comes from the tool output, not from the streamed text: the
// stream is a progress indicator and the output is what was saved.
export function CoverLetterResult({ output }: { output: AgentCoverLetterResult }) {
  const t = useTranslations("agent.results");
  if (output.status === "no_job") {
    return <p className="text-sm">{t("coverLetter.noJob")}</p>;
  }

  if (output.status === "no_description") {
    return (
      <p className="text-sm">
        {t.rich("coverLetter.noDescription", { title: output.jobTitle, strong })}
      </p>
    );
  }

  if (output.status === "no_resumes") {
    return <NoResumesNotice />;
  }

  if (output.status === "needs_selection") {
    return (
      <ResumeSelectionPrompt
        prompt={t("coverLetter.whichResume")}
        resumes={output.resumes}
        // Sent to the model as the user's message (D31: left as it was).
        messageFor={(title) =>
          `Write a cover letter for this job using my resume "${title}"`
        }
      />
    );
  }

  if (output.status === "unreadable") {
    return (
      <p className="text-sm">
        {t.rich("couldNotRead", { title: output.title, reason: output.reason, strong })}
      </p>
    );
  }

  if (output.status === "generation_failed") {
    return (
      <p className="text-sm">
        {t.rich("coverLetter.couldNotWrite", {
          title: output.jobTitle,
          reason: output.reason,
          strong,
        })}
      </p>
    );
  }

  return (
    <div className="text-sm">
      <AgentMarkdown text={output.body} />
      <p className="mt-2 text-xs text-muted-foreground">
        {output.company
          ? t("coverLetter.footerAt", {
              title: output.jobTitle,
              company: output.company,
              resume: output.resumeTitle,
            })
          : t("coverLetter.footer", { title: output.jobTitle, resume: output.resumeTitle })}
      </p>
      {output.saved ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {t.rich("coverLetter.saved", {
            title: output.coverLetterTitle ?? "",
            link: (chunks) => (
              <Link href="/dashboard/profile" className="underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          {t("coverLetter.notSaved", { error: output.saveError ?? "" })}
        </p>
      )}
    </div>
  );
}
