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
  SquareCheckBig,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import AddContactShortcut from "./AddContactShortcut";
import { useTranslations } from "@/i18n/client";
import { useFeatures } from "@/context/FeaturesContext";
import { cn } from "@/lib/utils";
import {
  QUICK_ACTION_BUTTON,
  QUICK_ACTION_LABEL,
  QUICK_ACTIONS_GRID,
} from "./quickActionStyles";

// The line above the buttons names only the ones that are shown.
function descriptionKey(automations: boolean, activities: boolean) {
  if (automations) {
    return activities
      ? "quickActions.description"
      : "quickActions.descriptionWithoutActivities";
  }
  return activities
    ? "quickActions.descriptionWithoutAutomations"
    : "quickActions.descriptionWithoutAutomationsAndActivities";
}

export default function JobsAppliedCard() {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const { activities, automations } = useFeatures();
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
          {t(descriptionKey(automations, activities))}
        </CardDescription>
      </CardHeader>
      <CardFooter className={QUICK_ACTIONS_GRID}>
        <Button
          variant="outline"
          className={QUICK_ACTION_BUTTON}
          onClick={() => router.push("/dashboard/myjobs?add-job=true")}
        >
          <BriefcaseBusiness className="h-3.5 w-3.5 shrink-0" />
          <span className={QUICK_ACTION_LABEL}>{t("quickActions.addJob")}</span>
        </Button>
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
        <Button
          variant="outline"
          className={QUICK_ACTION_BUTTON}
          onClick={() => router.push("/dashboard/tasks?add-task=true")}
        >
          <SquareCheckBig className="h-3.5 w-3.5 shrink-0" />
          <span className={QUICK_ACTION_LABEL}>{t("quickActions.addTask")}</span>
        </Button>
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
        <AddContactShortcut />
      </CardFooter>
    </Card>
  );
}
