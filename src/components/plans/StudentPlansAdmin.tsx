"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assignStudentPlan, type PlanStudent } from "@/actions/plan.actions";
import { useTranslations } from "@/i18n/client";
import { toastError, toastSuccess } from "@/lib/toast";

// «Плани студентів»: who has which plan, and a button to give one. The admin's
// own page — the role is checked again on the server when a plan is given.
export default function StudentPlansAdmin({
  students,
  tracks,
}: {
  students: PlanStudent[];
  tracks: { track: string; title: string }[];
}) {
  const t = useTranslations("plans");
  const [held, setHeld] = useState(() => new Map(students.map((s) => [s.id, s.tracks])));
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const give = (studentId: string, track: string) => {
    setPending(`${studentId}:${track}`);
    startTransition(async () => {
      const result = await assignStudentPlan(studentId, track).catch(() => null);
      setPending(null);
      if (result?.success) {
        setHeld((prev) => new Map(prev).set(studentId, [...(prev.get(studentId) ?? []), track]));
        toastSuccess(t("admin.assigned"));
      } else {
        toastError(result?.message);
      }
    });
  };

  const shown = students.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()));
  const titleOf = (track: string) => tracks.find((x) => x.track === track)?.title ?? track;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("admin.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.description")}</p>
      </div>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("admin.searchPlaceholder")}
        aria-label={t("admin.searchLabel")}
        className="max-w-sm"
      />
      {students.length === 0 ? (
        <p className="text-muted-foreground">{t("admin.noStudents")}</p>
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground">{t("admin.noMatch")}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {shown.map((student) => {
            const mine = held.get(student.id) ?? [];
            return (
              <li key={student.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <div className="font-medium">{student.name || t("admin.unnamed")}</div>
                  <div className="text-sm text-muted-foreground">
                    {student.cabinetUserId !== null && `${t("admin.cabinetId", { id: student.cabinetUserId })} · `}
                    {mine.length === 0 ? t("admin.noPlans") : mine.map((track) => t("admin.has", { track: titleOf(track) })).join(", ")}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tracks
                    .filter((x) => !mine.includes(x.track))
                    .map((x) => (
                      <Button
                        key={x.track}
                        type="button"
                        size="sm"
                        disabled={pending !== null}
                        onClick={() => give(student.id, x.track)}
                      >
                        {t("admin.assign", { track: x.title })}
                      </Button>
                    ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
