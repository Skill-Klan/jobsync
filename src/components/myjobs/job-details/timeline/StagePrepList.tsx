"use client";
import { useState, useTransition } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TipTapContentViewer } from "@/components/TipTapContentViewer";
import { toastActionResult } from "@/lib/toast";
import {
  removeStagePrepQuestion,
  setPrepQuestionAsked,
} from "@/actions/jobStage.actions";
import type { JobStage } from "@/models/jobStage.model";
import { askedTally } from "./stageDisplay";
import { useTranslations } from "@/i18n/client";

type StagePrepListProps = {
  stage: JobStage;
  onAddPrepQuestions: () => void;
  onChanged: () => void;
};

// An untouched answer is still QuestionForm's "TBD" default, which the Tiptap
// editor may have wrapped in markup by the time it is saved.
function hasAnswer(answer: string | null): boolean {
  const text = (answer ?? "").replace(/<[^>]*>/g, "").trim().toLowerCase();
  return text.length > 0 && text !== "tbd";
}

export function StagePrepList({
  stage,
  onAddPrepQuestions,
  onChanged,
}: StagePrepListProps) {
  const t = useTranslations("jobs");
  const [, startTransition] = useTransition();
  // Optimistic so the checkbox never lags the click; the reload below is what
  // makes it durable.
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState(false);
  const rows = stage.prepQuestions ?? [];
  const { total } = askedTally(stage);
  const answerable = rows.filter((row) => hasAnswer(row.Question.answer));

  const toggle = (linkId: string, next: boolean) => {
    setPending((prev) => ({ ...prev, [linkId]: next }));
    startTransition(async () => {
      const res = await setPrepQuestionAsked(linkId, next);
      toastActionResult(res, {
        success: next
          ? t("prepList.markedAsked")
          : t("prepList.markedNotAsked"),
        onSuccess: onChanged,
      });
      // Rolled back only on failure: on success the reload lands on the same
      // value, so dropping it early would flash the old state.
      if (!res?.success) {
        setPending(({ [linkId]: _rolledBack, ...rest }) => rest);
      }
    });
  };

  const remove = (linkId: string) => {
    startTransition(async () => {
      const res = await removeStagePrepQuestion(linkId);
      toastActionResult(res, {
        success: t("prepList.removed"),
        onSuccess: onChanged,
      });
    });
  };

  const setOpen = (linkId: string, next: boolean) =>
    setExpanded((prev) => ({ ...prev, [linkId]: next }));

  const toggleAll = () => {
    const next = !allExpanded;
    setAllExpanded(next);
    setExpanded(
      next ? Object.fromEntries(answerable.map((row) => [row.id, true])) : {},
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {t("prepList.hint")}
        </p>
        <div className="flex items-center gap-2">
          {answerable.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 cursor-pointer gap-1 text-xs"
              onClick={toggleAll}
            >
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform",
                  allExpanded && "rotate-180",
                )}
              />
              {allExpanded ? t("prepList.collapseAll") : t("prepList.expandAll")}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 cursor-pointer gap-1"
            onClick={onAddPrepQuestions}
          >
            <Plus className="h-3 w-3" />
            {t("prepList.addQuestions")}
          </Button>
        </div>
      </div>

      {total === 0 ? (
        <p className="mt-2.5 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          {t("prepList.empty")}
        </p>
      ) : (
        <ul className="mt-2.5 overflow-hidden rounded-lg border">
          {rows.map((row, index) => {
            const isAsked = pending[row.id] ?? row.asked;
            const answered = hasAnswer(row.Question.answer);
            const isOpen = answered && (expanded[row.id] ?? false);
            const text = (
              <>
                <span
                  className={cn(
                    "block text-[13px]",
                    !isAsked && "text-muted-foreground",
                  )}
                >
                  {row.Question.question}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {row.Question.tags?.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="secondary"
                      className="text-[11px]"
                    >
                      {tag.label}
                    </Badge>
                  ))}
                  {!answered && (
                    <span className="text-[11px] italic text-muted-foreground">
                      {t("prepList.noAnswer")}
                    </span>
                  )}
                </span>
              </>
            );
            return (
              <li
                key={row.id}
                className={cn(
                  "px-3.5 py-2.5",
                  index > 0 && "border-t",
                  isAsked && "bg-emerald-500/10",
                )}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-emerald-600"
                    checked={isAsked}
                    aria-label={t("prepList.markAsked", {
                      question: row.Question.question,
                    })}
                    onChange={(e) => toggle(row.id, e.target.checked)}
                  />
                  {/* The text expands the answer; only the checkbox marks asked. */}
                  {answered ? (
                    <button
                      type="button"
                      className="flex-1 cursor-pointer text-left"
                      aria-expanded={isOpen}
                      onClick={() => setOpen(row.id, !isOpen)}
                    >
                      {text}
                    </button>
                  ) : (
                    <div className="flex-1">{text}</div>
                  )}
                  {isAsked && (
                    <span className="shrink-0 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                      {t("prepList.asked")}
                    </span>
                  )}
                  {answered && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 cursor-pointer"
                      aria-expanded={isOpen}
                      aria-label={t(
                        isOpen ? "prepList.hideAnswer" : "prepList.showAnswer",
                        { question: row.Question.question },
                      )}
                      onClick={() => setOpen(row.id, !isOpen)}
                    >
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          isOpen && "rotate-180",
                        )}
                      />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 cursor-pointer"
                    aria-label={t("prepList.remove", {
                      question: row.Question.question,
                    })}
                    onClick={() => remove(row.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {isOpen && (
                  <div className="prose prose-sm dark:prose-invert mt-2.5 ml-6.5 max-w-none border-t pt-2.5 text-[13px] text-muted-foreground">
                    <TipTapContentViewer content={row.Question.answer!} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
