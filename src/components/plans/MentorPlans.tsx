"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { getEntryStudents, getStudentPlans } from "@/actions/plan.actions";
import type { MentorEntry, StudentPlans } from "@/skillklan/mentorPlans";
import type { Mentor, MentorStudent } from "@/skillklan/cabinetApi";
import { useTranslations } from "@/i18n/client";
import { cn } from "@/lib/utils";
import PlanView from "./PlanView";

// «Плани студентів» for the admin, the QA moderator and a mentor: pick a mentor
// (or «Без ментора», or «Мої студенти»), then a student, then look at their
// plan — view only (D92). The lists are the backend's answers for the signed-in
// person; a list that could not be loaded says so and shows nothing.

type Choice = { label: string; entry: MentorEntry };

export default function MentorPlans({
  mentors,
  me,
  canPick,
}: {
  // `null` — the list of mentors could not be loaded.
  mentors: Mentor[] | null;
  me: Mentor | null;
  canPick: boolean;
}) {
  const t = useTranslations("plans");
  const [entry, setEntry] = useState<Choice | null>(null);
  const [students, setStudents] = useState<MentorStudent[] | null>(null);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [plans, setPlans] = useState<StudentPlans | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const choices: Choice[] = [
    ...(me ? [{ label: t("mentor.mine"), entry: { kind: "mentor", mentorId: me.mentorId } as MentorEntry }] : []),
    ...(canPick
      ? [
          ...(mentors ?? [])
            .filter((m) => m.mentorId !== me?.mentorId)
            .map((m) => ({
              label: m.direction ? `${m.name} · ${m.direction}` : m.name,
              entry: { kind: "mentor", mentorId: m.mentorId } as MentorEntry,
            })),
          { label: t("mentor.noMentor"), entry: { kind: "none" } as MentorEntry },
        ]
      : []),
  ];

  const pick = (choice: Choice) => {
    setEntry(choice);
    setStudents(null);
    setStudentId(null);
    setPlans(null);
    setError(null);
    startTransition(async () => {
      const result = await getEntryStudents(choice.entry).catch(() => null);
      if (result?.success) setStudents(result.data.students);
      else setError(result?.message ?? t("mentor.listFailed"));
    });
  };

  const open = (student: MentorStudent) => {
    if (!entry) return;
    setStudentId(student.userId);
    setPlans(null);
    setError(null);
    startTransition(async () => {
      const result = await getStudentPlans(entry.entry, student.userId).catch(() => null);
      if (result?.success) setPlans(result.data);
      else setError(result?.message ?? t("mentor.studentNotAvailable"));
    });
  };

  const nameOf = (s: MentorStudent) => s.name || t("mentor.noName", { id: s.userId });

  return (
    <section className="space-y-4" aria-label={t("mentor.title")}>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("mentor.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("mentor.intro")}</p>
      </div>

      {canPick && mentors === null && (
        <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
          {t("mentor.mentorsFailed")}
        </p>
      )}
      {canPick && mentors !== null && mentors.length === 0 && !me && (
        <p className="text-sm text-muted-foreground">{t("mentor.noMentors")}</p>
      )}

      <div role="group" aria-label={t("mentor.title")} className="flex flex-wrap gap-2">
        {choices.map((choice) => (
          <Button
            key={choice.entry.kind === "none" ? "none" : choice.entry.mentorId}
            type="button"
            variant={entry === choice ? "default" : "outline"}
            size="sm"
            aria-pressed={entry === choice}
            onClick={() => pick(choice)}
          >
            {choice.label}
          </Button>
        ))}
      </div>

      {!entry && <p className="text-sm text-muted-foreground">{t(canPick ? "mentor.pickEntry" : "mentor.pickMine")}</p>}
      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {entry && pending && !students && <p className="text-sm text-muted-foreground">{t("mentor.loading")}</p>}

      {students && (
        <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
          <div className="space-y-2">
            <h2 className="text-sm font-medium">{t("mentor.students")}</h2>
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("mentor.noStudents")}</p>
            ) : (
              <ul className="space-y-1">
                {students.map((s) => (
                  <li key={s.userId}>
                    <button
                      type="button"
                      onClick={() => open(s)}
                      aria-pressed={studentId === s.userId}
                      className={cn(
                        "w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted",
                        studentId === s.userId && "border-primary bg-muted",
                      )}
                    >
                      {nameOf(s)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            {studentId === null && students.length > 0 && (
              <p className="text-sm text-muted-foreground">{t("mentor.pickStudent")}</p>
            )}
            {studentId !== null && pending && !plans && <p className="text-sm text-muted-foreground">{t("mentor.loading")}</p>}
            {plans && !plans.hasAccount && <p className="text-sm text-muted-foreground">{t("mentor.noAccount")}</p>}
            {plans && plans.hasAccount && plans.plans.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("mentor.noPlans")}</p>
            )}
            {plans && plans.plans.length > 0 && (
              <PlanView
                key={studentId}
                plans={plans.plans}
                readOnly
                title={t("mentor.viewOnly", { name: plans.name || t("mentor.noName", { id: studentId ?? 0 }) })}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
