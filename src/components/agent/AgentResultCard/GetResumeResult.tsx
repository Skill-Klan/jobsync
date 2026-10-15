"use client";

import { NoResumesNotice } from "@/components/agent/AgentResultCard/NoResumesNotice";
import { ResumeSelectionPrompt } from "@/components/agent/AgentResultCard/ResumeSelectionPrompt";
import type { AgentGetResumeResult } from "@/models/agent.model";
import { useTranslations } from "@/i18n/client";

const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;

// The resume text itself is never rendered: the user is about to read the
// review, not the serialization, and the card would be a wall of text.
export function GetResumeResult({ output }: { output: AgentGetResumeResult }) {
  const t = useTranslations("agent.results");
  if (output.status === "no_resumes") {
    return <NoResumesNotice />;
  }

  if (output.status === "unreadable") {
    return (
      <p className="text-sm">
        {t.rich("couldNotRead", { title: output.title, reason: output.reason, strong })}
      </p>
    );
  }

  if (output.status === "needs_selection") {
    return <ResumeSelectionPrompt prompt={t("whichResume")} resumes={output.resumes} />;
  }

  const read =
    output.source === "default"
      ? "getResume.readDefault"
      : output.source === "page"
        ? "getResume.readPage"
        : "getResume.read";
  const details = [
    t("getResume.characters", { chars: output.chars }),
    output.truncated && t("getResume.truncated"),
    output.ambiguousTitle && t("getResume.ambiguous"),
  ].filter(Boolean);

  return (
    <div className="text-sm">
      <p>{t.rich(read, { title: output.title, strong })}</p>
      <p className="mt-1 text-xs text-muted-foreground">{details.join(" · ")}</p>
    </div>
  );
}
