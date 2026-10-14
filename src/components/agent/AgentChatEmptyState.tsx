"use client";

import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { useAgentChat } from "@/components/agent/AgentChatProvider";
import { AGENT_ADD_JOB_INTRO } from "@/lib/agent/prompt";
import { useTranslations } from "@/i18n/client";

// None need editing first, so they act on click. "Review resume" runs a real
// turn. "Match a job" and "Generate cover letter" have no page context here,
// so the tools reply with a graceful "no_job" result telling the user to open
// a job's page first. ADD_JOB is the one whose answer is knowable without the
// model — see AGENT_ADD_JOB_INTRO.
// `text` is what a click sends, as the user's message, to the model; the
// language the model is spoken to in is the prompts' decision (D31), so it
// stays as it was. Only the label on the button is translated.
const ADD_JOB = "Add a job posting";
const EXAMPLES = [
  { label: "addJob", text: ADD_JOB },
  { label: "reviewResume", text: "Review resume" },
  { label: "matchJob", text: "Match a job" },
  { label: "coverLetter", text: "Generate cover letter" },
] as const;

export function AgentChatEmptyState() {
  const t = useTranslations("agent.emptyState");
  const { sendMessage, seedExchange, preflight } = useAgentChat();

  const handleClick = (example: string) => {
    if (!preflight.ok) return;
    if (example === ADD_JOB) {
      seedExchange(example, AGENT_ADD_JOB_INTRO);
      return;
    }
    void sendMessage({ parts: [{ type: "text", text: example }] });
  };

  return (
    <div className="flex flex-1 flex-col justify-end gap-4 p-4">
      {/* Stated up front rather than left to the model to confess: a local 8B
          asked what it can do will happily invent capabilities. */}
      <p className="text-sm text-muted-foreground">{t("intro")}</p>

      <Suggestions>
        {EXAMPLES.map((example) => (
          <Suggestion
            disabled={!preflight.ok}
            key={example.text}
            onClick={handleClick}
            suggestion={example.text}
          >
            {t(example.label)}
          </Suggestion>
        ))}
      </Suggestions>
    </div>
  );
}
