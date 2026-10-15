"use client";

import { AgentMatchContent } from "@/components/agent/AgentMatchContent";
import { NoResumesNotice } from "@/components/agent/AgentResultCard/NoResumesNotice";
import { ResumeSelectionPrompt } from "@/components/agent/AgentResultCard/ResumeSelectionPrompt";
import type { AgentMatchJobResult } from "@/models/agent.model";
import { useTranslations } from "@/i18n/client";

const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;

// The score and body come from the tool output, not from parsed prose — the
// match is a server-side generation, so the card cannot disagree with what
// was saved.
export function MatchJobResult({ output }: { output: AgentMatchJobResult }) {
  const t = useTranslations("agent.results");
  if (output.status === "no_job") {
    return <p className="text-sm">{t("matchJob.noJob")}</p>;
  }

  if (output.status === "no_resumes") {
    return <NoResumesNotice />;
  }

  if (output.status === "needs_selection") {
    return (
      <ResumeSelectionPrompt
        prompt={t("matchJob.whichResume")}
        resumes={output.resumes}
        // Sent to the model as the user's message (D31: left as it was).
        messageFor={(title) => `Match this job against my resume "${title}"`}
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
        {t.rich("matchJob.couldNotMatch", {
          title: output.jobTitle,
          reason: output.reason,
          strong,
        })}
      </p>
    );
  }

  return (
    <div className="text-sm">
      <AgentMatchContent body={output.body} scores={output.scores} />
      <p className="mt-2 text-xs text-muted-foreground">
        {output.company
          ? t("matchJob.footerAt", {
              title: output.jobTitle,
              company: output.company,
              resume: output.resumeTitle,
            })
          : t("matchJob.footer", { title: output.jobTitle, resume: output.resumeTitle })}
      </p>
      {!output.saved && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t("matchJob.notSaved", { error: output.saveError ?? "" })}
        </p>
      )}
    </div>
  );
}
