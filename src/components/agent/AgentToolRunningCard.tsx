"use client";

import { getToolName, type ToolUIPart } from "ai";
import { AgentStatusRow } from "@/components/agent/AgentStatusRow";
import { useTranslations } from "@/i18n/client";

const LABELS = {
  add_job: "addJob",
  get_resume: "getResume",
  review_resume: "reviewResume",
  match_job: "matchJob",
  generate_cover_letter: "coverLetter",
} as const;

// Confirmation renders null for these states, so this is not redundant with
// it. On a local 8B, deciding on a tool call is the longest phase of a turn.
export function AgentToolRunningCard({ part }: { part: ToolUIPart }) {
  const t = useTranslations("agent.running");
  const toolName = getToolName(part);
  const label = Object.prototype.hasOwnProperty.call(LABELS, toolName)
    ? t(LABELS[toolName as keyof typeof LABELS])
    : t("other");

  return <AgentStatusRow label={label} />;
}
