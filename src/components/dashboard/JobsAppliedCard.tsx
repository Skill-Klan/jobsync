"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BookOpen,
  BriefcaseBusiness,
  CalendarClock,
  GraduationCap,
  List,
  MessagesSquare,
  SquareCheckBig,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import AddContactShortcut from "./AddContactShortcut";
import { useFormatter, useTranslations } from "@/i18n/client";
import { useFeatures } from "@/context/FeaturesContext";
import { cn } from "@/lib/utils";
import {
  QUICK_ACTION_BUTTON,
  QUICK_ACTION_LABEL,
  QUICK_ACTIONS_GRID,
} from "./quickActionStyles";

// The line above the buttons names only the ones that are shown, as a list in
// the user's language.
function shownItems(flags: { automations: boolean; activities: boolean; tasks: boolean; questions: boolean; contacts: boolean }) {
  return [
    "jobs",
    flags.automations && "automations",
    flags.tasks && "tasks",
    flags.activities && "activities",
    flags.questions && "questions",
    flags.contacts && "contacts",
  ].filter((item): item is string => typeof item === "string");
}

// A button with a hint on hover and on keyboard focus: what it is for.
function Hinted({ hint, children }: { hint: string; children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="max-w-xs">{hint}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function JobsAppliedCard() {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const format = useFormatter();
  const { activities, automations, tasks, questions, contacts, plans } = useFeatures();
  const items = shownItems({ automations, activities, tasks, questions, contacts }).map((item) =>
    t(`quickActions.items.${item}` as Parameters<typeof t>[0]),
  );
  return (
    // Activities off: the hours card beside it is gone — take the whole row.
    <Card
      className={cn(
        "@container min-w-0 flex flex-col",
        activities ? "@lg:col-span-2" : "@lg:col-span-4",
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-green-600">{t("title")}</CardTitle>
        <CardDescription className="max-w-lg text-balance leading-relaxed">
          {t("quickActions.description", { items: format.list(items, { type: "conjunction" }) })}
        </CardDescription>
      </CardHeader>
      <CardFooter className={QUICK_ACTIONS_GRID}>
        {/* A hint on hover and on keyboard focus: what the button is for. */}
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className={QUICK_ACTION_BUTTON}
                onClick={() => router.push("/dashboard/myjobs?add-job=true")}
              >
                <BriefcaseBusiness className="h-3.5 w-3.5 shrink-0" />
                <span className={QUICK_ACTION_LABEL}>{t("quickActions.addJob")}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {t("quickActions.addJobHint")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {automations && (
          <Button
            variant="outline"
            className={QUICK_ACTION_BUTTON}
            onClick={() =>
              router.push("/dashboard/automations?add-automation=true")
            }
          >
            <Zap className="h-3.5 w-3.5 shrink-0" />
            <span className={QUICK_ACTION_LABEL}>{t("quickActions.addAutomation")}</span>
          </Button>
        )}
        {tasks && (
          <Button
            variant="outline"
            className={QUICK_ACTION_BUTTON}
            onClick={() => router.push("/dashboard/tasks?add-task=true")}
          >
            <SquareCheckBig className="h-3.5 w-3.5 shrink-0" />
            <span className={QUICK_ACTION_LABEL}>{t("quickActions.addTask")}</span>
          </Button>
        )}
        {questions && (
          <Button
            variant="outline"
            className={QUICK_ACTION_BUTTON}
            onClick={() =>
              router.push("/dashboard/questions?add-question=true")
            }
          >
            <BookOpen className="h-3.5 w-3.5 shrink-0" />
            <span className={QUICK_ACTION_LABEL}>{t("quickActions.addQuestion")}</span>
          </Button>
        )}
        {activities && (
          <Button
            variant="outline"
            className={QUICK_ACTION_BUTTON}
            onClick={() =>
              router.push("/dashboard/activities?add-activity=true")
            }
          >
            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
            <span className={QUICK_ACTION_LABEL}>{t("quickActions.addActivity")}</span>
          </Button>
        )}
        {contacts && <AddContactShortcut />}
      </CardFooter>
      {/* Where to go next: plain links, no creating. A switched-off area has none. */}
      <CardFooter className="flex-col items-stretch gap-2 pt-0">
        <p className="text-sm text-muted-foreground">{t("goTo.title")}</p>
        <div className={QUICK_ACTIONS_GRID.replace("mt-auto ", "")}>
          <Hinted hint={t("goTo.interviewsHint")}>
            <Button asChild variant="outline" className={QUICK_ACTION_BUTTON}>
              <Link href="/dashboard/interviews">
                <MessagesSquare className="h-3.5 w-3.5 shrink-0" />
                <span className={QUICK_ACTION_LABEL}>{t("goTo.interviews")}</span>
              </Link>
            </Button>
          </Hinted>
          <Hinted hint={t("goTo.jobBankHint")}>
            <Button asChild variant="outline" className={QUICK_ACTION_BUTTON}>
              <Link href="/dashboard/myjobs">
                <List className="h-3.5 w-3.5 shrink-0" />
                <span className={QUICK_ACTION_LABEL}>{t("goTo.jobBank")}</span>
              </Link>
            </Button>
          </Hinted>
          {plans && (
            <Hinted hint={t("goTo.planHint")}>
              <Button asChild variant="outline" className={QUICK_ACTION_BUTTON}>
                <Link href="/dashboard/plan">
                  <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                  <span className={QUICK_ACTION_LABEL}>{t("goTo.plan")}</span>
                </Link>
              </Button>
            </Hinted>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
