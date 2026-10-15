"use client";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  ExternalLink,
  MapPin,
  MoreVertical,
  Pencil,
  Phone,
  Video,
} from "lucide-react";
import { StatusBadge } from "../StatusBadge";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { TableCell, TableRow } from "../ui/table";
import {
  durationLabel,
  formatIconKind,
  formatText,
  interviewerSummary,
  outcomeLabel,
  outcomeColor,
  prepSummary,
  whenParts,
  type DisplayText,
} from "./interviewDisplay";
import { setStageOutcome } from "@/actions/jobStage.actions";
import { STAGE_OUTCOMES } from "@/lib/constants";
import { toastActionResult } from "@/lib/toast";
import type { InterviewRow as InterviewRowType } from "@/models/interview.model";
import { useFormatDate, useLabel, useTranslations } from "@/i18n/client";

const FORMAT_ICONS = { video: Video, phone: Phone, location: MapPin };

type InterviewRowProps = {
  interview: InterviewRowType;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onOutcomeSaved: () => void;
};

function InterviewRow({
  interview,
  expanded,
  onToggle,
  onEdit,
  onOutcomeSaved,
}: InterviewRowProps) {
  const t = useTranslations("interviews");
  const label = useLabel();
  const formatDate = useFormatDate();
  const text: DisplayText = {
    storedOutcome: (outcome) => label("stageOutcome", outcome),
    scheduled: label("stageOutcome", { value: "scheduled" }),
    awaitingOutcome: t("display.awaitingOutcome"),
    notScheduled: t("display.notScheduled"),
    notSet: t("display.notSet"),
    noDate: t("display.noDate"),
    noneLinked: t("display.noneLinked"),
    interviewers: (count) => t("display.interviewersCount", { count }),
    // Strings, not numbers: a duration is shown without digit grouping.
    hours: (hours) => t("display.hours", { hours: String(hours) }),
    minutes: (minutes) => t("display.minutes", { minutes: String(minutes) }),
    formatDate,
  };
  const when = whenParts(interview.occurredAt, text);
  // The badge colour is keyed on the English label; the badge shows ours.
  const outcomeColorKey = outcomeLabel(interview.occurredAt, interview.outcome);
  const outcome = outcomeLabel(
    interview.occurredAt,
    interview.outcome,
    undefined,
    text,
  );
  const FormatIcon = FORMAT_ICONS[formatIconKind(interview.format)];
  const duration = durationLabel(interview.durationMins, text);
  const title = interview.Job.JobTitle.label;

  const saveOutcome = async (value: string | null) => {
    const res = await setStageOutcome(interview.id, value);
    toastActionResult(res, {
      success: t("row.outcomeSaved"),
      onSuccess: () => onOutcomeSaved(),
    });
  };

  return (
    <>
      <TableRow>
        <TableCell className="w-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            aria-label={
              expanded
                ? t("row.collapse", { title })
                : t("row.expand", { title })
            }
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <div className="font-medium">{when.day}</div>
          {when.time && (
            <div className="text-xs text-muted-foreground">{when.time}</div>
          )}
        </TableCell>
        <TableCell className="max-w-[120px] md:max-w-[220px]">
          <Link
            href={`/dashboard/myjobs/${interview.Job.id}`}
            className="block truncate font-medium text-primary underline-offset-4 hover:underline"
          >
            {title}
          </Link>
          <div className="truncate text-xs text-muted-foreground">
            {interview.Job.Company.label}
          </div>
        </TableCell>
        <TableCell>
          <StatusBadge
            label={label("jobStage", interview.StageType)}
            color="violet"
            className="whitespace-nowrap"
          />
        </TableCell>
        <TableCell className="hidden md:table-cell whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <FormatIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{formatText(interview.format, interview.location, text)}</span>
          </div>
          {duration && (
            <div className="text-xs text-muted-foreground">{duration}</div>
          )}
        </TableCell>
        <TableCell className="hidden lg:table-cell">
          {interviewerSummary(interview.interviewers, text)}
        </TableCell>
        <TableCell className="hidden sm:table-cell">
          {prepSummary(interview.prepQuestions)}
        </TableCell>
        <TableCell>
          <StatusBadge
            label={outcome}
            color={outcomeColor(outcomeColorKey)}
            className="whitespace-nowrap"
          />
        </TableCell>
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-haspopup="true" size="icon" variant="ghost">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">{t("row.toggleMenu")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("row.actions")}</DropdownMenuLabel>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  {t("row.setOutcome")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {STAGE_OUTCOMES.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      className="cursor-pointer"
                      onClick={() => saveOutcome(option.value)}
                    >
                      {label("stageOutcome", option)}
                    </DropdownMenuItem>
                  ))}
                  {interview.outcome && (
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => saveOutcome(null)}
                    >
                      {t("row.clearOutcome")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem className="cursor-pointer" onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                {t("row.editRound")}
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link
                  href={`/dashboard/myjobs/${interview.Job.id}?tab=timeline`}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t("row.openTimeline")}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={9} className="bg-muted/40">
            <div className="grid gap-6 text-sm sm:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("row.interviewers", {
                      count: interview.interviewers.length,
                    })}
                  </div>
                  {interview.interviewers.length === 0 ? (
                    <p className="mt-1 text-muted-foreground">
                      {t("row.noInterviewers")}
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {interview.interviewers.map((link) => (
                        <li key={link.id}>
                          <div className="font-medium">
                            {link.Contact.name}
                            {link.Contact.title && (
                              <span className="font-normal text-muted-foreground">
                                {" · "}
                                {link.Contact.title}
                              </span>
                            )}
                          </div>
                          {link.Contact.email && (
                            <a
                              href={`mailto:${link.Contact.email}`}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              {link.Contact.email}
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {interview.notes && (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("row.notes")}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                      {interview.notes}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-baseline gap-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("row.prepQuestions", {
                      summary: prepSummary(interview.prepQuestions),
                    })}
                  </div>
                  {interview.prepQuestions.length > 0 && (
                    <Link
                      href={`/dashboard/questions?stage=${interview.id}`}
                      className="whitespace-nowrap text-xs text-primary underline-offset-4 hover:underline"
                    >
                      {t("row.viewAnswers")}
                    </Link>
                  )}
                </div>
                {interview.prepQuestions.length === 0 ? (
                  <p className="mt-1 text-muted-foreground">
                    {t("row.noPrep")}
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {interview.prepQuestions.map((link) => (
                      <li key={link.id} className="flex items-start gap-2">
                        {link.asked ? (
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                        ) : (
                          <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span
                          className={
                            link.asked ? "text-muted-foreground" : undefined
                          }
                        >
                          {link.Question.question}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default InterviewRow;
