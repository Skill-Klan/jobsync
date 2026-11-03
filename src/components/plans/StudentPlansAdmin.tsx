"use client";

import { useState, useTransition } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { assignStudentPlan, removeStudentPlan, type PlanStudent } from "@/actions/plan.actions";
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
  const [removing, setRemoving] = useState<{ student: PlanStudent; track: string } | null>(null);
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

  const takeBack = (studentId: string, track: string) => {
    setRemoving(null);
    setPending(`${studentId}:${track}`);
    startTransition(async () => {
      const result = await removeStudentPlan(studentId, track).catch(() => null);
      setPending(null);
      if (result?.success) {
        setHeld((prev) => new Map(prev).set(studentId, (prev.get(studentId) ?? []).filter((x) => x !== track)));
        toastSuccess(t("admin.removed"));
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
                  {mine.map((track) => (
                    <Button
                      key={track}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending !== null}
                      aria-label={t("admin.removeLabel", { track: titleOf(track), name: student.name || t("admin.unnamed") })}
                      onClick={() => setRemoving({ student, track })}
                    >
                      {t("admin.remove")}
                    </Button>
                  ))}
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
      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{removing && t("admin.removeTitle", { track: titleOf(removing.track) })}</AlertDialogTitle>
            <AlertDialogDescription>
              {removing &&
                t("admin.removeLoss", {
                  done: removing.student.plans.find((p) => p.track === removing.track)?.done ?? 0,
                  notes: removing.student.plans.find((p) => p.track === removing.track)?.notes ?? 0,
                })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("student.noteCancel")}</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => removing && takeBack(removing.student.id, removing.track)}
            >
              {t("admin.removeConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
