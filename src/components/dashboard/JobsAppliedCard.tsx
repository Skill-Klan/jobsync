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

export default function JobsAppliedCard() {
  const router = useRouter();
  const t = useTranslations("dashboard");
  return (
    <Card className="@lg:col-span-2 min-w-0 flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-green-600">{t("title")}</CardTitle>
        <CardDescription className="max-w-lg text-balance leading-relaxed">
          {t("quickActions.description")}
        </CardDescription>
      </CardHeader>
      <CardFooter className="mt-auto grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="justify-start min-w-0"
          onClick={() => router.push("/dashboard/myjobs?add-job=true")}
        >
          <BriefcaseBusiness className="h-3.5 w-3.5 mr-1 shrink-0" />
          <span className="min-w-0 truncate">{t("quickActions.addJob")}</span>
        </Button>
        <Button
          variant="outline"
          className="justify-start min-w-0"
          onClick={() =>
            router.push("/dashboard/automations?add-automation=true")
          }
        >
          <Zap className="h-3.5 w-3.5 mr-1 shrink-0" />
          <span className="min-w-0 truncate">{t("quickActions.addAutomation")}</span>
        </Button>
        <Button
          variant="outline"
          className="justify-start min-w-0"
          onClick={() => router.push("/dashboard/tasks?add-task=true")}
        >
          <SquareCheckBig className="h-3.5 w-3.5 mr-1 shrink-0" />
          <span className="min-w-0 truncate">{t("quickActions.addTask")}</span>
        </Button>
        <Button
          variant="outline"
          className="justify-start min-w-0"
          onClick={() =>
            router.push("/dashboard/questions?add-question=true")
          }
        >
          <BookOpen className="h-3.5 w-3.5 mr-1 shrink-0" />
          <span className="min-w-0 truncate">{t("quickActions.addQuestion")}</span>
        </Button>
        <Button
          variant="outline"
          className="justify-start min-w-0"
          onClick={() =>
            router.push("/dashboard/activities?add-activity=true")
          }
        >
          <CalendarClock className="h-3.5 w-3.5 mr-1 shrink-0" />
          <span className="min-w-0 truncate">{t("quickActions.addActivity")}</span>
        </Button>
        <AddContactShortcut />
      </CardFooter>
    </Card>
  );
}
