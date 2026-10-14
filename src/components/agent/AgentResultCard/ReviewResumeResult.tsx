"use client";

import { AgentReviewContent } from "@/components/agent/AgentReviewContent";
import { NoResumesNotice } from "@/components/agent/AgentResultCard/NoResumesNotice";
import { ResumeSelectionPrompt } from "@/components/agent/AgentResultCard/ResumeSelectionPrompt";
import type { AgentReviewResumeResult } from "@/models/agent.model";
import { useTranslations } from "@/i18n/client";

// The scores and body come from the tool output, not from parsed prose — the
// review is a server-side generation now, so the card cannot disagree with
// what was saved.
export function ReviewResumeResult({ output }: { output: AgentReviewResumeResult }) {
  const t = useTranslations("agent.results");
  if (output.status === "no_resumes") {
    return <NoResumesNotice />;
  }

  if (output.status === "needs_selection") {
    return <ResumeSelectionPrompt prompt={t("whichResume")} resumes={output.resumes} />;
  }

  if (output.status === "unreadable" || output.status === "generation_failed") {
    return (
      <p className="text-sm">
        {t.rich("reviewResume.couldNotReview", {
          title: output.title,
          reason: output.reason,
          strong: (chunks) => <strong>{chunks}</strong>,
        })}
      </p>
    );
  }

  return (
    <div className="text-sm">
      <AgentReviewContent body={output.body} scores={output.scores} />
      {!output.saved && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("reviewResume.notSaved", { error: output.saveError ?? "" })}
        </p>
      )}
    </div>
  );
}
